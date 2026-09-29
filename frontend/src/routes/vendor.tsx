import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/vendor")({
  ssr: false,
  // External vendors only; data comes only from the vendor-scoped /vendor/requests API.
  beforeLoad: () => requireRoleWorkspace(["VENDOR"]),
  component: VendorLayout,
});

function VendorLayout() {
  return (
    <AdminShell workspace="vendor">
      <Outlet />
    </AdminShell>
  );
}
