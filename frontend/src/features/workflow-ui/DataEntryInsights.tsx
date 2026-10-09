import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  CircleAlert,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Inbox,
  MessageSquareWarning,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ColumnPicker } from "@/components/table/column-picker";
import { useColumnChoice } from "@/components/table/use-column-choice";
import {
  DATA_ENTRY_REPORT_COLUMNS,
  downloadDataEntryReport,
  getDataEntryOverview,
  getDataEntryReport,
  type DataEntryReportColumn,
  type DataEntryReportFilter,
  type DataEntryReportRow,
} from "@/lib/backend-api/workflow";
import { istDateTime } from "@/features/operations/workspace/ops-queue-model";
import { cachedIdentity } from "@/lib/auth/platform-session";
import { StatCard as Stat } from "@/components/workspace/kit";

const hoursText = (value: number | null) =>
  value === null ? "—" : value < 24 ? `${value} h` : `${Math.round((value / 24) * 10) / 10} d`;

function ScopeSwitch({
  scope,
  onChange,
}: {
  scope: "mine" | "team";
  onChange: (scope: "mine" | "team") => void;
}) {
  return (
    <div className="ops-segment" role="group" aria-label="Whose work">
      <button type="button" aria-pressed={scope === "mine"} onClick={() => onChange("mine")}>
        My work
      </button>
      <button type="button" aria-pressed={scope === "team"} onClick={() => onChange("team")}>
        My team
      </button>
    </div>
  );
}

