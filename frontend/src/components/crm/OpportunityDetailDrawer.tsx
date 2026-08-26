import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Mail, Phone, UserRound, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  addSalesActivity,
  getOpportunity,
  listSalesOwners,
  type OpportunityDetail,
  updateOpportunity,
} from "@/lib/api/crm";
import { OpportunityActivityPanel } from "./OpportunityActivityPanel";
import { OpportunityEditForm, type OpportunityEditInput } from "./OpportunityEditForm";
import { humanize, money } from "./crm-utils";

export function OpportunityDetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"SUMMARY" | "ACTIVITY" | "EDIT">("SUMMARY");
  const detail = useQuery({
    queryKey: ["crm", "opportunity", id],
    queryFn: () => getOpportunity(id),
  });
  const owners = useQuery({ queryKey: ["crm", "owners"], queryFn: listSalesOwners });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["crm", "opportunity", id] }),
      queryClient.invalidateQueries({ queryKey: ["crm", "opportunities"] }),
      queryClient.invalidateQueries({ queryKey: ["crm", "overview"] }),
    ]);
  };
  const update = useMutation({
    mutationFn: (input: OpportunityEditInput) => updateOpportunity(id, input),
    onSuccess: async () => {
      toast.success("Opportunity updated");
      await refresh();
      setTab("SUMMARY");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const activity = useMutation({
    mutationFn: (input: Parameters<typeof addSalesActivity>[1]) => addSalesActivity(id, input),
    onSuccess: async () => {
      toast.success("Activity recorded");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const item = detail.data;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close opportunity"
        className="absolute inset-0 cursor-default"
      />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
                Sales opportunity
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                {item?.companyName ?? "Loading opportunity"}
              </h2>
              <p className="text-xs text-slate-500">
                {item?.contactName ?? "Secure commercial record"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1">
            {(["SUMMARY", "ACTIVITY", "EDIT"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-bold ${tab === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
              >
                {humanize(value)}
              </button>
            ))}
          </nav>
        </header>
        <div className="p-5">
          {detail.isLoading ? (
            <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
          ) : null}
          {detail.isError ? (
            <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{detail.error.message}</p>
          ) : null}
          {item && tab === "SUMMARY" ? <OpportunitySummary item={item} /> : null}
          {item && tab === "ACTIVITY" ? (
            <OpportunityActivityPanel
              item={item}
              saving={activity.isPending}
              onAdd={(input) => activity.mutate(input)}
            />
          ) : null}
          {item && tab === "EDIT" ? (
            <OpportunityEditForm
              item={item}
              owners={owners.data?.items ?? []}
              saving={update.isPending}
              onSave={(input) => update.mutate(input)}
            />
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function OpportunitySummary({ item }: { item: OpportunityDetail }) {
  const overdue = Boolean(item.nextFollowUpAt && new Date(item.nextFollowUpAt) < new Date());
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <Fact label="Forecast" value={money(Number(item.estimatedValue))} />
        <Fact label="Probability" value={`${item.probability}%`} />
        <Fact label="Stage" value={humanize(item.stage)} />
      </section>
      <section className="rounded-2xl border border-slate-200 p-4">
        <h3 className="text-xs font-semibold">Contact and ownership</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Line icon={UserRound} label={item.owner?.displayName ?? "Unassigned"} />
          <Line icon={Mail} label={item.contactEmail ?? "Email not provided"} />
          <Line icon={Phone} label={item.contactPhone ?? "Phone not provided"} />
          <Line
            icon={CalendarDays}
            label={
              item.expectedCloseDate
                ? `Close ${formatDate(item.expectedCloseDate)}`
                : "Close date not set"
            }
          />
        </div>
      </section>
      <section
        className={`rounded-2xl border p-4 ${overdue ? "border-red-200 bg-red-50" : "border-orange-100 bg-orange-50/50"}`}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Next follow-up
        </p>
        <p className={`mt-1 text-sm font-semibold ${overdue ? "text-red-700" : "text-slate-800"}`}>
          {item.nextFollowUpAt ? formatDateTime(item.nextFollowUpAt) : "No follow-up scheduled"}
        </p>
      </section>
      {item.notes ? (
        <section className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Commercial notes
          </p>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{item.notes}</p>
        </section>
      ) : null}
      {item.lostReason ? (
        <section className="rounded-2xl border border-red-100 bg-red-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-500">Lost reason</p>
          <p className="mt-2 text-xs text-red-700">{item.lostReason}</p>
        </section>
      ) : null}
    </div>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
function Line({ icon: Icon, label }: { icon: typeof UserRound; label: string }) {
  return (
    <p className="flex items-center gap-2 text-xs text-slate-600">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      <span className="truncate">{label}</span>
    </p>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
