import { Search } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { ColumnPicker } from "@/components/table/column-picker";
import type { CaseQueue, QueueCase } from "@/lib/backend-api/workflow";
import { RmQueueBulkBar } from "./RmQueueBulkBar";
import { RmQueueFooter } from "./RmQueueFooter";
import { RmQueueTable } from "./RmQueueTable";
import type { RmQueueSearch } from "./RmWorkQueue";
import {
  ACTION_TABS,
  isBulkDataEntryEligible,
  RM_COLUMNS,
  RM_DEFAULT_COLUMNS,
  type RmActionKind,
} from "./rm-queue-model";

type ColKey = "stage" | "working" | "checks" | "documents" | "due" | "received";

export function RmQueueTableSection({
  search,
  input,
  onInputChange,
  onChange,
  columns,
  queueData,
  queueError,
  queuePending,
  queueFetching,
  onRefetch,
  clients,
  filtered,
  page,
  pages,
  size,
  total,
  selectedIds,
  onToggleRow,
  onTogglePage,
  onClearSelection,
  onBulkAssign,
  onAction,
  embedded = false,
}: {
  search: RmQueueSearch;
  input: string;
  onInputChange: (val: string) => void;
  onChange: (patch: Partial<RmQueueSearch>, replace?: boolean) => void;
  columns: {
    columns: ColKey[];
    show: (key: ColKey) => boolean;
    update: (next: ColKey[]) => void;
  };
  queueData: CaseQueue | undefined;
  queueError: Error | null;
  queuePending: boolean;
  queueFetching: boolean;
  onRefetch: () => void;
  clients: Array<{ id: string; name: string }>;
  filtered: boolean;
  page: number;
  pages: number;
  size: number;
  total: number;
  selectedIds: Set<string>;
  onToggleRow: (item: QueueCase) => void;
  onTogglePage: (eligibleItems: QueueCase[], selectAll: boolean) => void;
  onClearSelection: () => void;
  onBulkAssign: () => void;
  onAction: (kind: RmActionKind, item: QueueCase) => void;
  embedded?: boolean;
}) {
  const counts = queueData?.counts ?? {};
  const summary = queueData?.summary;
  const showSelect =
    search.bucket === "needs_data_entry" || Boolean(queueData?.items.some(isBulkDataEntryEligible));
  const tools = (
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
  );

  const body = (
    <>
      {embedded ? null : (
        <header className="rmo-queue-head">
          <div>
            <h2>{search.bucket === "correction" ? "Correction cases" : "My action queue"}</h2>
            <p>
              {search.sort === "newest"
                ? "Newest handovers first."
                : "Prioritised by deadline and readiness."}
            </p>
          </div>
          {tools}
        </header>
      )}

      <div
        className={embedded ? "rmo-tabs pt-3.5" : "rmo-tabs"}
        role="group"
        aria-label="Quick filters"
      >
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
            onChange={(event) => onInputChange(event.target.value)}
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
              onInputChange("");
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
          {queueFetching ? "Updating…" : ""}
        </span>
        {embedded ? <div className="ml-auto">{tools}</div> : null}
      </div>

      {queueError ? (
        <ErrorState description={queueError.message} onRetry={onRefetch} retrying={queueFetching} />
      ) : null}
      {queuePending ? <ListSkeleton rows={5} /> : null}
      {queueData ? (
        queueData.items.length ? (
          <>
            <RmQueueBulkBar
              count={selectedIds.size}
              onAssign={onBulkAssign}
              onClear={onClearSelection}
            />
            <RmQueueTable
              items={queueData.items}
              show={columns.show}
              focusedCaseId={search.caseId}
              showSelect={showSelect}
              selectedIds={selectedIds}
              onToggleRow={onToggleRow}
              onTogglePage={onTogglePage}
              onFocusCase={(caseId) => onChange({ caseId }, true)}
              onAction={onAction}
            />
          </>
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

      <RmQueueFooter page={page} pages={pages} size={size} total={total} onChange={onChange} />
    </>
  );

  return embedded ? (
    body
  ) : (
    <section className="rmo-card rmo-queue" aria-label="My action queue">
      {body}
    </section>
  );
}
