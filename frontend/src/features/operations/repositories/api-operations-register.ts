import { listCases } from "@/lib/backend-api/cases";
import type { OpsCaseQuery } from "../contracts/case";
import { baseCase } from "./api-operations-mappers";

export async function getOperationsRegister(query: OpsCaseQuery, signal?: AbortSignal) {
  const owner = query.owner === "all" ? undefined : query.owner;
  const ownerIsId = owner && /^[\da-f]{8}-[\da-f-]{27}$/i.test(owner);
  const response = await listCases(
    {
      search: query.search,
      clientId: query.clientId === "all" ? undefined : query.clientId,
      stage: query.stage === "all" ? undefined : query.stage,
      priority:
        query.priority && query.priority !== "all"
          ? { standard: "NORMAL", high: "HIGH", critical: "URGENT" }[query.priority]
          : undefined,
      risk: query.risk === "all" ? undefined : query.risk,
      sla: query.sla === "all" ? undefined : query.sla,
      owner: ownerIsId ? undefined : owner,
      ownerId: ownerIsId ? owner : undefined,
      unassigned: query.unassigned,
      dueToday: query.dueToday,
      dueNext7Days: query.dueNext7Days,
      view: "operations",
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      from: query.from,
      to: query.to,
      sortBy: query.sortBy ?? "updatedAt",
      sortDir: query.sortDir ?? "desc",
    },
    signal,
  );
  return {
    rows: response.items.map(baseCase),
    total: response.total,
    page: response.page ?? 1,
    pageSize: response.pageSize ?? 10,
  };
}
