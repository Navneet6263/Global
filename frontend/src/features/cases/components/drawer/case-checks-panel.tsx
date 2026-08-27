import { CHECK_STATUS_META, type VerificationCase } from "@/lib/contracts/case";
import { StatusBadge } from "@/components/feedback/status-badge";
import { formatRelativeToNow } from "@/lib/formatting";

export function CaseChecksPanel({ item }: { item: VerificationCase }) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {item.checks.map((check) => {
        const meta = CHECK_STATUS_META[check.status];
        return (
          <li key={check.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">{check.label}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {check.assignee} · updated {formatRelativeToNow(check.updatedAt)}
              </p>
              {check.note ? (
                <p className="mt-1 text-[11px] text-critical-foreground">{check.note}</p>
              ) : null}
            </div>
            <StatusBadge label={meta.label} tone={meta.tone} />
          </li>
        );
      })}
    </ul>
  );
}
