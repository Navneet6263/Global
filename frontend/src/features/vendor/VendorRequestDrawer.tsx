import { useState, type ReactNode } from "react";
import { CheckCircle2, Eye, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { oversightLabel } from "@/features/admin-dashboard/oversight-format";
import { formatBytes } from "@/features/cases/case-detail-formatting";
import { formatDateTime } from "@/lib/formatting";
import { DelegateRequestPanel } from "./DelegateRequestPanel";
import { useVendorDecision, useVendorRequest } from "./use-vendor-requests";
import { vendorApi } from "./vendor-api";
import type { VendorDecision } from "./vendor-contracts";
import { REQUEST_STATUS_META } from "./vendor-request-model";
import { VendorDecisionDialog } from "./VendorDecisionDialog";
import { VendorReportPanel } from "./VendorReportPanel";

const when = (value: string | null) => (value ? formatDateTime(value) : "—");

/** One assigned document: details, preview, Approve / Reject while pending, then its report. */
export function VendorRequestDrawer({
  requestId,
  onClose,
}: {
  requestId: string | undefined;
  onClose: () => void;
}) {
  const request = useVendorRequest(requestId);
  const [decision, setDecision] = useState<VendorDecision | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const decide = useVendorDecision(() => setDecision(null));
  const item = request.data;
  const status = item ? REQUEST_STATUS_META[item.status] : null;
  const documentLabel = item ? `${oversightLabel(item.documentType)} · ${item.caseNumber}` : "";

  const preview = async () => {
    if (!item) return;
    setPreviewing(true);
    try {
      await vendorApi.preview(item.id);
    } catch (error) {
      toast.error("Preview failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Sheet open={Boolean(requestId)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {item
              ? oversightLabel(item.documentType)
              : request.isError
                ? "Request unavailable"
                : "Loading request"}
            {status ? <StatusBadge label={status.label} tone={status.tone} /> : null}
          </SheetTitle>
          <SheetDescription>
            {item ? `${item.clientName} · ${item.caseNumber}` : "Assigned document"}
          </SheetDescription>
        </SheetHeader>

        {request.isError ? (
          <div className="p-5">
            <ErrorState
              description={request.error.message}
              onRetry={() => void request.refetch()}
              retrying={request.isFetching}
            />
          </div>
        ) : !item ? (
          <div className="p-5">
            <ListSkeleton rows={4} />
          </div>
        ) : (
          <div className="space-y-6 p-5 text-xs">
            <dl className="grid grid-cols-2 gap-3">
              <Fact term="Candidate" value={item.candidateName} />
              <Fact term="Client" value={item.clientName} />
              <Fact term="Assigned by" value={item.assignedBy} />
              <Fact term="Assigned" value={when(item.assignedAt)} />
              {item.handler ? <Fact term="Handled by" value={item.handler.name} /> : null}
              <Fact term="File" value={item.file?.name ?? "Unavailable"} />
              <Fact
                term="Size"
                value={
                  item.file ? `${formatBytes(item.file.sizeBytes)} · v${item.file.version}` : "—"
                }
              />
              {item.note ? <Fact wide term="Note from SPOC-RM" value={item.note} /> : null}
              {item.resolutionNote ? (
                <Fact wide term="What was fixed" value={item.resolutionNote} />
              ) : null}
              {item.status !== "PENDING" ? (
                <>
                  <Fact term="Your decision" value={status?.label ?? item.status} />
                  <Fact term="Decided" value={when(item.decidedAt)} />
                  {item.reason ? <Fact wide term="Your reason" value={item.reason} /> : null}
                </>
              ) : null}
            </dl>
            {item.canDelegate ? (
              <DelegateRequestPanel key={`${item.id}-${item.version}`} item={item} />
            ) : null}
            {item.canUploadReport || item.report ? <VendorReportPanel item={item} /> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!item.file || previewing}
                loading={previewing}
                onClick={() => void preview()}
              >
                <Eye className="size-4" aria-hidden /> Preview document
              </Button>
              {item.status === "PENDING" ? (
                <>
                  <Button type="button" onClick={() => setDecision("APPROVED")}>
                    <CheckCircle2 className="size-4" aria-hidden /> Approve
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDecision("REJECTED")}
                  >
                    <XCircle className="size-4" aria-hidden /> Reject
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        )}

        <VendorDecisionDialog
          decision={decision}
          documentLabel={documentLabel}
          busy={decide.isPending}
          onClose={() => setDecision(null)}
          onConfirm={(reason) =>
            item && decision
              ? decide.mutate({ requestId: item.id, decision, reason, version: item.version })
              : undefined
          }
        />
      </SheetContent>
    </Sheet>
  );
}

function Fact({ term, value, wide }: { term: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 min-w-0" : "min-w-0"}>
      <dt className="text-[10px] text-muted-foreground">{term}</dt>
      <dd className="mt-0.5 font-medium break-words whitespace-pre-wrap text-foreground">
        {value}
      </dd>
    </div>
  );
}
