import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CircleCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  FolderOpen,
  MoreHorizontal,
  Search,
  Siren,
  TriangleAlert,
  UserRoundCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { ColumnPicker } from "@/components/table/column-picker";
import { useColumnChoice } from "@/components/table/use-column-choice";
import { getSession } from "@/lib/api/auth";
import { getRmQueue, rmBuckets, type QueueCase, type RmBucket } from "@/lib/backend-api/workflow";
import { OpsCaseContext } from "@/features/operations/workspace/OpsCaseContext";
import { dueLabel, flowPosition, sinceLabel } from "./flow-model";
import { StopResumeButton } from "./StopResume";
import { canStop } from "./flow-model";
import {
  AssignDataEntryDialog,
  FinalReviewDialog,
  RouteChecksDialog,
  SendBackDialog,
} from "./RmDialogs";
import {
  ACTION_TABS,
  PAGE_SIZES,
  RM_COLUMNS,
  RM_DEFAULT_COLUMNS,
  initialsOf,
  nextAction,
  type RmActionKind,
} from "./rm-queue-model";

export interface RmQueueSearch {
  bucket?: RmBucket;
  q?: string;
  page?: number;
  caseId?: string;
  client?: string;
  sort?: "due" | "newest";
  size?: number;
  /** Escalated by the client / Platform Admin, or past the due time. */
  flag?: "escalated" | "overdue";
}

const STAGE_COLORS: Record<RmBucket, string> = {
  needs_data_entry: "#93c5fd",
  with_data_entry: "#c7d2fe",
  correction: "#fcd34d",
  ready: "#86efac",
  in_verification: "#6ee7b7",
  qc: "#c4b5fd",
  final_approval: "#fdba74",
};

