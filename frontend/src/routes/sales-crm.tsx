import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/sales-crm")({
  ssr: false,
  beforeLoad: () => requireRoleWorkspace(["SALES_MANAGER"]),
  component: SalesCrmLayout,
});

function SalesCrmLayout() {
  return (
    <AdminShell workspace="sales-crm">
      {/* Required: nested Sales & CRM routes render here. */}
      <Outlet />
    </AdminShell>
  );
}
