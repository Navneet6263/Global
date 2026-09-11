import { createFileRoute } from "@tanstack/react-router";
import { QaWorkspace } from "@/features/delivery/qa/QaWorkspace";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/qa-review_/mine")({
  ssr: false,
  head: () => ({ meta: [{ title: "My reviews — Sapling Global" }] }),
  beforeLoad: () => requireRoleWorkspace(["QA_REVIEWER"], { reloadOnDenied: true }),
  component: () => <QaWorkspace view="mine" />,
});