/** RM home: headline numbers, where cases sit, the action queue and a client pulse. */
export function RmWorkQueue({
  search,
  onChange,
}: {
  search: RmQueueSearch;
  onChange: (patch: Partial<RmQueueSearch>, replace?: boolean) => void;
}) {
  const [input, setInput] = useState(search.q ?? "");
  const [dialog, setDialog] = useState<{ kind: RmActionKind; item: QueueCase }>();
  useEffect(() => setInput(search.q ?? ""), [search.q]);
  const page = search.page ?? 1;
  const size = search.size ?? 10;
  const columns = useColumnChoice("sapling.rm.queue.columns.v1", RM_COLUMNS, RM_DEFAULT_COLUMNS);
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const queue = useQuery({
    queryKey: [
      "workflow",
      "rm-queue",
      search.bucket ?? "all",
      search.q ?? "",
      search.client ?? "",
      search.sort ?? "due",
      search.flag ?? "",
      page,
      size,
    ],
    queryFn: ({ signal }) =>
      getRmQueue(
        {
          bucket: search.bucket,
          search: search.q,
          clientId: search.client,
          sort: search.sort,
          flag: search.flag,
          page,
          pageSize: size,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const latest = useQuery({
    queryKey: ["workflow", "rm-queue", "latest-handover"],
    queryFn: ({ signal }) => getRmQueue({ sort: "newest", page: 1, pageSize: 1 }, signal),
    staleTime: 60_000,
  });
  const counts = queue.data?.counts ?? {};
  const summary = queue.data?.summary;
  const myActions =
    (counts["needs_data_entry"] ?? 0) + (counts["ready"] ?? 0) + (counts["final_approval"] ?? 0);
  const stageTotal = rmBuckets.reduce((sum, bucket) => sum + (counts[bucket.value] ?? 0), 0);
  const total = queue.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));
  const clients = session.data?.clientScope?.length
    ? session.data.clientScope
    : (summary?.clients ?? []).map(({ id, name }) => ({ id, name }));
  const filtered = Boolean(search.bucket || search.q || search.client || search.flag);
  const handover = latest.data?.items[0];

  return (
    <div className="rmo">
      <section className="rmo-kpis" aria-label="Your numbers">
        <Kpi icon={FolderOpen} label="Active cases" value={summary?.active} tone="info" />
        <Kpi
          icon={UserRoundCheck}
          label="My actions"
          value={queue.data ? myActions : undefined}
          tone="action"
        />
        <Kpi icon={Clock3} label="Due today" value={summary?.dueToday} tone="neutral" />
        <Kpi icon={TriangleAlert} label="Overdue" value={summary?.overdue} tone="bad" />
        <Kpi
          icon={CircleCheck}
          label="Completed this week"
          value={summary?.completedThisWeek}
          tone="good"
        />
      </section>

      {summary?.escalated && search.flag !== "escalated" ? (
        <div className="rmo-alert" role="alert">
          <Siren aria-hidden />
          <span>
            <strong>
              {summary.escalated} escalated {summary.escalated === 1 ? "case needs" : "cases need"}{" "}
              you now
            </strong>
            Raised by the client or Sapling management. Escalated cases are high priority.
          </span>
          <button
            type="button"
            onClick={() => onChange({ flag: "escalated", bucket: undefined, page: undefined })}
          >
            View escalations <ArrowRight aria-hidden />
          </button>
        </div>
      ) : null}

      <section className="rmo-card rmo-stages" aria-label="Cases by current stage">
        <header>
          <h2>
            Cases by current stage <small>({stageTotal} total)</small>
          </h2>
          {search.bucket ? (
            <button
              type="button"
              className="rmo-link"
              onClick={() => onChange({ bucket: undefined, page: undefined })}
            >
              Show all active
            </button>
          ) : (
            <span className="rmo-muted">Choose a stage to filter the queue.</span>
          )}
        </header>
        <div className="rmo-stage-bar" aria-hidden>
          {rmBuckets.map((bucket) =>
            counts[bucket.value] ? (
              <span
                key={bucket.value}
                style={{ flexGrow: counts[bucket.value], background: STAGE_COLORS[bucket.value] }}
              />
            ) : null,
          )}
          {!stageTotal ? <span className="is-empty" /> : null}
        </div>
        <div className="rmo-stage-list">
          {rmBuckets.map((bucket) => {
            const pressed = search.bucket === bucket.value;
            return (
              <button
                key={bucket.value}
                type="button"
                aria-pressed={pressed}
                className={pressed ? "is-active" : ""}
                onClick={() =>
                  onChange({
                    bucket: pressed ? undefined : bucket.value,
                    flag: undefined,
                    page: undefined,
                  })
                }
              >
                <span className="rmo-dot" style={{ background: STAGE_COLORS[bucket.value] }} />
                <small>{bucket.label}</small>
                <strong>{counts[bucket.value] ?? "—"}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <div className="rmo-grid">
        <section className="rmo-card rmo-queue" aria-label="My action queue">
          <header className="rmo-queue-head">
            <div>
              <h2>My action queue</h2>
              <p>
                {search.sort === "newest"
                  ? "Newest handovers first."
                  : "Prioritised by deadline and readiness."}
              </p>
            </div>
            <div className="rmo-queue-tools">
              <select
                aria-label="Sort"
                value={search.sort ?? "due"}
                onChange={(event) =>
                  onChange({
                    sort: event.target.value === "newest" ? "newest" : undefined,
                    page: undefined,
                  })
                }
              >
                <option value="due">Urgent first</option>
                <option value="newest">Newest first</option>
              </select>
              <ColumnPicker
                options={RM_COLUMNS}
                value={columns.columns}
                defaults={RM_DEFAULT_COLUMNS}
                fixedLabel="Candidate and next action"
                onChange={columns.update}
              />
            </div>
          </header>

          <div className="rmo-tabs" role="group" aria-label="Quick filters">
            {ACTION_TABS.map((tab) => {
              const pressed = search.bucket === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={pressed}
                  className={`is-${tab.value} ${pressed ? "is-active" : ""}`}
                  onClick={() =>
                    onChange({
                      bucket: pressed ? undefined : tab.value,
                      flag: undefined,
                      page: undefined,
                    })
                  }
                >
                  {tab.label}
                  <span>{counts[tab.value] ?? 0}</span>
                </button>
              );
            })}
            {(
              [
                ["escalated", "Escalated", summary?.escalated],
                ["overdue", "Overdue", summary?.overdue],
              ] as const
            ).map(([flag, label, count]) => {
              const pressed = search.flag === flag;
              return (
                <button
                  key={flag}
                  type="button"
                  aria-pressed={pressed}
                  className={`is-alarm ${pressed ? "is-active" : ""}`}
                  onClick={() =>
                    onChange({
                      flag: pressed ? undefined : flag,
                      bucket: undefined,
                      page: undefined,
                    })
                  }
                >
                  {label}
                  <span>{count ?? 0}</span>
                </button>
              );
            })}
          </div>

          <div className="rmo-filters">
            <form
              className="rmo-search"
              onSubmit={(event) => {
                event.preventDefault();
                onChange({ q: input.trim() || undefined, page: undefined });
              }}
            >
              <Search aria-hidden />
              <input
                type="search"
                value={input}
                maxLength={120}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Search candidate, case or client"
                aria-label="Search cases"
              />
            </form>
            <select
              aria-label="Client"
              value={search.client ?? ""}
              onChange={(event) =>
                onChange({ client: event.target.value || undefined, page: undefined })
              }
            >
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            {filtered ? (
              <button
                type="button"
                className="rmo-link"
                onClick={() => {
                  setInput("");
                  onChange({
                    bucket: undefined,
                    q: undefined,
                    client: undefined,
                    flag: undefined,
                    page: undefined,
                  });
                }}
              >
                Reset
              </button>
            ) : null}
            <span className="rmo-status" role="status" aria-live="polite">
              {queue.isFetching ? "Updating…" : ""}
            </span>
          </div>

          {queue.isError ? (
            <ErrorState
              description={queue.error.message}
              onRetry={() => void queue.refetch()}
              retrying={queue.isFetching}
            />
          ) : null}
          {queue.isPending ? <ListSkeleton rows={5} /> : null}
          {queue.data ? (
            queue.data.items.length ? (
              <div className="rmo-table-scroll">
                <table className="rmo-table" aria-label="Cases">
                  <thead>
                    <tr>
                      <th>Candidate / client</th>
                      {columns.show("stage") ? <th>Current stage</th> : null}
                      {columns.show("working") ? <th>Working with</th> : null}
                      {columns.show("checks") ? <th>Checks</th> : null}
                      {columns.show("documents") ? <th>Documents</th> : null}
                      {columns.show("due") ? <th>Due</th> : null}
                      {columns.show("received") ? <th>Received</th> : null}
                      <th className="is-action">Next action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.data.items.map((item) => (
                      <RmRow
                        key={item.id}
                        item={item}
                        show={columns.show}
                        focused={search.caseId === item.id}
                        onFocus={() => onChange({ caseId: item.id }, true)}
                        onAction={(kind) => setDialog({ kind, item })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rmo-empty">
                <strong>Nothing here right now</strong>
                <span>
                  {filtered
                    ? "No case matches these filters."
                    : "New cases appear when a company you look after starts a verification."}
                </span>
              </div>
            )
          ) : null}

          <footer className="rmo-pager">
            <span>
              {total
                ? `Showing ${(page - 1) * size + 1}–${Math.min(total, page * size)} of ${total}`
                : ""}
            </span>
            <div>
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => onChange({ page: page - 1 })}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <span className="rmo-page">
                {page} / {pages}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next page"
                disabled={page >= pages}
                onClick={() => onChange({ page: page + 1 })}
              >
                <ChevronRight aria-hidden />
              </Button>
              <select
                aria-label="Rows per page"
                value={size}
                onChange={(event) =>
                  onChange({
                    size:
                      Number(event.target.value) === 10 ? undefined : Number(event.target.value),
                    page: undefined,
                  })
                }
              >
                {PAGE_SIZES.map((value) => (
                  <option key={value} value={value}>
                    {value} per page
                  </option>
                ))}
              </select>
            </div>
          </footer>
        </section>

        <aside className="rmo-rail" aria-label="Clients and follow-ups">
          {search.caseId ? (
            <OpsCaseContext
              caseId={search.caseId}
              canManage={false}
              showFullCaseLink={false}
              onClose={() => onChange({ caseId: undefined }, true)}
              onChangeRm={() => undefined}
              onEscalate={() => undefined}
            />
          ) : (
            <>
              <section className="rmo-card" aria-labelledby="rmo-pulse">
                <header className="rmo-rail-head">
                  <h2 id="rmo-pulse">Client pulse</h2>
                  <span className="rmo-muted">
                    {summary ? `${summary.clients.length} with active cases` : ""}
                  </span>
                </header>
                {summary?.clients.length ? (
                  <table className="rmo-pulse" aria-label="Client pulse">
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Active</th>
                        <th>Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.clients.map((client) => (
                        <tr key={client.id}>
                          <td>
                            <button
                              type="button"
                              onClick={() => onChange({ client: client.id, page: undefined })}
                            >
                              {client.name}
                            </button>
                          </td>
                          <td>
                            <span className="rmo-dot is-good" /> {client.active}
                          </td>
                          <td className={client.overdue ? "is-bad" : "rmo-muted"}>
                            <span className={`rmo-dot ${client.overdue ? "is-bad" : ""}`} />{" "}
                            {client.overdue}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="rmo-rail-empty">
                    {summary ? "No active cases for your clients yet." : "Loading…"}
                  </p>
                )}
              </section>

              <section className="rmo-card" aria-labelledby="rmo-follow">
                <header className="rmo-rail-head">
                  <h2 id="rmo-follow">Follow-ups</h2>
                </header>
                <ul className="rmo-follow">
                  <FollowUp
                    icon={Siren}
                    text={`${summary?.escalated ?? 0} escalated`}
                    action="View"
                    onClick={() =>
                      onChange({ flag: "escalated", bucket: undefined, page: undefined })
                    }
                  />
                  <FollowUp
                    icon={FileText}
                    text={`${counts["correction"] ?? 0} waiting on a correction`}
                    action="Open"
                    onClick={() =>
                      onChange({ bucket: "correction", flag: undefined, page: undefined })
                    }
                  />
                  <FollowUp
                    icon={Clock3}
                    text={`${counts["qc"] ?? 0} in QC review`}
                    action="View"
                    onClick={() => onChange({ bucket: "qc", flag: undefined, page: undefined })}
                  />
                  <FollowUp
                    icon={CircleCheck}
                    text={`${counts["final_approval"] ?? 0} waiting for your decision`}
                    action="Review"
                    onClick={() =>
                      onChange({ bucket: "final_approval", flag: undefined, page: undefined })
                    }
                  />
                </ul>
              </section>

              {handover ? (
                <section className="rmo-card rmo-handover" aria-labelledby="rmo-handover">
                  <header className="rmo-rail-head">
                    <h2 id="rmo-handover">Latest handover</h2>
                  </header>
                  <div>
                    <FileText aria-hidden />
                    <span>
                      <strong>
                        {handover.caseNumber} · {handover.candidateName}
                      </strong>
                      <small>
                        {handover.client.name} · received {sinceLabel(handover.createdAt)} ago
                      </small>
                      <button
                        type="button"
                        className="rmo-link"
                        onClick={() => onChange({ caseId: handover.id }, true)}
                      >
                        Open case <ArrowRight aria-hidden />
                      </button>
                    </span>
                  </div>
                </section>
              ) : null}
            </>
          )}
        </aside>
      </div>

      {dialog?.kind === "data-entry" ? (
        <AssignDataEntryDialog item={dialog.item} onClose={() => setDialog(undefined)} />
      ) : null}
      {dialog?.kind === "route" ? (
        <RouteChecksDialog item={dialog.item} onClose={() => setDialog(undefined)} />
      ) : null}
      {dialog?.kind === "send-back" ? (
        <SendBackDialog item={dialog.item} onClose={() => setDialog(undefined)} />
      ) : null}
      {dialog?.kind === "final" ? (
        <FinalReviewDialog item={dialog.item} onClose={() => setDialog(undefined)} />
      ) : null}
      {dialog?.kind === "stop" ? (
        <StopResumeButton
          item={dialog.item}
          open
          onOpenChange={(open) => (!open ? setDialog(undefined) : undefined)}
        />
      ) : null}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock3;
  label: string;
  value: number | undefined;
  tone: "info" | "action" | "neutral" | "bad" | "good";
}) {
  return (
    <div className={`rmo-kpi is-${tone}`}>
      <Icon aria-hidden />
      <span>
        <small>{label}</small>
        <strong>{value ?? "—"}</strong>
      </span>
    </div>
  );
}

function FollowUp({
  icon: Icon,
  text,
  action,
  onClick,
}: {
  icon: typeof Clock3;
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <li>
      <Icon aria-hidden />
      <span>{text}</span>
      <button type="button" className="rmo-link" onClick={onClick}>
        {action} <ArrowRight aria-hidden />
      </button>
    </li>
  );
}

function RmRow({
  item,
  show,
  focused,
  onFocus,
  onAction,
}: {
  item: QueueCase;
  show: (key: "stage" | "working" | "checks" | "documents" | "due" | "received") => boolean;
  focused: boolean;
  onFocus: () => void;
  onAction: (kind: RmActionKind) => void;
}) {
  const position = flowPosition(item);
  const due = dueLabel(item.dueAt);
  const action = nextAction(item);
  const percent = item.checks.total
    ? Math.round((item.checks.completed / item.checks.total) * 100)
    : 0;
  const more: Array<{ label: string; kind: RmActionKind }> = [
    ...(item.intakeStage === "READY"
      ? [{ label: "Return to Data Entry", kind: "send-back" as const }]
      : []),
    ...(item.intakeStage === "DATA_ENTRY" || item.intakeStage === "CORRECTION"
      ? [{ label: "Change Data Entry", kind: "data-entry" as const }]
      : []),
    ...(item.status === "STOPPED"
      ? [{ label: "Resume case", kind: "stop" as const }]
      : canStop(item.status)
        ? [{ label: "Stop case", kind: "stop" as const }]
        : []),
  ];
  return (
    <tr className={`${focused ? "is-focused" : ""} ${item.escalation ? "is-escalated" : ""}`}>
      <td>
        <button
          type="button"
          className="rmo-candidate"
          onClick={onFocus}
          aria-pressed={focused}
          aria-label={`Show details for ${item.candidateName}`}
        >
          <strong>{item.candidateName}</strong>
          <small>
            {item.client.name} · {item.caseNumber}
          </small>
        </button>
      </td>
      {show("stage") ? (
        <td>
          {item.escalation ? (
            <span className="rmo-pill is-bad" title={item.escalation.note ?? "Escalated"}>
              Escalated
            </span>
          ) : null}
          <span className={`rmo-pill is-${position.tone}`}>{position.label}</span>
          {item.openInsufficiency.l1 ? (
            <span className="rmo-pill is-warn">L1 {item.openInsufficiency.l1}</span>
          ) : null}
          {item.openInsufficiency.l2 ? (
            <span className="rmo-pill is-warn">L2 {item.openInsufficiency.l2}</span>
          ) : null}
        </td>
      ) : null}
      {show("working") ? (
        <td>
          <span className="rmo-person">
            <span className="rmo-avatar" aria-hidden>
              {initialsOf(position.holder)}
            </span>
            <span className="min-w-0">
              {position.holder}
              {item.intakeStage === "DATA_ENTRY" || item.intakeStage === "CORRECTION" ? (
                <small>since {sinceLabel(item.dataEntryAssignedAt)}</small>
              ) : null}
            </span>
          </span>
        </td>
      ) : null}
      {show("checks") ? (
        <td>
          <span className="rmo-progress" title={`${item.checks.completed} of ${item.checks.total}`}>
            <span className="rmo-meter">
              <span style={{ width: `${percent}%` }} />
            </span>
            {item.checks.completed}/{item.checks.total}
          </span>
        </td>
      ) : null}
      {show("documents") ? (
        <td>
          {item.documents.total}
          {item.documents.rejected ? (
            <span className="rmo-pill is-bad">{item.documents.rejected} sent back</span>
          ) : null}
        </td>
      ) : null}
      {show("due") ? (
        <td>
          <span className={`rmo-due is-${due.tone}`}>{due.text}</span>
        </td>
      ) : null}
      {show("received") ? <td className="rmo-muted">{sinceLabel(item.createdAt)} ago</td> : null}
      <td className="is-action">
        <span className="rmo-actions">
          {action ? (
            <Button size="sm" onClick={() => onAction(action.kind)}>
              {action.label}
            </Button>
          ) : (
            <span className="rmo-muted">No action</span>
          )}
          {more.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`More actions for ${item.candidateName}`}
                >
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {more.map((entry) => (
                  <DropdownMenuItem key={entry.label} onSelect={() => onAction(entry.kind)}>
                    {entry.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </span>
      </td>
    </tr>
  );
}
