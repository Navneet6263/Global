import { Check } from "lucide-react";

import type { CaseDetail } from "@/lib/api/cases";
import { caseStatusLabel, relativeTime } from "./client-portal-utils";

export function ClientCaseTimeline({ items }: { items: CaseDetail["statusHistory"] }) {
  return (
    <section className="rounded-2xl border border-slate-200">
      <header className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-xs font-semibold">Progress timeline</h3>
        <p className="mt-0.5 text-[10px] text-slate-500">A clear history of every case movement</p>
      </header>
      <div className="p-4">
        {[...items].reverse().map((event, index) => (
          <div
            key={`${event.createdAt}-${event.toStatus}`}
            className="relative flex gap-3 pb-4 last:pb-0"
          >
            {index < items.length - 1 ? (
              <span className="absolute left-3 top-6 h-full w-px bg-slate-200" />
            ) : null}
            <span
              className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full ${index === 0 ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500"}`}
            >
              <Check className="h-3 w-3" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[11px] font-semibold text-slate-800">
                {caseStatusLabel(event.toStatus)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                {relativeTime(event.createdAt)}
                {event.reason ? ` · ${event.reason}` : ""}
              </p>
            </div>
          </div>
        ))}
        {!items.length ? (
          <p className="py-4 text-center text-xs text-slate-500">
            Timeline will appear after the first workflow event.
          </p>
        ) : null}
      </div>
    </section>
  );
}
