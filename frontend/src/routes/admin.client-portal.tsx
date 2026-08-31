import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock3, Files } from "lucide-react";

import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton, ListSkeleton } from "@/components/feedback/skeletons";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { getExceptionsDashboard, getOperationsDashboard } from "@/lib/api/dashboards";
import { humanize } from "@/features/stakeholders/client/client-portal-utils";

export const Route = createFileRoute("/admin/client-portal")({
  head: () => ({
    meta: [
      { title: "Client Portfolio Oversight — Sapling Global" },
      {
        name: "description",
        content: "Client-facing portfolio volume, response backlog and SLA risk signals.",
      },
    ],
  }),
  component: ClientOversightPage,
});

function ClientOversightPage() {
  const operations = useQuery({
    queryKey: ["dashboard", "admin", "client-oversight"],
    queryFn: getOperationsDashboard,
  });
  const exceptions = useQuery({
    queryKey: ["dashboard", "admin", "client-oversight", "exceptions"],
    queryFn: getExceptionsDashboard,
  });
  const failed = operations.isError || exceptions.isError;
  const pending = operations.isPending || exceptions.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client portfolio oversight"
        description="Client-facing risk and response signals only. Case intake and client actions stay inside the dedicated client workspace."
      />
      {failed ? (
        <ErrorState
          title="Client oversight unavailable"
          description={
            operations.error?.message ??
            exceptions.error?.message ??
            "The live portfolio could not be loaded."
          }
          onRetry={() => {
            void operations.refetch();
            void exceptions.refetch();
          }}
          retrying={operations.isFetching || exceptions.isFetching}
        />
      ) : null}
      {pending ? (
        <>
          <CardGridSkeleton count={4} />
          <ListSkeleton rows={4} />
        </>
      ) : operations.data && exceptions.data ? (
        <OversightContent operations={operations.data} exceptions={exceptions.data} />
      ) : null}
    </div>
  );
}

function OversightContent({
  operations,
  exceptions,
}: {
  operations: Awaited<ReturnType<typeof getOperationsDashboard>>;
  exceptions: Awaited<ReturnType<typeof getExceptionsDashboard>>;
}) {
  const completed =
    (operations.statusMix["COMPLETED"] ?? 0) + (operations.statusMix["CLOSED"] ?? 0);
  const cancelled = operations.statusMix["CANCELLED"] ?? 0;
  const active = Math.max(0, operations.summary.total - completed - cancelled);
  const openResponses = exceptions.clarifications.filter((item) => item.status === "OPEN");
  const cards = [
    {
      label: "Active portfolio",
      value: active,
      detail: "Cases in flight",
      icon: Files,
      tone: "info",
    },
    {
      label: "Client response",
      value: openResponses.length,
      detail: "Open clarifications",
      icon: AlertTriangle,
      tone: openResponses.length ? "warning" : "success",
    },
    {
      label: "SLA exposure",
      value: operations.summary.overdue,
      detail: "Overdue cases",
      icon: Clock3,
      tone: operations.summary.overdue ? "critical" : "success",
    },
    {
      label: "Completed",
      value: completed,
      detail: `${operations.summary.completedToday} today`,
      icon: CheckCircle2,
      tone: "success",
    },
  ] as const;
  const responseByClient = Object.entries(
    openResponses.reduce<Record<string, number>>((result, item) => {
      const name = item.case.client.displayName;
      result[name] = (result[name] ?? 0) + 1;
      return result;
    }, {}),
  ).sort((left, right) => right[1] - left[1]);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <SignalCard key={card.label} {...card} />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Section title="Response pressure" description="Open client clarifications by organisation">
          <div className="space-y-3">
            {responseByClient.slice(0, 6).map(([name, count]) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-xl bg-warning-soft/55 px-3.5 py-3"
              >
                <span className="truncate text-xs font-medium text-foreground">{name}</span>
                <span className="num rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
                  {count}
                </span>
              </div>
            ))}
            {!responseByClient.length ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No client response is pending.
              </p>
            ) : null}
          </div>
        </Section>
        <Section
          title="Portfolio stage mix"
          description="Live case volume across client-facing workflow states"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(operations.statusMix)
              .filter(([, count]) => count > 0)
              .map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-xl border border-border bg-card/70 px-3.5 py-3 shadow-[var(--shadow-card)]"
                >
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {humanize(status)}
                  </span>
                  <span className="num text-sm font-semibold text-foreground">{count}</span>
                </div>
              ))}
          </div>
        </Section>
      </div>
    </>
  );
}

function SignalCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Files;
  tone: "info" | "warning" | "critical" | "success";
}) {
  return (
    <article
      className={`rounded-[1.4rem] border border-white/80 p-4 shadow-[var(--shadow-card)] ${toneClass[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {label}
          </p>
          <p className="num mt-2 text-2xl font-medium tracking-tight text-foreground">{value}</p>
        </div>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">{detail}</p>
    </article>
  );
}

const toneClass = {
  info: "bg-info-soft/65",
  warning: "bg-warning-soft/65",
  critical: "bg-critical-soft/65",
  success: "bg-success-soft/65",
} as const;
