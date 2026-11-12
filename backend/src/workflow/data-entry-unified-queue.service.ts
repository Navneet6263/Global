import { ForbiddenException, Injectable } from "@nestjs/common";
import { loadReentryCheckMap, reentryCaseWhere } from "../clarifications/clarification-l2-reentry.helpers";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import type { DataEntryQueueFilter, DataEntryUnifiedQueueQueryDto } from "./dto/data-entry-queue.dto";
import { presentQueueCase, queueCaseSelect, searchWhere } from "./intake.service";
import { OPEN_CLARIFICATION, isSupervisor, ledDepartmentIds } from "./workflow-access";

const unifiedQueueSelect = {
  ...queueCaseSelect,
  clarifications: {
    where: { status: { in: OPEN_CLARIFICATION } },
    select: {
      publicId: true,
      level: true,
      status: true,
      subject: true,
      checkId: true,
      requestedDocumentType: true,
      submittedDocumentVersion: true,
      opsReviewedAt: true,
      rejectionCount: true,
      dueAt: true,
      createdAt: true,
    },
    orderBy: [{ opsReviewedAt: "asc" as const }, { createdAt: "asc" as const }],
  },
} satisfies Prisma.VerificationCaseSelect;

type UnifiedQueueRow = Prisma.VerificationCaseGetPayload<{
  select: typeof unifiedQueueSelect;
}>;

/** Unified Data Entry work queue merging normal intake and pending L2 re-entry without duplicating cases. */
@Injectable()
export class DataEntryUnifiedQueueService {
  constructor(private readonly prisma: PrismaService) {}

