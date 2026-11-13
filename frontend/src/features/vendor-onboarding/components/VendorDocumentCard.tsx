import { useState, useRef } from "react";
import { Download, Eye, FileText, Info, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openDocumentPreview } from "@/lib/backend-api/document-preview";
import { apiDownload } from "@/lib/backend-api/client";
import {
  downloadVendorDocument,
  type VendorDocumentItem,
} from "../api/vendor-onboarding-api";
import { DocChip, DocIcon } from "@/features/onboarding/onboarding-ui";
import { docRowClass, fileSize, shortDate } from "@/features/onboarding/onboarding-format";
import type { OnboardingDocumentState } from "@/lib/backend-api/onboarding";

const DOC_CONFIG: Record<
  string,
  { title: string; subtitle: string; hint: string }
> = {
  COMPANY_PAN: {
    title: "Company PAN Card",
    subtitle: "Permanent Account Number card registered in your business name",
    hint: "Upload clear scanned copy or e-PAN (PDF, PNG or JPG)",
  },
  GST_CERTIFICATE: {
    title: "GSTIN Certificate",
    subtitle: "Goods and Services Tax Registration Certificate (Form GST REG-06)",
    hint: "Upload complete 3-page certificate (PDF, PNG or JPG)",
  },
  BUSINESS_REGISTRATION: {
    title: "Legal Business Registration",
    subtitle: "Certificate of Incorporation, MSME/Udyam, Partnership Deed, or Trade License",
    hint: "Upload official registration or incorporation deed (PDF, PNG or JPG)",
  },
};

export function VendorDocumentCard({
  docType,
  document,
  isMainVendor,
  canUpload,
  onUpload,
}: {
  docType: "COMPANY_PAN" | "GST_CERTIFICATE" | "BUSINESS_REGISTRATION";
  document?: VendorDocumentItem;
  isMainVendor: boolean;
  canUpload: boolean;
  onUpload: (file: File) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const config = DOC_CONFIG[docType] ?? {
    title: docType,
    subtitle: "Business document",
    hint: "Upload verification file",
  };

  const latest = document?.latestRevision;
  const docState: OnboardingDocumentState =
    document?.status === "VERIFIED"
      ? "APPROVED"
      : document?.status === "REJECTED"
        ? "REJECTED"
        : latest
          ? "PENDING"
          : "MISSING";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 10 MB.");
      return;
    }

    setUploading(true);
    try {
      await onUpload(file);
      toast.success(`${config.title} uploaded successfully`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload document");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handlePreview = () => {
    if (!document?.publicId) return;
    openDocumentPreview(() =>
      apiDownload(
        `/vendor/onboarding/me/document/${encodeURIComponent(document.publicId)}/download`,
      ),
    ).catch((err: any) => {
      toast.error("Preview failed", { description: err?.message || "Could not open document" });
    });
  };

  return (
    <li className={`onb-doc ${docRowClass(docState)}`}>
      <DocIcon state={docState} />
      <div className="min-w-0 flex-1">
        <div className="onb-doc-title">
          <span>{config.title}</span>
          <DocChip state={docState} />
        </div>
        <p className="onb-doc-hint">{config.subtitle} · {config.hint}</p>

        {latest && document ? (
          <div className="onb-doc-file">
            <button
              type="button"
              onClick={handlePreview}
              title="Click to preview document in browser"
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              <Eye className="size-3.5" aria-hidden />
              {latest.fileName}
            </button>
            <span>
              {fileSize(latest.fileSize)} · r{latest.revisionNumber} · uploaded {shortDate(latest.uploadedAt)}
            </span>
          </div>
        ) : null}

        {document?.rejectionReason && (
          <p className="onb-doc-review">
            <Info className="mr-1 inline size-3.5" aria-hidden />
            Reviewer note: {document.rejectionReason}
          </p>
        )}
      </div>

      <div className="onb-doc-actions flex items-center gap-2">
        {latest && document?.publicId && isMainVendor ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void downloadVendorDocument(document.publicId, latest.fileName)}
            title="Download original file"
          >
            <Download className="size-3.5" aria-hidden />
            Download
          </Button>
        ) : null}

        {isMainVendor && canUpload ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              hidden
              aria-label={`Upload ${config.title}`}
            />
            <Button
              type="button"
              size="sm"
              variant={latest ? "outline" : "default"}
              loading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-3.5" aria-hidden />
              {latest ? "Replace" : "Upload"}
            </Button>
          </>
        ) : !isMainVendor ? (
          <span className="text-xs italic text-muted-foreground">Team Member (View Only)</span>
        ) : null}
      </div>
    </li>
  );
}
