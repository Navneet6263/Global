import { Outlet, createFileRoute } from "@tanstack/react-router";

import { ClientPortalShell } from "@/features/stakeholders/client/ClientPortalShell";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/client-portal")({
  ssr: false,
  beforeLoad: () => requireRoleWorkspace(["CLIENT_ADMIN"]),
  component: ClientPortalLayout,
});

function ClientPortalLayout() {
  return (
    <ClientPortalShell>
      <Outlet />
    </ClientPortalShell>
  );
}
