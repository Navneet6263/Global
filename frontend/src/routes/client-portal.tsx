import { Outlet, createFileRoute } from "@tanstack/react-router";

import { StakeholderShell } from "@/features/stakeholders/StakeholderShell";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/client-portal")({
  ssr: false,
  beforeLoad: () => requireRoleWorkspace(["CLIENT_ADMIN"]),
  component: ClientPortalLayout,
});

function ClientPortalLayout() {
  return (
    <StakeholderShell workspace="client-admin">
      <Outlet />
    </StakeholderShell>
  );
}
