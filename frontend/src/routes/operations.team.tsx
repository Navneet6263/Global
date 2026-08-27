import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { ErrorState } from "@/components/feedback/error-state";
import { ChartSkeleton } from "@/components/feedback/skeletons";
import { OPS_CHECK_LABELS } from "@/features/operations/contracts/case";
import { OpsCapacityList } from "@/features/operations/components/ops-capacity-list";
import { useOpsTeam } from "@/features/operations/hooks/use-operations";
import { formatPercent } from "@/lib/formatting";

export const Route = createFileRoute("/operations/team")({
  head: () => ({
    meta: [
      { title: "Team Capacity — Sapling Global Operations" },
      {
        name: "description",
        content:
          "Verifier workload, branch load, skill demand and rebalancing signals for the delivery team.",
      },
      { property: "og:title", content: "Team Capacity — Sapling Global Operations" },
      {
        property: "og:description",
        content: "See who is overloaded, who has headroom and where demand is concentrated.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamCapacityPage,
});

function TeamCapacityPage() {
  const { data, isPending, isError, isFetching, refetch } = useOpsTeam();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team capacity"
        description="Balance workload across verifiers and branches before SLAs start slipping."
        meta={data ? `${data.openAssignments} checks awaiting allocation` : undefined}
      />

      {isError ? <ErrorState onRetry={() => void refetch()} retrying={isFetching} /> : null}

      {isPending || !data ? (
        <ChartSkeleton height={320} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section
              title="Workload per verifier"
              description="Open checks against working capacity."
            >
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...data.workload]} margin={{ left: -18, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      angle={-20}
                      height={54}
                      textAnchor="end"
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 14,
                        border: "1px solid var(--border)",
                        fontSize: 12,
                        background: "var(--card)",
                      }}
                    />
                    <Bar
                      dataKey="checks"
                      name="Open checks"
                      fill="var(--primary)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <Section
              title="Demand by check type"
              description="Where open work is concentrated today."
            >
              <ul className="space-y-2.5">
                {data.demand.map((row) => {
                  const max = Math.max(...data.demand.map((entry) => entry.open), 1);
                  return (
                    <li key={row.checkType} className="space-y-1">
                      <div className="flex justify-between text-[12px]">
                        <span className="text-foreground">{OPS_CHECK_LABELS[row.checkType]}</span>
                        <span className="num text-muted-foreground">{row.open} open</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary/65"
                          style={{ width: `${(row.open / max) * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Section>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
            <div className="space-y-4">
              <Section
                title="Branch load"
                description="Members, open checks and utilisation by branch."
              >
                <ul className="space-y-2.5">
                  {data.branches.map((row) => (
                    <li key={row.branch} className="space-y-1">
                      <div className="flex justify-between text-[12px]">
                        <span className="text-foreground">{row.branch}</span>
                        <span className="num text-muted-foreground">
                          {row.members} members · {row.openChecks} checks ·{" "}
                          {formatPercent(row.loadPercent, 0)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className={
                            row.loadPercent > 90
                              ? "block h-full rounded-full bg-critical"
                              : row.loadPercent > 75
                                ? "block h-full rounded-full bg-warning"
                                : "block h-full rounded-full bg-success"
                          }
                          style={{ width: `${Math.min(100, row.loadPercent)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section
                title="Rebalancing signals"
                description="Suggested moves to protect SLA health."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <SignalCard
                    title="Overloaded"
                    names={data.overloaded}
                    className="border-critical/25 bg-critical/6"
                  />
                  <SignalCard
                    title="Has headroom"
                    names={data.underutilised}
                    className="border-success/25 bg-success/6"
                  />
                </div>
              </Section>
            </div>

            <OpsCapacityList
              members={data.members}
              title="Verifier roster"
              description="Live load, skills, availability and turnaround per verifier."
            />
          </div>
        </>
      )}
    </div>
  );
}

function SignalCard({
  title,
  names,
  className,
}: {
  title: string;
  names: readonly string[];
  className: string;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${className}`}>
      <p className="text-[11px] tracking-[0.07em] text-muted-foreground uppercase">{title}</p>
      <p className="mt-1.5 text-[12.5px] text-foreground/90">
        {names.length > 0 ? names.join(", ") : "None right now"}
      </p>
    </div>
  );
}
