import { createFileRoute } from "@tanstack/react-router";
import { FinanceWorkspace } from "@/features/stakeholders/finance/FinanceWorkspace";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/finance_/billing")({
  ssr: false,
  head: () => ({ meta: [{ title: "Ready for billing — Sapling Global" }] }),
  beforeLoad: () => requireRoleWorkspace(["FINANCE_MANAGER"], { reloadOnDenied: true }),
  component: () => <FinanceWorkspace view="billing" />,
});
