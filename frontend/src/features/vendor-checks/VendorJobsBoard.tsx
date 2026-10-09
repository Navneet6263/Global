import { useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  AlarmClock,
  CheckCheck,
  ClipboardList,
  Download,
  Hourglass,
  Inbox,
  ShieldQuestion,
  RotateCcw,
  Search,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ColumnPicker } from "@/components/table/column-picker";
import { useColumnChoice } from "@/components/table/use-column-choice";
import {
  EXPORT_COLUMNS,
  type BoardFilter,
  type VendorBoard,
  type VendorJob,
  type VendorJobStatus,
} from "@/lib/backend-api/vendor-checks";
import { formatDateTime } from "@/lib/formatting";
import { STATUS_COPY, readable } from "./vendor-job-format";

type Column = (typeof EXPORT_COLUMNS)[number]["key"];
const TABLE_DEFAULTS: Column[] = ["check", "vendor", "status", "dueAt", "ageDays", "result"];
/** Sapling ID and candidate are always shown; everything else is the user's choice. */
const OPTIONS = EXPORT_COLUMNS.filter(
  (column) => column.key !== "caseNumber" && column.key !== "candidate",
);

const TABS: Array<{ label: string; filter: BoardFilter; internal?: boolean }> = [
  { label: "All", filter: {} },
  // A Team Leader's request waiting for the case RM (internal users only).
  { label: "Waiting for approval", filter: { status: "PENDING_APPROVAL" }, internal: true },
  { label: "New", filter: { status: "ASSIGNED" } },
  { label: "In progress", filter: { status: "IN_PROGRESS" } },
  { label: "Returned", filter: { status: "RETURNED" } },
  { label: "To review", filter: { status: "SUBMITTED" } },
  { label: "Approved", filter: { status: "APPROVED" } },
  { label: "Overdue", filter: { overdue: true } },
];

const AGEING = [
  { key: "0-2", label: "0–2 days", hex: "#16a34a" },
  { key: "3-5", label: "3–5 days", hex: "#ca8a04" },
  { key: "6-10", label: "6–10 days", hex: "#ea580c" },
  { key: "10+", label: "10+ days", hex: "#dc2626" },
] as const;

/**
 * Board of vendor check jobs: KPIs, ageing, status tabs, search, chosen columns and a
 * CSV with exactly those columns. Used by the vendor workspace and by Operations / RM.
 */
