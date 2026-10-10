import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { SubjectPiiService } from "../common/security/subject-pii.service";
import { PrismaService } from "../database/prisma.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import { INTERNAL_KEYS, reportItems } from "./report-annexures";
import { caseColour } from "../verification/dispositions";
import type { ReportData } from "./report-data";
import { ReportPdfService } from "./report-pdf.service";
import { loadProofBytes } from "./report-proofs";
import {
  entriesOf,
  reportApprovalSelect,
  reportBodyFor,
} from "./report-snapshot";

export type PreviewAudience = "client" | "internal";

/** Whole-case copies: Operations and QA see either copy; RM and Data Entry the client copy. */
const FULL_INTERNAL = ["PLATFORM_ADMIN", "OPS_MANAGER", "QA_REVIEWER"];
const FULL_CLIENT = [...FULL_INTERNAL, "SPOC_RM", "DATA_ENTRY"];

const INTERNAL_LABELS: Record<string, string> = {
  extraCost: "Extra cost (₹)",
  extraCostApproval: "Extra cost approval",
  challanReference: "Payment / challan reference",
};

/** Report header details the RM or Data Entry can still change before approval. */
const EDITABLE = [
  "DRAFT",
  "CONSENT_PENDING",
  "DOCUMENT_PENDING",
  "IN_PROGRESS",
  "CLARIFICATION_PENDING",
  "QA_REVIEW",
  "MANAGER_REVIEW",
];

/**
 * Live report preview at every stage, built from the same code as the approved report.
 * The client copy is exactly what the client will receive (marked Draft until approval);
 * the internal copy adds who verified each check, the team, sources and costs. A Team
 * Leader or verifier sees only the checks of its own team or tasks. Every view is audited.
 */
