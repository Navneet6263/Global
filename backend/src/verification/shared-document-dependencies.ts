import type { Actor } from "../common/auth/actor";
import type { Prisma } from "../generated/prisma/client";
import { updateCaseRisk } from "./case-risk";
import { parseMethodEvidence } from "./method-evidence.policy";
import { restartCheckMethods } from "./restart-check-methods";

export interface DependentCheckMatch {
  id: bigint;
  publicId: string;
  type: string;
  status: string;
  result: string | null;
  riskLevel: string | null;
  sourceSummary: string | null;
  dueAt: Date | null;
  matchedVersions: Array<number | null>;
  latestTask?: {
    id: bigint;
    publicId: string;
    assigneeId: bigint | null;
    status: string;
  };
}

export async function findDependentChecksForDocumentVersion(
  tx: Prisma.TransactionClient,
  caseId: bigint,
  documentPublicId: string,
  promotedVersion: number,
  excludeCheckId?: bigint,
): Promise<DependentCheckMatch[]> {
  const checks = await tx.caseCheck.findMany({
    where: {
      caseId,
      ...(excludeCheckId ? { id: { not: excludeCheckId } } : {}),
      methodRuns: { some: { status: { not: "SUPERSEDED" } } },
    },
    select: {
      id: true,
      publicId: true,
      type: true,
      status: true,
      result: true,
      riskLevel: true,
      sourceSummary: true,
      dueAt: true,
      tasks: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, publicId: true, assigneeId: true, status: true },
      },
      methodRuns: {
        where: { status: { not: "SUPERSEDED" } },
        select: { evidenceJson: true },
      },
    },
  });

  const matches: DependentCheckMatch[] = [];
  for (const check of checks) {
    const matchedVersions: Array<number | null> = [];
    for (const run of check.methodRuns) {
      for (const entry of parseMethodEvidence(run.evidenceJson)) {
        if (
          entry.documentId === documentPublicId &&
          (entry.version === null || entry.version < promotedVersion)
        ) {
          matchedVersions.push(entry.version);
        }
      }
    }
    if (!matchedVersions.length) continue;
    matches.push({
      id: check.id,
      publicId: check.publicId,
      type: check.type,
      status: check.status,
      result: check.result,
      riskLevel: check.riskLevel,
      sourceSummary: check.sourceSummary,
      dueAt: check.dueAt,
      matchedVersions,
      latestTask: check.tasks[0],
    });
  }
  return matches;
}

export async function reopenDependentChecksForPromotedVersion(
  tx: Prisma.TransactionClient,
  actor: Actor,
  input: {
    tenantId: bigint;
    caseId: bigint;
    documentPublicId: string;
    documentType: string;
    promotedVersion: number;
    excludeCheckId?: bigint;
    reason: string;
  },
): Promise<Array<{ checkId: string; type: string; reopened: boolean }>> {
  const dependent = await findDependentChecksForDocumentVersion(
    tx,
    input.caseId,
    input.documentPublicId,
    input.promotedVersion,
    input.excludeCheckId,
  );
  if (!dependent.length) return [];

  const affected: Array<{ checkId: string; type: string; reopened: boolean }> =
    [];
  let riskDirty = false;
  for (const check of dependent) {
    await restartCheckMethods(tx, check.id, actor.userId);
    const wasCompleted = ["COMPLETED", "TL_REVIEW"].includes(check.status);
    if (wasCompleted) {
      riskDirty = true;
      const previous = check.latestTask;
      const assignee = previous?.assigneeId
        ? await tx.user.findFirst({
            where: {
              id: previous.assigneeId,
              tenantId: input.tenantId,
              status: "ACTIVE",
            },
            select: { id: true },
          })
        : null;
      await tx.caseCheck.update({
        where: { id: check.id },
        data: {
          status: assignee ? "ASSIGNED" : "PENDING",
          result: null,
          riskLevel: null,
          sourceSummary: null,
          completedAt: null,
          reviewCycle: { increment: 1 },
          version: { increment: 1 },
        },
      });
      const activeTask =
        previous &&
        ["OPEN", "UNASSIGNED", "IN_PROGRESS", "BLOCKED"].includes(
          previous.status,
        );
      const taskData = {
        tenantId: input.tenantId,
        checkId: check.id,
        assigneeId: assignee?.id,
        status: assignee ? "OPEN" : "UNASSIGNED",
        dueAt: check.dueAt,
        instructions:
          `Re-verify ${check.type.toLowerCase()} after shared ${input.documentType.replaceAll("_", " ").toLowerCase()} updated to v${input.promotedVersion}: ${input.reason}`.slice(
            0,
            1000,
          ),
      };
      if (activeTask) {
        await tx.checkTask.update({
          where: { id: previous.id },
          data: {
            ...taskData,
            assigneeId: assignee?.id ?? null,
            startedAt: null,
            completedAt: null,
            blockerReason: null,
            blockedAt: null,
            version: { increment: 1 },
          },
        });
      } else {
        await tx.checkTask.create({ data: taskData });
      }
      if (assignee) {
        await tx.notification.create({
          data: {
            tenantId: input.tenantId,
            userId: assignee.id,
            type: "CLARIFICATION_REVERIFICATION",
            title: "Shared document updated; re-verification required",
            body: `${input.documentType.replaceAll("_", " ")} updated to v${input.promotedVersion}.`,
            href: "/verifier",
          },
        });
      }
    }
    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: actor.userId,
        action: "check.shared-evidence-updated",
        resourceType: "check",
        resourcePublicId: check.publicId,
        beforeJson: JSON.stringify({
          status: check.status,
          result: check.result,
          riskLevel: check.riskLevel,
          sourceSummary: check.sourceSummary,
          pinnedVersions: check.matchedVersions,
        }),
        afterJson: JSON.stringify({
          documentId: input.documentPublicId,
          documentType: input.documentType,
          promotedVersion: input.promotedVersion,
          reopened: wasCompleted,
        }),
      },
    });
    affected.push({
      checkId: check.publicId,
      type: check.type,
      reopened: wasCompleted,
    });
  }
  if (riskDirty) {
    await updateCaseRisk(tx, input.caseId);
  }
  return affected;
}
