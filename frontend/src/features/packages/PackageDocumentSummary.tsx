import { FileCheck2, FileX2, Info } from "lucide-react";
import { documentPlan, type CheckOptions } from "./check-catalogue";

/**
 * What the candidate will upload for this package, and why, so nobody is surprised that
 * four checks ask for more than four documents (two IDs, two addresses, two degrees).
 */
export function PackageDocumentSummary({
  checks,
  options,
  extraDocuments = [],
}: {
  checks: readonly string[];
  options: Readonly<Record<string, CheckOptions>>;
  extraDocuments?: readonly string[];
}) {
  const plan = documentPlan(checks, options, extraDocuments);
  return (
    <section
      className="rounded-2xl border border-emerald-200 bg-emerald-50/40"
      aria-label="Candidate documents"
    >
      <header className="border-b border-emerald-100 px-4 py-3">
        <h3 className="text-[13px] font-semibold text-slate-900">What the candidate will upload</h3>
        <p className="text-[12px] text-slate-600" aria-live="polite">
          {checks.length
            ? `${checks.length} ${checks.length === 1 ? "check" : "checks"} · ${plan.totalUploads} ${
                plan.totalUploads === 1 ? "upload" : "uploads"
              } · ${plan.totalPapers} ${plan.totalPapers === 1 ? "document" : "documents"} in all`
            : "Tick checks above to see the documents."}
        </p>
      </header>
      {checks.length ? (
        <div className="space-y-3 px-4 py-3">
          {plan.uploads.length ? (
            <ol className="space-y-2">
              {plan.uploads.map((upload, index) => (
                <li
                  key={upload.type}
                  className="rounded-xl border border-emerald-100 bg-white px-3 py-2"
                >
                  <p className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-slate-900">
                    <FileCheck2 className="size-3.5 text-emerald-600" aria-hidden />
                    {index + 1}. {upload.label}
                    {upload.papers.length > 1 ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800">
                        {upload.papers.length} in one file
                      </span>
                    ) : null}
                  </p>
                  {upload.papers.length > 1 ? (
                    <p className="mt-0.5 text-[11.5px] text-slate-600">
                      Contains: {upload.papers.join(", ")}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-[11.5px] text-slate-500">
                    {upload.forChecks.length ? `For ${upload.forChecks.join(" and ")}. ` : ""}
                    {upload.why.join(" ")}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[12px] text-slate-600">
              The candidate uploads nothing for these checks.
            </p>
          )}
          {plan.noDocument.length ? (
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                No document needed
              </p>
              <ul className="mt-1 space-y-0.5">
                {plan.noDocument.map((row) => (
                  <li key={row.type} className="flex gap-1.5 text-[11.5px] text-slate-600">
                    <FileX2 className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
                    <span>
                      <span className="font-medium text-slate-800">{row.label}:</span> {row.why}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="flex gap-1.5 rounded-lg bg-white/70 px-2.5 py-2 text-[11px] text-slate-500">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            The candidate uploads one file per document type. When a type covers more than one paper
            (two addresses, two degrees, two employers), all of them go in that one file. A document
            two checks share, like the PAN, is asked for once.
          </p>
        </div>
      ) : null}
    </section>
  );
}
