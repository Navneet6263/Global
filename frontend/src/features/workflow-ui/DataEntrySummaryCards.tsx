import { ClipboardCheck, Inbox, MessageSquareWarning, TriangleAlert } from "lucide-react";
import { StatCard as Stat } from "@/components/workspace/kit";

export function DataEntrySummaryCards({
  counts,
  overdueKpi,
  readyTodayKpi,
}: {
  counts: Record<string, number>;
  overdueKpi?: number;
  readyTodayKpi?: number;
}) {
  const mineL2 = counts["mineL2"] ?? 0;
  const toReviewHint =
    mineL2 > 0 ? `Assigned to you (incl. ${mineL2} L2 re-entry)` : "Assigned to you";
  const overdueValue = counts["overdue"] ?? overdueKpi;

  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Intake summary">
      <Stat
        icon={Inbox}
        tone="info"
        label="To review"
        value={counts["mine"] ?? "—"}
        hint={toReviewHint}
      />
      <Stat
        icon={MessageSquareWarning}
        tone="action"
        label="Waiting on correction"
        value={counts["correction"] ?? "—"}
        hint="Candidate or client to reply"
      />
      <Stat
        icon={TriangleAlert}
        tone={overdueValue ? "bad" : "neutral"}
        label="Past due"
        value={overdueValue ?? "—"}
        hint="Over the due date"
      />
      <Stat
        icon={ClipboardCheck}
        tone="good"
        label="Marked Ready today"
        value={readyTodayKpi ?? "—"}
        hint="Sent to the verification teams"
      />
    </section>
  );
}