/** Data Entry dashboard: today's queue, what was done lately and how fast. */
export function DataEntryDashboard() {
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const overview = useQuery({
    queryKey: ["workflow", "data-entry", "overview", scope],
    queryFn: ({ signal }) => getDataEntryOverview(scope, signal),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const data = overview.data;
  const k = data?.kpis;
  const peak = Math.max(1, ...(data?.trend.map((day) => day.ready) ?? [1]));
  const trendTotal = data?.trend.reduce((sum, day) => sum + day.ready, 0) ?? 0;
  const identity = cachedIdentity();
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Kolkata",
    }).format(new Date()),
  );
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = identity?.fullName.split(" ")[0];
  const todayDone = k?.readyToday ?? 0;
  const todayTotal = todayDone + (k?.inQueue ?? 0);
  const todayPct = todayTotal ? Math.round((todayDone / todayTotal) * 100) : 0;
  return (
    <div className="rmo">
      <section className="de-hero" aria-label="Today">
        <div className="min-w-0">
          <h2>
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h2>
          <p>
            {k
              ? k.inQueue
                ? `${k.inQueue} case${k.inQueue === 1 ? "" : "s"} waiting for your review${k.overdue ? `, ${k.overdue} past due` : ""}.`
                : "Your queue is clear. Nice work!"
              : "Loading your day…"}
          </p>
          <div className="de-hero-actions">
            <Link to="/data-entry" className="de-hero-primary">
              <Inbox aria-hidden /> Open intake queue
            </Link>
            <Link to="/data-entry/reports" className="de-hero-secondary">
              <FileSpreadsheet aria-hidden /> My reports
            </Link>
            {data?.canSeeTeam ? <ScopeSwitch scope={scope} onChange={setScope} /> : null}
          </div>
        </div>
        <div className="de-hero-score">
          <span
            className="de-ring"
            role="img"
            aria-label={`Today: ${todayDone} of ${todayTotal} cleared`}
            style={{ ["--pct" as string]: `${todayPct}%` }}
          >
            <strong>{todayPct}%</strong>
          </span>
          <span className="min-w-0">
            <small>Today&apos;s progress</small>
            <b>
              {todayDone} of {todayTotal} cleared
            </b>
            <em>{k ? `${k.readyThisWeek} Ready this week` : ""}</em>
          </span>
        </div>
      </section>
      {overview.isError ? (
        <div className="rmo-card rmo-empty" role="alert">
          <strong>Dashboard unavailable</strong>
          <span>{overview.error.message}</span>
        </div>
      ) : null}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Data Entry summary">
        <Stat
          icon={Inbox}
          tone="info"
          label="To review now"
          value={k ? k.inQueue : "—"}
          hint="Open the queue"
          to="/data-entry"
        />
        <Stat
          icon={MessageSquareWarning}
          tone="action"
          label="Waiting on correction"
          value={k ? k.corrections : "—"}
          hint="Candidate or client to reply"
        />
        <Stat
          icon={TriangleAlert}
          tone={k?.overdue ? "bad" : "neutral"}
          label="Past due"
          value={k ? k.overdue : "—"}
          hint="Over the due date"
        />
        <Stat
          icon={ClipboardCheck}
          tone="good"
          label="Marked Ready today"
          value={k ? k.readyToday : "—"}
          hint="Sent back to the RM"
        />
      </section>
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Recent output">
        <Stat
          icon={CalendarCheck}
          tone="violet"
          label="Ready this week"
          value={k ? k.readyThisWeek : "—"}
          hint="Since Monday"
        />
        <Stat
          icon={CalendarCheck}
          tone="violet"
          label="Ready this month"
          value={k ? k.readyThisMonth : "—"}
          hint="Since the 1st"
        />
        <Stat
          icon={Timer}
          tone="neutral"
          label="Avg. time to Ready"
          value={k ? hoursText(k.averageTurnaroundHours) : "—"}
          hint="Assigned → Ready, 30 days"
        />
        <Stat
          icon={CircleAlert}
          tone="neutral"
          label="L1 raised"
          value={k ? k.l1Raised30d : "—"}
          hint="Last 30 days"
        />
      </section>
      <div className="rmo-grid">
        <div className="rmo">
          <section className="rmo-card" aria-labelledby="de-trend-title">
            <header className="rmo-queue-head">
              <div>
                <h2 id="de-trend-title">Marked Ready, last 14 days</h2>
                <p>
                  {trendTotal} case{trendTotal === 1 ? "" : "s"} sent back to the RM.
                </p>
              </div>
            </header>
            <div className="de-trend" role="list" aria-label="Cases marked Ready per day">
              {(data?.trend ?? []).map((day) => {
                const label = new Date(`${day.day}T00:00:00+05:30`).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  timeZone: "Asia/Kolkata",
                });
                return (
                  <div
                    key={day.day}
                    role="listitem"
                    className="de-trend-day"
                    title={`${label}: ${day.ready} Ready`}
                    aria-label={`${label}: ${day.ready} Ready`}
                  >
                    <span className="de-trend-value">{day.ready || ""}</span>
                    <span
                      className="de-trend-bar"
                      style={{
                        height: `${Math.max(day.ready ? 6 : 2, (day.ready / peak) * 100)}%`,
                      }}
                    />
                    <small>{label.split(" ")[0]}</small>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="rmo-card rmo-queue" aria-labelledby="de-recent-title">
            <header className="rmo-queue-head">
              <div>
                <h2 id="de-recent-title">Recently marked Ready</h2>
                <p>Your latest finished cases.</p>
              </div>
              <Link to="/data-entry/reports" className="rmo-link">
                Full report
              </Link>
            </header>
            {data && !data.recent.length ? (
              <div className="rmo-empty">
                <strong>Nothing finished yet</strong>
                <span>Cases you mark Ready appear here.</span>
              </div>
            ) : (
              <div className="rmo-table-scroll">
                <table className="rmo-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Company</th>
                      {data?.scope === "team" ? <th>Data Entry</th> : null}
                      <th>Marked Ready</th>
                      <th>Took</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.recent ?? []).map((row) => (
                      <tr key={row.caseId}>
                        <td>
                          <strong>{row.candidateName}</strong>
                          <div className="rmo-muted">{row.caseNumber}</div>
                        </td>
                        <td>{row.clientName}</td>
                        {data?.scope === "team" ? <td>{row.dataEntry ?? "—"}</td> : null}
                        <td>{istDateTime(row.readyAt)}</td>
                        <td>{hoursText(row.turnaroundHours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
        <aside className="rmo-rail">
          <section className="rmo-card" aria-labelledby="de-company-title">
            <header className="rmo-rail-head">
              <h2 id="de-company-title">Waiting by company</h2>
            </header>
            {data && !data.pendingByClient.length ? (
              <p className="rmo-rail-empty">Nothing waiting. All caught up.</p>
            ) : (
              <ul className="de-bars">
                {(data?.pendingByClient ?? []).map((row) => (
                  <li key={row.client}>
                    <span>{row.client}</span>
                    <strong>{row.count}</strong>
                    <span
                      className="de-bar"
                      style={{
                        width: `${(row.count / (data?.pendingByClient[0]?.count ?? 1)) * 100}%`,
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {data?.scope === "team" ? (
            <section className="rmo-card" aria-labelledby="de-team-title">
              <header className="rmo-rail-head">
                <h2 id="de-team-title">Team</h2>
              </header>
              {data.team.length ? (
                <table className="rmo-pulse">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Queue</th>
                      <th>Ready this week</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.team.map((person) => (
                      <tr key={person.name}>
                        <td>{person.name}</td>
                        <td>{person.inQueue}</td>
                        <td>{person.readyThisWeek}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="rmo-rail-empty">No team work yet.</p>
              )}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const shift = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const PRESETS = [
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "custom", label: "Custom" },
] as const;
type Preset = (typeof PRESETS)[number]["id"];

function presetRange(preset: Exclude<Preset, "custom">) {
  const today = istToday();
  if (preset === "7") return { from: shift(today, -6), to: today };
  if (preset === "30") return { from: shift(today, -29), to: today };
  const monthStart = `${today.slice(0, 8)}01`;
  if (preset === "month") return { from: monthStart, to: today };
  const lastEnd = shift(monthStart, -1);
  return { from: `${lastEnd.slice(0, 8)}01`, to: lastEnd };
}

const DEFAULT_COLUMNS: readonly DataEntryReportColumn[] = [
  "caseNumber",
  "candidate",
  "client",
  "assignedAt",
  "readyAt",
  "turnaroundHours",
  "stage",
  "l1Raised",
];

function cellValue(row: DataEntryReportRow, key: DataEntryReportColumn) {
  const value = row[key];
  if (key === "assignedAt" || key === "readyAt") return value ? istDateTime(value as string) : "—";
  if (key === "turnaroundHours") return hoursText(value as number | null);
  return value === null || value === "" ? "—" : String(value);
}

/** My reports: pick a period and the columns, preview, then download the sheet. */
export function DataEntryReports() {
  const [preset, setPreset] = useState<Preset>("30");
  const [range, setRange] = useState(() => presetRange("30"));
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const choice = useColumnChoice(
    "data-entry-report-columns",
    DATA_ENTRY_REPORT_COLUMNS,
    DEFAULT_COLUMNS,
  );
  const columns = choice.columns.length ? choice.columns : DEFAULT_COLUMNS;
  const filter: DataEntryReportFilter = { ...range, scope };
  const validRange = Boolean(range.from && range.to && range.from <= range.to);
  const overview = useQuery({
    queryKey: ["workflow", "data-entry", "overview", "mine"],
    queryFn: ({ signal }) => getDataEntryOverview("mine", signal),
    staleTime: 60_000,
  });
  const report = useQuery({
    queryKey: ["workflow", "data-entry", "report", filter],
    queryFn: ({ signal }) => getDataEntryReport(filter, signal),
    enabled: validRange,
    placeholderData: keepPreviousData,
  });
  const download = useMutation({
    mutationFn: () => downloadDataEntryReport(filter, columns),
    onSuccess: () => toast.success("Report downloaded"),
    onError: (error: Error) => toast.error("Download failed", { description: error.message }),
  });
  const data = report.data;
  return (
    <div className="rmo">
      <section className="rmo-card rmo-queue" aria-labelledby="de-report-title">
        <header className="rmo-queue-head">
          <div>
            <h2 id="de-report-title">Build your sheet</h2>
            <p>Pick a period and the columns you need. The download uses the same columns.</p>
          </div>
          <div className="rmo-queue-tools">
            {overview.data?.canSeeTeam ? <ScopeSwitch scope={scope} onChange={setScope} /> : null}
            <ColumnPicker
              options={DATA_ENTRY_REPORT_COLUMNS}
              value={columns}
              defaults={DEFAULT_COLUMNS}
              fixedLabel="Pick at least one column"
              heading="Columns in your sheet"
              onChange={(next) => choice.update(next.length ? next : DEFAULT_COLUMNS)}
            />
            <Button
              type="button"
              loading={download.isPending}
              disabled={!validRange || !data?.total}
              onClick={() => download.mutate()}
            >
              <Download aria-hidden /> Download CSV
            </Button>
          </div>
        </header>
        <div className="rmo-filters">
          <div className="rmo-tabs de-presets" role="group" aria-label="Period">
            {PRESETS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={preset === option.id}
                className={preset === option.id ? "is-active" : ""}
                onClick={() => {
                  setPreset(option.id);
                  if (option.id !== "custom") setRange(presetRange(option.id));
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          {preset === "custom" ? (
            <div className="de-dates">
              <label>
                <span>From</span>
                <input
                  type="date"
                  value={range.from}
                  max={range.to}
                  onChange={(event) => setRange((r) => ({ ...r, from: event.target.value }))}
                />
              </label>
              <label>
                <span>To</span>
                <input
                  type="date"
                  value={range.to}
                  min={range.from}
                  max={istToday()}
                  onChange={(event) => setRange((r) => ({ ...r, to: event.target.value }))}
                />
              </label>
            </div>
          ) : null}
        </div>
        <section className="de-summary" aria-label="Report summary">
          <div>
            <small>Cases in period</small>
            <strong>{data ? data.total : "—"}</strong>
          </div>
          <div>
            <small>Marked Ready</small>
            <strong>{data ? data.summary.markedReady : "—"}</strong>
          </div>
          <div>
            <small>Avg. time to Ready</small>
            <strong>{data ? hoursText(data.summary.averageTurnaroundHours) : "—"}</strong>
          </div>
          <div>
            <small>L1 raised</small>
            <strong>{data ? data.summary.l1Raised : "—"}</strong>
          </div>
        </section>
        {!validRange ? (
          <div className="rmo-empty" role="alert">
            Choose a start date on or before the end date.
          </div>
        ) : report.isError ? (
          <div className="rmo-empty" role="alert">
            <strong>Report unavailable</strong>
            <span>{report.error.message}</span>
          </div>
        ) : !data ? (
          <div className="rmo-empty">Loading…</div>
        ) : !data.rows.length ? (
          <div className="rmo-empty">
            <strong>No cases in this period</strong>
            <span>Try a longer period.</span>
          </div>
        ) : (
          <>
            <div className="rmo-table-scroll">
              <table className="rmo-table" aria-label="Report preview">
                <thead>
                  <tr>
                    {columns.map((key) => (
                      <th key={key}>
                        {DATA_ENTRY_REPORT_COLUMNS.find((column) => column.key === key)?.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.caseNumber}>
                      {columns.map((key) => (
                        <td key={key}>{cellValue(row, key)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="rmo-pager">
              <span>
                {data.total > data.rows.length
                  ? `Showing ${data.rows.length} of ${data.total}. The download has all rows.`
                  : `${data.total} case${data.total === 1 ? "" : "s"}`}
              </span>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
