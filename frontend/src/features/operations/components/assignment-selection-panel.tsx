"use client";

import { useEffect, useMemo, useState } from "react";
import { Inbox, Search } from "lucide-react";
import type { OpsAssignableItem } from "../contracts/operations";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Section } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { OPS_PRIORITY_META, OPS_SLA_META } from "@/features/operations/contracts/case";
import { formatDuration } from "@/lib/formatting";

const PAGE_SIZE = 8;

interface AssignmentSelectionPanelProps {
  items: readonly OpsAssignableItem[];
  selectedIds: readonly string[];
  disabled?: boolean;
  maxSelection?: number;
  onSelectionChange: (ids: string[]) => void;
}

export function AssignmentSelectionPanel({
  items,
  selectedIds,
  disabled,
  maxSelection = 50,
  onSelectionChange,
}: AssignmentSelectionPanelProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      items.filter((item) =>
        [item.candidateName, item.caseNumber, item.clientName, item.checkLabel, item.branch]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [items, normalizedQuery],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedOnPage = visible.filter((item) => selectedSet.has(item.id)).length;
  const allOnPageSelected = visible.length > 0 && selectedOnPage === visible.length;

  useEffect(() => setPage(1), [normalizedQuery]);
  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount]);

  const toggleItem = (id: string) => {
    if (selectedSet.has(id)) {
      onSelectionChange(selectedIds.filter((entry) => entry !== id));
      return;
    }
    if (selectedIds.length < maxSelection) onSelectionChange([...selectedIds, id]);
  };

  const toggleVisible = () => {
    if (allOnPageSelected) {
      const visibleIds = new Set(visible.map((item) => item.id));
      onSelectionChange(selectedIds.filter((id) => !visibleIds.has(id)));
      return;
    }
    const next = [...selectedIds];
    for (const item of visible) {
      if (!selectedSet.has(item.id) && next.length < maxSelection) next.push(item.id);
    }
    onSelectionChange(next);
  };

  return (
    <Section
      title="1. Select checks"
      description={`Choose the work to allocate. A maximum of ${maxSelection} checks can be committed together.`}
      actions={
        <Badge variant="secondary" className="num rounded-full font-medium">
          {selectedIds.length} selected
        </Badge>
      }
      padded={false}
    >
      <div className="space-y-3 border-b border-border p-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search candidate, case, client or check"
            className="h-11 rounded-xl bg-background pl-10"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={allOnPageSelected || (selectedOnPage > 0 && "indeterminate")}
            disabled={disabled || visible.length === 0}
            onCheckedChange={toggleVisible}
            aria-label="Select all checks on this page"
          />
          Select this page ({visible.length})
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={Inbox}
            title={items.length === 0 ? "Nothing waiting for allocation" : "No checks found"}
            description={
              items.length === 0
                ? "Every open check currently has an owner."
                : "Try another candidate, case, client or check name."
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((item) => {
            const checked = selectedSet.has(item.id);
            return (
              <li
                key={item.id}
                className={checked ? "bg-primary/[0.045]" : "transition-colors hover:bg-muted/25"}
              >
                <label className="flex cursor-pointer items-start gap-3 px-5 py-3.5">
                  <Checkbox
                    checked={checked}
                    disabled={disabled || (!checked && selectedIds.length >= maxSelection)}
                    onCheckedChange={() => toggleItem(item.id)}
                    aria-label={`Select ${item.checkLabel} for ${item.candidateName}`}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-foreground">
                        {item.candidateName}
                      </span>
                      <span className="num text-[11px] text-muted-foreground">
                        {item.caseNumber}
                      </span>
                      <StatusBadge
                        label={OPS_PRIORITY_META[item.priority].label}
                        tone={OPS_PRIORITY_META[item.priority].tone}
                        withDot={false}
                      />
                      <StatusBadge
                        label={OPS_SLA_META[item.slaState].label}
                        tone={OPS_SLA_META[item.slaState].tone}
                      />
                    </div>
                    <p className="text-xs text-foreground/80">
                      {item.checkLabel} <span className="text-muted-foreground">for</span>{" "}
                      {item.clientName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.branch} ({item.city}) ·{" "}
                      <span className="num">
                        {item.slaMinutesRemaining <= 0
                          ? `overdue ${formatDuration(-item.slaMinutesRemaining)}`
                          : `${formatDuration(item.slaMinutesRemaining)} left`}
                      </span>
                    </p>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        onPageChange={setPage}
        label="checks"
      />
    </Section>
  );
}
