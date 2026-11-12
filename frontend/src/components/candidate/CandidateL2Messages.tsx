import { AlertTriangle } from "lucide-react";
import { humanize } from "./candidate-utils";

export function CandidateL2Messages({
  messages,
  rejectionCount,
  lastRejectedReason,
  status,
}: {
  messages: Array<{ sender: string; body: string; createdAt: string }>;
  rejectionCount?: number;
  lastRejectedReason?: string | null;
  status: string;
}) {
  const needsReupload = (rejectionCount ?? 0) > 0 && status === "OPEN";
  return (
    <>
      {needsReupload && lastRejectedReason ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-950"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
          <div>
            <p className="font-semibold">
              Previous upload rejected (attempt #{(rejectionCount ?? 0) + 1})
            </p>
            <p className="mt-0.5">{lastRejectedReason}</p>
          </div>
        </div>
      ) : null}
      <div className="mt-3 space-y-2">
        {messages.map((entry, index) => (
          <div
            key={`${entry.createdAt}-${index}`}
            className={`max-w-[94%] rounded-[0.9rem] px-3 py-2.5 ${
              entry.sender === "CANDIDATE" ? "ml-auto bg-mint-deep text-white" : "bg-white/95"
            }`}
          >
            <p
              className={`text-[9px] font-semibold uppercase tracking-wide ${
                entry.sender === "CANDIDATE" ? "text-white/70" : "text-muted-foreground"
              }`}
            >
              {entry.sender === "CANDIDATE"
                ? "Your response"
                : entry.sender === "VERIFIER" || entry.sender === "OPS_MANAGER"
                  ? "Verification team"
                  : humanize(entry.sender)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[11.5px] leading-4">{entry.body}</p>
          </div>
        ))}
      </div>
    </>
  );
}
