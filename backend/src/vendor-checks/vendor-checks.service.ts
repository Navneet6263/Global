import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import type { Prisma } from "../generated/prisma/client";
import { verifiedFormFor } from "../verification/verified-fields";
import { INITIATION_FORMS } from "../workflow/initiation-fields";
import { documentScope } from "../verification/check-documents";
import {
  LIVE_VENDOR_STATUSES,
  VENDOR_CHECK_STATUSES,
  defaultSharedTypes,
  exportColumns,
  parseJsonArray,
  parseSubmission,
  vendorText,
  type VendorCheckStatus,
} from "./vendor-check-rules";
import {
  boardSummary,
  toVendorRow,
  vendorCsv,
  vendorRowSelect,
} from "./vendor-check-view";

const OPEN_CASE = ["IN_PROGRESS", "CLARIFICATION_PENDING"];
const MANAGERS = ["PLATFORM_ADMIN", "OPS_MANAGER"];

export type AssignedAs = "OPERATIONS" | "RM" | "TEAM_LEADER";

type CheckForRights = {
  departmentId: bigint | null;
  case: { assignedOpsUserId: bigint | null };
  tasks: Array<{ assigneeId: bigint | null }>;
};

const ledIds = (actor: Actor) =>
  (actor.departments ?? [])
    .filter((department) => department.role === "LEAD")
    .map((department) => department.id);

/** Who may send this check to a vendor, and as what; a plain verifier may only look. */
export function assignAs(
  actor: Actor,
  check: CheckForRights,
): AssignedAs | null {
  if (actor.roles.some((role) => MANAGERS.includes(role))) return "OPERATIONS";
  if (
    actor.roles.includes("SPOC_RM") &&
    check.case.assignedOpsUserId === actor.userId
  )
    return "RM";
  if (check.departmentId !== null && ledIds(actor).includes(check.departmentId))
    return "TEAM_LEADER";
  return null;
}

/** The case RM (or Operations) approves a Team Leader's request. */
export function canApprove(actor: Actor, check: CheckForRights) {
  const as = assignAs(actor, check);
  return as === "OPERATIONS" || as === "RM";
}

/**
 * Whoever sent the job reviews the vendor's result: a Team Leader's job by the Team
 * Leader, an RM's job by the RM. Operations always can.
 */
export function canReview(
  actor: Actor,
  check: CheckForRights,
  row: { assignedAs: string | null },
) {
  const as = assignAs(actor, check);
  if (as === "OPERATIONS") return true;
  if (row.assignedAs === "TEAM_LEADER") return as === "TEAM_LEADER";
  if (row.assignedAs === "RM") return as === "RM";
  return as !== null;
}

const entriesOf = (json: string | null | undefined) => {
  try {
    const value = JSON.parse(json ?? "") as {
      entries?: Array<Record<string, string>>;
    };
    return Array.isArray(value.entries) ? value.entries : [];
  } catch {
    return [];
  }
};

export type BoardQuery = {
  status?: string;
  search?: string;
  overdue?: boolean;
};

/**
 * Internal side of vendor check work: Operations, the case RM or the department's Team
 * Leader sends a check to a vendor with the documents it may see (a Team Leader's
 * request waits for the RM's approval); whoever sent it reviews the vendor's result (approve copies it into the check's RHS; return
 * sends it back), and watches every vendor job on a board. Every step is audited.
 */
