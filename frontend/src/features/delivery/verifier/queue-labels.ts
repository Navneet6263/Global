import type { VerificationTask } from "@/lib/api/tasks";

/** "14 Nov, 5:51 am" in India time, for the queue's due column. */
export const dueLabel = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

/** Where the check's latest L2 insufficiency stands, for an open check. */
export function l2QueueLabel(task: VerificationTask) {
  const latest = task.check.clarifications?.find((item) => item.level === "L2");
  if (!latest || task.status === "COMPLETED") return null;
  if (latest.status === "RESOLVED" && latest.reentryCompletedAt)
    return { label: "All details re-entered by Data Entry", resolved: true };
  const label =
    latest.status === "DATA_ENTRY_PENDING"
      ? "L2: With Data Entry"
      : latest.status === "CANDIDATE_SUBMITTED"
        ? "L2: Awaiting Ops"
        : latest.status === "OPEN"
          ? "L2: Awaiting candidate"
          : null;
  return label ? { label, resolved: false } : null;
}