export function VendorJobsBoard({
  mode,
  storageKey,
  load,
  exportCsv,
  onOpen,
  initialStatus,
}: {
  mode: "vendor" | "internal";
  /** Open on this status tab, e.g. from an approval notification. */
  initialStatus?: VendorJobStatus;
  storageKey: string;
  load: (filter: BoardFilter) => Promise<VendorBoard>;
  exportCsv: (filter: BoardFilter, columns: readonly string[]) => Promise<void>;
  onOpen: (job: VendorJob) => void;
}) {
  const tabs = TABS.filter((item) => mode === "internal" || !item.internal);
  const [tab, setTab] = useState(() =>
    Math.max(
      0,
      tabs.findIndex((item) => initialStatus && item.filter.status === initialStatus),
    ),
  );
  const [search, setSearch] = useState("");
  const { columns, update, show } = useColumnChoice<Column>(storageKey, OPTIONS, TABLE_DEFAULTS);
  const filter: BoardFilter = { ...tabs[tab]!.filter, search: search.trim() || undefined };
  const board = useQuery({
    queryKey: ["vendor-checks", mode, filter],
    queryFn: () => load(filter),
    placeholderData: keepPreviousData,
  });
  const download = useMutation({
    mutationFn: () => exportCsv(filter, ["caseNumber", "candidate", ...columns]),
    onError: (error: Error) => toast.error("Not downloaded", { description: error.message }),
  });
  const summary = board.data?.summary;
  const count = (status: VendorJobStatus) => summary?.counts[status] ?? 0;
  const kpis: Array<{ label: string; value: number; icon: LucideIcon; tone: string }> = [
    ...(mode === "internal"
      ? [
          {
            label: "Waiting for approval",
            value: count("PENDING_APPROVAL"),
            icon: ShieldQuestion,
            tone: "is-action",
          },
        ]
      : []),
    { label: "New", value: count("ASSIGNED"), icon: Inbox, tone: "is-info" },
    { label: "In progress", value: count("IN_PROGRESS"), icon: Hourglass, tone: "is-neutral" },
    { label: "Returned", value: count("RETURNED"), icon: RotateCcw, tone: "is-action" },
    {
      label: mode === "vendor" ? "Submitted" : "To review",
      value: count("SUBMITTED"),
      icon: ClipboardList,
      tone: "is-info",
    },
    ...(mode === "vendor"
      ? [{ label: "Approved", value: count("APPROVED"), icon: CheckCheck, tone: "is-good" }]
      : []),
    { label: "Overdue", value: summary?.overdue ?? 0, icon: AlarmClock, tone: "is-bad" },
  ];
  const ageingTotal = AGEING.reduce((sum, bucket) => sum + (summary?.ageing[bucket.key] ?? 0), 0);
  return (
    <div className="rmo">
      <section className="rmo-kpis vjb-kpis" aria-label="Vendor work summary">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`rmo-kpi ${kpi.tone}`}>
            <kpi.icon aria-hidden />
            <div>
              <small>{kpi.label}</small>
              <strong>{summary ? kpi.value : "—"}</strong>
            </div>
          </div>
        ))}
      </section>
      <section className="rmo-card rmo-stages" aria-label="Ageing of open checks">
        <header>
          <h2>
            Ageing <small>· open checks by days since assignment</small>
          </h2>
          <span className="rmo-muted">{ageingTotal} open</span>
        </header>
        <div className="rmo-stage-bar">
          {ageingTotal ? (
            AGEING.map((bucket) =>
              summary?.ageing[bucket.key] ? (
                <span
                  key={bucket.key}
                  style={{ flex: summary.ageing[bucket.key], background: bucket.hex }}
                  title={`${bucket.label}: ${summary.ageing[bucket.key]}`}
                />
              ) : null,
            )
          ) : (
            <span className="is-empty" />
          )}
        </div>
        <div className="ann-colours mis-colours vjb-legend">
          {AGEING.map((bucket) => (
            <span key={bucket.key} className="ann-chip">
              <i style={{ background: bucket.hex }} aria-hidden />
              {bucket.label}
              <strong>{summary?.ageing[bucket.key] ?? 0}</strong>
            </span>
          ))}
        </div>
      </section>
      <section className="rmo-card rmo-queue">
        <header className="rmo-queue-head">
          <div>
            <h2>{mode === "vendor" ? "My checks" : "Vendor work"}</h2>
            <p>
              {mode === "vendor"
                ? "Accept a check, record what you verified, attach proof and submit."
                : "Every check sent to a vendor. Open one to review the result."}
            </p>
          </div>
          <div className="rmo-queue-tools vjb-tools">
            <label className="rmo-search">
              <Search aria-hidden />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search Sapling ID or candidate"
                aria-label="Search vendor checks"
              />
            </label>
            <ColumnPicker
              options={OPTIONS}
              value={columns}
              defaults={TABLE_DEFAULTS}
              fixedLabel="Sapling ID and candidate"
              onChange={update}
            />
            <Button
              size="sm"
              variant="outline"
              loading={download.isPending}
              disabled={!board.data?.items.length}
              onClick={() => download.mutate()}
            >
              <Download aria-hidden /> Export
            </Button>
          </div>
        </header>
        <div className="rmo-tabs vjb-tabs" role="group" aria-label="Filter by status">
          {tabs.map((item, index) => (
            <button
              key={item.label}
              type="button"
              className={tab === index ? "is-active" : ""}
              aria-pressed={tab === index}
              onClick={() => setTab(index)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {board.isError ? (
          <div className="rmo-empty">
            <strong>Could not load</strong>
            <span>{board.error.message}</span>
          </div>
        ) : !board.data ? (
          <div className="rmo-empty">Loading…</div>
        ) : !board.data.items.length ? (
          <div className="rmo-empty">
            <strong>Nothing here</strong>
            <span>
              {mode === "vendor"
                ? "Checks assigned to you will appear here."
                : "Send a check to a vendor from its Sources & methods → Vendor tab."}
            </span>
          </div>
        ) : (
          <div className="rmo-table-scroll">
            <table className="rmo-table" aria-label="Vendor checks">
              <thead>
                <tr>
                  <th>Case</th>
                  {show("check") ? <th>Check</th> : null}
                  {show("client") ? <th>Client</th> : null}
                  {show("vendor") ? <th>Vendor</th> : null}
                  {show("handler") ? <th>Handled by</th> : null}
                  {show("status") ? <th>Status</th> : null}
                  {show("assignedAt") ? <th>Assigned</th> : null}
                  {show("dueAt") ? <th>Due</th> : null}
                  {show("ageDays") ? <th>Age</th> : null}
                  {show("overdue") ? <th>Overdue</th> : null}
                  {show("submittedAt") ? <th>Submitted</th> : null}
                  {show("result") ? <th>Result</th> : null}
                  {show("reviewedAt") ? <th>Reviewed</th> : null}
                  <th className="is-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {board.data.items.map((job) => (
                  <tr key={job.id} className={job.overdue ? "is-escalated" : undefined}>
                    <td>
                      <strong className="block text-[13px] text-slate-900">{job.caseNumber}</strong>
                      <span className="rmo-muted">{job.candidateName}</span>
                    </td>
                    {show("check") ? <td>{readable(job.checkType)}</td> : null}
                    {show("client") ? <td>{job.clientName}</td> : null}
                    {show("vendor") ? <td>{job.vendor.name}</td> : null}
                    {show("handler") ? <td>{job.handler?.name ?? job.vendor.name}</td> : null}
                    {show("status") ? (
                      <td>
                        <span className={`rmo-pill ${STATUS_COPY[job.status].tone}`}>
                          {STATUS_COPY[job.status][mode]}
                        </span>
                      </td>
                    ) : null}
                    {show("assignedAt") ? (
                      <td className="whitespace-nowrap">{formatDateTime(job.assignedAt)}</td>
                    ) : null}
                    {show("dueAt") ? (
                      <td className={`whitespace-nowrap ${job.overdue ? "text-red-600" : ""}`}>
                        {job.dueAt ? formatDateTime(job.dueAt) : "—"}
                      </td>
                    ) : null}
                    {show("ageDays") ? <td>{job.ageDays}d</td> : null}
                    {show("overdue") ? <td>{job.overdue ? "Yes" : "No"}</td> : null}
                    {show("submittedAt") ? (
                      <td className="whitespace-nowrap">
                        {job.submittedAt ? formatDateTime(job.submittedAt) : "—"}
                      </td>
                    ) : null}
                    {show("result") ? <td>{job.result ? readable(job.result) : "—"}</td> : null}
                    {show("reviewedAt") ? (
                      <td className="whitespace-nowrap">
                        {job.reviewedAt ? formatDateTime(job.reviewedAt) : "—"}
                      </td>
                    ) : null}
                    <td className="is-action">
                      <Button size="sm" variant="outline" onClick={() => onOpen(job)}>
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
