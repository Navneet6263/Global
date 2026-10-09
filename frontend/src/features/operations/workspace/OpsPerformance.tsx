import { Link } from "@tanstack/react-router";
import { CircleAlert, CircleCheck, CircleHelp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton } from "@/components/feedback/skeletons";
import type { ExecutiveDashboard } from "@/lib/api/dashboards";
import { opsStage } from "./ops-queue-model";
import { DISPOSITIONS, colourClass, dispositionMeta } from "@/features/workflow-ui/colour-codes";

const nf = (value: number) => value.toLocaleString("en-IN");
const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${Math.round(value)}%`;
const tat = (hours: number | null | undefined) =>
  hours === null || hours === undefined
    ? "—"
    : hours >= 48
      ? `${(hours / 24).toFixed(1)} d`
      : `${Math.round(hours)} h`;

export function OpsPerformance({
  data,
  loading,
  error,
  retrying,
  onRetry,
  months,
  onMonths,
}: {
  data?: ExecutiveDashboard;
  loading: boolean;
  error?: string;
  retrying: boolean;
  onRetry: () => void;
  months: number;
  onMonths: (months: number) => void;
}) {
  return (
    <section className="ops-performance" aria-label="Performance and MIS">
      <header className="ops-section-head">
        <div>
          <h2>Performance & MIS</h2>
          <p className="ops-subtle">
            SLA, turnaround, results, clients and RM workload for the selected period.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="ops-segment" role="group" aria-label="Period">
            {[3, 6, 12].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={months === value}
                onClick={() => onMonths(value)}
              >
                {value} months
              </button>
            ))}
          </div>
          <Link to="/operations/reports" className="ops-outline-link">
            Reports & downloads
          </Link>
        </div>
      </header>
      {error ? <ErrorState description={error} onRetry={onRetry} retrying={retrying} /> : null}
      {loading && !data ? <CardGridSkeleton count={4} /> : null}
      {data ? <PerformanceBody data={data} /> : null}
    </section>
  );
}

function PerformanceBody({ data }: { data: ExecutiveDashboard }) {
  // Older APIs return only results; fall back to the default colour for each result.
  const colourMix: Record<string, number> = data.dispositionMix ?? {
    GREEN: data.outcomeMix["CLEAR"] ?? 0,
    RED: data.outcomeMix["DISCREPANCY"] ?? 0,
    AMBER: data.outcomeMix["UNABLE_TO_VERIFY"] ?? 0,
  };
  const colourTotal = Object.values(colourMix).reduce((sum, value) => sum + value, 0);
  const caseTotal = Object.values(data.caseColourMix ?? {}).reduce((sum, value) => sum + value, 0);
  // The API returns ready display labels for each period bucket.
  const trend = data.performanceTrend.map((row) => ({ ...row, label: row.month }));
  const clients = [...data.clientPerformance].sort((a, b) => b.total - a.total).slice(0, 8);
  const team = [...data.teamCapacity].sort((a, b) => b.active - a.active).slice(0, 8);
  const maxActive = Math.max(1, ...team.map((row) => row.active));
  const ageing = data.stageAgeing.filter((row) => row.count > 0);
  const maxAge = Math.max(1, ...ageing.map((row) => row.oldestAgeHours));
  return (
    <>
      <div className="client-panel ops-kpis">
        <Kpi
          label="On-time (SLA)"
          value={pct(data.performance.slaPercentage)}
          tone={slaTone(data.performance.slaPercentage)}
          hint="Completed within due time"
        />
        <Kpi
          label="Average TAT"
          value={tat(data.performance.averageTatHours)}
          hint={`${nf(data.performance.completedCases)} completed in period`}
        />
        <Kpi
          label="Due next 7 days"
          value={nf(data.forecast.dueNext7Days)}
          hint={`${nf(data.forecast.atRiskNext7Days)} at risk`}
          tone={data.forecast.atRiskNext7Days ? "warn" : undefined}
        />
        <Kpi
          label="Projected completions"
          value={nf(data.forecast.projectedCompletions7Days)}
          hint="Next 7 days, at current pace"
        />
        <Kpi
          label="Live cases without RM"
          value={nf(data.forecast.unassignedActive)}
          hint="Assign from the work queue"
          tone={data.forecast.unassignedActive ? "warn" : "good"}
        />
      </div>
      <div className="ops-analytics-grid">
        <figure className="client-panel ops-chart">
          <figcaption>
            <h3>On-time % over time</h3>
            <p>Share of cases finished within their due time.</p>
          </figcaption>
          {trend.length ? (
            <div
              className="h-[220px]"
              role="img"
              aria-label={`On-time percentage over time: ${trend.map((row) => `${row.label} ${pct(row.slaPercentage)}`).join(", ")}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="#eef2f6" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 50, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    unit="%"
                  />
                  <Tooltip
                    cursor={{ stroke: "#cbd5e1" }}
                    content={({ active, payload }) => {
                      const row = active
                        ? (payload?.[0]?.payload as (typeof trend)[number] | undefined)
                        : undefined;
                      if (!row) return null;
                      return (
                        <div className="ops-tooltip">
                          <strong>{row.label}</strong>
                          <span>On-time {pct(row.slaPercentage)}</span>
                          <span>
                            {nf(row.created)} created · {nf(row.overdue)} overdue
                          </span>
                          <span>Average TAT {tat(row.averageTatHours)}</span>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="slaPercentage"
                    stroke="#1d4ed8"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#1d4ed8", stroke: "#fff", strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="ops-empty">No completed cases in this period yet.</p>
          )}
        </figure>
        <section className="client-panel ops-chart" aria-label="Check results">
          <h3>Check outcomes</h3>
          <p>
            Checks closed in the period ({nf(colourTotal)}). A case takes the result of its most
            serious check.
          </p>
          <div className="colour-bars">
            {DISPOSITIONS.map((value) => {
              const count = colourMix[value] ?? 0;
              const share = colourTotal ? (count / colourTotal) * 100 : 0;
              return (
                <div key={value} className={`colour-bar ${colourClass(value)}`}>
                  <span className="colour-bar-label">
                    <i aria-hidden />
                    {dispositionMeta[value].label}
                  </span>
                  <span className="ops-bar" aria-hidden>
                    <i style={{ width: `${share}%` }} />
                  </span>
                  <strong className="num">{nf(count)}</strong>
                  <small className="num">{colourTotal ? `${Math.round(share)}%` : "—"}</small>
                </div>
              );
            })}
          </div>
          {caseTotal ? (
            <div className="colour-stack" aria-label="Cases by outcome">
              {DISPOSITIONS.map((value) => {
                const count = data.caseColourMix?.[value] ?? 0;
                return count ? (
                  <span
                    key={value}
                    className={colourClass(value)}
                    style={{ flexGrow: count }}
                    title={`${dispositionMeta[value].label}: ${count} cases`}
                  >
                    {count}
                  </span>
                ) : null;
              })}
            </div>
          ) : null}
          <p className="ops-footnote">{nf(caseTotal)} cases with a final outcome in the period.</p>
        </section>
      </div>
      <div className="ops-analytics-grid is-tables">
        <section className="client-panel" aria-label="Client performance">
          <h3 className="ops-card-title">Client performance</h3>
          {clients.length ? (
            <div
              className="client-table-scroll ops-mini-table"
              role="region"
              aria-label="Client performance table"
              tabIndex={0}
            >
              <table className="client-case-table">
                <thead>
                  <tr>
                    <th scope="col">Client</th>
                    <th scope="col">Cases</th>
                    <th scope="col">Active</th>
                    <th scope="col">Overdue</th>
                    <th scope="col">On-time</th>
                    <th scope="col">Avg TAT</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td className="num">{nf(row.total)}</td>
                      <td className="num">{nf(row.active)}</td>
                      <td className={`num ${row.overdue ? "ops-text-bad" : ""}`}>
                        {nf(row.overdue)}
                      </td>
                      <td>
                        <span className="ops-inline-meter">
                          <span className="ops-bar" aria-hidden>
                            <i style={{ width: `${row.slaPercentage ?? 0}%` }} />
                          </span>
                          <span className="num">{pct(row.slaPercentage)}</span>
                        </span>
                      </td>
                      <td className="num">{tat(row.averageTatHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="ops-empty">No client activity in this period.</p>
          )}
        </section>
        <section className="client-panel" aria-label="RM workload">
          <h3 className="ops-card-title">RM workload</h3>
          {team.length ? (
            <ul className="ops-workload">
              {team.map((row) => (
                <li key={row.id}>
                  <span className={row.id === "unassigned" ? "ops-text-warn" : undefined}>
                    {row.name}
                  </span>
                  <span className="ops-bar" aria-hidden>
                    <i style={{ width: `${(row.active / maxActive) * 100}%` }} />
                  </span>
                  <strong className="num">{nf(row.active)}</strong>
                  <small>
                    {row.overdue ? (
                      <span className="ops-text-bad">{nf(row.overdue)} overdue</span>
                    ) : (
                      "0 overdue"
                    )}{" "}
                    · {nf(row.completed)} done
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ops-empty">No owner workload yet.</p>
          )}
          <p className="ops-footnote">Active cases by responsible owner.</p>
        </section>
        <section className="client-panel" aria-label="Stage ageing">
          <h3 className="ops-card-title">Stage ageing</h3>
          {ageing.length ? (
            <ul className="ops-workload is-ageing">
              {ageing.map((row) => (
                <li key={row.status}>
                  <span>{opsStage(row.status).label}</span>
                  <span className="ops-bar is-age" aria-hidden>
                    <i style={{ width: `${(row.oldestAgeHours / maxAge) * 100}%` }} />
                  </span>
                  <strong className="num">{nf(row.count)}</strong>
                  <small>
                    avg {tat(row.averageAgeHours)} · oldest {tat(row.oldestAgeHours)}
                    {row.atRisk ? (
                      <span className="ops-text-bad"> · {nf(row.atRisk)} at risk</span>
                    ) : null}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ops-empty">No live cases are ageing.</p>
          )}
          <p className="ops-footnote">Bar length shows the oldest case in each stage.</p>
        </section>
      </div>
    </>
  );
}

function slaTone(value: number | null) {
  if (value === null) return undefined;
  return value >= 90 ? "good" : value >= 75 ? "warn" : "bad";
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "good" | "warn" | "bad";
}) {
  return (
    <div className={`ops-kpi ${tone ? `is-${tone}` : ""}`}>
      <small>{label}</small>
      <strong className="num">{value}</strong>
      <span>{hint}</span>
    </div>
  );
}
