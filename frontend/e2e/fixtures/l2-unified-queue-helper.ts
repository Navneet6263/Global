import type { Route } from "@playwright/test";

export function replyUnifiedL2Queue(input: {
  route: Route;
  url: URL;
  state: { caseStatus: string; clarification: Record<string, unknown> | null };
  reentryItem: () => Record<string, unknown>;
  iso: (h: number) => string;
}) {
  const { route, url, state, reentryItem, iso } = input;
  const pending = state.clarification?.status === "DATA_ENTRY_PENDING";
  const r = pending ? reentryItem() : null;
  const filter = url.searchParams.get("filter") ?? "all";
  const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";

  const items =
    pending && r && (filter === "all" || filter === "l2_reentry")
      ? [
          {
            id: "case-l2-1",
            caseNumber: "SG-2026-L201",
            status: state.caseStatus,
            priority: "HIGH",
            version: 3,
            workflowVersion: 2,
            intakeStage: "ROUTED",
            dueAt: r.dueAt,
            createdAt: iso(-24),
            updatedAt: iso(0),
            dataEntryAssignedAt: iso(-20),
            dataEntryReadyAt: iso(-18),
            candidateName: "Asha Verma",
            client: { id: "client-l2", name: "Horizon Tech" },
            escalation: null,
            rm: { id: "rm-1", name: "Riya Mehta" },
            dataEntry: { id: "de-sara", name: "Sara Khan" },
            documents: { total: 1, rejected: state.clarification?.rejectionCount ? 1 : 0 },
            openInsufficiency: { l1: 0, l2: 1 },
            checks: { total: 2, completed: 1, unassigned: 0, departments: ["Employment"] },
            l2Reentries: [
              {
                id: r.id,
                subject: r.subject,
                checkId: "chk-emp-l2",
                checkType: "EMPLOYMENT",
                requestedDocumentType: r.requestedDocumentType,
                submittedDocumentVersion: r.submittedDocumentVersion,
                opsReviewedAt: r.opsReviewedAt,
                rejectionCount: r.rejectionCount,
                dueAt: r.dueAt,
              },
            ],
          },
        ].filter(
          (item) =>
            !search ||
            item.candidateName.toLowerCase().includes(search) ||
            item.caseNumber.toLowerCase().includes(search) ||
            item.client.name.toLowerCase().includes(search),
        )
      : [];

  const l2Count = pending ? 1 : 0;
  return route.fulfill({
    status: 200,
    json: {
      items,
      total: items.length,
      page: 1,
      pageSize: 10,
      counts: {
        mine: l2Count,
        mineL2: l2Count,
        intakeToReview: 0,
        correction: 0,
        l2Reentry: l2Count,
        allInView: l2Count,
        overdue: 0,
      },
      generatedAt: iso(0),
    },
  });
}
