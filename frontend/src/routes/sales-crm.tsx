import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { AdminShell } from "@/components/shell/admin-shell";
import { landingPathForRoles, loadIdentity } from "@/lib/auth/platform-session";

export const Route = createFileRoute("/sales-crm")({
  ssr: false,
  beforeLoad: async () => {
    const identity = await loadIdentity();
    if (!identity) throw redirect({ to: "/auth" });
    if (!identity.roles.some((role) => role === "PLATFORM_ADMIN" || role === "SALES_MANAGER")) {
      throw redirect({ to: landingPathForRoles(identity.roles) as "/admin" });
    }
  },
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
