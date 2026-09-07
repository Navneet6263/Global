import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/shell/admin-shell";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/verifier")({
  ssr: false,
  beforeLoad: () => requireRoleWorkspace(["VERIFIER"]),
  component: VerifierLayout,
});

function VerifierLayout() {
  return (
    <AdminShell workspace="verifier">
      <Outlet />
    </AdminShell>
  );
}
