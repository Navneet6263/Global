import { useEffect, useRef } from "react";
import type { QueueCase } from "@/lib/backend-api/workflow";
import { RmQueueRow } from "./RmQueueRow";
import {
  isBulkDataEntryEligible,
  MAX_BULK_DATA_ENTRY,
  type RmActionKind,
  type RmColumn,
} from "./rm-queue-model";

export function RmQueueTable({
  items,
  show,
  focusedCaseId,
  showSelect,
  selectedIds,
  onToggleRow,
  onTogglePage,
  onFocusCase,
  onAction,
}: {
  items: QueueCase[];
  show: (key: RmColumn) => boolean;
  focusedCaseId?: string;
  showSelect: boolean;
  selectedIds: Set<string>;
  onToggleRow: (item: QueueCase) => void;
  onTogglePage: (eligibleItems: QueueCase[], selectAll: boolean) => void;
  onFocusCase: (caseId: string) => void;
  onAction: (kind: RmActionKind, item: QueueCase) => void;
}) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const eligible = items.filter(isBulkDataEntryEligible);
  const allSelected = eligible.length > 0 && eligible.every((item) => selectedIds.has(item.id));
  const someSelected = eligible.some((item) => selectedIds.has(item.id));
  const limitReached = selectedIds.size >= MAX_BULK_DATA_ENTRY;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  return (
    <div className="rmo-table-scroll">
      <table className="rmo-table" aria-label="Cases">
        <thead>
          <tr>
            {showSelect ? (
              <th className="oa-check">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  disabled={!eligible.length}
                  onChange={() => onTogglePage(eligible, !allSelected)}
                  aria-label="Select all on page"
                  title="Select all eligible cases on this page"
                />
              </th>
            ) : null}
            <th>Candidate / client</th>
            {show("stage") ? <th>Current stage</th> : null}
            {show("working") ? <th>Working with</th> : null}
            {show("checks") ? <th>Checks</th> : null}
            {show("documents") ? <th>Documents</th> : null}
            {show("due") ? <th>Due</th> : null}
            {show("received") ? <th>Received</th> : null}
            <th className="is-action">Next action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <RmQueueRow
              key={item.id}
              item={item}
              show={show}
              focused={focusedCaseId === item.id}
              showSelect={showSelect}
              selected={selectedIds.has(item.id)}
              selectionLimitReached={limitReached}
              onToggleSelect={() => onToggleRow(item)}
              onFocus={() => onFocusCase(item.id)}
              onAction={(kind) => onAction(kind, item)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