@Injectable()
export class VendorChecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalObjectStorageService,
  ) {}

  private async findCheck(
    actor: Actor,
    checkPublicId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const check = await db.caseCheck.findFirst({
      where: {
        publicId: checkPublicId,
        tenantId: actor.tenantId,
        case: caseAccessScope(actor),
      },
      select: {
        id: true,
        publicId: true,
        type: true,
        status: true,
        departmentId: true,
        initiationJson: true,
        case: {
          select: {
            id: true,
            publicId: true,
            caseNumber: true,
            status: true,
            clientId: true,
            assignedOpsUserId: true,
            client: { select: { displayName: true } },
            subject: { select: { fullName: true } },
          },
        },
        tasks: {
          where: { status: { not: "COMPLETED" } },
          select: { assigneeId: true },
        },
      },
    });
    if (!check) throw new NotFoundException("Check not found");
    return check;
  }

  /** Everything the "Vendor" tab of a check needs. */
  async forCheck(actor: Actor, checkPublicId: string) {
    const check = await this.findCheck(actor, checkPublicId);
    const [vendors, documents, attempts] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          tenantId: actor.tenantId,
          status: "ACTIVE",
          vendorOwnerId: null,
          userRoles: { some: { role: { code: "VENDOR" } } },
        },
        orderBy: { displayName: "asc" },
        take: 200,
        select: { publicId: true, displayName: true },
      }),
      this.prisma.document.findMany({
        where: {
          caseId: check.case.id,
          status: { not: "REJECTED" },
          ...documentScope(actor),
        },
        orderBy: { createdAt: "desc" },
        select: {
          publicId: true,
          type: true,
          versions: {
            where: { malwareState: "CLEAN" },
            orderBy: { version: "desc" },
            take: 1,
            select: { originalName: true, version: true },
          },
        },
      }),
      this.prisma.vendorCheckAssignment.findMany({
        where: { checkId: check.id },
        orderBy: { attempt: "desc" },
        select: {
          ...vendorRowSelect,
          submissionJson: true,
          evidence: {
            orderBy: { id: "asc" },
            select: {
              publicId: true,
              originalName: true,
              contentType: true,
              sizeBytes: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);
    const defaults = defaultSharedTypes(check.type);
    const live = attempts.find((attempt) =>
      LIVE_VENDOR_STATUSES.includes(attempt.status as VendorCheckStatus),
    );
    const as = assignAs(actor, check);
    const canManage = as !== null;
    return {
      checkId: check.publicId,
      checkType: check.type,
      canManage,
      assignAs: as,
      /** A Team Leader must give the RM a reason; the RM approves before the vendor sees it. */
      needsApproval: as === "TEAM_LEADER",
      canAssign:
        canManage &&
        !live &&
        check.status !== "COMPLETED" &&
        OPEN_CASE.includes(check.case.status),
      vendors: canManage
        ? vendors.map((vendor) => ({
            id: vendor.publicId,
            name: vendor.displayName,
          }))
        : [],
      documents: documents.flatMap((document) =>
        document.versions.map((version) => ({
          id: document.publicId,
          type: document.type,
          name: version.originalName,
          suggested: defaults.includes(document.type),
        })),
      ),
      rhsForm: verifiedFormFor(check.type),
      attempts: attempts.map((attempt) => ({
        ...toVendorRow(attempt),
        canApprove:
          attempt.status === "PENDING_APPROVAL" && canApprove(actor, check),
        canReview:
          attempt.status === "SUBMITTED" && canReview(actor, check, attempt),
        canCancel:
          LIVE_VENDOR_STATUSES.includes(attempt.status as VendorCheckStatus) &&
          canReview(actor, check, attempt),
        submission: parseSubmission(attempt.submissionJson),
        evidence: attempt.evidence.map((file) => ({
          id: file.publicId,
          name: file.originalName,
          contentType: file.contentType,
          sizeBytes: file.sizeBytes,
          uploadedAt: file.createdAt,
        })),
      })),
    };
  }

  async assign(
    actor: Actor,
    checkPublicId: string,
    input: {
      vendorId: string;
      dueAt?: string;
      note?: string;
      reason?: string;
      documentIds: string[];
    },
    now = new Date(),
  ) {
    const note = input.note?.trim() || null;
    const dueAt = input.dueAt ? new Date(input.dueAt) : null;
    if (
      dueAt &&
      (!Number.isFinite(dueAt.getTime()) ||
        dueAt <= now ||
        dueAt.getTime() > now.getTime() + 90 * 86_400_000)
    )
      throw new BadRequestException("Choose a due date in the next 90 days");
    return this.prisma.$transaction(
      async (tx) => {
        const check = await this.findCheck(actor, checkPublicId, tx);
        const as = assignAs(actor, check);
        if (!as)
          throw new ForbiddenException(
            "Only the case RM, the Team Leader or Operations can send a check to a vendor",
          );
        const pending = as === "TEAM_LEADER";
        const reason = pending
          ? vendorText(input.reason, "Reason for the RM", 10)
          : null;
        if (check.status === "COMPLETED")
          throw new ConflictException("This check is already completed");
        if (!OPEN_CASE.includes(check.case.status))
          throw new ConflictException(
            "Route the case to verification before sending a check to a vendor",
          );
        const attempts = await tx.vendorCheckAssignment.findMany({
          where: { checkId: check.id },
          select: { attempt: true, status: true },
        });
        if (
          attempts.some((attempt) =>
            LIVE_VENDOR_STATUSES.includes(attempt.status as VendorCheckStatus),
          )
        )
          throw new ConflictException(
            "This check is already with a vendor; cancel that first",
          );
        const vendor = await tx.user.findFirst({
          where: {
            tenantId: actor.tenantId,
            publicId: input.vendorId,
            status: "ACTIVE",
            vendorOwnerId: null,
            userRoles: { some: { role: { code: "VENDOR" } } },
          },
          select: { id: true, publicId: true, displayName: true },
        });
        if (!vendor) throw new NotFoundException("Active vendor not found");
        const documentIds = [...new Set(input.documentIds)];
        const documents = documentIds.length
          ? await tx.document.findMany({
              where: {
                caseId: check.case.id,
                publicId: { in: documentIds },
                status: { not: "REJECTED" },
                versions: { some: { malwareState: "CLEAN" } },
                ...documentScope(actor),
              },
              select: { publicId: true, type: true },
            })
          : [];
        if (documents.length !== documentIds.length)
          throw new BadRequestException(
            "Share only clean documents of this case",
          );
        const attempt =
          attempts.reduce((max, row) => Math.max(max, row.attempt), 0) + 1;
        const created = await tx.vendorCheckAssignment.create({
          data: {
            tenantId: actor.tenantId,
            clientId: check.case.clientId,
            caseId: check.case.id,
            checkId: check.id,
            vendorUserId: vendor.id,
            assignedById: actor.userId,
            assignedAs: as,
            requestReason: reason,
            status: pending ? "PENDING_APPROVAL" : "ASSIGNED",
            attempt,
            dueAt,
            note,
            sharedDocumentsJson: JSON.stringify(documentIds),
          },
          select: { publicId: true },
        });
        if (pending) {
          if (check.case.assignedOpsUserId)
            await tx.notification.create({
              data: {
                tenantId: actor.tenantId,
                userId: check.case.assignedOpsUserId,
                type: "VENDOR_CHECK_APPROVAL",
                title: `Approve vendor: ${check.case.caseNumber}`,
                body: `Team Leader asks to send the ${check.type.replaceAll("_", " ").toLowerCase()} check to ${vendor.displayName}: ${reason}`,
                href: "/spoc-rm/vendor-work?status=PENDING_APPROVAL",
              },
            });
        } else
          await tx.notification.create({
            data: {
              tenantId: actor.tenantId,
              userId: vendor.id,
              type: "VENDOR_CHECK_ASSIGNED",
              title: `New check: ${check.type.replaceAll("_", " ").toLowerCase()}`,
              body: `${check.case.caseNumber} · ${check.case.client.displayName}${dueAt ? ` · due ${dueAt.toISOString().slice(0, 10)}` : ""}`,
              href: "/vendor/checks",
            },
          });
        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: pending
              ? "vendor_check.approval-requested"
              : "vendor_check.assigned",
            resourceType: "case",
            resourcePublicId: check.case.publicId,
            afterJson: JSON.stringify({
              assignmentId: created.publicId,
              checkId: check.publicId,
              checkType: check.type,
              attempt,
              vendorId: vendor.publicId,
              vendorName: vendor.displayName,
              dueAt,
              sharedDocuments: documents.map((document) => document.type),
              assignedAs: as,
              ...(reason ? { reason } : {}),
            }),
          },
        });
        return {
          id: created.publicId,
          attempt,
          status: pending ? "PENDING_APPROVAL" : "ASSIGNED",
        };
      },
      { isolationLevel: "Serializable" },
    );
  }

  private async loadAssignment(
    actor: Actor,
    assignmentPublicId: string,
    tx: Prisma.TransactionClient,
  ) {
    const row = await tx.vendorCheckAssignment.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: assignmentPublicId,
        case: caseAccessScope(actor),
      },
      select: {
        id: true,
        publicId: true,
        status: true,
        version: true,
        vendorUserId: true,
        handlerUserId: true,
        submissionJson: true,
        result: true,
        remarks: true,
        assignedAs: true,
        assignedById: true,
        dueAt: true,
        vendor: { select: { displayName: true } },
        check: { select: { publicId: true } },
      },
    });
    if (!row) throw new NotFoundException("Vendor job not found");
    const check = await this.findCheck(actor, row.check.publicId, tx);
    return { row, check };
  }

  /** Approve copies the vendor's verified details into the check; return sends it back. */
  async review(
    actor: Actor,
    assignmentPublicId: string,
    input: { decision: "APPROVE" | "RETURN"; note?: string; version: number },
    now = new Date(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { row, check } = await this.loadAssignment(
        actor,
        assignmentPublicId,
        tx,
      );
      if (!canReview(actor, check, row))
        throw new ForbiddenException(
          row.assignedAs === "TEAM_LEADER"
            ? "The Team Leader who sent this to the vendor reviews the result"
            : "The case RM reviews this vendor result",
        );
      if (row.status !== "SUBMITTED")
        throw new ConflictException("Only a submitted result can be reviewed");
      if (row.version !== input.version)
        throw new ConflictException("Changed meanwhile; refresh and try again");
      const note =
        input.decision === "RETURN"
          ? vendorText(input.note, "Return reason", 10)
          : input.note?.trim() || null;
      const changed = await tx.vendorCheckAssignment.updateMany({
        where: { id: row.id, status: "SUBMITTED", version: row.version },
        data: {
          status: input.decision === "APPROVE" ? "APPROVED" : "RETURNED",
          reviewNote: note,
          reviewedById: actor.userId,
          reviewedAt: now,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException("Changed meanwhile; refresh and try again");
      if (input.decision === "APPROVE") {
        await tx.caseCheck.update({
          where: { id: check.id },
          data: {
            verifiedJson: JSON.stringify({
              entries: parseSubmission(row.submissionJson),
            }),
            verifiedAt: now,
            verifiedById: actor.userId,
          },
        });
        const verifiers = check.tasks
          .map((task) => task.assigneeId)
          .filter((id): id is bigint => id !== null && id !== actor.userId);
        if (verifiers.length)
          await tx.notification.createMany({
            data: verifiers.map((userId) => ({
              tenantId: actor.tenantId,
              userId,
              type: "VENDOR_CHECK_APPROVED",
              title: `Vendor result approved: ${check.case.caseNumber}`,
              body: `The vendor's ${check.type.replaceAll("_", " ").toLowerCase()} result (${(row.result ?? "").replaceAll("_", " ").toLowerCase()}) is in Verified details. Complete the check.`,
              href: "/verifier/queue",
            })),
          });
      }
      await tx.notification.create({
        data: {
          tenantId: actor.tenantId,
          userId: row.handlerUserId ?? row.vendorUserId,
          type:
            input.decision === "APPROVE"
              ? "VENDOR_CHECK_APPROVED"
              : "VENDOR_CHECK_RETURNED",
          title:
            input.decision === "APPROVE"
              ? `Approved: ${check.case.caseNumber}`
              : `Returned for rework: ${check.case.caseNumber}`,
          body: note ?? "Your result was accepted.",
          href: "/vendor/checks",
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action:
            input.decision === "APPROVE"
              ? "vendor_check.approved"
              : "vendor_check.returned",
          resourceType: "case",
          resourcePublicId: check.case.publicId,
          afterJson: JSON.stringify({
            assignmentId: row.publicId,
            checkId: check.publicId,
            result: row.result,
            note,
          }),
        },
      });
      return {
        id: row.publicId,
        status: input.decision === "APPROVE" ? "APPROVED" : "RETURNED",
      };
    });
  }

  async cancel(actor: Actor, assignmentPublicId: string, reason: string) {
    const note = vendorText(reason, "Cancel reason", 10);
    return this.prisma.$transaction(async (tx) => {
      const { row, check } = await this.loadAssignment(
        actor,
        assignmentPublicId,
        tx,
      );
      if (!canReview(actor, check, row))
        throw new ForbiddenException(
          "Only whoever sent this job can withdraw it",
        );
      if (!LIVE_VENDOR_STATUSES.includes(row.status as VendorCheckStatus))
        throw new ConflictException("This vendor job is already closed");
      await tx.vendorCheckAssignment.update({
        where: { id: row.id },
        data: {
          status: "CANCELLED",
          reviewNote: note,
          reviewedById: actor.userId,
          reviewedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (row.status !== "PENDING_APPROVAL")
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: row.handlerUserId ?? row.vendorUserId,
            type: "VENDOR_CHECK_CANCELLED",
            title: `Withdrawn: ${check.case.caseNumber}`,
            body: note,
            href: "/vendor/checks",
          },
        });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "vendor_check.cancelled",
          resourceType: "case",
          resourcePublicId: check.case.publicId,
          afterJson: JSON.stringify({
            assignmentId: row.publicId,
            from: row.status,
            reason: note,
          }),
        },
      });
      return { id: row.publicId, status: "CANCELLED" };
    });
  }

  /** The case RM (or Operations) approves or turns down a Team Leader's request. */
  async decide(
    actor: Actor,
    assignmentPublicId: string,
    input: { decision: "APPROVE" | "REJECT"; note?: string; version: number },
    now = new Date(),
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { row, check } = await this.loadAssignment(
        actor,
        assignmentPublicId,
        tx,
      );
      if (!canApprove(actor, check))
        throw new ForbiddenException(
          "Only the case RM approves a Team Leader's vendor request",
        );
      if (row.status !== "PENDING_APPROVAL")
        throw new ConflictException("This request was already decided");
      if (row.version !== input.version)
        throw new ConflictException("Changed meanwhile; refresh and try again");
      const approve = input.decision === "APPROVE";
      const note = approve
        ? input.note?.trim() || null
        : vendorText(input.note, "Reason for turning it down", 10);
      const changed = await tx.vendorCheckAssignment.updateMany({
        where: { id: row.id, status: "PENDING_APPROVAL", version: row.version },
        data: {
          status: approve ? "ASSIGNED" : "REJECTED",
          approvedById: actor.userId,
          approvedAt: now,
          approvalNote: note,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException("Changed meanwhile; refresh and try again");
      if (approve)
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: row.vendorUserId,
            type: "VENDOR_CHECK_ASSIGNED",
            title: `New check: ${check.type.replaceAll("_", " ").toLowerCase()}`,
            body: `${check.case.caseNumber} · ${check.case.client.displayName}${row.dueAt ? ` · due ${row.dueAt.toISOString().slice(0, 10)}` : ""}`,
            href: "/vendor/checks",
          },
        });
      if (row.assignedById !== actor.userId)
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: row.assignedById,
            type: approve ? "VENDOR_CHECK_ASSIGNED" : "VENDOR_CHECK_CANCELLED",
            title: approve
              ? `RM approved: ${check.case.caseNumber} is with ${row.vendor.displayName}`
              : `RM turned down the vendor request: ${check.case.caseNumber}`,
            body: note ?? "You review the vendor's result when it comes back.",
            href: "/verifier/team",
          },
        });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: approve
            ? "vendor_check.request-approved"
            : "vendor_check.request-rejected",
          resourceType: "case",
          resourcePublicId: check.case.publicId,
          afterJson: JSON.stringify({
            assignmentId: row.publicId,
            checkId: check.publicId,
            note,
          }),
        },
      });
      return { id: row.publicId, status: approve ? "ASSIGNED" : "REJECTED" };
    });
  }

  private boardWhere(
    actor: Actor,
    query: BoardQuery,
    now: Date,
  ): Prisma.VendorCheckAssignmentWhereInput {
    const search = query.search?.trim();
    return {
      tenantId: actor.tenantId,
      case: {
        ...caseAccessScope(actor),
        ...(search
          ? {
              OR: [
                { caseNumber: { contains: search } },
                { subject: { fullName: { contains: search } } },
              ],
            }
          : {}),
      },
      ...(query.status &&
      (VENDOR_CHECK_STATUSES as readonly string[]).includes(query.status)
        ? { status: query.status }
        : {}),
      ...(query.overdue
        ? {
            status: { in: ["ASSIGNED", "IN_PROGRESS", "RETURNED"] },
            dueAt: { lt: now },
          }
        : {}),
    };
  }

  async board(actor: Actor, query: BoardQuery, now = new Date()) {
    const [rows, all] = await Promise.all([
      this.prisma.vendorCheckAssignment.findMany({
        where: this.boardWhere(actor, query, now),
        orderBy: [{ createdAt: "desc" }],
        take: 300,
        select: vendorRowSelect,
      }),
      this.prisma.vendorCheckAssignment.findMany({
        where: this.boardWhere(actor, {}, now),
        take: 5000,
        select: vendorRowSelect,
      }),
    ]);
    return {
      summary: boardSummary(all.map((row) => toVendorRow(row, now))),
      items: rows.map((row) => toVendorRow(row, now)),
    };
  }

  async export(
    actor: Actor,
    query: BoardQuery & { columns?: string },
    now = new Date(),
  ) {
    const rows = await this.prisma.vendorCheckAssignment.findMany({
      where: this.boardWhere(actor, query, now),
      orderBy: [{ createdAt: "desc" }],
      take: 5000,
      select: vendorRowSelect,
    });
    const columns = exportColumns(query.columns);
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "vendor_check.exported",
        resourceType: "vendor_check",
        resourcePublicId: "board",
        afterJson: JSON.stringify({ rows: rows.length, columns, ...query }),
      },
    });
    return new StreamableFile(
      Buffer.from(
        vendorCsv(
          rows.map((row) => toVendorRow(row, now)),
          columns,
        ),
      ),
      {
        type: "text/csv; charset=utf-8",
        disposition: `attachment; filename="Sapling-Global-vendor-work.csv"`,
      },
    );
  }

  /** Internal users open a vendor's proof file. */
  async evidence(actor: Actor, assignmentPublicId: string, fileId: string) {
    const file = await this.prisma.vendorCheckEvidence.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: fileId,
        assignment: {
          publicId: assignmentPublicId,
          case: caseAccessScope(actor),
        },
      },
      select: { objectKey: true, contentType: true, originalName: true },
    });
    if (!file) throw new NotFoundException("File not found");
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "vendor_check.evidence-viewed",
        resourceType: "vendor_check",
        resourcePublicId: assignmentPublicId,
        afterJson: JSON.stringify({ fileId }),
      },
    });
    return new StreamableFile(await this.storage.get(file.objectKey), {
      type: file.contentType,
      disposition: `inline; filename="vendor-proof.${file.contentType === "application/pdf" ? "pdf" : file.contentType === "image/png" ? "png" : "jpg"}"`,
    });
  }
}

/** LHS the vendor works from (only this check's initiation entries). */
export function vendorLhs(type: string, initiationJson: string | null) {
  return {
    form: INITIATION_FORMS[type.toUpperCase()] ?? null,
    entries: entriesOf(initiationJson),
  };
}

export { parseJsonArray };
