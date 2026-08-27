import { PRIORITY_META, STAGE_META, type VerificationCase } from "@/lib/contracts/case";
import { StatusBadge } from "@/components/feedback/status-badge";
import { formatRelativeToNow, formatSlaRemaining, initialsOf } from "@/lib/formatting";
import { TONE_DOT } from "@/lib/formatting/tones";
import { cn } from "@/lib/utils";

export function CandidateCell({ row }: { row: VerificationCase }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
        {initialsOf(row.candidateName)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-foreground">
          {row.candidateName}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">{row.branch}</span>
      </span>
    </div>
  );
}

export function StageCell({ row }: { row: VerificationCase }) {
  const meta = STAGE_META[row.stage];
  return <StatusBadge label={meta.label} tone={meta.tone} />;
}

export function ProgressCell({ row }: { row: VerificationCase }) {
  return (
    <div className="flex min-w-24 items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", TONE_DOT[STAGE_META[row.stage].tone])}
          style={{ width: `${row.progress}%` }}
          aria-hidden
        />
      </span>
      <span className="num text-xs text-muted-foreground">{row.progress}%</span>
    </div>
  );
}

export function PriorityCell({ row }: { row: VerificationCase }) {
  const meta = PRIORITY_META[row.priority];
  return <StatusBadge label={meta.label} tone={meta.tone} withDot={false} />;
}

export function SlaCell({ row }: { row: VerificationCase }) {
  if (row.stage === "completed") {
    return <span className="text-xs text-muted-foreground">Delivered</span>;
  }
  const tone =
    row.slaState === "overdue"
      ? "critical"
      : row.slaState === "approaching"
        ? "warning"
        : "success";
  return (
    <span className="space-y-0.5">
      <StatusBadge label={formatSlaRemaining(row.slaMinutesRemaining)} tone={tone} />
    </span>
  );
}

export function OwnerCell({ row }: { row: VerificationCase }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate text-[13px] text-foreground">{row.owner}</span>
      <span className="block truncate text-[11px] text-muted-foreground">{row.ownerRole}</span>
    </span>
  );
}

export function UpdatedCell({ row }: { row: VerificationCase }) {
  return (
    <span className="text-xs text-muted-foreground">{formatRelativeToNow(row.updatedAt)}</span>
  );
}
