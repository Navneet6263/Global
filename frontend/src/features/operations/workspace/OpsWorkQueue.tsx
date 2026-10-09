import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColourChip } from "@/features/workflow-ui/ColourChip";
import { caseColour } from "@/features/workflow-ui/colour-codes";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { listCases, type CaseListItem } from "@/lib/api/cases";
import { queueRange } from "@/features/stakeholders/client/client-queue-model";
import {
  OPS_PAGE_SIZE,
  dueState,
  humanizeCode,
  initials,
  opsQueueQuery,
  opsQueueViews,
  caseStage,
  opsStageFilters,
  workingWith,
  type OpsQueueSearch,
} from "./ops-queue-model";
import type { NavigationCounts } from "./ops-workspace-api";
import { ColumnPicker } from "@/components/table/column-picker";
import { useColumnChoice } from "@/components/table/use-column-choice";
import {
  OPS_QUEUE_COLUMNS_KEY,
  defaultOpsQueueColumns,
  opsQueueColumns,
  type OpsQueueColumn,
} from "./ops-queue-columns";

const shortDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        timeZone: "Asia/Kolkata",
      }).format(new Date(value))
    : "—";

export interface Option {
  value: string;
  label: string;
}

export function OpsWorkQueue({
  search,
  counts,
  clients,
  rms,
  canAssign,
  onChange,
  onFocus,
  onAssign,
}: {
  search: OpsQueueSearch;
  counts?: NavigationCounts;
  clients: Option[];
  rms: Option[];
  canAssign: boolean;
  onChange: (patch: Partial<OpsQueueSearch>, replace?: boolean) => void;
  onFocus: (caseId: string) => void;
  onAssign: (item: CaseListItem) => void;
}) {
  const [input, setInput] = useState(search.q ?? "");
  useEffect(() => setInput(search.q ?? ""), [search.q]);
  const layout = useColumnChoice(OPS_QUEUE_COLUMNS_KEY, opsQueueColumns, defaultOpsQueueColumns);
  const query = opsQueueQuery(search);
  const cases = useQuery({
    queryKey: ["cases", "ops-queue", query],
    queryFn: ({ signal }) => listCases(query, signal),
    placeholderData: keepPreviousData,
  });
  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? OPS_PAGE_SIZE;
  const total = cases.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const waiting = cases.isFetching;
  const shortcutCount: Partial<Record<string, number | undefined>> = {
    "needs-rm": counts?.opsUnassigned,
    overdue: counts?.opsSlaRisk,
    queries: counts?.opsClarifications,
    qc: counts?.qaQueue,
  };
  const filtered = Boolean(
    search.q || search.view || search.stage || search.clientId || search.ownerId,
  );
  return (
    <section className="client-panel client-queue ops-queue" aria-label="Work queue">
      <header className="client-queue-heading">
        <div>
          <h2>Work queue</h2>
          <p className="ops-subtle">
            Live cases, due first. Select a row to see its owner and blocker.
          </p>
        </div>
        <ColumnPicker
          options={opsQueueColumns}
          value={layout.columns}
          defaults={defaultOpsQueueColumns}
          fixedLabel="Candidate and action"
          onChange={layout.update}
        />
      </header>
      <div className="ops-shortcuts" role="group" aria-label="Attention shortcuts">
        {opsQueueViews.map((item) => {
          const count = shortcutCount[item.value];
          const pressed = search.view === item.value;
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={pressed}
              className={`ops-shortcut is-${item.value}`}
              onClick={() =>
                onChange({
                  view: pressed ? undefined : item.value,
                  stage: undefined,
                  page: undefined,
                })
              }
            >
              {item.label}
              {count !== undefined ? <span className="num">{count}</span> : null}
            </button>
          );
        })}
      </div>
      <form
        className="client-queue-filters ops-queue-filters"
        onSubmit={(event) => {
          event.preventDefault();
          onChange({ q: input.trim() || undefined, page: undefined });
        }}
      >
        <label className="client-queue-search">
          <span className="sr-only">Search candidate, case, client or RM</span>
          <input
            value={input}
            maxLength={120}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Search candidate, case, client or RM"
            type="search"
          />
          <button type="submit" aria-label="Search">
            <Search aria-hidden />
          </button>
        </label>
        <select
          aria-label="Filter by client"
          value={search.clientId ?? ""}
          onChange={(event) =>
            onChange({ clientId: event.target.value || undefined, page: undefined })
          }
        >
          <option value="">All clients</option>
          {clients.map((client) => (
            <option key={client.value} value={client.value}>
              {client.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by stage"
          value={search.stage ?? ""}
          disabled={Boolean(search.view && search.view !== "needs-rm" && search.view !== "overdue")}
          onChange={(event) =>
            onChange({
              stage: (event.target.value || undefined) as OpsQueueSearch["stage"],
              page: undefined,
            })
          }
        >
          <option value="">All stages</option>
          {opsStageFilters.map((stage) => (
            <option key={stage.value} value={stage.value}>
              {stage.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by responsible RM"
          value={search.ownerId ?? ""}
          disabled={search.view === "needs-rm"}
          onChange={(event) =>
            onChange({ ownerId: event.target.value || undefined, page: undefined })
          }
        >
          <option value="">Any RM</option>
          {rms.map((rm) => (
            <option key={rm.value} value={rm.value}>
              {rm.label}
            </option>
          ))}
        </select>
        {filtered ? (
          <button
            type="button"
            className="client-filter-reset"
            onClick={() => {
              setInput("");
              onChange({
                q: undefined,
                view: undefined,
                stage: undefined,
                clientId: undefined,
                ownerId: undefined,
                page: undefined,
              });
            }}
          >
            Reset
          </button>
        ) : null}
      </form>
      <div className="client-queue-feedback" role="status" aria-live="polite">
        {waiting ? "Updating work queue…" : cases.isError ? "Work queue unavailable" : ""}
      </div>
      {cases.isError ? (
        <ErrorState
          description={cases.error.message}
          onRetry={() => void cases.refetch()}
          retrying={waiting}
        />
      ) : null}
      {cases.isPending ? <ListSkeleton rows={6} /> : null}
      {cases.data && !cases.isError ? (
        <div aria-busy={waiting} className={cases.isPlaceholderData ? "opacity-60" : undefined}>
          {cases.data.items.length ? (
            <div
              className="client-table-scroll"
              role="region"
              aria-label="Operations cases table"
              tabIndex={0}
            >
              <table className="client-case-table ops-case-table">
                <thead>
                  <tr>
                    <th scope="col">Candidate / client</th>
                    {layout.columns.map((key) => (
                      <th key={key} scope="col">
                        {opsQueueColumns.find((column) => column.key === key)?.label}
                      </th>
                    ))}
                    <th scope="col">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cases.data.items.map((item) => (
                    <QueueRow
                      key={item.id}
                      item={item}
                      columns={layout.columns}
                      focused={search.caseId === item.id}
                      disabled={cases.isPlaceholderData}
                      canAssign={canAssign}
                      onFocus={() => onFocus(item.id)}
                      onAssign={() => onAssign(item)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="font-semibold">
                {page > pages ? "This page is no longer available" : "No cases match this view"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {filtered
                  ? "Change or reset the filters."
                  : "New cases appear here as clients create them."}
              </p>
              {page > 1 ? (
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => onChange({ page: undefined })}
                >
                  First page
                </Button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      <footer className="client-queue-footer">
        <span>
          {cases.data && !cases.isError && !cases.isPlaceholderData
            ? queueRange(page, cases.data.items.length, total, pageSize)
            : cases.isError
              ? "Results unavailable"
              : "Loading results…"}
        </span>
        <div className="client-pagination">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={page <= 1 || waiting}
            onClick={() => onChange({ page: page - 1 })}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span>
            Page {page} / {pages}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={page >= pages || waiting || cases.isError}
            onClick={() => onChange({ page: page + 1 })}
          >
            <ChevronRight aria-hidden />
          </Button>
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(event) =>
              onChange({ pageSize: Number(event.target.value), page: undefined })
            }
          >
            <option value={6}>6 per page</option>
            <option value={12}>12 per page</option>
          </select>
        </div>
      </footer>
    </section>
  );
}

function QueueRow({
  item,
  columns,
  focused,
  disabled,
  canAssign,
  onFocus,
  onAssign,
}: {
  item: CaseListItem;
  columns: readonly OpsQueueColumn[];
  focused: boolean;
  disabled?: boolean;
  canAssign: boolean;
  onFocus: () => void;
  onAssign: () => void;
}) {
  const stage = caseStage(item);
  const worker = workingWith(item);
  const colour = caseColour(item.checks);
  const due = dueState(item.dueAt);
  const live = stage.step < 6;
  const needsRm = live && !item.assignedOpsUser;
  const person = (name: string | null | undefined, empty: string) =>
    name ? (
      <span className="ops-person">
        <span className="ops-avatar" aria-hidden>
          {initials(name)}
        </span>
        {name}
      </span>
    ) : (
      <span className="ops-person is-empty">{empty}</span>
    );
  const cell: Record<OpsQueueColumn, () => React.ReactNode> = {
    stage: () => (
      <span className={`ops-stage-chip is-${stage.tone}`}>
        <i aria-hidden />
        {stage.label}
      </span>
    ),
    outcome: () =>
      colour ? (
        <ColourChip value={colour} compact />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    rm: () => person(item.assignedOpsUser?.displayName, "Unassigned"),
    companyRm: () => person(item.workflow?.companyRm?.displayName, "Not set"),
    working: () => (
      <span className="ops-working">
        {worker.name}
        {worker.role !== stage.label ? <small>{worker.role}</small> : null}
      </span>
    ),
    due: () => <span className={`ops-due is-${due.tone}`}>{live ? due.text : "—"}</span>,
    package: () => <span>{item.servicePackage?.name ?? "—"}</span>,
    priority: () => <span>{humanizeCode(item.priority)}</span>,
    checks: () => (
      <span className="num">
        {item.checks.filter((check) => check.status === "COMPLETED").length}/{item.checks.length}
      </span>
    ),
    created: () => <span className="num">{shortDate(item.createdAt)}</span>,
    updated: () => <span className="num">{shortDate(item.updatedAt)}</span>,
  };
  return (
    <tr className={focused ? "is-focused" : undefined} aria-selected={focused}>
      <td data-column="candidate">
        <button
          type="button"
          className="ops-row-focus"
          onClick={onFocus}
          aria-label={`Show details for ${item.subject.fullName}`}
          aria-pressed={focused}
        >
          <strong className="client-candidate-name">{item.subject.fullName}</strong>
          <span className="client-case-number">
            {item.client.displayName} · {item.caseNumber}
          </span>
        </button>
      </td>
      {columns.map((key) => (
        <td key={key} data-column={key}>
          {cell[key]()}
        </td>
      ))}
      <td>
        {needsRm && canAssign ? (
          <Button
            size="sm"
            className="ops-row-action"
            disabled={disabled}
            onClick={onAssign}
            aria-label={`Assign RM for ${item.subject.fullName}`}
          >
            Assign RM
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="client-open-case ops-row-action"
            disabled={disabled}
            onClick={onFocus}
            aria-label={`View ${item.subject.fullName}`}
          >
            View
          </Button>
        )}
      </td>
    </tr>
  );
}
