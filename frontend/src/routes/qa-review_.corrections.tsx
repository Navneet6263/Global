import { createFileRoute } from "@tanstack/react-router";
import { QaWorkspace } from "@/features/delivery/qa/QaWorkspace";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/qa-review_/corrections")({
  ssr: false,
  head: () => ({ meta: [{ title: "Corrections — Sapling Global" }] }),
  beforeLoad: () => requireRoleWorkspace(["QA_REVIEWER"], { reloadOnDenied: true }),
  component: () => <QaWorkspace view="corrections" />,
});