  async queue(actor: Actor, query: DataEntryUnifiedQueueQueryDto) {
    const supervisor = isSupervisor(actor);
    if (!supervisor && !actor.roles.includes("DATA_ENTRY")) {
      throw new ForbiddenException("Data Entry queue is for the Data Entry team");
    }

    const leads = ledDepartmentIds(actor, "DATA_ENTRY");
    const canSeeTeam = supervisor || leads.length > 0;
    const view: "mine" | "team" = query.view === "team" && canSeeTeam ? "team" : "mine";
    const filter: DataEntryQueueFilter = query.filter ?? "all";
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const now = new Date();

    const normalViewWhere = this.normalWhere(actor, view, leads, supervisor);
    const l2ViewWhere = this.l2Where(actor, view, leads, supervisor);
    const mineNormalWhere = this.normalWhere(actor, "mine", leads, supervisor);
    const mineL2Where = this.l2Where(actor, "mine", leads, supervisor);

    const search = query.search?.trim();
    const filterWhere = this.applyFilter(filter, normalViewWhere, l2ViewWhere);
    const where: Prisma.VerificationCaseWhereInput = search
      ? { AND: [filterWhere, this.unifiedSearchWhere(search)] }
      : filterWhere;

    const countEntries = this.buildCounts(
      now,
      normalViewWhere,
      l2ViewWhere,
      mineNormalWhere,
      mineL2Where,
    );
    const countKeys = Object.keys(countEntries);

    const [rows, total, ...countValues] = await Promise.all([
      this.prisma.verificationCase.findMany({
        where,
        orderBy: [{ dueAt: "asc" }, { dataEntryAssignedAt: "asc" }, { publicId: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: unifiedQueueSelect,
      }),
      this.prisma.verificationCase.count({ where }),
      ...countKeys.map((key) =>
        this.prisma.verificationCase.count({ where: countEntries[key]! }),
      ),
    ]);

    const items = await this.presentRows(rows);
    return {
      items,
      total,
      page,
      pageSize,
      counts: Object.fromEntries(countKeys.map((key, idx) => [key, countValues[idx]!])),
      generatedAt: now,
    };
  }

  private normalWhere(
    actor: Actor,
    view: "mine" | "team",
    leads: readonly bigint[],
    supervisor: boolean,
  ): Prisma.VerificationCaseWhereInput {
    const scope: Prisma.VerificationCaseWhereInput =
      view === "mine" || (!leads.length && !supervisor)
        ? { dataEntryUserId: actor.userId }
        : supervisor
          ? { dataEntryUserId: { not: null } }
          : {
              dataEntryUser: {
                departmentMemberships: { some: { departmentId: { in: [...leads] } } },
              },
            };
    return {
      ...caseAccessScope(actor),
      workflowVersion: 2,
      intakeStage: { in: ["DATA_ENTRY", "CORRECTION"] },
      AND: [scope],
    };
  }

  private l2Where(
    actor: Actor,
    view: "mine" | "team",
    leads: readonly bigint[],
    supervisor: boolean,
  ): Prisma.VerificationCaseWhereInput {
    const scope: Prisma.VerificationCaseWhereInput =
      view === "mine" || (!leads.length && !supervisor)
        ? supervisor
          ? { dataEntryUserId: actor.userId }
          : { OR: [{ dataEntryUserId: actor.userId }, { dataEntryUserId: null }] }
        : {};
    return {
      AND: [
        reentryCaseWhere(actor),
        ...(Object.keys(scope).length ? [scope] : []),
        { clarifications: { some: { level: "L2", status: "DATA_ENTRY_PENDING" } } },
      ],
    };
  }

  private applyFilter(
    filter: DataEntryQueueFilter,
    normalWhere: Prisma.VerificationCaseWhereInput,
    l2Where: Prisma.VerificationCaseWhereInput,
  ): Prisma.VerificationCaseWhereInput {
    if (filter === "to_review") return { AND: [normalWhere, { intakeStage: "DATA_ENTRY" }] };
    if (filter === "correction") return { AND: [normalWhere, { intakeStage: "CORRECTION" }] };
    if (filter === "l2_reentry") return l2Where;
    return { OR: [normalWhere, l2Where] };
  }

  private unifiedSearchWhere(search: string): Prisma.VerificationCaseWhereInput {
    const term = search.slice(0, 120);
    return {
      OR: [
        ...(searchWhere(term).OR ?? []),
        {
          clarifications: {
            some: {
              level: "L2",
              status: "DATA_ENTRY_PENDING",
              subject: { contains: term },
            },
          },
        },
      ],
    };
  }

  private buildCounts(
    now: Date,
    normalViewWhere: Prisma.VerificationCaseWhereInput,
    l2ViewWhere: Prisma.VerificationCaseWhereInput,
    mineNormalWhere: Prisma.VerificationCaseWhereInput,
    mineL2Where: Prisma.VerificationCaseWhereInput,
  ): Record<string, Prisma.VerificationCaseWhereInput> {
    const dueClause: Prisma.VerificationCaseWhereInput = {
      OR: [
        { dueAt: { lt: now } },
        {
          AND: [
            { dueAt: null },
            {
              clarifications: {
                some: { level: "L2", status: "DATA_ENTRY_PENDING", dueAt: { lt: now } },
              },
            },
          ],
        },
      ],
    };
    return {
      mine: { OR: [{ AND: [mineNormalWhere, { intakeStage: "DATA_ENTRY" }] }, mineL2Where] },
      mineL2: mineL2Where,
      intakeToReview: { AND: [normalViewWhere, { intakeStage: "DATA_ENTRY" }] },
      correction: { AND: [normalViewWhere, { intakeStage: "CORRECTION" }] },
      l2Reentry: l2ViewWhere,
      allInView: { OR: [normalViewWhere, l2ViewWhere] },
      overdue: { AND: [{ OR: [mineNormalWhere, mineL2Where] }, dueClause] },
    };
  }

  private async presentRows(rows: UnifiedQueueRow[]) {
    const checkIds = [
      ...new Set(
        rows
          .flatMap((row) =>
            row.clarifications
              .filter((c) => c.level === "L2" && c.status === "DATA_ENTRY_PENDING")
              .map((c) => c.checkId),
          )
          .filter((id): id is bigint => id != null),
      ),
    ];
    const checkMap = await loadReentryCheckMap(this.prisma, checkIds);

    return rows.map((row) => {
      const pendingL2 = row.clarifications.filter(
        (c) => c.level === "L2" && c.status === "DATA_ENTRY_PENDING",
      );
      const earliestL2Due = pendingL2.map((c) => c.dueAt).find((d) => d != null) ?? null;
      const base = presentQueueCase(row);
      return {
        ...base,
        dueAt: base.dueAt ?? earliestL2Due,
        l2Reentries: pendingL2.map((c) => {
          const check = c.checkId ? checkMap.get(c.checkId) : undefined;
          return {
            id: c.publicId,
            subject: c.subject,
            checkId: check?.publicId ?? null,
            checkType: check?.type ?? null,
            requestedDocumentType: c.requestedDocumentType,
            submittedDocumentVersion: c.submittedDocumentVersion,
            opsReviewedAt: c.opsReviewedAt,
            rejectionCount: c.rejectionCount,
            dueAt: c.dueAt,
          };
        }),
      };
    });
  }
}
