import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Landmark, ReceiptIndianRupee, WalletCards } from "lucide-react";

import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton, ChartSkeleton } from "@/components/feedback/skeletons";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { getFinanceOverview } from "@/lib/api/finance";
import { money } from "@/features/stakeholders/finance/finance-utils";
import { MonthlyStatement } from "@/features/stakeholders/finance/MonthlyStatement";

export const Route = createFileRoute("/admin/finance")({
  head: () => ({
    meta: [
      { title: "Finance & Billing Oversight — Sapling Global" },
      {
        name: "description",
        content: "Read-only billing, collection and receivables exposure for platform admins.",
      },
    ],
  }),
  component: FinanceOversightPage,
});

function FinanceOversightPage() {
  const overview = useQuery({
    queryKey: ["finance", "admin", "overview"],
    queryFn: getFinanceOverview,
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance & billing oversight"
        actions={<MonthlyStatement />}
        description="Commercial exposure only. Invoice issue, payment reconciliation and credit actions remain in the Finance workspace."
        meta={
          overview.data ? `Snapshot generated ${formatTime(overview.data.generatedAt)}` : undefined
        }
      />
      {overview.isError ? (
        <ErrorState
          title="Finance oversight unavailable"
          description={overview.error.message}
          onRetry={() => void overview.refetch()}
          retrying={overview.isFetching}
        />
      ) : null}
      {overview.isPending ? (
        <>
          <CardGridSkeleton count={4} />
          <ChartSkeleton height={250} />
        </>
      ) : overview.data ? (
        <FinanceSignals data={overview.data} />
      ) : null}
    </div>
  );
}

function FinanceSignals({ data }: { data: Awaited<ReturnType<typeof getFinanceOverview>> }) {
  const summary = data.summary;
  const cards = [
    {
      label: "Billed",
      value: money(summary.billed),
      detail: `${summary.invoiceCount} invoices`,
      icon: ReceiptIndianRupee,
      tone: "info",
    },
    {
      label: "Collected",
      value: money(summary.collected),
      detail: `${ratio(summary.collected, summary.billed)}% realised`,
      icon: Landmark,
      tone: "success",
    },
    {
      label: "Outstanding",
      value: money(summary.outstanding),
      detail: `${summary.openInvoiceCount} open invoices`,
      icon: WalletCards,
      tone: "warning",
    },
    {
      label: "Overdue",
      value: money(summary.overdueAmount),
      detail: `${summary.overdueCount} beyond due date`,
      icon: AlertTriangle,
      tone: summary.overdueCount ? "critical" : "success",
    },
  ] as const;
  const ageingTotal = data.ageing.reduce((sum, item) => sum + item.value, 0);
  const peak = Math.max(1, ...data.ageing.map((item) => item.value));

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <FinanceSignal key={card.label} {...card} />
        ))}
      </div>
      <Section
        title="Receivables exposure"
        description="Outstanding value by collection age; no payment execution controls are exposed here."
      >
        {ageingTotal ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.ageing.map((item, index) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border bg-card/70 p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-foreground">{item.label}</span>
                  <span className="num text-xs font-semibold text-foreground">
                    {money(item.value)}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <span
                    className={`block h-full rounded-full ${index === 0 ? "bg-success" : index === 1 ? "bg-warning" : "bg-critical"}`}
                    style={{ width: `${Math.max(3, (item.value / peak) * 100)}%` }}
                  />
                </div>
                <p className="num mt-2 text-[10px] text-muted-foreground">
                  {Math.round((item.value / ageingTotal) * 100)}% of outstanding exposure
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border-strong bg-muted/20 py-12 text-center text-xs text-muted-foreground">
            No outstanding receivables.
          </p>
        )}
      </Section>
    </>
  );
}

function FinanceSignal({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Landmark;
  tone: "info" | "success" | "warning" | "critical";
}) {
  return (
    <article
      className={`rounded-[1.4rem] border border-white/80 p-4 shadow-[var(--shadow-card)] ${toneClass[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {label}
          </p>
          <p className="num mt-2 truncate text-xl font-medium tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <Icon className="size-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">{detail}</p>
    </article>
  );
}

const toneClass = {
  info: "bg-info-soft/65",
  success: "bg-success-soft/65",
  warning: "bg-warning-soft/65",
  critical: "bg-critical-soft/65",
} as const;
function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
