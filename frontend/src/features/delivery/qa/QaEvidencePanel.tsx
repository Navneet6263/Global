import { Download, FileCheck2, Fingerprint, MapPin } from "lucide-react";
import { toast } from "sonner";

import type { QaQueueItem } from "@/lib/api/qa";
import { downloadDocument } from "@/lib/api/documents";
import { viewFieldEvidence } from "@/lib/api/field-visits";
import { humanize, riskTone } from "../utils";

export function QaEvidencePanel({
  item,
  selectedChecks,
  onToggleCheck,
}: {
  item: QaQueueItem;
  selectedChecks: string[];
  onToggleCheck: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Check results and findings
        </h3>
        <div className="mt-2 grid gap-3 lg:grid-cols-2">
          {item.checks.map((check) => (
            <article
              key={check.publicId}
              className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedChecks.includes(check.publicId)}
                    onChange={() => onToggleCheck(check.publicId)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <span className="block text-sm font-semibold">{humanize(check.type)}</span>
                    <span className="text-[10px] text-slate-500">
                      Mark only if rework is required
                    </span>
                  </span>
                </label>
                <span
                  className={`rounded-full px-2 py-1 text-[9px] font-bold ${riskTone(check.riskLevel)}`}
                >
                  {humanize(check.riskLevel ?? "unclassified")}
                </span>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-700">
                Outcome: {humanize(check.result ?? "unavailable")}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {check.sourceSummary ?? "No source summary supplied."}
              </p>
              {check.findings.map((finding) => (
                <div
                  key={finding.publicId}
                  className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3"
                >
                  <p className="text-xs font-semibold">
                    {finding.title} · {humanize(finding.severity)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">{finding.description}</p>
                  {finding.source ? (
                    <p className="mt-1 text-[10px] text-slate-400">Source: {finding.source}</p>
                  ) : null}
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <FileCheck2 className="h-4 w-4 text-blue-600" /> Case documents
          </h3>
          <div className="mt-3 space-y-2">
            {item.documents.map((document) => {
              const version = document.versions[0];
              return (
                <div
                  key={document.publicId}
                  className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"
                >
                  <Fingerprint className="h-4 w-4 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">
                      {version?.originalName ?? humanize(document.type)}
                    </p>
                    <p className="truncate text-[9px] text-slate-400">
                      {version
                        ? `${version.malwareState} · SHA ${version.sha256.slice(0, 12)}…`
                        : "Awaiting upload"}
                    </p>
                  </div>
                  {version ? (
                    <button
                      type="button"
                      onClick={() =>
                        void downloadDocument(document.publicId, version.originalName).catch(
                          (error: Error) => toast.error(error.message),
                        )
                      }
                      className="rounded-lg bg-white p-2 shadow-sm"
                      title="Download controlled document"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              );
            })}
            {!item.documents.length ? (
              <p className="text-xs text-slate-500">No case documents attached.</p>
            ) : null}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-orange-600" /> Field evidence
          </h3>
          <div className="mt-3 space-y-2">
            {item.fieldVisits.flatMap((visit) =>
              visit.evidence.map((evidence) => (
                <button
                  type="button"
                  onClick={() =>
                    void viewFieldEvidence(evidence.publicId).catch((error: Error) =>
                      toast.error(error.message),
                    )
                  }
                  key={evidence.publicId}
                  className="block w-full rounded-lg bg-slate-50 p-3 text-left hover:bg-slate-100"
                >
                  <p className="text-xs font-semibold">
                    {humanize(evidence.type)} · {visit.address}
                  </p>
                  <p className="mt-1 text-[9px] text-slate-400">
                    SHA {evidence.sha256.slice(0, 16)}… ·{" "}
                    {new Date(evidence.capturedAt).toLocaleString("en-IN")}
                  </p>
                  <span className="mt-2 block text-[9px] font-semibold text-blue-600">
                    Open controlled evidence
                  </span>
                </button>
              )),
            )}
            {!item.fieldVisits.some((visit) => visit.evidence.length) ? (
              <p className="text-xs text-slate-500">No field evidence linked to this case.</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
