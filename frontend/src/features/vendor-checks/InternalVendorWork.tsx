import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  internalVendorApi,
  type VendorJob,
  type VendorJobStatus,
} from "@/lib/backend-api/vendor-checks";
import { CheckVendorPanel } from "./CheckVendorPanel";
import { VendorJobsBoard } from "./VendorJobsBoard";
import { readable } from "./vendor-job-format";

/** Operations / RM / Team Leader board of vendor jobs; opening one shows its review. */
export function InternalVendorWork({
  storageKey,
  initialStatus,
}: {
  storageKey: string;
  initialStatus?: VendorJobStatus;
}) {
  const [open, setOpen] = useState<VendorJob | null>(null);
  return (
    <>
      <VendorJobsBoard
        mode="internal"
        storageKey={storageKey}
        load={internalVendorApi.board}
        exportCsv={internalVendorApi.export}
        onOpen={setOpen}
        initialStatus={initialStatus}
      />
      <Dialog open={Boolean(open)} onOpenChange={(value) => (!value ? setOpen(null) : undefined)}>
        <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {open ? `${open.caseNumber} · ${readable(open.checkType)}` : "Vendor job"}
            </DialogTitle>
            <DialogDescription>
              {open ? `${open.candidateName} · ${open.clientName}` : ""}
            </DialogDescription>
          </DialogHeader>
          {open ? <CheckVendorPanel checkId={open.checkId} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
