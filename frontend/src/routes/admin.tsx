import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { AdminShell } from "@/components/shell/admin-shell";
import { landingPathForRoles, loadIdentity } from "@/lib/auth/platform-session";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const identity = await loadIdentity();
    if (!identity) throw redirect({ to: "/auth" });
    if (!identity.roles.includes("PLATFORM_ADMIN")) {
      throw redirect({ to: landingPathForRoles(identity.roles) as "/admin" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AdminShell>
      {/* Required: nested admin routes render here. */}
      <Outlet />
    </AdminShell>
  );
}
