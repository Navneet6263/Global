import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Inbox,
  RotateCcw,
  ShieldCheck,
  Timer,
  UserRoundCheck,
} from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import { getQaDashboard, type QaDashboard as Data } from "@/lib/backend-api/qa-register";
import { cn } from "@/lib/utils";
import { WorkspaceError } from "../WorkspaceStates";
import { humanize } from "../utils";

const minutesText = (minutes: number | null) => {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return hours < 48 ? `${hours.toFixed(1)} h` : `${(hours / 24).toFixed(1)} days`;
};
const waitedText = (hours: number) =>
  hours < 1 ? "< 1 h" : hours < 48 ? `${Math.round(hours)} h` : `${Math.round(hours / 24)} d`;
const dueText = (value: string | null) => {
  if (!value) return { text: "No due date", tone: "text-slate-400" };
  const diff = new Date(value).getTime() - Date.now();
  const hours = Math.abs(diff) / 3_600_000;
  const span = hours < 48 ? `${Math.max(1, Math.round(hours))} h` : `${Math.round(hours / 24)} d`;
  return diff < 0
    ? { text: `Overdue ${span}`, tone: "text-red-600 font-semibold" }
    : { text: `Due in ${span}`, tone: hours < 24 ? "text-amber-700" : "text-slate-500" };
};
const ago = (value: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
};

