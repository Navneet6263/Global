import { ChevronLeft, ChevronRight, Eye, SearchX, UserRound } from "lucide-react";

import { humanize, money } from "@/components/crm/crm-utils";
import { opportunityStages, type Opportunity, type OpportunityStage } from "@/lib/api/crm";

const stageTone: Record<OpportunityStage, string> = {
  NEW: "bg-sky-50 text-sky-700",
  QUALIFIED: "bg-blue-50 text-blue-700",
  PROPOSAL: "bg-violet-50 text-violet-700",
  NEGOTIATION: "bg-amber-50 text-amber-700",
  WON: "bg-emerald-50 text-emerald-700",
  LOST: "bg-stone-100 text-stone-600",
};

export function OpportunityRegisterV2({
  items,
  stage,
  page,
  hasPrevious,
  hasNext,
  onStage,
  onPrevious,
  onNext,
  onOpen,
}: {
  items: Opportunity[];
  stage: OpportunityStage | "ALL";
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onStage: (stage: OpportunityStage | "ALL") => void;
  onPrevious: () => void;
  onNext: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="surface overflow-hidden rounded-2xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="text-sm font-bold">Deal register</h2>
          <p className="text-[10px] text-muted-foreground">
            Server-paged contacts, ownership and next action
          </p>
        </div>
        <select
          value={stage}
          onChange={(event) => onStage(event.target.value as OpportunityStage | "ALL")}
          className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold"
        >
          <option value="ALL">All stages</option>
          {opportunityStages.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
      </header>
      {items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left">
            <thead className="bg-secondary/35 text-[9px] uppercase tracking-[.11em] text-muted-foreground">
              <tr>
                {["Account", "Owner", "Forecast", "Probability", "Next follow-up", "Stage", ""].map(
                  (label, index) => (
                    <th key={`${label}-${index}`} className="px-4 py-2.5 font-semibold">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const overdue = Boolean(
                  item.nextFollowUpAt && new Date(item.nextFollowUpAt) < new Date(),
                );
                return (
                  <tr
                    key={item.id}
                    className="border-t border-border/60 text-xs transition hover:bg-orange-50/30"
                  >
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => onOpen(item.id)} className="text-left">
                        <p className="font-bold hover:text-orange-700">{item.companyName}</p>
                        <p className="mt-0.5 text-[9px] text-muted-foreground">
                          {item.contactName}
                          {item.contactEmail ? ` · ${item.contactEmail}` : ""}
                        </p>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <UserRound className="h-3 w-3" />
                        {item.owner?.displayName ?? "Unassigned"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold">{money(Number(item.estimatedValue))}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full bg-orange-500"
                            style={{ width: `${item.probability}%` }}
                          />
                        </div>
                        <span className="text-[10px]">{item.probability}%</span>
                      </div>
                    </td>
                    <td
                      className={`px-4 py-3 text-[10px] ${overdue ? "font-semibold text-red-600" : "text-slate-500"}`}
                    >
                      {item.nextFollowUpAt ? formatDate(item.nextFollowUpAt) : "Not scheduled"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${stageTone[item.stage]}`}
                      >
                        {humanize(item.stage)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onOpen(item.id)}
                        aria-label={`Open ${item.companyName}`}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid h-36 place-items-center text-center">
          <div>
            <SearchX className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-[11px] font-semibold">No matching opportunities</p>
          </div>
        </div>
      )}
      <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
        <span className="text-[10px] text-slate-500">Server page {page}</span>
        <div className="flex gap-2">
          <PageButton
            label="Previous deals"
            disabled={!hasPrevious}
            onClick={onPrevious}
            icon={ChevronLeft}
          />
          <PageButton label="Next deals" disabled={!hasNext} onClick={onNext} icon={ChevronRight} />
        </div>
      </footer>
    </section>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  icon: Icon,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  icon: typeof ChevronLeft;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-35"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
