import type { CrmRepository } from "./crm-repository";
import {
  activityType,
  allOpportunities,
  filterOpportunities,
  followUpFrom,
  mapActivity,
  mapOpportunity,
  overview,
  paginate,
  versions,
} from "./api-crm-helpers";
import {
  addSalesActivity,
  createOpportunity,
  getCrmOverview,
  getOpportunity,
  listOpportunities,
  listSalesOwners,
  updateOpportunity,
} from "@/lib/backend-api/crm";
import type {
  AccountQuery,
  ActivityQuery,
  FollowUp,
  FollowUpQuery,
  ForecastQuery,
  Opportunity,
  RevenueForecast,
  SalesAccount,
  SalesOwner,
} from "../contracts/crm";

export function createApiCrmRepository(_baseUrl: string): CrmRepository {
  return {
    getOverview: overview,
    async getAdminSummary() {
      const data = await overview();
      const opportunities = await allOpportunities();
      return {
        generatedAt: data.generatedAt,
        metrics: data.metrics,
        trend: data.trend,
        pendingFollowUps: data.followUps.length,
        overdueFollowUps: data.followUps.filter((row) => Date.parse(row.dueAt) < Date.now()).length,
        unassignedOpportunities: opportunities.filter(
          (row) => !row.ownerId && !["WON", "LOST"].includes(row.stage),
        ).length,
      };
    },
    async getOpportunities(query) {
      const rows = filterOpportunities(await allOpportunities(), query);
      if (query.sort === "value") rows.sort((a, b) => b.estimatedValue - a.estimatedValue);
      else if (query.sort === "probability") rows.sort((a, b) => b.probability - a.probability);
      else if (query.sort === "close")
        rows.sort((a, b) => Date.parse(a.expectedCloseDate) - Date.parse(b.expectedCloseDate));
      else
        rows.sort(
          (a, b) =>
            Date.parse(b.lastActivityAt ?? b.createdAt) -
            Date.parse(a.lastActivityAt ?? a.createdAt),
        );
      return paginate(rows, query.page, query.pageSize);
    },
    async getOpportunity(id) {
      const raw = await getOpportunity(id);
      return {
        ...mapOpportunity(raw),
        ageDays: Math.max(0, Math.floor((Date.now() - Date.parse(raw.createdAt)) / 86_400_000)),
        activities: raw.activities.map((row) => mapActivity(row, raw)),
      };
    },
    async createOpportunity(input) {
      return mapOpportunity(
        await createOpportunity({
          companyName: input.company,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactMobile,
          ownerId: input.ownerId ?? undefined,
          source: input.source,
          estimatedValue: input.estimatedValue,
          probability: input.probability,
          expectedCloseDate: input.expectedCloseDate,
          nextFollowUpAt: input.nextFollowUpAt ?? undefined,
          notes: input.notes,
        }),
      );
    },
    async updateOpportunity(id, input) {
      const version = versions.get(id) ?? (await getOpportunity(id)).version;
      return mapOpportunity(
        await updateOpportunity(id, {
          version,
          companyName: input.company,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactMobile,
          ownerId: input.ownerId ?? undefined,
          source: input.source,
          estimatedValue: input.estimatedValue,
          probability: input.probability,
          expectedCloseDate: input.expectedCloseDate,
          nextFollowUpAt: input.nextFollowUpAt ?? undefined,
          notes: input.notes,
        }),
      );
    },
    async changeOpportunityStage(input) {
      const version =
        versions.get(input.opportunityId) ?? (await getOpportunity(input.opportunityId)).version;
      return mapOpportunity(
        await updateOpportunity(input.opportunityId, {
          version,
          stage: input.stage,
          lostReason: input.lostReason,
          estimatedValue: input.finalValue,
          activitySummary: input.notes,
        }),
      );
    },
    async assignOwner(input) {
      if (!input.ownerId) throw new Error("Choose an active sales owner");
      const version =
        versions.get(input.opportunityId) ?? (await getOpportunity(input.opportunityId)).version;
      return mapOpportunity(
        await updateOpportunity(input.opportunityId, {
          version,
          ownerId: input.ownerId,
          activitySummary: "Opportunity owner changed",
        }),
      );
    },
    async prepareOnboarding(id) {
      await addSalesActivity(id, { type: "NOTE", summary: "Onboarding handoff prepared" });
      return { ...mapOpportunity(await getOpportunity(id)), onboardingHandoff: true };
    },
    async addActivity(input) {
      const opportunity = await getOpportunity(input.opportunityId);
      const row = await addSalesActivity(input.opportunityId, {
        type: ["CALL", "EMAIL", "MEETING", "NOTE", "FOLLOW_UP"].includes(input.type)
          ? (input.type as "CALL" | "EMAIL" | "MEETING" | "NOTE" | "FOLLOW_UP")
          : "NOTE",
        summary: input.notes ? `${input.summary} — ${input.notes}` : input.summary,
        occurredAt: input.occurredAt,
        nextFollowUpAt: input.nextFollowUpAt ?? undefined,
      });
      return {
        id: row.id,
        opportunityId: input.opportunityId,
        company: opportunity.companyName,
        contactName: opportunity.contactName,
        actor: "Current user",
        type: activityType(row.type),
        summary: row.summary,
        occurredAt: row.occurredAt,
      };
    },
    async getActivities(query: ActivityQuery) {
      const opportunities = (await listOpportunities({ limit: 100 })).items;
      const details = await Promise.all(opportunities.map((row) => getOpportunity(row.id)));
      let rows = details
        .flatMap((detail) => detail.activities.map((activity) => mapActivity(activity, detail)))
        .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
      if (query.search)
        rows = rows.filter((row) =>
          `${row.company} ${row.contactName} ${row.summary}`
            .toLowerCase()
            .includes(query.search!.toLowerCase()),
        );
      if (query.type && query.type !== "all") rows = rows.filter((row) => row.type === query.type);
      if (query.owner && query.owner !== "all")
        rows = rows.filter((row) => row.actor === query.owner);
      return paginate(rows, query.page, query.pageSize);
    },
    async getFollowUps(query: FollowUpQuery) {
      let rows = (await allOpportunities())
        .map(followUpFrom)
        .filter((row): row is FollowUp => row !== null);
      const today = new Date().toISOString().slice(0, 10);
      if (query.view === "overdue") rows = rows.filter((row) => Date.parse(row.dueAt) < Date.now());
      if (query.view === "today") rows = rows.filter((row) => row.dueAt.slice(0, 10) === today);
      if (query.search)
        rows = rows.filter((row) =>
          `${row.company} ${row.contactName}`.toLowerCase().includes(query.search!.toLowerCase()),
        );
      if (query.owner && query.owner !== "all")
        rows = rows.filter((row) => row.ownerName === query.owner);
      return paginate(rows, query.page, query.pageSize);
    },
    async completeFollowUp(input) {
      const opportunity = await getOpportunity(input.followUpId);
      await addSalesActivity(input.followUpId, {
        type: "FOLLOW_UP",
        summary: input.notes ?? "Follow-up completed",
      });
      const mapped = followUpFrom(mapOpportunity(opportunity));
      if (!mapped) throw new Error("Follow-up not found");
      return { ...mapped, completedAt: new Date().toISOString() };
    },
    async rescheduleFollowUp(input) {
      if (!input.dueAt && !input.nextFollowUpAt) throw new Error("Choose a new follow-up date");
      const raw = await getOpportunity(input.followUpId);
      const updated = await updateOpportunity(raw.id, {
        version: raw.version,
        nextFollowUpAt: input.nextFollowUpAt ?? input.dueAt,
        activitySummary: input.notes ?? "Follow-up rescheduled",
      });
      return followUpFrom(mapOpportunity(updated))!;
    },
    async getAccounts(query: AccountQuery) {
      const opportunities = await allOpportunities();
      const groups = new Map<string, Opportunity[]>();
      opportunities.forEach((row) =>
        groups.set(row.accountId, [...(groups.get(row.accountId) ?? []), row]),
      );
      let rows: SalesAccount[] = Array.from(groups, ([id, items]) => {
        const first = items[0]!;
        const open = items.filter((row) => !["WON", "LOST"].includes(row.stage));
        const won = items.filter((row) => row.stage === "WON");
        return {
          id,
          company: first.company,
          status: won.length ? "active" : "prospect",
          industry: first.industry,
          city: first.city,
          openOpportunities: open.length,
          pipelineValue: open.reduce((sum, row) => sum + row.estimatedValue, 0),
          wonRevenue: won.reduce((sum, row) => sum + row.estimatedValue, 0),
          primaryContact: first.contactName,
          contactEmail: first.contactEmail,
          contactMobile: first.contactMobile,
          ownerName: first.ownerName,
          lastActivityAt:
            items
              .map((row) => row.lastActivityAt)
              .filter(Boolean)
              .sort()
              .at(-1) ?? null,
          nextFollowUpAt:
            items
              .map((row) => row.nextFollowUpAt)
              .filter((value): value is string => Boolean(value))
              .sort()[0] ?? null,
        };
      });
      if (query.search)
        rows = rows.filter((row) =>
          `${row.company} ${row.primaryContact}`
            .toLowerCase()
            .includes(query.search!.toLowerCase()),
        );
      if (query.status && query.status !== "all")
        rows = rows.filter((row) => row.status === query.status);
      if (query.owner && query.owner !== "all")
        rows = rows.filter((row) => row.ownerName === query.owner);
      return paginate(rows, query.page, query.pageSize);
    },
    async getForecast(query: ForecastQuery): Promise<RevenueForecast> {
      let rows = await allOpportunities();
      if (query.owner && query.owner !== "all")
        rows = rows.filter((row) => row.ownerId === query.owner);
      if (query.stage && query.stage !== "all")
        rows = rows.filter((row) => row.stage === query.stage);
      if (query.source && query.source !== "all")
        rows = rows.filter((row) => row.source === query.source);
      const open = rows.filter((row) => !["WON", "LOST"].includes(row.stage));
      const overviewData = await getCrmOverview();
      const bucket = (key: (row: Opportunity) => string) =>
        Array.from(new Set(rows.map(key))).map((label) => {
          const items = rows.filter((row) => key(row) === label);
          return {
            label,
            value: items.reduce((sum, row) => sum + row.estimatedValue, 0),
            weighted: items.reduce((sum, row) => sum + row.weightedValue, 0),
          };
        });
      const weightedForecast = open.reduce((sum, row) => sum + row.weightedValue, 0);
      const closedWon = rows
        .filter((row) => row.stage === "WON")
        .reduce((sum, row) => sum + row.estimatedValue, 0);
      return {
        period: query.period ?? "month",
        openPipeline: open.reduce((sum, row) => sum + row.estimatedValue, 0),
        weightedForecast,
        commitForecast: open
          .filter((row) => row.probability >= 75)
          .reduce((sum, row) => sum + row.estimatedValue, 0),
        bestCaseForecast: open
          .filter((row) => row.probability >= 50)
          .reduce((sum, row) => sum + row.estimatedValue, 0),
        closedWon,
        target: 0,
        gapToTarget: 0,
        monthly: overviewData.trend.map((row) => ({
          label: row.month,
          pipeline: row.pipelineValue,
          weighted: row.weightedValue,
          won: row.wonValue,
        })),
        byOwner: bucket((row) => row.ownerName ?? "Unassigned"),
        byStage: bucket((row) => row.stage),
        calendar: [],
        atRisk: open.filter(
          (row) => row.nextFollowUpAt && Date.parse(row.nextFollowUpAt) < Date.now(),
        ),
      };
    },
    async getSalesOwners(): Promise<SalesOwner[]> {
      const [owners, opportunities] = await Promise.all([listSalesOwners(), allOpportunities()]);
      return owners.items.map((owner) => {
        const rows = opportunities.filter((row) => row.ownerId === owner.id);
        const open = rows.filter((row) => !["WON", "LOST"].includes(row.stage));
        const won = rows.filter((row) => row.stage === "WON");
        const closed = rows.filter((row) => ["WON", "LOST"].includes(row.stage));
        return {
          id: owner.id,
          name: owner.displayName,
          email: owner.email,
          territory: "All India",
          activeOpportunities: open.length,
          pipelineValue: open.reduce((sum, row) => sum + row.estimatedValue, 0),
          weightedForecast: open.reduce((sum, row) => sum + row.weightedValue, 0),
          wonRevenue: won.reduce((sum, row) => sum + row.estimatedValue, 0),
          winRate: closed.length ? Math.round((won.length / closed.length) * 100) : 0,
          overdueFollowUps: open.filter(
            (row) => row.nextFollowUpAt && Date.parse(row.nextFollowUpAt) < Date.now(),
          ).length,
          activitiesThisWeek: 0,
          closingThisMonth: open.filter(
            (row) => row.expectedCloseDate.slice(0, 7) === new Date().toISOString().slice(0, 7),
          ).length,
        };
      });
    },
  };
}
