import { createFileRoute } from "@tanstack/react-router";
import { QaWorkspace } from "@/features/delivery/qa/QaWorkspace";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/qa-review_/overview")({
  ssr: false,
  head: () => ({ meta: [{ title: "QA overview — Sapling Global" }] }),
  beforeLoad: () => requireRoleWorkspace(["QA_REVIEWER"], { reloadOnDenied: true }),
  component: () => <QaWorkspace view="overview" />,
});
