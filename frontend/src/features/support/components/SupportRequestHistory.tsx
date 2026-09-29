import { StatusBadge } from "@/components/feedback/status-badge";
import { dateTime } from "@/features/spoc-rm/utils/spoc-format";
import type { MySupportRequest } from "../api/support-contracts";
import { REQUEST_STATUS_META } from "../support-model";

/** The requester's own requests with status and the support team's reply. */
export function SupportRequestHistory({
  requests,
  loading,
  error,
}: {
  requests: readonly MySupportRequest[] | undefined;
  loading?: boolean;
  error?: string | null;
}) {
  if (error) return <p className="text-xs text-critical-foreground">{error}</p>;
  if (loading && !requests) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if (!requests?.length)
    return <p className="text-xs text-muted-foreground">You have not raised any requests yet.</p>;
  return (
    <ul className="space-y-2">
      {requests.map((request) => {
        const status = REQUEST_STATUS_META[request.status];
        return (
          <li key={request.id} className="rounded-2xl border border-border px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{request.subject}</span>
              <StatusBadge label={status.label} tone={status.tone} />
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {request.requestNumber}
              {request.caseNumber ? ` · ${request.caseNumber}` : ""} · {dateTime(request.createdAt)}
            </p>
            {request.reply ? (
              <p className="mt-2 rounded-xl bg-success-soft/60 px-2.5 py-2 whitespace-pre-wrap">
                <span className="font-semibold">Support reply: </span>
                {request.reply}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
