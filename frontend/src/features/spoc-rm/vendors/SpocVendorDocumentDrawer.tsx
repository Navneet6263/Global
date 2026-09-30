import { useState } from "react";
import { Eye } from "lucide-react";
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
import { formatBytes } from "@/features/cases/case-detail-formatting";
import { statusTone } from "../config/spoc-meta";
import { dateTime, label } from "../utils/spoc-format";
import { AssignVendorDialog } from "./AssignVendorDialog";
import { RequestReuploadDialog } from "./RequestReuploadDialog";
import { spocVendorApi } from "./spoc-vendor-api";
import { VENDOR_STATUS_META } from "./spoc-vendor-model";
import {
  useRequestReupload,
  useSaveVendorAssignment,
  useSpocVendorDocument,
} from "./use-spoc-vendors";
import { Fact, Section } from "./VendorDrawerParts";
import { VendorHistoryTimeline } from "./VendorHistoryTimeline";
import { VendorReportActions } from "./VendorReportActions";
import { VendorStatusPanel } from "./VendorStatusPanel";

/**
 * One document: file details, preview, current vendor status, full history and the
 * actions the server allows (assign; after a rejection, re-assign or re-upload).
 */
export function SpocVendorDocumentDrawer({
  documentId,
  onClose,
}: {
  documentId: string | undefined;
  onClose: () => void;
}) {
  const detail = useSpocVendorDocument(documentId);
  const [dialog, setDialog] = useState<"assign" | "reassign" | "reupload" | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const save = useSaveVendorAssignment(() => setDialog(null));
  const reupload = useRequestReupload(() => setDialog(null));
  const item = detail.data;
  const status = item ? VENDOR_STATUS_META[item.vendorStatus] : null;
  const current = item?.current ?? null;
  const rejection =
    current?.status === "REJECTED" ? { vendor: current.vendor.name, reason: current.reason } : null;

  const preview = async () => {
    if (!item) return;
    setPreviewing(true);
    try {
      await spocVendorApi.preview(item.id);
    } catch (error) {
      toast.error("Preview failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Sheet open={Boolean(documentId)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {item ? label(item.type) : detail.isError ? "Document unavailable" : "Loading document"}
            {status ? <StatusBadge label={status.label} tone={status.tone} /> : null}
          </SheetTitle>
          <SheetDescription>
            {item
              ? `${item.caseNumber} · ${item.candidateName} · ${item.client.displayName}`
              : "Vendor assignment"}
          </SheetDescription>
        </SheetHeader>

        {detail.isError ? (
          <div className="p-5">
            <ErrorState
              description={detail.error.message}
              onRetry={() => void detail.refetch()}
              retrying={detail.isFetching}
            />
          </div>
        ) : !item ? (
          <div className="p-5">
            <ListSkeleton rows={4} />
          </div>
        ) : (
          <div className="space-y-6 p-5">
            <Section title="Uploaded file">
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <Fact term="File" value={item.file?.name ?? "No safe version"} />
                <Fact term="Size" value={item.file ? formatBytes(item.file.sizeBytes) : "—"} />
                <Fact term="Version" value={item.file ? `v${item.file.version}` : "—"} />
                <Fact term="Uploaded" value={dateTime(item.file?.uploadedAt)} />
                <Fact
                  term="Internal review"
                  value={
                    <StatusBadge
                      label={label(item.internalStatus)}
                      tone={statusTone(item.internalStatus)}
                    />
                  }
                />
                <Fact term="Case stage" value={label(item.caseStatus)} />
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!item.file || previewing}
                  loading={previewing}
                  onClick={() => void preview()}
                >
                  <Eye className="size-4" aria-hidden /> Preview file
                </Button>
                <VendorReportActions attempt={current} caseNumber={item.caseNumber} />
              </div>
            </Section>

            <Section title="Vendor status">
              <VendorStatusPanel
                item={item}
                onAssign={() => setDialog("assign")}
                onReassign={() => setDialog("reassign")}
                onReupload={() => setDialog("reupload")}
              />
            </Section>

            <Section title="Assignment history">
              <VendorHistoryTimeline
                attempts={item.history}
                reuploads={item.reuploadHistory}
                versions={item.versions}
              />
            </Section>
          </div>
        )}

        {item ? (
          <RequestReuploadDialog
            open={dialog === "reupload"}
            documentLabel={`${label(item.type)} · ${item.caseNumber}`}
            rejection={rejection}
            candidateLink={item.candidateLink}
            busy={reupload.isPending}
            onOpenChange={(open) => setDialog(open ? "reupload" : null)}
            onSubmit={(message) =>
              reupload.mutate({ documentId: item.id, version: item.version, message })
            }
          />
        ) : null}
        {item ? (
          <AssignVendorDialog
            open={dialog === "assign" || dialog === "reassign"}
            mode={dialog === "reassign" ? "reassign" : "assign"}
            documentLabel={`${label(item.type)} · ${item.caseNumber}`}
            rejection={rejection}
            busy={save.isPending}
            onOpenChange={(open) => setDialog(open ? dialog : null)}
            onSubmit={({ vendorId, text }) =>
              save.mutate(
                dialog === "reassign" && current
                  ? {
                      mode: "reassign",
                      assignmentId: current.id,
                      version: current.version,
                      vendorId,
                      resolutionNote: text,
                    }
                  : { mode: "assign", documentId: item.id, vendorId, note: text },
              )
            }
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
