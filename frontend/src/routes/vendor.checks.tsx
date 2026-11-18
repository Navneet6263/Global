import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { VendorJobDrawer } from "@/features/vendor-checks/VendorJobDrawer";
import { VendorJobsBoard } from "@/features/vendor-checks/VendorJobsBoard";
import { vendorWorkApi, type VendorJobStatus } from "@/lib/backend-api/vendor-checks";

const VENDOR_TABS: readonly VendorJobStatus[] = [
  "ASSIGNED",
  "IN_PROGRESS",
  "TEAM_REVIEW",
  "RETURNED",
  "SUBMITTED",
  "APPROVED",
];

export const Route = createFileRoute("/vendor/checks")({
  head: () => ({ meta: [{ title: "My checks — Sapling Global" }] }),
  // Home links open a status tab (?status=ASSIGNED) or one check (?job=<id>).
  validateSearch: (input: Record<string, unknown>): { job?: string; status?: VendorJobStatus } => ({
    ...(typeof input["job"] === "string" && input["job"] ? { job: input["job"] } : {}),
    ...(VENDOR_TABS.includes(input["status"] as VendorJobStatus)
      ? { status: input["status"] as VendorJobStatus }
      : {}),
  }),
  component: VendorChecksPage,
});

function VendorChecksPage() {
  const { job, status } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const open = (id: string | undefined) =>
    void navigate({ search: (current) => ({ ...current, job: id }), replace: !id });
  return (
    <div className="grid gap-5">
      <PageHeader
        title="My checks"
        description="Checks you picked or were sent: accept, verify, attach proof and submit before the due date."
      />
      <VendorJobsBoard
        key={status ?? "all"}
        mode="vendor"
        storageKey="vendor-checks-columns"
        initialStatus={status}
        load={vendorWorkApi.list}
        exportCsv={vendorWorkApi.export}
        onOpen={(row) => open(row.id)}
      />
      <VendorJobDrawer jobId={job ?? null} onClose={() => open(undefined)} />
    </div>
  );
}
