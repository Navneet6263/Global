import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Plus,
  Target,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { KpiStrip, PageHeader, Panel } from "@/components/dashboards/ui";
import { Sidebar } from "@/components/ops/Sidebar";
import { Topbar } from "@/components/ops/Topbar";
import {
  createOpportunity,
  getCrmOverview,
  listOpportunities,
  opportunityStages,
  updateOpportunity,
  type Opportunity,
  type OpportunityStage,
} from "@/lib/api/crm";

export const Route = createFileRoute("/sales-crm")({
  head: () => ({ meta: [{ title: "Sales & CRM — Sapling Global" }] }),
  component: SalesCrm,
});

function SalesCrm() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const overview = useQuery({ queryKey: ["crm", "overview"], queryFn: getCrmOverview });
  const opportunities = useQuery({
    queryKey: ["crm", "opportunities", search],
    queryFn: () => listOpportunities(search.trim() ? { search: search.trim() } : {}),
  });
  const data = overview.data;
  const rows = opportunities.data?.items ?? [];
  return (
    <div className="canvas-mesh min-h-screen bg-background text-foreground lg:pl-64">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          search={search}
          onSearchChange={setSearch}
          onRefresh={() => {
            void overview.refetch();
            void opportunities.refetch();
          }}
          isRefreshing={overview.isFetching || opportunities.isFetching}
        />
        <main className="flex-1 space-y-4 px-4 pb-10 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <PageHeader
              title="Sales & CRM"
              subtitle="Auditable opportunity pipeline from qualification to closure"
              chip={data ? `Live · ${formatDate(data.generatedAt)}` : "Loading live data"}
            />
            <button
              type="button"
              onClick={() => setShowCreate((value) => !value)}
              className="mb-4 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> New opportunity
            </button>
          </div>
          {overview.isError || opportunities.isError ? (
            <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
              {overview.error?.message ?? opportunities.error?.message}
            </div>
          ) : null}
          {showCreate ? <OpportunityForm onClose={() => setShowCreate(false)} /> : null}
          <KpiStrip
            items={[
              {
                label: "Open pipeline",
                value: money(data?.summary.openValue ?? 0),
                delta: `${data?.summary.openCount ?? 0} opportunities`,
                tone: "info",
              },
              {
                label: "Weighted pipeline",
                value: money(data?.summary.weightedValue ?? 0),
                delta: "probability adjusted",
                tone: "warning",
              },
              {
                label: "Closed won",
                value: money(data?.summary.wonValue ?? 0),
                delta: "all recorded wins",
                tone: "success",
              },
              {
                label: "Active owners",
                value: String(
                  new Set(rows.flatMap((item) => (item.owner ? [item.owner.publicId] : []))).size,
                ),
                delta: "assigned sales users",
                tone: "info",
              },
            ]}
          />
          <Panel
            title="Opportunity pipeline"
            subtitle="Move stages with an audited, concurrency-safe update"
          >
            <div className="grid gap-3 xl:grid-cols-5">
              {opportunityStages
                .filter((stage) => stage !== "LOST")
                .map((stage) => (
                  <PipelineColumn
                    key={stage}
                    stage={stage}
                    items={rows.filter((item) => item.stage === stage)}
                  />
                ))}
            </div>
          </Panel>
          <div className="grid gap-4 xl:grid-cols-[1.5fr_0.8fr]">
            <Panel title="Opportunity register" subtitle="Contact, ownership and expected close">
              <OpportunityTable items={rows} />
            </Panel>
            <Panel title="Recent activity" subtitle="Immutable pipeline history">
              <div className="space-y-3">
                {data?.activities.length ? (
                  data.activities.map((activity) => (
                    <div key={activity.id} className="rounded-2xl bg-secondary/50 p-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-accent" />
                        <p className="text-xs font-semibold">{activity.opportunity.companyName}</p>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {activity.summary}
                      </p>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {activity.actor.displayName} · {formatDate(activity.occurredAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <Empty text="No sales activity recorded yet" />
                )}
              </div>
            </Panel>
          </div>
        </main>
      </div>
    </div>
  );
}

function OpportunityForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [probability, setProbability] = useState(20);
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [source, setSource] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      createOpportunity({
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
        estimatedValue: Number(estimatedValue),
        probability,
        ...(expectedCloseDate ? { expectedCloseDate } : {}),
        ...(source.trim() ? { source: source.trim() } : {}),
      }),
    onSuccess: async () => {
      toast.success("Opportunity created");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crm", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["crm", "opportunities"] }),
      ]);
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (
          companyName.trim().length >= 2 &&
          contactName.trim().length >= 2 &&
          Number(estimatedValue) >= 0
        )
          mutation.mutate();
      }}
      className="surface-float rounded-3xl p-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Create opportunity</h2>
          <p className="text-xs text-muted-foreground">
            Capture only verified prospect information.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-muted-foreground"
        >
          Close
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input
          value={companyName}
          setValue={setCompanyName}
          placeholder="Company name"
          icon={Building2}
        />
        <Input
          value={contactName}
          setValue={setContactName}
          placeholder="Contact name"
          icon={UsersRound}
        />
        <Input
          value={contactEmail}
          setValue={setContactEmail}
          placeholder="Work email (optional)"
          type="email"
          icon={UsersRound}
        />
        <Input
          value={estimatedValue}
          setValue={setEstimatedValue}
          placeholder="Estimated value (INR)"
          type="number"
          icon={CircleDollarSign}
        />
        <Input
          value={source}
          setValue={setSource}
          placeholder="Lead source (optional)"
          icon={Target}
        />
        <Input
          value={expectedCloseDate}
          setValue={setExpectedCloseDate}
          placeholder="Expected close"
          type="date"
          icon={CalendarDays}
        />
        <label className="rounded-2xl bg-secondary/50 px-4 py-2 text-xs">
          Probability · {probability}%
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={probability}
            onChange={(event) => setProbability(Number(event.target.value))}
            className="mt-2 w-full accent-[var(--accent)]"
          />
        </label>
        <button
          disabled={
            mutation.isPending ||
            companyName.trim().length < 2 ||
            contactName.trim().length < 2 ||
            estimatedValue === ""
          }
          className="h-11 self-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {mutation.isPending ? "Creating…" : "Create opportunity"}
        </button>
      </div>
    </form>
  );
}

