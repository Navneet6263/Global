import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/support")({
  ssr: false,
  // Support desk: data comes only from the role-gated, read-only /support API.
  beforeLoad: () => requireRoleWorkspace(["SUPPORT_AGENT", "PLATFORM_ADMIN"]),
  component: SupportLayout,
});

function SupportLayout() {
  return (
    <AdminShell workspace="support">
      <Outlet />
    </AdminShell>
  );
}
