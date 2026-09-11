import { FileCheck2, Fingerprint, MapPin } from "lucide-react";
import { toast } from "sonner";

import type { QaQueueItem } from "@/lib/api/qa";
import { DocumentFileActions } from "@/features/cases/document-file-actions";
import { viewFieldEvidence } from "@/lib/api/field-visits";
import { humanize, riskTone } from "../utils";
import type { QaReviewTab } from "./QaReviewTabs";

export function QaEvidencePanel({
  item,
  selectedChecks,
  onToggleCheck,
  view = "checks",
}: {
  item: QaQueueItem;
  selectedChecks: string[];
  onToggleCheck: (id: string) => void;
  view?: Exclude<QaReviewTab, "decision">;
}) {
  return (
    <div className="space-y-4">
      {view === "checks" ? (
        <section className="rounded-2xl border border-mint/30 bg-gradient-to-br from-mint-soft to-mint-soft/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[12px] font-semibold">Check results and findings</h3>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Compare source outcomes and select only checks that require rework.
              </p>
            </div>
            <span className="num rounded-full bg-mint-soft px-2.5 py-1 text-[9px] font-medium text-mint-deep">
              {item.checks.length} checks
            </span>
          </div>
          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            {item.checks.map((check) => (
              <article
                key={check.publicId}
                className="rounded-[1.1rem] border border-border/70 bg-white/70 p-4 transition hover:border-mint/25"
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
                      <span className="block text-[11.5px] font-semibold">
                        {humanize(check.type)}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
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
                <p className="mt-3 text-[10.5px] font-medium text-foreground">
                  Outcome: {humanize(check.result ?? "unavailable")}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                  {check.sourceSummary ?? "No source summary supplied."}
                </p>
                {check.findings.map((finding) => (
                  <div
                    key={finding.publicId}
                    className="mt-3 rounded-[0.9rem] border border-warning/20 bg-warning-soft/60 p-3"
                  >
                    <p className="text-[10.5px] font-semibold">
                      {finding.title} · {humanize(finding.severity)}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{finding.description}</p>
                    {finding.source ? (
                      <p className="mt-1 text-[9px] text-muted-foreground">
                        Source: {finding.source}
                      </p>
                    ) : null}
                  </div>
                ))}
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {view === "documents" ? (
        <section>
          <div className="rounded-2xl border border-info/30 bg-gradient-to-br from-info-soft to-info-soft/20 p-4">
            <h3 className="flex items-center gap-2 text-[12px] font-semibold">
              <span className="grid size-8 place-items-center rounded-full bg-info-soft text-info-foreground">
                <FileCheck2 className="size-3.5" />
              </span>
              Case documents
            </h3>
            <div className="mt-3 space-y-2">
              {item.documents.map((document) => {
                const version = document.versions[0];
                return (
                  <div
                    key={document.publicId}
                    className="flex flex-wrap items-center gap-3 rounded-[1rem] border border-white/80 bg-white/70 p-3"
                  >
                    <Fingerprint className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10.5px] font-semibold">
                        {version?.originalName ?? humanize(document.type)}
                      </p>
                      <p className="truncate text-[8.5px] text-muted-foreground">
                        {version
                          ? `${version.malwareState} · SHA ${version.sha256.slice(0, 12)}…`
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
                  </div>
                );
              })}
              {!item.documents.length ? (
                <p className="text-[10px] text-muted-foreground">No case documents attached.</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
      {view === "field" && item.fieldVisits.length > 0 ? (
        <section>
          <div className="rounded-2xl border border-warning/30 bg-gradient-to-br from-warning-soft to-warning-soft/20 p-4">
            <h3 className="flex items-center gap-2 text-[12px] font-semibold">
              <span className="grid size-8 place-items-center rounded-full bg-warning-soft text-warning-foreground">
                <MapPin className="size-3.5" />
              </span>
              Field evidence
            </h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Existing visits linked to this case, reviewed as supporting verification evidence.
            </p>
            <div className="mt-3 space-y-2">
              {item.fieldVisits.map((visit) => (
                <p key={visit.publicId} className="rounded-xl bg-white/80 p-3 text-xs">
                  <strong>{visit.address}</strong>
                  <span className="ml-2 text-muted-foreground">{humanize(visit.status)}</span>
                </p>
              ))}
            </div>
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
                    className="block w-full rounded-[1rem] border border-white/80 bg-white/70 p-3 text-left transition hover:border-warning/25 hover:bg-warning-soft/35"
                  >
                    <p className="text-[10.5px] font-semibold">
                      {humanize(evidence.type)} · {visit.address}
                    </p>
                    <p className="mt-1 text-[8.5px] text-muted-foreground">
                      SHA {evidence.sha256.slice(0, 16)}… ·{" "}
                      {new Date(evidence.capturedAt).toLocaleString("en-IN")}
                    </p>
                    <span className="mt-2 block text-[9px] font-medium text-mint-deep">
                      Open controlled evidence
                    </span>
                  </button>
                )),
              )}
              {!item.fieldVisits.some((visit) => visit.evidence.length) ? (
                <p className="text-[10px] text-muted-foreground">
                  No field evidence linked to this case.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
