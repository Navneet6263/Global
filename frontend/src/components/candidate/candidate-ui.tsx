import { humanize } from "./candidate-utils";

export function CandidateStatus({ value }: { value: string }) {
  const complete = ["COMPLETED", "CLOSED", "ACCEPTED", "AVAILABLE", "RESOLVED"].includes(value);
  const critical = ["REJECTED", "FAILED", "EXPIRED", "CANCELLED"].includes(value);
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${complete ? "bg-success-soft text-success-foreground" : critical ? "bg-critical-soft text-critical-foreground" : "bg-warning-soft text-warning-foreground"}`}
    >
      {humanize(value)}
    </span>
  );
}
