import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { AdminShell } from "@/components/shell/admin-shell";
import { landingPathForRoles, loadIdentity } from "@/lib/auth/platform-session";

export const Route = createFileRoute("/operations")({
  ssr: false,
  beforeLoad: async () => {
    const identity = await loadIdentity();
    if (!identity) throw redirect({ to: "/auth" });
    if (!identity.roles.some((role) => role === "PLATFORM_ADMIN" || role === "OPS_MANAGER")) {
      throw redirect({ to: landingPathForRoles(identity.roles) as "/admin" });
    }
  },
  component: OperationsLayout,
});

function OperationsLayout() {
  return (
    <AdminShell workspace="operations">
      {/* Required: nested operations routes render here. */}
      <Outlet />
    </AdminShell>
  );
}
