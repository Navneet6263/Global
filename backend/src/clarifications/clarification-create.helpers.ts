import { randomBytes } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import { notifyClarificationStakeholders } from "../common/persistence/clarification-recipients";
import type { PrismaService } from "../database/prisma.service";
import { lockMutableCaseEvidence } from "../documents/upload-document-policy";
import {
  assertNoDuplicateActiveL2Clarification,
  resolveRequestedDocumentType,
} from "./clarification-case-resume.helpers";
import { digestClarificationToken } from "./clarification-token.service";
import type { CreateClarificationDto } from "./dto/create-clarification.dto";
import {
  sendInsufficiencyNotice,
  type InsufficiencyDeps,
} from "./insufficiency-notice";

export async function createClarificationRecord(
  prisma: PrismaService,
  actor: Actor,
  verificationCase: {
    id: bigint;
    publicId?: string;
    caseNumber?: string;
    branchId?: bigint | null;
    clientId?: bigint;
    assignedOpsUserId?: bigint | null;
    status: string;
    intakeStage: string | null;
  },
  check: { id: bigint; type: string; reviewCycle: number } | null,
  input: CreateClarificationDto,
  options: {
    level: "L1" | "L2";
    intakeCorrection: boolean;
    noticeDeps?: InsufficiencyDeps;
  },
) {
  const portalToken = randomBytes(32).toString("base64url");
  const tokenExpiresAt = new Date(Date.now() + 7 * 86_400_000);
  const clarification = await prisma.$transaction(async (tx) => {
    await lockMutableCaseEvidence(tx, verificationCase.id, true);
    const currentCheck = check
      ? await tx.caseCheck.findUniqueOrThrow({
          where: { id: check.id },
          select: { type: true, reviewCycle: true },
        })
      : null;
    const requestedDocumentType = await resolveRequestedDocumentType(
      tx,
      verificationCase.id,
      currentCheck?.type ?? null,
      input.requestedDocumentType,
    );
    if (options.level === "L2") {
      await assertNoDuplicateActiveL2Clarification(tx, {
        caseId: verificationCase.id,
        checkId: check?.id ?? null,
        requestedDocumentType,
      });
    }
    const created = await tx.clarification.create({
      data: {
        tenantId: actor.tenantId,
        caseId: verificationCase.id,
        checkId: check?.id,
        checkCycle: currentCheck?.reviewCycle,
        subject: input.subject.trim(),
        level: options.level,
        requestedDocumentType,
        raisedById: actor.userId,
        ...(options.intakeCorrection ? { reverificationRequired: false } : {}),
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        responseTokenHash: digestClarificationToken(portalToken),
        responseTokenExpiresAt: tokenExpiresAt,
        messages: {
          create: {
            senderUserId: actor.userId,
            senderType: "TEAM",
            body: input.message.trim(),
          },
        },
      },
      select: {
        publicId: true,
        status: true,
        level: true,
        requestedDocumentType: true,
        subject: true,
        dueAt: true,
        createdAt: true,
      },
    });
    if (
      options.intakeCorrection &&
      verificationCase.intakeStage === "DATA_ENTRY"
    ) {
      await tx.verificationCase.update({
        where: { id: verificationCase.id },
        data: { intakeStage: "CORRECTION", version: { increment: 1 } },
      });
    }
    if (["IN_PROGRESS", "QA_REVIEW"].includes(verificationCase.status)) {
      await tx.verificationCase.update({
        where: { id: verificationCase.id },
        data: {
          status: "CLARIFICATION_PENDING",
          qaReviewerId: null,
          qaClaimedAt: null,
          version: { increment: 1 },
        },
      });
      await tx.caseStatusHistory.create({
        data: {
          caseId: verificationCase.id,
          fromStatus: verificationCase.status,
          toStatus: "CLARIFICATION_PENDING",
          changedById: actor.userId,
          reason: input.subject,
        },
      });
    }
    const notice = options.noticeDeps
      ? await sendInsufficiencyNotice(tx, options.noticeDeps, {
          tenantId: actor.tenantId,
          caseId: verificationCase.id,
          actorUserId: actor.userId,
          subject: input.subject.trim(),
          message: input.message.trim(),
          level: options.level,
        })
      : null;
    if (verificationCase.clientId != null && verificationCase.caseNumber) {
      await notifyClarificationStakeholders(tx, {
        tenantId: actor.tenantId,
        branchId: verificationCase.branchId ?? null,
        clientId: verificationCase.clientId,
        assignedUserId: verificationCase.assignedOpsUserId ?? null,
        excludeUserId: actor.userId,
        type: "CLARIFICATION_RAISED",
        title:
          options.level === "L2"
            ? "L2 insufficiency raised"
            : "Clarification raised",
        body: `${verificationCase.caseNumber}: ${created.subject}`,
        opsHref: "/operations/clarifications",
        rmHref: "/spoc-rm/work?bucket=correction",
      });
    }
    await tx.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "clarification.created",
        resourceType: "clarification",
        resourcePublicId: created.publicId,
        afterJson: JSON.stringify({
          level: options.level,
          requestedDocumentType,
          subject: created.subject,
          ...(notice ? { notified: notice } : {}),
        }),
      },
    });
    return created;
  });
  return {
    id: clarification.publicId,
    status: clarification.status,
    level: clarification.level,
    requestedDocumentType: clarification.requestedDocumentType,
    subject: clarification.subject,
    dueAt: clarification.dueAt,
    createdAt: clarification.createdAt,
    portalToken,
    tokenExpiresAt,
  };
}
