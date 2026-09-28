import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/spoc-rm")({
  ssr: false,
  // View-only central monitor; data comes only from the role-gated /spoc API.
  beforeLoad: () => requireRoleWorkspace(["SPOC_RM", "PLATFORM_ADMIN"]),
  component: SpocLayout,
});

function SpocLayout() {
  return (
    <AdminShell workspace="spoc-rm">
      <Outlet />
    </AdminShell>
  );
}
