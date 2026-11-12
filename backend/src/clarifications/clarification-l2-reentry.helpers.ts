import { ForbiddenException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import type { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { findDependentChecksForDocumentVersion } from "../verification/shared-document-dependencies";
import { INITIATION_FORMS } from "../workflow/initiation-fields";
import { isSupervisor, ledDepartmentIds } from "../workflow/workflow-access";

export function reentryCaseWhere(actor: Actor): Prisma.VerificationCaseWhereInput {
  const isPlatformAdmin = actor.roles.includes("PLATFORM_ADMIN");
  const supervisor = isSupervisor(actor);
  const leads = ledDepartmentIds(actor, "DATA_ENTRY");
  return {
    tenantId: actor.tenantId,
    ...(!isPlatformAdmin && actor.branchId
      ? supervisor
        ? { OR: [{ branchId: actor.branchId }, { branchId: null }] }
        : { branchId: actor.branchId }
      : {}),
    ...(!isPlatformAdmin && actor.clientId ? { clientId: actor.clientId } : {}),
    ...(!supervisor
      ? {
          OR: [
            { dataEntryUserId: actor.userId },
            { dataEntryUserId: null },
            ...(leads.length
              ? [
                  {
                    dataEntryUser: {
                      departmentMemberships: {
                        some: { departmentId: { in: leads } },
                      },
                    },
                  },
                ]
              : []),
          ],
        }
      : {}),
  };
}

export async function assertDataEntryClarificationAccess(
  prisma: PrismaService,
  actor: Actor,
  verificationCase: {
    branchId: bigint | null;
    clientId: bigint;
    dataEntryUserId: bigint | null;
  },
) {
  const isPlatformAdmin = actor.roles.includes("PLATFORM_ADMIN");
  const supervisor = isSupervisor(actor);
  if (!isPlatformAdmin) {
    if (actor.clientId && verificationCase.clientId !== actor.clientId) {
      throw new ForbiddenException("Case is outside your client scope");
    }
    if (
      actor.branchId &&
      verificationCase.branchId &&
      verificationCase.branchId !== actor.branchId
    ) {
      throw new ForbiddenException("Case is outside your branch scope");
    }
  }
  if (supervisor) return;
  if (!actor.roles.includes("DATA_ENTRY")) {
    throw new ForbiddenException("Only Data Entry or Operations can act here");
  }
  if (
    verificationCase.dataEntryUserId === null ||
    verificationCase.dataEntryUserId === actor.userId
  ) {
    return;
  }
  const leads = ledDepartmentIds(actor, "DATA_ENTRY");
  if (leads.length && typeof prisma.departmentMember?.findFirst === "function") {
    const member = await prisma.departmentMember.findFirst({
      where: {
        userId: verificationCase.dataEntryUserId,
        departmentId: { in: leads },
      },
      select: { userId: true },
    });
    if (member) return;
  }
  throw new ForbiddenException(
    "This clarification is assigned to another Data Entry member",
  );
}

export async function loadReentryCheckMap(
  prisma: PrismaService,
  checkIds: readonly bigint[],
) {
  if (!checkIds.length || typeof prisma.caseCheck?.findMany !== "function") {
    return new Map<
      bigint,
      {
        id: bigint;
        publicId: string;
        type: string;
        status: string;
        initiationJson: string | null;
        initiatedAt: Date | null;
      }
    >();
  }
  const checks = await prisma.caseCheck.findMany({
    where: { id: { in: [...checkIds] } },
    select: {
      id: true,
      publicId: true,
      type: true,
      status: true,
      initiationJson: true,
      initiatedAt: true,
    },
  });
  return new Map(checks.map((c) => [c.id, c]));
}

export async function formatReentryItem(
  prisma: PrismaService,
  row: {
    publicId: string;
    status: string;
    level: string | null;
    subject: string;
    caseId: bigint;
    checkId: bigint | null;
    requestedDocumentType: string | null;
    submittedDocumentVersion: number | null;
    opsReviewedAt: Date | null;
    opsReviewNote: string | null;
    rejectionCount: number;
    lastRejectedAt: Date | null;
    lastRejectedReason: string | null;
    dueAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    case: {
      publicId: string;
      caseNumber: string;
      status: string;
      workflowVersion: number;
      intakeStage: string | null;
      subject: { publicId: string; fullName: string };
      client: { publicId: string; displayName: string };
    };
    submittedDocument: {
      publicId: string;
      type: string;
      status: string;
      currentVersion: number;
      versions: Array<{
        version: number;
        originalName: string;
        contentType: string;
        sizeBytes: bigint;
        malwareState: string;
        reviewStatus: string;
        reviewNote: string | null;
        reviewedAt: Date | null;
        createdAt: Date;
      }>;
    } | null;
    messages: Array<{ senderType: string; body: string; createdAt: Date }>;
  },
  check?: {
    id: bigint;
    publicId: string;
    type: string;
    status: string;
    initiationJson: string | null;
    initiatedAt: Date | null;
  },
) {
  const dependentChecks =
    row.submittedDocument && row.submittedDocumentVersion != null
      ? await findDependentChecksForDocumentVersion(
          prisma,
          row.caseId,
          row.submittedDocument.publicId,
          row.submittedDocumentVersion,
          row.checkId ?? undefined,
        )
      : [];

  let entries: Array<Record<string, string>> = [];
  try {
    const parsed = JSON.parse(check?.initiationJson ?? "") as {
      entries?: Array<Record<string, string>>;
    };
    entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    entries = [];
  }

  return {
    id: row.publicId,
    status: row.status,
    level: row.level,
    subject: row.subject,
    requestedDocumentType: row.requestedDocumentType,
    submittedDocumentVersion: row.submittedDocumentVersion,
    opsReviewedAt: row.opsReviewedAt,
    opsReviewNote: row.opsReviewNote,
    rejectionCount: row.rejectionCount,
    lastRejectedAt: row.lastRejectedAt,
    lastRejectedReason: row.lastRejectedReason,
    dueAt: row.dueAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    case: {
      id: row.case.publicId,
      caseNumber: row.case.caseNumber,
      status: row.case.status,
      workflowVersion: row.case.workflowVersion,
      intakeStage: row.case.intakeStage,
      subjectName: row.case.subject.fullName,
      clientName: row.case.client.displayName,
    },
    check: check
      ? {
          id: check.publicId,
          type: check.type,
          status: check.status,
          initiatedAt: check.initiatedAt,
          entries,
          form: INITIATION_FORMS[check.type.toUpperCase()] ?? null,
        }
      : null,
    submittedDocument: row.submittedDocument
      ? {
          id: row.submittedDocument.publicId,
          type: row.submittedDocument.type,
          status: row.submittedDocument.status,
          currentVersion: row.submittedDocument.currentVersion,
          versions: row.submittedDocument.versions.map((v) => ({
            ...v,
            sizeBytes: v.sizeBytes.toString(),
            isSubmitted: v.version === row.submittedDocumentVersion,
          })),
        }
      : null,
    dependentChecks: {
      count: dependentChecks.length,
      items: dependentChecks.map((d) => ({
        checkId: d.publicId,
        checkType: d.type,
        status: d.status,
        willReopen: d.status === "COMPLETED" || d.status === "TL_REVIEW",
      })),
    },
    messages: row.messages,
  };
}