@Injectable()
export class ReportPreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalObjectStorageService,
    private readonly pdf: ReportPdfService,
    private readonly pii: SubjectPiiService,
  ) {}

  /** What this person may open: the whole case, or only its own checks. */
  private scopeFor(actor: Actor, audience: PreviewAudience) {
    const roles = audience === "internal" ? FULL_INTERNAL : FULL_CLIENT;
    if (actor.roles.some((role) => roles.includes(role)))
      return "case" as const;
    if (actor.roles.includes("VERIFIER")) return "own-checks" as const;
    throw new ForbiddenException(
      audience === "internal"
        ? "The internal copy is for Operations, QA and Team Leaders"
        : "You cannot open this report",
    );
  }

  /** The report data for this person and copy, from the case's current state. */
  private async build(
    actor: Actor,
    casePublicId: string,
    audience: PreviewAudience,
  ) {
    const scope = this.scopeFor(actor, audience);
    const row = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId: casePublicId },
      select: reportApprovalSelect,
    });
    if (!row) throw new NotFoundException("Case not found");
    const body = reportBodyFor(row, this.pii);
    let checks = body.checks;
    if (scope === "own-checks") {
      const led = (actor.departments ?? [])
        .filter((department) => department.role === "LEAD")
        .map((department) => department.id);
      const own = await this.prisma.caseCheck.findMany({
        where: {
          caseId: row.id,
          OR: [
            { departmentId: { in: led.length ? led : [-1n] } },
            { tasks: { some: { assigneeId: actor.userId } } },
          ],
        },
        select: { publicId: true },
      });
      const ids = new Set(own.map((check) => check.publicId));
      checks = checks.filter((check) => check.id && ids.has(check.id));
      if (!checks.length)
        throw new NotFoundException("No checks of yours are on this case");
    }
    if (audience === "internal") {
      const names = await this.verifierNames(row);
      checks = checks.map((check) => {
        const source = row.checks.find((item) => item.publicId === check.id);
        if (!source) return check;
        const by = source.verifiedById ?? source.tasks[0]?.completedById;
        const notes = entriesOf(source.verifiedJson).flatMap((entry) =>
          Object.entries(entry)
            .filter(([key, value]) => INTERNAL_KEYS.has(key) && value)
            .map(([key, value]): [string, string] => [
              INTERNAL_LABELS[key] ?? key,
              value,
            ]),
        );
        return {
          ...check,
          internal: {
            team: source.department?.name ?? null,
            verifiedBy: by ? (names.get(by) ?? null) : null,
            verifiedAt: source.verifiedAt?.toISOString() ?? null,
            notes,
          },
        };
      });
    } else
      checks = checks.map((check) => ({
        ...check,
        verified: check.verified?.map((entry) =>
          Object.fromEntries(
            Object.entries(entry).filter(([key]) => !INTERNAL_KEYS.has(key)),
          ),
        ),
      }));
    const data: ReportData = {
      ...body,
      checks,
      audience,
      draft: true,
      generatedAt: new Date(),
      authenticityCode: "DRAFT",
      completedAt: null,
    };
    return { data, row, scope };
  }

  /**
   * The same report as structured data for the on-screen view (QA review, RM final
   * review): summary rows, annexure blocks and proof file references, no file bytes.
   */
  async view(actor: Actor, casePublicId: string, audience: PreviewAudience) {
    const { data, row, scope } = await this.build(
      actor,
      casePublicId,
      audience,
    );
    const items = reportItems(data);
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "report.preview-viewed",
        resourceType: "case",
        resourcePublicId: casePublicId,
        afterJson: JSON.stringify({
          caseNumber: row.caseNumber,
          audience,
          scope,
          format: "screen",
          checks: data.checks.length,
        }),
      },
    });
    return {
      caseNumber: data.caseNumber,
      candidateName: data.candidateName,
      clientName: data.clientName,
      audience,
      generatedAt: data.generatedAt,
      header: data.header ?? {},
      details: (data.identityDetails ?? []).filter(
        ([name]) => !/^employee (code|reference)$/i.test(name),
      ),
      overall: caseColour(data.checks),
      pendingChecks: data.checks.filter((check) => !check.result).length,
      items: items.map((item) => ({
        checkId: item.checkId ?? null,
        label: item.label,
        detail: item.detail,
        status: item.status,
        disposition: item.disposition,
        pending: item.pending,
        annexure: item.annexure,
        annexureTitle: item.annexureTitle,
        blocks: item.blocks,
        proofAnnexure: item.proofAnnexure ?? null,
        proofTitle: item.proofTitle,
        proofs: item.proofs.map((proof) => ({
          id: proof.id,
          name: proof.name,
          contentType: proof.contentType,
          caption: proof.caption,
        })),
      })),
      internal:
        audience === "internal"
          ? data.checks.map((check) => ({
              checkId: check.id ?? null,
              type: check.type,
              ...(check.internal ?? {}),
            }))
          : [],
      documents: (data.evidence ?? []).map((item) => ({
        type: item.type,
        name: item.name,
      })),
    };
  }

  async render(actor: Actor, casePublicId: string, audience: PreviewAudience) {
    const { data, row, scope } = await this.build(
      actor,
      casePublicId,
      audience,
    );
    const checks = data.checks;
    const pdf = await this.pdf.render(data, {
      proofs: await loadProofBytes(
        this.prisma,
        this.storage,
        actor.tenantId,
        data,
      ),
    });
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "report.preview-viewed",
        resourceType: "case",
        resourcePublicId: casePublicId,
        afterJson: JSON.stringify({
          caseNumber: row.caseNumber,
          audience,
          scope,
          checks: checks.length,
        }),
      },
    });
    return new StreamableFile(pdf, {
      type: "application/pdf",
      disposition: `inline; filename="Sapling-Global-${audience === "internal" ? "internal-" : ""}draft-${row.caseNumber}.pdf"`,
    });
  }

  private async verifierNames(row: {
    checks: Array<{
      verifiedById: bigint | null;
      tasks: Array<{ completedById: bigint | null }>;
    }>;
  }) {
    const ids = [
      ...new Set(
        row.checks.flatMap((check) =>
          [check.verifiedById, check.tasks[0]?.completedById].filter(
            (id): id is bigint => typeof id === "bigint",
          ),
        ),
      ),
    ];
    if (!ids.length) return new Map<bigint, string>();
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true },
    });
    return new Map(users.map((user) => [user.id, user.displayName]));
  }

  private canEditDetails(
    actor: Actor,
    row: {
      status: string;
      assignedOpsUserId: bigint | null;
      dataEntryUserId: bigint | null;
    },
  ) {
    if (!EDITABLE.includes(row.status)) return false;
    if (
      actor.roles.some((role) =>
        ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role),
      )
    )
      return true;
    if (
      actor.roles.includes("SPOC_RM") &&
      row.assignedOpsUserId === actor.userId
    )
      return true;
    return (
      actor.roles.includes("DATA_ENTRY") && row.dataEntryUserId === actor.userId
    );
  }

  private async detailsRow(actor: Actor, casePublicId: string) {
    const row = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId: casePublicId },
      select: {
        id: true,
        status: true,
        externalRef: true,
        joiningDate: true,
        assignedOpsUserId: true,
        dataEntryUserId: true,
      },
    });
    if (!row) throw new NotFoundException("Case not found");
    return row;
  }

  /** Report header fields: date of joining and client process / reference. */
  async details(actor: Actor, casePublicId: string) {
    const row = await this.detailsRow(actor, casePublicId);
    return {
      joiningDate: row.joiningDate?.toISOString().slice(0, 10) ?? null,
      clientProcess: row.externalRef,
      canEdit: this.canEditDetails(actor, row),
    };
  }

  async updateDetails(
    actor: Actor,
    casePublicId: string,
    input: { joiningDate?: string | null; clientProcess?: string | null },
  ) {
    const row = await this.detailsRow(actor, casePublicId);
    if (!this.canEditDetails(actor, row))
      throw new ForbiddenException(
        "Only Operations, the case RM or its Data Entry can change report details before approval",
      );
    const joining =
      input.joiningDate === undefined
        ? undefined
        : input.joiningDate
          ? new Date(`${input.joiningDate}T00:00:00Z`)
          : null;
    if (joining && !Number.isFinite(joining.getTime()))
      throw new BadRequestException("Date of joining is not valid");
    const process =
      input.clientProcess === undefined
        ? undefined
        : input.clientProcess?.trim().slice(0, 80) || null;
    const before = {
      joiningDate: row.joiningDate?.toISOString().slice(0, 10) ?? null,
      clientProcess: row.externalRef,
    };
    await this.prisma.$transaction(async (tx) => {
      // Header fields only: the case version (used by workflow actions) is left alone.
      await tx.verificationCase.update({
        where: { id: row.id },
        data: {
          ...(joining !== undefined ? { joiningDate: joining } : {}),
          ...(process !== undefined ? { externalRef: process } : {}),
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "case.report-details-updated",
          resourceType: "case",
          resourcePublicId: casePublicId,
          beforeJson: JSON.stringify(before),
          afterJson: JSON.stringify({
            joiningDate:
              joining === undefined
                ? before.joiningDate
                : (joining?.toISOString().slice(0, 10) ?? null),
            clientProcess:
              process === undefined ? before.clientProcess : process,
          }),
        },
      });
    });
    return this.details(actor, casePublicId);
  }
}
