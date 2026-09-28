import type { SpocDomain, SpocQuery } from "../contracts/spoc";
import type { SpocRecordsSearch } from "../config/spoc-search";

export const SPOC_PAGE_SIZE = 20;

/**
 * Builds the API query for one record domain. The backend DTOs reject unknown
 * parameters (forbidNonWhitelisted), so each domain forwards only its own keys.
 */
export function recordsQuery(domain: SpocDomain, search: SpocRecordsSearch): SpocQuery {
  const common: SpocQuery = {
    page: search.page ?? 1,
    pageSize: SPOC_PAGE_SIZE,
    search: search.search,
    clientId: search.clientId,
    bucket: search.bucket,
    from: search.from,
    to: search.to,
  };
  const caseScoped: SpocQuery = { ...common, branchId: search.branchId, priority: search.priority };
  switch (domain) {
    case "cases":
      return {
        ...caseScoped,
        status: search.status,
        holderRole: search.holderRole,
        bucketRole: search.bucketRole,
        ownerId: search.ownerId,
        activeOnly: search.activeOnly,
        sla: search.sla === "dueToday" ? undefined : search.sla,
      };
    case "tasks":
      return {
        ...caseScoped,
        status: search.status,
        assigneeId: search.assigneeId,
        sla: search.sla === "overdue" || search.sla === "dueToday" ? search.sla : undefined,
      };
    case "qa":
      return { ...caseScoped, view: search.view ?? "awaiting" };
    case "visits":
      return { ...caseScoped, status: search.status, assigneeId: search.assigneeId };
    case "opportunities":
      return {
        ...common,
        stage: search.status,
        ownerId: search.ownerId,
        followUp: search.followUp,
      };
    case "invoices":
      return { ...common, status: search.status };
  }
}
