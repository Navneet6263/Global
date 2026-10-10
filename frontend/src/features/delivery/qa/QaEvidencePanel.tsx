import { Camera, FileCheck2, MapPin } from "lucide-react";
import { toast } from "sonner";

import type { QaQueueItem } from "@/lib/api/qa";
import { DocumentFileActions } from "@/features/cases/document-file-actions";
import { viewFieldEvidence } from "@/lib/api/field-visits";
import { humanize } from "../utils";
import type { QaReviewTab } from "./QaReviewTabs";

/** Case documents and field evidence QA checks next to the report. */
export function QaEvidencePanel({
  item,
  view,
}: {
  item: QaQueueItem;
  view: Exclude<QaReviewTab, "decision" | "report">;
}) {
  if (view === "documents")
    return (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-900">
            <FileCheck2 className="size-4 text-slate-400" aria-hidden />
            Case documents
          </h3>
          <span className="text-[12px] text-slate-500">{item.documents.length} files</span>
        </header>
        <ul className="divide-y divide-slate-100">
          {item.documents.map((document) => {
            const version = document.versions[0];
            return (
              <li key={document.publicId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                  <FileCheck2 className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-900">
                    {version?.originalName ?? humanize(document.type)}
                  </p>
                  <p className="truncate text-[12px] text-slate-500">
                    {humanize(document.type)} ·{" "}
                    {version
                      ? `${humanize(version.malwareState)} · SHA ${version.sha256.slice(0, 12)}…`
                      : "Awaiting upload"}
                  </p>
                </div>
                {version ? (
                  <DocumentFileActions
                    documentId={document.publicId}
                    filename={version.originalName}
                    label={humanize(document.type)}
                  />
                ) : null}
              </li>
            );
          })}
          {!item.documents.length ? (
            <li className="px-5 py-8 text-center text-[12.5px] text-slate-500">
              No case documents attached.
            </li>
          ) : null}
        </ul>
      </section>
    );
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-5 py-3">
        <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-900">
          <MapPin className="size-4 text-slate-400" aria-hidden />
          Field evidence
        </h3>
        <p className="mt-0.5 text-[12px] text-slate-500">
          Visits linked to this case, reviewed as supporting verification evidence.
        </p>
      </header>
      <div className="grid gap-3 p-5">
        {item.fieldVisits.map((visit) => (
          <div key={visit.publicId} className="rounded-xl border border-slate-200">
            <p className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 text-[13px]">
              <strong className="text-slate-900">{visit.address}</strong>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-medium text-slate-600">
                {humanize(visit.status)}
              </span>
            </p>
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {visit.evidence.map((evidence) => (
                <button
                  type="button"
                  onClick={() =>
                    void viewFieldEvidence(evidence.publicId).catch((error: Error) =>
                      toast.error(error.message),
                    )
                  }
                  key={evidence.publicId}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
                >
                  <Camera className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-semibold text-slate-900">
                      {humanize(evidence.type)}
                    </span>
                    <span className="block truncate text-[11.5px] text-slate-500">
                      SHA {evidence.sha256.slice(0, 16)}… ·{" "}
                      {new Date(evidence.capturedAt).toLocaleString("en-IN")}
                    </span>
                    <span className="mt-1 block text-[11.5px] font-medium text-blue-700">
                      Open controlled evidence
                    </span>
                  </span>
                </button>
              ))}
              {!visit.evidence.length ? (
                <p className="text-[12px] text-slate-500">No evidence captured on this visit.</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
