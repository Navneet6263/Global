import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/operations")({
  ssr: false,
  beforeLoad: () => requireRoleWorkspace(["OPS_MANAGER"]),
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
