import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";
import { lockMutableCaseEvidence } from "../documents/upload-document-policy";
import type { Prisma } from "../generated/prisma/client";
import {
  L2_OPS_QUEUE_SELECT,
  dataEntryBranchScope,
  loadL2QueueLookups,
  presentOpsClarificationItem,
  resolveActiveDataEntryUser,
} from "./clarification-l2-ops.helpers";
import {
  isSpocRmOnly,
  notifyL2HandoffPeerStakeholders,
} from "./clarification-l2-ops-notifications.helpers";
import type {
  OpsClarificationQueueQueryDto,
  OpsCompleteClarificationDto,
} from "./dto/l2-clarification.dto";

@Injectable()
export class ClarificationL2OpsService {
  constructor(private readonly prisma: PrismaService) {}

  async opsQueue(actor: Actor, query: OpsClarificationQueueQueryDto) {
    const limit = query.limit ?? 50;
    const search = query.search?.trim();
    const statusFilter =
      query.status === "ALL"
        ? { in: ["OPEN", "CANDIDATE_SUBMITTED", "DATA_ENTRY_PENDING", "RESOLVED"] }
        : query.status
          ? query.status
          : { in: ["CANDIDATE_SUBMITTED", "DATA_ENTRY_PENDING", "OPEN"] };

    const where: Prisma.ClarificationWhereInput = {
      tenantId: actor.tenantId,
      level: "L2",
      status: statusFilter,
      case: caseAccessScope(actor),
      ...(search
        ? {
            OR: [
              { subject: { contains: search } },
              { case: { caseNumber: { contains: search } } },
              { case: { subject: { fullName: { contains: search } } } },
              { case: { client: { displayName: { contains: search } } } },
            ],
          }
        : {}),
    };

    const [rows, dataEntryUsers] = await Promise.all([
      this.prisma.clarification.findMany({
        where,
        select: L2_OPS_QUEUE_SELECT,
        orderBy: [{ status: "asc" }, { updatedAt: "asc" }],
        take: limit,
      }),
      this.prisma.user.findMany({
        where: {
          tenantId: actor.tenantId,
          status: "ACTIVE",
          userRoles: { some: { role: { code: "DATA_ENTRY" } } },
          ...dataEntryBranchScope(actor),
        },
        select: { id: true, publicId: true, displayName: true, branchId: true },
        orderBy: { displayName: "asc" },
      }),
    ]);

    const { checksById, usersById } = await loadL2QueueLookups(
      this.prisma,
      rows,
      dataEntryUsers,
    );

    return {
      items: rows.map((row) =>
        presentOpsClarificationItem(row, checksById, usersById),
      ),
      dataEntryUsers: dataEntryUsers.map((u) => ({
        id: u.publicId,
        displayName: u.displayName,
      })),
    };
  }

  async completeOpsReview(
    actor: Actor,
    clarificationPublicId: string,
    input: OpsCompleteClarificationDto,
  ) {
    const clarification = await this.prisma.clarification.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: clarificationPublicId,
        case: caseAccessScope(actor),
      },
      select: {
        id: true,
        publicId: true,
        level: true,
        status: true,
        subject: true,
        submittedDocumentId: true,
        submittedDocumentVersion: true,
        raisedById: true,
        case: {
          select: {
            id: true,
            publicId: true,
            caseNumber: true,
            branchId: true,
            clientId: true,
            assignedOpsUserId: true,
            dataEntryUserId: true,
          },
        },
      },
    });
    if (!clarification) throw new NotFoundException("Clarification not found");
    if (clarification.level !== "L2") {
      throw new ConflictException(
        "Only L2 clarifications can be handed off to Data Entry",
      );
    }
    if (clarification.status !== "CANDIDATE_SUBMITTED") {
      throw new ConflictException(
        clarification.status === "DATA_ENTRY_PENDING"
          ? "Clarification is already handed off to Data Entry"
          : "Candidate must submit corrected evidence before Operations handoff",
      );
    }
    if (
      clarification.submittedDocumentId == null ||
      clarification.submittedDocumentVersion == null
    ) {
      throw new ConflictException(
        "Submitted document version is missing on this clarification",
      );
    }

    const deUser = await resolveActiveDataEntryUser(
      this.prisma,
      actor,
      input.dataEntryUserId,
      clarification.case.dataEntryUserId,
    );
    const now = new Date();
    const note = input.note?.trim();

    return this.prisma.$transaction(async (tx) => {
      await lockMutableCaseEvidence(tx, clarification.case.id, true);
      const updated = await tx.clarification.updateMany({
        where: {
          id: clarification.id,
          tenantId: actor.tenantId,
          level: "L2",
          status: "CANDIDATE_SUBMITTED",
        },
        data: {
          status: "DATA_ENTRY_PENDING",
          opsReviewedById: actor.userId,
          opsReviewedAt: now,
          opsReviewNote: note ?? null,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          "Clarification changed or was already handed off; refresh and try again",
        );
      }
      if (clarification.case.dataEntryUserId !== deUser.id) {
        await tx.verificationCase.update({
          where: { id: clarification.case.id },
          data: {
            dataEntryUserId: deUser.id,
            dataEntryAssignedAt: now,
            version: { increment: 1 },
          },
        });
      }
      const actorPrefix = isSpocRmOnly(actor)
        ? `RM (${actor.displayName})`
        : "Operations";
      await tx.clarificationMessage.create({
        data: {
          clarificationId: clarification.id,
          senderUserId: actor.userId,
          senderType: "TEAM",
          body:
            note ??
            `${actorPrefix} verified submission v${clarification.submittedDocumentVersion} and handed off to Data Entry (${deUser.displayName}).`,
        },
      });
      await tx.notification.create({
        data: {
          tenantId: actor.tenantId,
          userId: deUser.id,
          type: "CLARIFICATION_DATA_ENTRY_PENDING",
          title: "L2 insufficiency re-entry assigned",
          body: `${clarification.case.caseNumber}: ${clarification.subject} (v${clarification.submittedDocumentVersion})`,
          href: `/data-entry?clarificationId=${clarification.publicId}`,
        },
      });
      await notifyL2HandoffPeerStakeholders(tx, actor, {
        casePublicId: clarification.case.publicId,
        caseNumber: clarification.case.caseNumber,
        branchId: clarification.case.branchId ?? null,
        clientId: clarification.case.clientId,
        assignedOpsUserId: clarification.case.assignedOpsUserId ?? null,
        raisedById: clarification.raisedById ?? null,
        subject: clarification.subject,
        submittedVersion: clarification.submittedDocumentVersion!,
        deDisplayName: deUser.displayName,
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "clarification.l2-ops-completed",
          resourceType: "clarification",
          resourcePublicId: clarification.publicId,
          afterJson: JSON.stringify({
            status: "DATA_ENTRY_PENDING",
            actorRoles: actor.roles,
            dataEntryUserId: deUser.publicId,
            submittedDocumentVersion: clarification.submittedDocumentVersion,
            opsReviewedAt: now,
          }),
        },
      });
      return {
        id: clarification.publicId,
        status: "DATA_ENTRY_PENDING" as const,
        opsReviewedAt: now,
        dataEntryUser: { id: deUser.publicId, displayName: deUser.displayName },
      };
    });
  }
}
