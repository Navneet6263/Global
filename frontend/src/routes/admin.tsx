import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: () => requireRoleWorkspace(["PLATFORM_ADMIN"]),
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
