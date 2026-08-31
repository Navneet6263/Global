import type { CrmRepository } from "./crm-repository";
import { activityType, mapActivity, mapOpportunity, overview, versions } from "./api-crm-helpers";
import {
  completeFollowUp,
  getActivities,
  getFollowUps,
  rescheduleFollowUp,
} from "./api-crm-worklists";
import { getAccounts, getForecast, getSalesOwners } from "./api-crm-insights";
import {
  addSalesActivity,
  createOpportunity as createBackendOpportunity,
  getOpportunity as getBackendOpportunity,
  listOpportunities,
  prepareSalesOnboarding,
  updateOpportunity as updateBackendOpportunity,
  getCrmSettings,
  updateCrmSettings,
} from "@/lib/backend-api/crm";

export function createApiCrmRepository(_baseUrl: string): CrmRepository {
  return {
    getOverview: overview,
    async getAdminSummary() {
      const data = await overview();
      return {
        generatedAt: data.generatedAt,
        metrics: data.metrics,
        trend: data.trend,
        pendingFollowUps: data.pendingFollowUpsTotal,
        overdueFollowUps: data.overdueFollowUpsTotal,
        unassignedOpportunities: data.unassignedOpportunitiesTotal,
      };
    },
    async getOpportunities(query) {
      const response = await listOpportunities({
        search: query.search,
        stage: query.stage === "all" ? undefined : query.stage,
        owner: query.owner === "all" ? undefined : query.owner,
        source: query.source === "all" ? undefined : query.source,
        minValue: query.minValue,
        maxValue: query.maxValue,
        minProbability: query.minProbability,
        maxProbability: query.maxProbability,
        closeFrom: query.closeFrom,
        closeTo: query.closeTo,
        followUp: query.followUp === "all" ? undefined : query.followUp,
        sort: query.sort,
        savedView: query.savedView === "all" ? undefined : query.savedView,
        page: query.page ?? 1,
        limit: query.pageSize ?? 10,
      });
      return {
        rows: response.items.map(mapOpportunity),
        total: response.total,
        page: response.page,
        pageSize: response.pageSize,
      };
    },
    async getOpportunity(id) {
      const raw = await getBackendOpportunity(id);
      return {
        ...mapOpportunity(raw),
        ageDays: Math.max(0, Math.floor((Date.now() - Date.parse(raw.createdAt)) / 86_400_000)),
        activities: raw.activities.map((row) => mapActivity(row, raw)),
      };
    },
    async createOpportunity(input) {
      return mapOpportunity(
        await createBackendOpportunity({
          companyName: input.company,
          city: input.city || undefined,
          industry: input.industry || undefined,
          contactName: input.contactName,
          contactTitle: input.contactTitle || undefined,
          contactEmail: input.contactEmail,
          contactPhone: input.contactMobile,
          ownerId: input.ownerId ?? undefined,
          source: input.source,
          estimatedValue: input.estimatedValue,
          probability: input.probability,
          expectedCloseDate: input.expectedCloseDate,
          nextFollowUpAt: input.nextFollowUpAt ?? undefined,
          notes: input.notes || undefined,
        }),
      );
    },
    async updateOpportunity(id, input) {
      const version = versions.get(id) ?? (await getBackendOpportunity(id)).version;
      return mapOpportunity(
        await updateBackendOpportunity(id, {
          version,
          companyName: input.company,
          city: emptyAsNull(input.city),
          industry: emptyAsNull(input.industry),
          contactName: input.contactName,
          contactTitle: emptyAsNull(input.contactTitle),
          contactEmail: input.contactEmail,
          contactPhone: input.contactMobile,
          ownerId: input.ownerId,
          source: input.source,
          estimatedValue: input.estimatedValue,
          probability: input.probability,
          expectedCloseDate: input.expectedCloseDate,
          nextFollowUpAt: input.nextFollowUpAt ?? undefined,
          notes: emptyAsNull(input.notes),
        }),
      );
    },
    async changeOpportunityStage(input) {
      const version =
        versions.get(input.opportunityId) ??
        (await getBackendOpportunity(input.opportunityId)).version;
      return mapOpportunity(
        await updateBackendOpportunity(input.opportunityId, {
          version,
          stage: input.stage,
          lostReason: input.lostReason,
          estimatedValue: input.finalValue,
          activitySummary:
            [input.notes, input.competitor ? `Competitor: ${input.competitor}` : undefined]
              .filter(Boolean)
              .join(" — ") || undefined,
        }),
      );
    },
    async assignOwner(input) {
      const version =
        versions.get(input.opportunityId) ??
        (await getBackendOpportunity(input.opportunityId)).version;
      return mapOpportunity(
        await updateBackendOpportunity(input.opportunityId, {
          version,
          ownerId: input.ownerId,
          activitySummary: input.ownerId ? "Opportunity owner changed" : "Opportunity unassigned",
        }),
      );
    },
    async prepareOnboarding(id) {
      const opportunity = await getBackendOpportunity(id);
      await prepareSalesOnboarding(id, opportunity.version);
      return mapOpportunity(await getBackendOpportunity(id));
    },
    async addActivity(input) {
      const opportunity = await getBackendOpportunity(input.opportunityId);
      const row = await addSalesActivity(input.opportunityId, {
        type: activityTypeForWrite(input.type),
        summary: input.notes ? `${input.summary} — ${input.notes}` : input.summary,
        occurredAt: input.occurredAt,
        nextFollowUpAt: input.nextFollowUpAt ?? undefined,
      });
      return {
        id: row.id,
        opportunityId: input.opportunityId,
        company: opportunity.companyName,
        contactName: opportunity.contactName,
        actor: row.actor.displayName,
        type: activityType(row.type),
        summary: row.summary,
        occurredAt: row.occurredAt,
      };
    },
    getActivities,
    getFollowUps,
    completeFollowUp,
    rescheduleFollowUp,
    getAccounts,
    getForecast,
    getSalesOwners,
    getSettings: getCrmSettings,
    updateSettings: updateCrmSettings,
  };
}

function emptyAsNull(value: string | undefined) {
  if (value === undefined) return undefined;
  return value.trim() || null;
}

function activityTypeForWrite(value: string) {
  return ["CALL", "EMAIL", "MEETING", "NOTE", "FOLLOW_UP"].includes(value)
    ? (value as "CALL" | "EMAIL" | "MEETING" | "NOTE" | "FOLLOW_UP")
    : "NOTE";
}
