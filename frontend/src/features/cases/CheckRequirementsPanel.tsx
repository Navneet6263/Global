import { FileText } from "lucide-react";
import { humanize } from "@/features/stakeholders/client/client-portal-utils";

export interface CheckRequirement {
  type: string;
  documents: string[];
  details: string[];
}

/** What each selected check needs, shown before the case is started. */
export function CheckRequirementsPanel({
  requirements,
  checks,
}: {
  requirements: readonly CheckRequirement[];
  checks?: readonly string[];
}) {
  const shown = requirements.filter((item) => !checks || checks.includes(item.type));
  if (!shown.length) return null;
  return (
    <section
      className="rounded-xl border border-slate-200 bg-white"
      aria-label="Documents and details required"
    >
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <FileText className="size-4 text-blue-600" aria-hidden />
        <h4 className="text-sm font-bold text-slate-900">Documents and details required</h4>
      </header>
      <ul className="divide-y divide-slate-100">
        {shown.map((item) => (
          <li key={item.type} className="grid gap-1 px-4 py-2.5 text-xs sm:grid-cols-[160px_1fr]">
            <strong className="font-semibold text-slate-800">{humanize(item.type)}</strong>
            <span className="text-slate-600">
              <span className="block">
                <b className="font-medium text-slate-700">Document: </b>
                {item.documents.length ? item.documents.map(humanize).join(", ") : "None"}
              </span>
              <span className="block">
                <b className="font-medium text-slate-700">Details: </b>
                {item.details.length ? item.details.join(", ") : "None"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
