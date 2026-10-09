import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { SendBackDto, VersionedNoteDto } from "./dto/workflow.dto";
import { assertCaseOwner, assertVersion, trimNote } from "./workflow-access";

/** Statuses a client can ask Sapling to stop. Later stages are already finished work. */
export const STOPPABLE = [
  "CONSENT_PENDING",
  "DOCUMENT_PENDING",
  "IN_PROGRESS",
  "CLARIFICATION_PENDING",
  "QA_REVIEW",
];

/** STOP on client instruction and resume, by Operations or the case's RM. Fully audited. */
@Injectable()
export class CaseHoldService {
  constructor(private readonly prisma: PrismaService) {}

  async stop(actor: Actor, casePublicId: string, input: SendBackDto) {
    const current = await this.find(actor, casePublicId);
    assertCaseOwner(actor, current.assignedOpsUserId);
    assertVersion(current.version, input.version);
    if (!STOPPABLE.includes(current.status))
      throw new ConflictException(
        "Only a case that is still being worked can be stopped",
      );
    const reason = input.reason.trim();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.verificationCase.updateMany({
        where: {
          id: current.id,
          version: input.version,
          status: current.status,
        },
        data: {
          status: "STOPPED",
          stoppedFromStatus: current.status,
          stoppedAt: new Date(),
          stopReason: reason,
          qaReviewerId: null,
          qaClaimedAt: null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "Case changed since it was loaded; refresh and try again",
        );
      await tx.caseStatusHistory.create({
        data: {
          caseId: current.id,
          fromStatus: current.status,
          toStatus: "STOPPED",
          changedById: actor.userId,
          reason,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "case.stopped",
          resourceType: "case",
          resourcePublicId: casePublicId,
          beforeJson: JSON.stringify({
            status: current.status,
            version: current.version,
          }),
          afterJson: JSON.stringify({
            caseNumber: current.caseNumber,
            status: "STOPPED",
            reason,
          }),
        },
      });
      await this.notify(
        tx,
        actor,
        current,
        "CASE_STOPPED",
        "Verification stopped",
        `${current.caseNumber}: ${reason}`,
      );
    });
    return {
      id: casePublicId,
      status: "STOPPED",
      version: current.version + 1,
    };
  }

  async resume(actor: Actor, casePublicId: string, input: VersionedNoteDto) {
    const current = await this.find(actor, casePublicId);
    assertCaseOwner(actor, current.assignedOpsUserId);
    assertVersion(current.version, input.version);
    if (current.status !== "STOPPED" || !current.stoppedFromStatus)
      throw new ConflictException("This case is not stopped");
    const target = current.stoppedFromStatus;
    const note = trimNote(input.note);
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.verificationCase.updateMany({
        where: { id: current.id, version: input.version, status: "STOPPED" },
        data: {
          status: target,
          stoppedFromStatus: null,
          stoppedAt: null,
          stopReason: null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "Case changed since it was loaded; refresh and try again",
        );
      await tx.caseStatusHistory.create({
        data: {
          caseId: current.id,
          fromStatus: "STOPPED",
          toStatus: target,
          changedById: actor.userId,
          reason: note ?? "Verification resumed",
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "case.resumed",
          resourceType: "case",
          resourcePublicId: casePublicId,
          beforeJson: JSON.stringify({
            status: "STOPPED",
            stoppedAt: current.stoppedAt,
            reason: current.stopReason,
          }),
          afterJson: JSON.stringify({
            caseNumber: current.caseNumber,
            status: target,
            note,
          }),
        },
      });
      await this.notify(
        tx,
        actor,
        current,
        "CASE_RESUMED",
        "Verification resumed",
        `${current.caseNumber} is being worked again.`,
      );
    });
    return { id: casePublicId, status: target, version: current.version + 1 };
  }

  /** Notification matrix: STOP / resume reach the client admins and the responsible RM. */
  private async notify(
    tx: Pick<PrismaService, "user" | "notification">,
    actor: Actor,
    current: {
      publicId: string;
      clientId: bigint;
      assignedOpsUserId: bigint | null;
    },
    type: string,
    title: string,
    body: string,
  ) {
    const clientAdmins = await tx.user.findMany({
      where: {
        tenantId: actor.tenantId,
        clientId: current.clientId,
        status: "ACTIVE",
        userRoles: { some: { role: { code: "CLIENT_ADMIN" } } },
      },
      select: { id: true },
    });
    const recipients = [
      ...clientAdmins.map((user) => ({
        userId: user.id,
        href: "/client-portal",
      })),
      ...(current.assignedOpsUserId &&
      current.assignedOpsUserId !== actor.userId
        ? [
            {
              userId: current.assignedOpsUserId,
              href: `/spoc-rm/work?caseId=${current.publicId}`,
            },
          ]
        : []),
    ];
    if (recipients.length)
      await tx.notification.createMany({
        data: recipients.map((recipient) => ({
          tenantId: actor.tenantId,
          userId: recipient.userId,
          type,
          title,
          body,
          href: recipient.href,
        })),
      });
  }

  private async find(actor: Actor, publicId: string) {
    const row = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId },
      select: {
        id: true,
        publicId: true,
        caseNumber: true,
        status: true,
        version: true,
        clientId: true,
        assignedOpsUserId: true,
        stoppedFromStatus: true,
        stoppedAt: true,
        stopReason: true,
      },
    });
    if (!row) throw new NotFoundException("Case not found");
    return row;
  }
}