function PipelineColumn({ stage, items }: { stage: OpportunityStage; items: Opportunity[] }) {
  return (
    <section className="min-w-0 rounded-2xl bg-secondary/35 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold">{humanize(stage)}</p>
        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold">
          {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.slice(0, 8).map((item) => (
          <OpportunityCard key={item.id} item={item} />
        ))}
        {!items.length ? (
          <p className="rounded-xl border border-dashed border-border py-6 text-center text-[11px] text-muted-foreground">
            No opportunities
          </p>
        ) : null}
      </div>
    </section>
  );
}

function OpportunityCard({ item }: { item: Opportunity }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (stage: OpportunityStage) =>
      updateOpportunity(item.id, { version: item.version, stage }),
    onSuccess: async () => {
      toast.success("Stage updated");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crm", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["crm", "opportunities"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <article className="rounded-2xl bg-background p-3 shadow-sm">
      <p className="truncate text-xs font-semibold">{item.companyName}</p>
      <p className="mt-1 truncate text-[10px] text-muted-foreground">{item.contactName}</p>
      <p className="mt-3 text-sm font-bold">{money(Number(item.estimatedValue))}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">{item.probability}%</span>
        <select
          value={item.stage}
          onChange={(event) => mutation.mutate(event.target.value as OpportunityStage)}
          disabled={mutation.isPending}
          aria-label={`Stage for ${item.companyName}`}
          className="min-w-0 rounded-full border border-border bg-secondary px-2 py-1 text-[10px] outline-none"
        >
          {opportunityStages.map((stage) => (
            <option key={stage} value={stage}>
              {humanize(stage)}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}

function OpportunityTable({ items }: { items: Opportunity[] }) {
  if (!items.length) return <Empty text="No opportunities match the current search" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Company</th>
            <th className="py-2 pr-3 font-medium">Owner</th>
            <th className="py-2 pr-3 font-medium">Value</th>
            <th className="py-2 pr-3 font-medium">Expected close</th>
            <th className="py-2 font-medium">Stage</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-border/60">
              <td className="py-3 pr-3">
                <p className="font-medium">{item.companyName}</p>
                <p className="text-[11px] text-muted-foreground">{item.contactName}</p>
              </td>
              <td className="py-3 pr-3 text-xs text-muted-foreground">
                {item.owner?.displayName ?? "Unassigned"}
              </td>
              <td className="py-3 pr-3 font-semibold">{money(Number(item.estimatedValue))}</td>
              <td className="py-3 pr-3 text-xs text-muted-foreground">
                {item.expectedCloseDate ? formatDate(item.expectedCloseDate) : "Not set"}
              </td>
              <td className="py-3">
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                  {humanize(item.stage)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Input({
  value,
  setValue,
  placeholder,
  type = "text",
  icon: Icon,
}: {
  value: string;
  setValue: (value: string) => void;
  placeholder: string;
  type?: string;
  icon: typeof Building2;
}) {
  return (
    <label className="relative">
      <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type={type}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        min={type === "number" ? 0 : undefined}
        className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/25"
      />
    </label>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-10 text-center">
      <ArrowRight className="mx-auto h-5 w-5 text-muted-foreground" />
      <p className="mt-2 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}
