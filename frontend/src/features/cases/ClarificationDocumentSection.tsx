import { FileCheck2, History } from "lucide-react";
import { formatBytes, formatDateTime, humanize } from "@/features/cases/case-detail-formatting";
import { DocumentFileActions } from "@/features/cases/document-file-actions";
import type { SubmittedClarificationDocument } from "@/lib/backend-api/clarifications-l2-types";

export function ClarificationDocumentSection({
  document,
  submittedVersionNumber,
  headingPrefix = "Submitted",
  showHistoryWhenSingle = true,
}: {
  document: SubmittedClarificationDocument;
  submittedVersionNumber?: number | null;
  headingPrefix?: string;
  showHistoryWhenSingle?: boolean;
}) {
  const versions = document.versions ?? [];
  const primary =
    versions.find((v) => v.version === submittedVersionNumber) ??
    versions.find((v) => v.isSubmitted) ??
    versions[0];
  if (!primary) return null;

  const showHistory = showHistoryWhenSingle ? versions.length > 0 : versions.length > 1;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-[12px]">
          <p className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-900">
            <FileCheck2 className="size-3.5 text-blue-600" />
            <span>
              {headingPrefix}: {humanize(document.type)} · v{primary.version}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700">
              {humanize(primary.reviewStatus)}
            </span>
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {primary.originalName} · {formatBytes(primary.sizeBytes)} · Scan:{" "}
            {humanize(primary.malwareState)}
          </p>
        </div>
        <DocumentFileActions
          documentId={document.id}
          filename={primary.originalName}
          label={`${humanize(document.type)} v${primary.version}`}
          version={primary.version}
          compact={false}
        />
      </div>

      {showHistory ? (
        <details className="mt-2.5 border-t border-slate-200/80 pt-2 text-[11.5px] text-slate-600">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-slate-800">
            <History className="size-3.5" /> Version history ({versions.length})
          </summary>
          <div className="mt-2 space-y-1.5">
            {versions.map((ver) => (
              <div
                key={ver.version}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">
                    v{ver.version} · {ver.originalName} · {humanize(ver.reviewStatus)}
                  </p>
                  <p className="truncate text-[10.5px] text-slate-500">
                    {formatBytes(ver.sizeBytes)} · {formatDateTime(ver.createdAt)}
                    {ver.reviewNote ? ` · ${ver.reviewNote}` : ""}
                  </p>
                </div>
                <DocumentFileActions
                  documentId={document.id}
                  filename={ver.originalName}
                  label={`${humanize(document.type)} v${ver.version}`}
                  version={ver.version}
                />
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
