import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DocChip, DocIcon } from "@/features/onboarding/onboarding-ui";
import { fileSize } from "@/features/onboarding/onboarding-format";
import {
  downloadOpsVendorDocument,
  previewOpsVendorDocument,
  type OpsVendorDocument,
} from "../api/vendor-onboarding-api";

const DOC_NAMES: Record<string, string> = {
  COMPANY_PAN: "Company PAN",
  GST_CERTIFICATE: "GSTIN Certificate",
  BUSINESS_REGISTRATION: "Legal Business Registration",
};

export function OpsVendorDocRow({
  doc,
  vendorProfileId,
  disabled,
  onReview,
}: {
  doc: OpsVendorDocument;
  vendorProfileId: string;
  disabled: boolean;
  onReview: (docId: string, decision: "ACCEPT" | "REJECT", reason?: string) => Promise<void>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<"ACCEPT" | "REJECT" | "PREVIEW" | null>(null);

  const latest = doc.revisions?.[0];
  const title = DOC_NAMES[doc.documentType] || doc.documentType;
  const chipState =
    doc.status === "VERIFIED" ? "APPROVED" : doc.status === "REJECTED" ? "REJECTED" : "PENDING";

  const handlePreview = async () => {
    setActionLoading("PREVIEW");
    try {
      await previewOpsVendorDocument(vendorProfileId, doc.publicId);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to preview document");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadOpsVendorDocument(
        vendorProfileId,
        doc.publicId,
        latest?.fileName ?? "document.pdf",
      );
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Failed to download document",
      );
    }
  };

  const handleAccept = async () => {
    setActionLoading("ACCEPT");
    try {
      await onReview(doc.publicId, "ACCEPT");
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading("REJECT");
    try {
      await onReview(doc.publicId, "REJECT", rejectReason.trim());
      setRejecting(false);
      setRejectReason("");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <li className="onb-doc">
      <DocIcon state={chipState} />
      <div className="onb-doc-main">
        <div className="flex items-center gap-2">
          <strong>{title}</strong>
          <DocChip state={chipState} />
        </div>

        {latest ? (
          <small className="ops-subtle">
            {latest.fileName} · {fileSize(latest.fileSize ?? 0)} · Rev {latest.revisionNumber}
          </small>
        ) : (
          <small className="ops-subtle">No file revision submitted</small>
        )}

        {doc.rejectionReason ? (
          <div className="mt-1 text-xs text-red-600 font-medium">
            Feedback: {doc.rejectionReason}
          </div>
        ) : null}

        {rejecting ? (
          <div className="mt-3 flex flex-col gap-2 rounded border border-red-200 bg-red-50/50 p-2.5">
            <span className="text-xs font-semibold text-red-900">
              Provide rejection reason for {title}:
            </span>
            <input
              type="text"
              autoFocus
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Document image is blurry or expired; please re-upload."
              className="rounded border border-red-300 bg-white px-2 py-1 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleConfirmReject();
                if (e.key === "Escape") setRejecting(false);
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={actionLoading !== null}
                onClick={() => setRejecting(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!rejectReason.trim() || actionLoading !== null}
                loading={actionLoading === "REJECT"}
                onClick={handleConfirmReject}
              >
                Confirm rejection
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="onb-doc-action flex items-center gap-2">
        {latest ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={actionLoading !== null}
              loading={actionLoading === "PREVIEW"}
              onClick={handlePreview}
              title="Inspect in secure preview"
            >
              <Eye className="mr-1 size-3.5" aria-hidden />
              Inspect
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={actionLoading !== null}
              onClick={handleDownload}
              title="Download file"
            >
              <Download className="size-3.5" aria-hidden />
            </Button>
          </>
        ) : null}

        {!rejecting && (
          <>
            <Button
              size="sm"
              disabled={disabled || doc.status === "VERIFIED" || actionLoading !== null}
              loading={actionLoading === "ACCEPT"}
              onClick={handleAccept}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled || doc.status === "REJECTED" || actionLoading !== null}
              onClick={() => setRejecting(true)}
            >
              Reject
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
