import { AlertTriangle, UploadCloud } from "lucide-react";

import type { CandidateCase } from "@/lib/api/candidate-portal";
import { documentsToReupload, humanize } from "./candidate-utils";

/**
 * "Re-upload required" at the top of the documents panel, with the reviewer's
 * message. The button only preselects the type in the existing upload form.
 */
export function CandidateReuploadNotice({
  documents,
  canUpload,
  isUploadable,
  onUpload,
}: {
  documents: CandidateCase["documents"];
  canUpload: boolean;
  isUploadable: (type: string) => boolean;
  onUpload: (type: string) => void;
}) {
  const pending = documentsToReupload(documents);
  if (!pending.length) return null;
  return (
    <div
      role="alert"
      className="mt-4 space-y-2 rounded-2xl border border-warning/30 bg-warning-soft/60 p-3"
    >
      <p className="flex items-center gap-2 text-xs font-semibold text-warning-foreground">
        <AlertTriangle className="size-4" aria-hidden />
        {pending.length === 1
          ? "One document needs to be uploaded again"
          : `${pending.length} documents need to be uploaded again`}
      </p>
      {pending.map((document) => (
        <div
          key={document.type}
          className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-white/80 px-3 py-2.5"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">
              {humanize(document.type)}
              <span className="ml-2 text-[9px] text-muted-foreground">
                Re-upload required · current v{document.currentVersion}
              </span>
            </p>
            {document.reviewNote ? (
              <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-muted-foreground">
                {document.reviewNote}
              </p>
            ) : null}
          </div>
          {canUpload && isUploadable(document.type) ? (
            <button
              type="button"
              onClick={() => onUpload(document.type)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-[11px] font-semibold text-primary-foreground"
            >
              <UploadCloud className="size-3.5" aria-hidden /> Upload corrected file
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
