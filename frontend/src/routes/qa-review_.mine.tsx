import { createFileRoute } from "@tanstack/react-router";
import { QaWorkspace } from "@/features/delivery/qa/QaWorkspace";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/qa-review_/mine")({
  ssr: false,
  head: () => ({ meta: [{ title: "My reviews — Sapling Global" }] }),
  validateSearch: (search: Record<string, unknown>): { case?: string } =>
    typeof search["case"] === "string" ? { case: search["case"] } : {},
  beforeLoad: () => requireRoleWorkspace(["QA_REVIEWER"], { reloadOnDenied: true }),
  component: function MyReviewsPage() {
    const { case: caseId } = Route.useSearch();
    return <QaWorkspace view="mine" initialCaseId={caseId} />;
  },
});
