import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { VendorJobDrawer } from "@/features/vendor-checks/VendorJobDrawer";
import { VendorJobsBoard } from "@/features/vendor-checks/VendorJobsBoard";
import { vendorWorkApi } from "@/lib/backend-api/vendor-checks";

export const Route = createFileRoute("/vendor/checks")({
  head: () => ({ meta: [{ title: "My checks — Sapling Global" }] }),
  component: VendorChecksPage,
});

function VendorChecksPage() {
  const [jobId, setJobId] = useState<string | null>(null);
  return (
    <>
      <header className="client-heading">
        <div>
          <h1>My checks</h1>
          <p>
            Checks Sapling Global sent you: verify, attach proof and submit before the due date.
          </p>
        </div>
      </header>
      <VendorJobsBoard
        mode="vendor"
        storageKey="vendor-checks-columns"
        load={vendorWorkApi.list}
        exportCsv={vendorWorkApi.export}
        onOpen={(job) => setJobId(job.id)}
      />
      <VendorJobDrawer jobId={jobId} onClose={() => setJobId(null)} />
    </>
  );
}
