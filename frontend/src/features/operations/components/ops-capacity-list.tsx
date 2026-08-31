"use client";

import type { OpsTeamMember } from "../contracts/operations";
import { Section } from "@/components/layout/section";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { formatDuration } from "@/lib/formatting";
import { cn } from "@/lib/utils";

interface OpsCapacityListProps {
  members: readonly OpsTeamMember[];
  loading?: boolean;
  selectedId?: string | null;
  onSelect?: (memberId: string) => void;
  title?: string;
  description?: string;
}

export function OpsCapacityList({
  members,
  loading,
  selectedId,
  onSelect,
  title = "Verifier workload",
  description = "Live assigned checks and due-date pressure. Pick a verifier for the selected checks.",
}: OpsCapacityListProps) {
  return (
    <Section title={title} description={description} padded={false}>
      {loading ? (
        <div className="p-5">
          <ListSkeleton rows={5} />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {members.map((member) => {
            const selected = selectedId === member.id;
            return (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => onSelect?.(member.id)}
                  disabled={!onSelect}
                  aria-pressed={selected}
                  className={cn(
                    "w-full space-y-2 px-5 py-3 text-left transition-colors",
                    onSelect ? "hover:bg-muted/40" : "cursor-default",
                    selected ? "bg-primary/8 ring-1 ring-primary/25 ring-inset" : "",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-foreground">{member.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {member.role} · {member.branch}
                    </span>
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
    </Section>
  );
}
