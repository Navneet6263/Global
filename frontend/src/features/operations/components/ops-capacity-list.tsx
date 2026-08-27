"use client";

import type { OpsCapacity, OpsTeamMember } from "../contracts/operations";
import { OPS_CHECK_LABELS } from "../contracts/case";
import { Section } from "@/components/layout/section";
import { StatusBadge } from "@/components/feedback/status-badge";
import { ListSkeleton } from "@/components/feedback/skeletons";
import type { StatusTone } from "@/lib/contracts/common";
import { formatDuration } from "@/lib/formatting";
import { cn } from "@/lib/utils";

const CAPACITY_META: Record<OpsCapacity, { label: string; tone: StatusTone }> = {
  available: { label: "Available", tone: "success" },
  balanced: { label: "Balanced", tone: "info" },
  stretched: { label: "Stretched", tone: "warning" },
  overloaded: { label: "Overloaded", tone: "critical" },
};

const AVAILABILITY_LABEL: Record<OpsTeamMember["availability"], string> = {
  available: "At desk",
  in_field: "In field",
  on_leave: "On leave",
};

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
  title = "Verifier capacity",
  description = "Live load, skills and availability. Pick a verifier to assign the selected checks.",
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
            const meta = CAPACITY_META[member.capacity];
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
                    <StatusBadge label={meta.label} tone={meta.tone} />
                    <span className="text-[11px] text-muted-foreground">
                      {member.role} · {member.branch} · {AVAILABILITY_LABEL[member.availability]}
                    </span>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        member.capacity === "overloaded"
                          ? "bg-critical"
                          : member.capacity === "stretched"
                            ? "bg-warning"
                            : "bg-success",
                      )}
                      style={{ width: `${Math.min(100, member.capacityPercent)}%` }}
                    />
                  </div>

                  <p className="num text-[11px] text-muted-foreground">
                    {member.activeChecks} open checks · {member.dueToday} due today ·{" "}
                    {member.overdue} overdue · avg {formatDuration(member.averageTurnaroundMinutes)}
                  </p>
                  <p className="text-[11px] text-muted-foreground/85">
                    Skills: {member.skills.map((skill) => OPS_CHECK_LABELS[skill]).join(", ")}
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
