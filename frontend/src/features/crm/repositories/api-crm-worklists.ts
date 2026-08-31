import {
  completeSalesFollowUp,
  getOpportunity,
  listSalesActivities,
  updateOpportunity,
} from "@/lib/backend-api/crm";
import type { ActivityQuery, FollowUp, FollowUpActionInput, FollowUpQuery } from "../contracts/crm";
import {
  allOpportunities,
  followUpFrom,
  mapOpportunity,
  paginate,
  activityType,
} from "./api-crm-helpers";

export async function getActivities(query: ActivityQuery) {
  const response = await listSalesActivities({
    search: query.search,
    type: query.type === "all" ? undefined : query.type,
    owner: query.owner === "all" ? undefined : query.owner,
    page: query.page ?? 1,
    limit: query.pageSize ?? 10,
  });
  return {
    rows: response.items.map((row) => ({
      id: row.id,
      opportunityId: row.opportunity.id,
      company: row.opportunity.companyName,
      contactName: row.opportunity.contactName,
      actor: row.actor.displayName,
      type: activityType(row.type),
      summary: row.summary,
      occurredAt: row.occurredAt,
    })),
    total: response.total,
    page: response.page,
    pageSize: response.pageSize,
  };
}

export async function getFollowUps(query: FollowUpQuery) {
  let opportunities = await allOpportunities();
  if (query.owner && query.owner !== "all") {
    opportunities = opportunities.filter((row) => row.ownerId === query.owner);
  }
  let rows = opportunities.map(followUpFrom).filter((row): row is FollowUp => row !== null);
  const today = new Date().toISOString().slice(0, 10);
  if (query.view === "overdue") rows = rows.filter((row) => Date.parse(row.dueAt) < Date.now());
  if (query.view === "today") rows = rows.filter((row) => row.dueAt.slice(0, 10) === today);
  if (query.view === "tomorrow") {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    rows = rows.filter((row) => row.dueAt.slice(0, 10) === tomorrow);
  }
  if (query.view === "week") {
    const weekEnd = Date.now() + 7 * 86_400_000;
    rows = rows.filter((row) => {
      const due = Date.parse(row.dueAt);
      return due >= Date.now() && due < weekEnd;
    });
  }
  if (query.view === "upcoming") rows = rows.filter((row) => Date.parse(row.dueAt) >= Date.now());
  if (query.view === "completed" || query.view === "none") rows = [];
  if (query.search) {
    const search = query.search.toLowerCase();
    rows = rows.filter((row) => `${row.company} ${row.contactName}`.toLowerCase().includes(search));
  }
  return paginate(rows, query.page, query.pageSize);
}

export async function completeFollowUp(input: FollowUpActionInput) {
  const opportunity = await getOpportunity(input.followUpId);
  const mapped = followUpFrom(mapOpportunity(opportunity));
  if (!mapped) throw new Error("Follow-up not found");
  const result = await completeSalesFollowUp(input.followUpId, {
    version: opportunity.version,
    notes: input.notes,
  });
  return { ...mapped, completedAt: result.completedAt };
}

export async function rescheduleFollowUp(input: FollowUpActionInput) {
  if (!input.dueAt && !input.nextFollowUpAt) throw new Error("Choose a new follow-up date");
  const raw = await getOpportunity(input.followUpId);
  const updated = await updateOpportunity(raw.id, {
    version: raw.version,
    nextFollowUpAt: input.nextFollowUpAt ?? input.dueAt,
    activitySummary: input.notes ?? "Follow-up rescheduled",
  });
  return followUpFrom(mapOpportunity(updated))!;
}