/** QA overview: what needs review now, queue health and the reviewer's own trend. */
export function QaDashboard() {
  const dashboard = useQuery({
    queryKey: ["qa", "dashboard"],
    queryFn: ({ signal }) => getQaDashboard(signal),
    refetchInterval: 60_000,
  });
  if (dashboard.isError)
    return (
      <WorkspaceError message={dashboard.error.message} onRetry={() => void dashboard.refetch()} />
    );
  if (!dashboard.data)
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading QA dashboard">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100 lg:col-span-2" />
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  const data = dashboard.data;
  return (
    <div className="grid min-w-0 gap-4">
      <Kpis data={data} />
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <DecisionTrend data={data} />
        <QueueHealth data={data} />
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <UpNext data={data} />
        <div className="grid min-w-0 content-start gap-4">
          <ReworkHotspots data={data} />
          <RecentDecisions data={data} />
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  action,
  className,
  children,
  label,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <section
      aria-label={label ?? title}
      className={cn("min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm", className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 px-5 pt-4">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="text-[12px] text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      <div className="px-5 pb-5 pt-3">{children}</div>
    </section>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  foot,
}: {
  label: string;
  value: ReactNode;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  foot: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[12.5px] font-medium text-slate-500">{label}</p>
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tone)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="num mt-1 text-[28px] font-semibold leading-tight tracking-tight text-slate-900">
        {value}
      </p>
      <div className="mt-1 truncate text-[12px] text-slate-500">{foot}</div>
    </div>
  );
}

function Kpis({ data }: { data: Data }) {
  const { queue, me } = data;
  const delta = me.week - me.previousWeek;
  return (
    <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Kpi
        label="In QA queue"
        value={queue.awaiting}
        icon={Inbox}
        tone="bg-blue-50 text-blue-700"
        foot={
          <>
            <span className="font-medium text-slate-700">{queue.available}</span> available ·{" "}
            <span className="font-medium text-slate-700">{queue.mine}</span> reserved by you
          </>
        }
      />
      <Kpi
        label="SLA overdue"
        value={<span className={queue.sla.overdue ? "text-red-600" : ""}>{queue.sla.overdue}</span>}
        icon={AlertTriangle}
        tone={queue.sla.overdue ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}
        foot={`${queue.sla.dueToday} due today · ${queue.highRisk} high risk`}
      />
      <Kpi
        label="Reviewed this week"
        value={me.week}
        icon={ShieldCheck}
        tone="bg-violet-50 text-violet-700"
        foot={
          <span className="inline-flex items-center gap-1">
            {delta === 0 ? (
              "Same as last week"
            ) : (
              <>
                <span
                  className={cn(
                    "inline-flex items-center font-semibold",
                    delta > 0 ? "text-emerald-700" : "text-amber-700",
                  )}
                >
                  {delta > 0 ? (
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  ) : (
                    <ArrowDownRight className="size-3.5" aria-hidden />
                  )}
                  {Math.abs(delta)}
                </span>
                vs last week
              </>
            )}
            <span className="text-slate-300">·</span> {me.today} today
          </span>
        }
      />
      <Kpi
        label="Approval rate · 30 days"
        value={me.approvalRate === null ? "—" : `${me.approvalRate}%`}
        icon={CheckCircle2}
        tone="bg-emerald-50 text-emerald-700"
        foot={`${me.approved30} approved · ${me.returned30} returned`}
      />
    </section>
  );
}

/** Stacked daily bars: approved (green) and returned for rework (amber). */
function DecisionTrend({ data }: { data: Data }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.trend.map((day) => day.approved + day.returned));
  const top = Math.max(2, Math.ceil(max / 2) * 2);
  const total = data.trend.reduce((sum, day) => sum + day.approved + day.returned, 0);
  const label = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  const active = hover === null ? null : data.trend[hover];
  return (
    <Card
      title="Your decisions"
      subtitle={`Last 14 days · ${total} decisions · median review time ${minutesText(data.me.medianReviewMinutes)}`}
      className="lg:col-span-2"
      action={
        <div className="flex items-center gap-3 text-[12px] text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-emerald-500" aria-hidden /> Approved
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-amber-400" aria-hidden /> Returned
          </span>
        </div>
      }
    >
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 grid h-60 grid-rows-2">
          {[top, top / 2].map((tick) => (
            <div key={tick} className="flex items-start border-t border-dashed border-slate-200">
              <span className="-mt-2 bg-white pr-1 text-[10.5px] text-slate-400">{tick}</span>
            </div>
          ))}
        </div>
        <ol
          aria-label="Decisions per day"
          className="relative ml-6 flex h-60 items-end gap-1.5 border-b border-slate-200"
          onMouseLeave={() => setHover(null)}
        >
          {data.trend.map((day, index) => {
            const count = day.approved + day.returned;
            return (
              <li
                key={day.date}
                className="flex h-full flex-1 cursor-default flex-col items-center justify-end"
                onMouseEnter={() => setHover(index)}
                aria-label={`${label(day.date)}: ${day.approved} approved, ${day.returned} returned`}
              >
                <div
                  className={cn(
                    "flex w-3/5 max-w-7 flex-col justify-end gap-0.5 rounded-t-md transition",
                    hover === index && "opacity-80",
                  )}
                  style={{ height: `${(count / top) * 100}%` }}
                >
                  {day.returned ? (
                    <span
                      className="block w-full rounded-t-[4px] bg-amber-400"
                      style={{ flexGrow: day.returned }}
                    />
                  ) : null}
                  {day.approved ? (
                    <span
                      className={cn(
                        "block w-full bg-emerald-500",
                        !day.returned && "rounded-t-[4px]",
                      )}
                      style={{ flexGrow: day.approved }}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
        <div className="ml-6 mt-1.5 flex gap-1.5">
          {data.trend.map((day, index) => (
            <span
              key={day.date}
              className={cn(
                "flex-1 text-center text-[10.5px] text-slate-400",
                index % 2 === 1 && "max-sm:invisible",
              )}
            >
              {label(day.date).split(" ")[0]}
            </span>
          ))}
        </div>
        {active ? (
          <div
            role="status"
            className="pointer-events-none absolute -top-2 right-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] shadow-md"
          >
            <p className="font-semibold text-slate-900">{label(active.date)}</p>
            <p className="text-slate-600">
              {active.approved} approved · {active.returned} returned
            </p>
          </div>
        ) : null}
      </div>
      {!total ? (
        <p className="mt-3 text-[12.5px] text-slate-500">
          No decisions in the last 14 days yet. Your approvals and returns will show here.
        </p>
      ) : null}
    </Card>
  );
}

function QueueHealth({ data }: { data: Data }) {
  const { sla, waiting, awaiting } = data.queue;
  const parts = [
    { label: "Overdue", value: sla.overdue, colour: "bg-red-500" },
    { label: "Due today", value: sla.dueToday, colour: "bg-amber-400" },
    { label: "Due later", value: sla.later, colour: "bg-emerald-500" },
    { label: "No due date", value: sla.noDueDate, colour: "bg-slate-300" },
  ];
  const buckets = [
    { label: "Under 4 hours", value: waiting.under4h },
    { label: "4 – 24 hours", value: waiting.under24h },
    { label: "1 – 3 days", value: waiting.under3d },
    { label: "Over 3 days", value: waiting.over3d },
  ];
  const most = Math.max(1, ...buckets.map((bucket) => bucket.value));
  return (
    <Card title="Queue health" subtitle={`${awaiting} cases waiting for QA`}>
      <p className="text-[12px] font-medium text-slate-500">SLA</p>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        {awaiting
          ? parts.map((part) =>
              part.value ? (
                <span
                  key={part.label}
                  className={cn("h-full border-r-2 border-white last:border-r-0", part.colour)}
                  style={{ width: `${(part.value / awaiting) * 100}%` }}
                />
              ) : null,
            )
          : null}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {parts.map((part) => (
          <li key={part.label} className="flex items-center justify-between gap-2 text-[12.5px]">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className={cn("size-2 rounded-full", part.colour)} aria-hidden />
              {part.label}
            </span>
            <span className="num font-semibold text-slate-900">{part.value}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[12px] font-medium text-slate-500">Time waiting in QA</p>
      <ul className="mt-2 grid gap-2">
        {buckets.map((bucket, index) => (
          <li key={bucket.label} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-2">
            <span className="text-[12px] text-slate-600">{bucket.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-slate-100">
              <span
                className={cn(
                  "block h-full rounded-full",
                  index === 3 ? "bg-red-400" : index === 2 ? "bg-amber-400" : "bg-blue-500",
                )}
                style={{ width: `${(bucket.value / most) * 100}%` }}
              />
            </span>
            <span className="num text-right text-[12.5px] font-semibold text-slate-900">
              {bucket.value}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
        <UserRoundCheck className="size-3.5 text-slate-400" aria-hidden />
        {data.queue.reservedByOthers} reserved by other reviewers · team decided {data.teamToday}{" "}
        today
      </p>
    </Card>
  );
}

function UpNext({ data }: { data: Data }) {
  return (
    <Card
      title="Up next"
      subtitle="Your reserved cases first, then the oldest due cases nobody has claimed"
      className="lg:col-span-2"
      action={
        <Link
          to="/qa-review"
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-blue-700 hover:underline"
        >
          Open queue <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      }
    >
      {data.upNext.length ? (
        <ul className="-mx-2 divide-y divide-slate-100">
          {data.upNext.map((row) => {
            const due = dueText(row.dueAt);
            return (
              <li key={row.id}>
                <Link
                  to={row.reservedByMe ? "/qa-review/mine" : "/qa-review"}
                  search={{ case: row.id }}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto]"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-slate-900">
                        {row.candidateName}
                      </span>
                      {row.reservedByMe ? (
                        <span className="shrink-0 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-violet-700 ring-1 ring-violet-200">
                          Yours
                        </span>
                      ) : null}
                      {row.highRisk ? (
                        <span className="shrink-0 rounded-md bg-red-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-red-700 ring-1 ring-red-200">
                          High risk
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[12px] text-slate-500">
                      {row.caseNumber} · {row.clientName} · {row.checks} check
                      {row.checks === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className={cn("hidden text-[12px] sm:block", due.tone)}>{due.text}</span>
                  <span className="hidden items-center gap-1 text-[12px] text-slate-500 sm:flex">
                    <Clock3 className="size-3.5" aria-hidden /> waiting{" "}
                    {waitedText(row.waitingHours)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[12px] font-semibold text-white">
                    {row.reservedByMe ? "Continue" : "Review"}
                    <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="grid place-items-center gap-2 py-10 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-5" aria-hidden />
          </span>
          <p className="text-[13px] font-semibold text-slate-900">All caught up</p>
          <p className="text-[12.5px] text-slate-500">No cases are waiting for QA right now.</p>
        </div>
      )}
    </Card>
  );
}

function ReworkHotspots({ data }: { data: Data }) {
  const most = Math.max(1, ...data.reworkByType.map((row) => row.count));
  return (
    <Card title="What you return most" subtitle="Checks sent back for rework · 30 days">
      {data.reworkByType.length ? (
        <ul className="grid gap-2">
          {data.reworkByType.map((row) => (
            <li key={row.type} className="grid grid-cols-[7rem_1fr_1.5rem] items-center gap-2">
              <span className="truncate text-[12.5px] text-slate-700">{humanize(row.type)}</span>
              <span className="h-2 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="block h-full rounded-full bg-amber-400"
                  style={{ width: `${(row.count / most) * 100}%` }}
                />
              </span>
              <span className="num text-right text-[12.5px] font-semibold text-slate-900">
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-slate-500">No checks returned in the last 30 days.</p>
      )}
    </Card>
  );
}

function RecentDecisions({ data }: { data: Data }) {
  return (
    <Card
      title="Recent decisions"
      action={
        <Link
          to="/qa-review/history"
          className="text-[12.5px] font-semibold text-blue-700 hover:underline"
        >
          History
        </Link>
      }
    >
      {data.recent.length ? (
        <ul className="grid gap-2.5">
          {data.recent.map((row) => {
            const approved = row.decision === "APPROVED";
            return (
              <li key={row.id} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
                    approved ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600",
                  )}
                >
                  {approved ? (
                    <CheckCircle2 className="size-3.5" aria-hidden />
                  ) : (
                    <RotateCcw className="size-3.5" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-slate-900">
                    {row.candidateName}
                  </span>
                  <span className="block truncate text-[11.5px] text-slate-500">
                    {approved ? "Approved" : "Returned"} · {row.caseNumber} ·{" "}
                    {humanize(row.caseStatus)}
                  </span>
                </span>
                <span className="shrink-0 text-[11.5px] text-slate-400">{ago(row.createdAt)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-[12.5px] text-slate-500">
          <Timer className="size-4 text-slate-400" aria-hidden /> Your decisions will appear here.
        </p>
      )}
    </Card>
  );
}
