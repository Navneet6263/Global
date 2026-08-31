"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import type { OpsTeamMember } from "../contracts/operations";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Section } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/formatting";
import { cn } from "@/lib/utils";

interface OpsCapacityListProps {
  members: readonly OpsTeamMember[];
  loading?: boolean;
  selectedId?: string | null;
  recommendedId?: string | null;
  onSelect?: (memberId: string) => void;
  title?: string;
  description?: string;
  pageSize?: number;
}

export function OpsCapacityList({
  members,
  loading,
  selectedId,
  recommendedId,
  onSelect,
  title = "2. Choose verifier",
  description = "Compare live workload and SLA pressure. Selection is always manual.",
  pageSize = 6,
}: OpsCapacityListProps) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(members.length / pageSize));
  const visible = members.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount]);

  return (
    <Section
      title={title}
      description={description}
      actions={
        selectedId ? (
          <Badge className="gap-1 rounded-full bg-mint text-forest hover:bg-mint">
            <CheckCircle2 className="size-3" aria-hidden /> Selected
          </Badge>
        ) : null
      }
      padded={false}
    >
      {loading ? (
        <div className="p-5">
          <ListSkeleton rows={5} />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((member) => {
            const selected = selectedId === member.id;
            const recommended = recommendedId === member.id;
            return (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => onSelect?.(member.id)}
                  disabled={!onSelect}
                  aria-pressed={selected}
                  className={cn(
                    "w-full space-y-2.5 px-5 py-3.5 text-left transition-colors",
                    onSelect ? "hover:bg-muted/40" : "cursor-default",
                    selected ? "bg-primary/[0.07] ring-1 ring-inset ring-primary/30" : "",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-foreground">{member.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {member.role} · {member.branch}
                    </span>
                    {recommended ? (
                      <Badge
                        variant="secondary"
                        className="ml-auto gap-1 rounded-full border-0 bg-sky/15 text-[10px] text-sky-foreground"
                      >
                        <Sparkles className="size-3" aria-hidden /> Best current fit
                      </Badge>
                    ) : null}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        member.overdue > 0 ? "bg-critical" : "bg-mint",
                      )}
                      style={{ width: `${Math.min(100, member.relativeLoadPercent)}%` }}
                    />
                  </div>
                  <p className="num text-[11px] text-muted-foreground">
                    {member.activeChecks} open checks · {member.dueToday} due today ·{" "}
                    {member.overdue} overdue · avg{" "}
                    {member.averageTurnaroundMinutes === null
                      ? "not available"
                      : formatDuration(member.averageTurnaroundMinutes)}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!loading ? (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={members.length}
          onPageChange={setPage}
          label="verifiers"
        />
      ) : null}
    </Section>
  );
}
