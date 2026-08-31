import type { VerificationCase } from "@/lib/contracts/case";
import { PRIORITY_META, STAGE_META } from "@/lib/contracts/case";
import { StatusBadge } from "@/components/feedback/status-badge";
import { formatDateTime, formatSlaRemaining, initialsOf } from "@/lib/formatting";
import { TONE_DOT } from "@/lib/formatting/tones";
import { cn } from "@/lib/utils";

export function CaseSummaryPanel({ item }: { item: VerificationCase }) {
  const stage = STAGE_META[item.stage];
  const slaTone =
    item.slaState === "overdue"
      ? "critical"
      : item.slaState === "approaching"
        ? "warning"
        : "success";

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
          {initialsOf(item.candidateName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">{item.candidateName}</p>
          <p className="num truncate text-xs text-muted-foreground">
            {item.caseNumber} · {item.clientName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {item.candidateEmail} · {item.candidateMobile}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={stage.label} tone={stage.tone} />
        <StatusBadge
          label={PRIORITY_META[item.priority].label}
          tone={PRIORITY_META[item.priority].tone}
          withDot={false}
        />
        <StatusBadge
          label={
            item.stage === "completed" ? "Delivered" : formatSlaRemaining(item.slaMinutesRemaining)
          }
          tone={item.stage === "completed" ? "success" : slaTone}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Overall progress</span>
          <span className="num font-medium text-foreground">{item.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <span
            className={cn("block h-full rounded-full", TONE_DOT[stage.tone])}
            style={{ width: `${item.progress}%` }}
            aria-hidden
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
        <Detail label="Package" value={item.packageName ?? "Not assigned"} />
        <Detail label="Branch" value={item.branch ?? "Not assigned"} />
        <Detail label="Operations owner" value={item.owner ?? "Not assigned"} />
        <Detail label="Created" value={formatDateTime(item.createdAt)} />
        <Detail label="Last updated" value={formatDateTime(item.updatedAt)} />
        <Detail label="Checks in bundle" value={`${item.checkBundle.length} verification checks`} />
      </dl>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="truncate text-[13px] text-foreground">{value}</dd>
    </div>
  );
}
