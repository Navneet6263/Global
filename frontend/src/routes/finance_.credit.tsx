import { createFileRoute } from "@tanstack/react-router";
import { FinanceWorkspace } from "@/features/stakeholders/finance/FinanceWorkspace";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/finance_/credit")({
  ssr: false,
  head: () => ({ meta: [{ title: "Credit control — Sapling Global" }] }),
  beforeLoad: () => requireRoleWorkspace(["FINANCE_MANAGER"], { reloadOnDenied: true }),
  component: () => <FinanceWorkspace view="credit" />,
});
