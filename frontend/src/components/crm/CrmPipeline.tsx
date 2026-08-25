import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, CircleDot, LayoutGrid, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { humanize, money } from "@/components/crm/crm-utils";
import {
  opportunityStages,
  updateOpportunity,
  type Opportunity,
  type OpportunityStage,
} from "@/lib/api/crm";

const stageStyle: Record<OpportunityStage, { dot: string; chip: string }> = {
  NEW: { dot: "bg-sky-500", chip: "bg-sky-50 text-sky-700" },
  QUALIFIED: { dot: "bg-blue-500", chip: "bg-blue-50 text-blue-700" },
  PROPOSAL: { dot: "bg-violet-500", chip: "bg-violet-50 text-violet-700" },
  NEGOTIATION: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700" },
  WON: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
  LOST: { dot: "bg-stone-400", chip: "bg-stone-100 text-stone-600" },
};

export function CrmPipeline({ items }: { items: Opportunity[] }) {
  const [focus, setFocus] = useState<OpportunityStage | "ALL">("ALL");
  const visibleStages =
    focus === "ALL" ? opportunityStages.filter((stage) => stage !== "LOST") : [focus];
  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-orange-50 text-orange-700">
            <LayoutGrid className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold">Opportunity pipeline</h2>
            <p className="text-[10px] text-muted-foreground">
              Select a stage to focus · change status from any card
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFocus("ALL")}
          className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${focus === "ALL" ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}
        >
          All stages
        </button>
      </div>
      <div className="grid grid-cols-3 border-b border-border/70 lg:grid-cols-6">
        {opportunityStages.map((stage) => {
          const rows = items.filter((item) => item.stage === stage);
          const value = rows.reduce((sum, item) => sum + Number(item.estimatedValue), 0);
          return (
            <button
              key={stage}
              type="button"
              onClick={() => setFocus(stage)}
              className={`border-r border-border/60 px-3 py-3 text-left transition last:border-r-0 hover:bg-secondary/35 ${focus === stage ? "bg-orange-50/60" : ""}`}
            >
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.08em]">
                  <span className={`h-1.5 w-1.5 rounded-full ${stageStyle[stage].dot}`} />
                  {humanize(stage)}
                </span>
                <span className="num text-[9px] text-muted-foreground">{rows.length}</span>
              </span>
              <strong className="num mt-1.5 block truncate text-xs">{money(value)}</strong>
            </button>
          );
        })}
      </div>
      <div
        className={`grid gap-3 overflow-x-auto p-4 ${focus === "ALL" ? "xl:grid-cols-5" : "md:grid-cols-2 xl:grid-cols-3"}`}
      >
        {visibleStages.map((stage) => {
          const rows = items.filter((item) => item.stage === stage);
          return (
            <section key={stage} className="min-w-[170px] rounded-xl bg-secondary/35 p-2.5">
              <div className="mb-2.5 flex items-center justify-between px-1">
                <span className="flex items-center gap-1.5 text-[10px] font-bold">
                  <CircleDot className="h-3 w-3 text-muted-foreground" />
                  {humanize(stage)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${stageStyle[stage].chip}`}
                >
                  {rows.length}
                </span>
              </div>
              <div className="space-y-2">
                {rows.slice(0, 10).map((item) => (
                  <DealCard key={item.id} item={item} />
                ))}
                {!rows.length ? (
                  <div className="grid h-24 place-items-center rounded-xl border border-dashed border-border bg-white/60 text-[10px] text-muted-foreground">
                    No deals in this stage
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function DealCard({ item }: { item: Opportunity }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (stage: OpportunityStage) =>
      updateOpportunity(item.id, {
        version: item.version,
        stage,
        activitySummary: `Moved to ${humanize(stage)}`,
      }),
    onSuccess: async () => {
      toast.success("Pipeline updated");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crm", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["crm", "opportunities"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <article className="rounded-xl border border-border/70 bg-white p-3 shadow-[0_5px_16px_-14px_rgba(0,0,0,.3)] transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold">{item.companyName}</p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.contactName}</p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="num text-sm font-bold">{money(Number(item.estimatedValue))}</p>
          <p className="mt-0.5 text-[9px] text-muted-foreground">{item.probability}% probability</p>
        </div>
        <div className="h-7 w-7 rounded-full bg-orange-100 text-center text-[9px] font-bold leading-7 text-orange-700">
          {item.probability}
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-orange-500"
          style={{ width: `${item.probability}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-[9px] text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1">
          <UserRound className="h-3 w-3" />
          <span className="truncate">{item.owner?.displayName ?? "Unassigned"}</span>
        </span>
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {shortDate(item.expectedCloseDate)}
        </span>
      </div>
      <select
        value={item.stage}
        onChange={(event) => mutation.mutate(event.target.value as OpportunityStage)}
        disabled={mutation.isPending}
        aria-label={`Stage for ${item.companyName}`}
        className={`mt-2 h-8 w-full rounded-lg border-0 px-2 text-[10px] font-bold outline-none ${stageStyle[item.stage].chip}`}
      >
        {opportunityStages.map((stage) => (
          <option key={stage} value={stage}>
            {humanize(stage)}
          </option>
        ))}
      </select>
    </article>
  );
}

function shortDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(value))
    : "No date";
}
