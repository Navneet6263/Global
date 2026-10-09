import { Outlet, createFileRoute } from "@tanstack/react-router";
import { OperationsShell } from "@/features/operations/workspace/OperationsShell";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/operations")({
  ssr: false,
  beforeLoad: () => requireRoleWorkspace(["OPS_MANAGER"]),
  component: OperationsLayout,
});

function OperationsLayout() {
  return (
    <OperationsShell>
      {/* Required: nested operations routes render here. */}
      <Outlet />
    </OperationsShell>
  );
}
