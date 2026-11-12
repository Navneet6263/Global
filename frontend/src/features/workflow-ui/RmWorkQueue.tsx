import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useColumnChoice } from "@/components/table/use-column-choice";
import { getSession } from "@/lib/api/auth";
import { getRmQueue, rmBuckets, type QueueCase, type RmBucket } from "@/lib/backend-api/workflow";
import { BulkAssignDataEntryDialog } from "./BulkAssignDataEntryDialog";
import { StopResumeButton } from "./StopResume";
import {
  AssignDataEntryDialog,
  FinalReviewDialog,
  RouteChecksDialog,
  RaiseInsufficiencyDialog,
  SendBackDialog,
} from "./RmDialogs";
import { RmCorrectionsWorkspace } from "./RmCorrectionsWorkspace";
import { RmQueueOverview } from "./RmQueueOverview";
import { RmQueueRail } from "./RmQueueRail";
import { RmQueueTableSection } from "./RmQueueTableSection";
import {
  isBulkDataEntryEligible,
  MAX_BULK_DATA_ENTRY,
  RM_COLUMNS,
  RM_DEFAULT_COLUMNS,
  type RmActionKind,
  type RmCorrectionTab,
} from "./rm-queue-model";

export interface RmQueueSearch {
  bucket?: RmBucket;
  tab?: Exclude<RmCorrectionTab, "cases">;
  q?: string;
  page?: number;
  caseId?: string;
  client?: string;
  sort?: "due" | "newest";
  size?: number;
  flag?: "escalated" | "overdue";
}

/** RM home: headline numbers, stage breakdown, action queue, corrections workspace, and client pulse. */
export function RmWorkQueue({
  search,
  onChange,
}: {
  search: RmQueueSearch;
  onChange: (patch: Partial<RmQueueSearch>, replace?: boolean) => void;
}) {
  const [input, setInput] = useState(search.q ?? "");
  const [dialog, setDialog] = useState<{ kind: RmActionKind; item: QueueCase }>();
  const [selectedMap, setSelectedMap] = useState<Record<string, QueueCase>>({});
  const [bulkOpen, setBulkOpen] = useState(false);
  useEffect(() => setInput(search.q ?? ""), [search.q]);
  const page = search.page ?? 1;
  const size = search.size ?? 10;
  const scopeKey = `${search.bucket ?? ""}|${search.tab ?? ""}|${search.q ?? ""}|${search.client ?? ""}|${search.flag ?? ""}|${page}|${size}`;
  useEffect(() => {
    setSelectedMap({});
    setBulkOpen(false);
  }, [scopeKey]);
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

  useEffect(() => {
    const items = queue.data?.items;
    if (!items) return;
    setSelectedMap((prev) => {
      const keys = Object.keys(prev);
      if (!keys.length) return prev;
      const freshById = new Map(items.filter(isBulkDataEntryEligible).map((row) => [row.id, row]));
      let changed = false;
      const next: Record<string, QueueCase> = {};
      for (const id of keys) {
        const fresh = freshById.get(id);
        if (fresh) {
          next[id] = fresh;
          if (fresh !== prev[id]) changed = true;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [queue.data?.items]);

  const selectedList = useMemo(() => Object.values(selectedMap), [selectedMap]);
  const selectedIds = useMemo(() => new Set(Object.keys(selectedMap)), [selectedMap]);

  const toggleRow = (item: QueueCase) => {
    if (!isBulkDataEntryEligible(item)) return;
    setSelectedMap((prev) => {
      if (prev[item.id]) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      if (Object.keys(prev).length >= MAX_BULK_DATA_ENTRY) return prev;
      return { ...prev, [item.id]: item };
    });
  };

  const togglePage = (eligibleItems: QueueCase[], selectAll: boolean) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (!selectAll) {
        for (const item of eligibleItems) delete next[item.id];
        return next;
      }
      for (const item of eligibleItems) {
        if (Object.keys(next).length >= MAX_BULK_DATA_ENTRY) break;
        next[item.id] = item;
      }
      return next;
    });
  };

  const tableSection = (
    <RmQueueTableSection
      search={search}
      input={input}
      onInputChange={setInput}
      onChange={onChange}
      columns={columns}
      queueData={queue.data}
      queueError={queue.error}
      queuePending={queue.isPending}
      queueFetching={queue.isFetching}
      onRefetch={() => void queue.refetch()}
      clients={clients}
      filtered={filtered}
      page={page}
      pages={pages}
      size={size}
      total={total}
      selectedIds={selectedIds}
      onToggleRow={toggleRow}
      onTogglePage={togglePage}
      onClearSelection={() => setSelectedMap({})}
      onBulkAssign={() => setBulkOpen(true)}
      onAction={(kind, item) => setDialog({ kind, item })}
      embedded={search.bucket === "correction"}
    />
  );

  return (
    <div className="rmo">
      <RmQueueOverview
        search={search}
        summary={summary}
        counts={counts}
        myActions={queue.data ? myActions : undefined}
        stageTotal={stageTotal}
        onChange={onChange}
      />

      <div className="rmo-grid">
        {search.bucket === "correction" ? (
          <RmCorrectionsWorkspace
            activeTab={search.tab}
            correctionCasesCount={queue.data ? (counts["correction"] ?? 0) : undefined}
            onTabChange={(nextTab) =>
              onChange({
                tab: nextTab === "cases" ? undefined : nextTab,
                caseId: nextTab === "cases" ? search.caseId : undefined,
              })
            }
            casesView={tableSection}
          />
        ) : (
          tableSection
        )}

        <RmQueueRail
          search={search}
          summary={summary}
          counts={counts}
          handover={latest.data?.items[0]}
          onChange={onChange}
        />
      </div>

      {bulkOpen && selectedList.length > 0 ? (
        <BulkAssignDataEntryDialog
          items={selectedList}
          onRemoveCase={(caseId) =>
            setSelectedMap((prev) => {
              const next = { ...prev };
              delete next[caseId];
              return next;
            })
          }
          onAssigned={(assignedCaseIds) =>
            setSelectedMap((prev) => {
              const next = { ...prev };
              for (const id of assignedCaseIds) delete next[id];
              return next;
            })
          }
          onClose={() => setBulkOpen(false)}
        />
      ) : null}

      {dialog?.kind === "data-entry" ? (
        <AssignDataEntryDialog item={dialog.item} onClose={() => setDialog(undefined)} />
      ) : null}
      {dialog?.kind === "route" ? (
        <RouteChecksDialog item={dialog.item} onClose={() => setDialog(undefined)} />
      ) : null}
      {dialog?.kind === "send-back" ? (
        <SendBackDialog item={dialog.item} onClose={() => setDialog(undefined)} />
      ) : null}
      {dialog?.kind === "insufficiency" ? (
        <RaiseInsufficiencyDialog item={dialog.item} onClose={() => setDialog(undefined)} />
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
