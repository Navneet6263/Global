import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, IndianRupee, Plus, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  internalVendorApi,
  vendorWorkApi,
  type VendorExtraCost,
} from "@/lib/backend-api/vendor-checks";
import { formatDateTime } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { rupees } from "./vendor-job-format";

const TONE: Record<VendorExtraCost["status"], string> = {
  PENDING: "bg-amber-50 text-amber-800",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
};
const LABEL: Record<VendorExtraCost["status"], string> = {
  PENDING: "Waiting for RM",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/**
 * Extra cost lines on one vendor check. The vendor adds them (amount + why) while working;
 * the case RM approves or rejects each before approving the result.
 */
export function VendorExtraCosts({
  jobId,
  costs,
  price,
  mode,
}: {
  jobId: string;
  costs: VendorExtraCost[];
  /** The agreed payment, shown above the extras. */
  price: number | null;
  /** "vendor": add/remove while working. "rm": decide pending lines. "view": read only. */
  mode: "vendor" | "rm" | "view";
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["vendor-checks"] }),
      queryClient.invalidateQueries({ queryKey: ["vendor-work"] }),
    ]);
  const act = useMutation({
    mutationFn: async (
      input:
        | { kind: "add" }
        | { kind: "remove"; costId: string }
        | { kind: "decide"; costId: string; decision: "APPROVE" | "REJECT" },
    ): Promise<unknown> => {
      if (input.kind === "add")
        return vendorWorkApi.addCost(jobId, { amount: Number(amount), reason: reason.trim() });
      if (input.kind === "remove") return vendorWorkApi.removeCost(jobId, input.costId);
      return internalVendorApi.decideCost(jobId, input.costId, {
        decision: input.decision,
        note: note.trim() || undefined,
      });
    },
    onSuccess: async (_, input) => {
      toast.success(
        input.kind === "add"
          ? "Extra cost added — the RM decides it with your result"
          : input.kind === "remove"
            ? "Extra cost removed"
            : input.decision === "APPROVE"
              ? "Extra cost approved"
              : "Extra cost rejected",
      );
      setAdding(false);
      setAmount("");
      setReason("");
      setRejecting(null);
      setNote("");
      await refresh();
    },
    onError: (error: Error) => toast.error("Not saved", { description: error.message }),
  });
  const approvedExtra = costs
    .filter((cost) => cost.status === "APPROVED")
    .reduce((sum, cost) => sum + cost.amount, 0);
  if (!costs.length && mode !== "vendor" && price === null) return null;
  const amountOk = Number(amount) >= 1 && Number(amount) <= 100_000;
  return (
    <section
      aria-label="Payment and extra cost"
      className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-[12.5px]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <strong className="flex items-center gap-1.5 text-[13px] text-slate-900">
          <IndianRupee className="size-4 text-slate-500" aria-hidden /> Payment
        </strong>
        <span className="text-slate-600">
          {price !== null ? (
            <>
              Agreed <strong className="text-slate-900">{rupees(price)}</strong>
              {approvedExtra ? (
                <>
                  {" "}
                  + extra <strong className="text-slate-900">{rupees(approvedExtra)}</strong> ={" "}
                  <strong className="text-slate-900">{rupees(price + approvedExtra)}</strong>
                </>
              ) : null}
            </>
          ) : (
            "Agreed with the vendor"
          )}
        </span>
      </header>
      {costs.length ? (
        <ul className="grid gap-1.5">
          {costs.map((cost) => (
            <li
              key={cost.id}
              className="grid gap-1 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0 flex-1">
                  <strong className="text-slate-900">{rupees(cost.amount)}</strong> · {cost.reason}
                  <small className="block text-slate-500">
                    Added by {cost.addedBy} · {formatDateTime(cost.addedAt)}
                    {cost.decidedBy ? ` · ${LABEL[cost.status]} by ${cost.decidedBy}` : ""}
                    {cost.note ? ` · “${cost.note}”` : ""}
                  </small>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
                    TONE[cost.status],
                  )}
                >
                  {LABEL[cost.status]}
                </span>
              </div>
              {cost.status === "PENDING" && mode === "vendor" ? (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={act.isPending}
                    onClick={() => act.mutate({ kind: "remove", costId: cost.id })}
                    aria-label={`Remove extra cost ${rupees(cost.amount)}`}
                  >
                    <Trash2 aria-hidden /> Remove
                  </Button>
                </div>
              ) : null}
              {cost.status === "PENDING" && mode === "rm" ? (
                rejecting === cost.id ? (
                  <div className="grid gap-2">
                    <input
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Why is it rejected?"
                      aria-label="Reason for rejecting the extra cost"
                      className="h-9 rounded-lg border border-slate-200 px-3"
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setRejecting(null)}>
                        Back
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={note.trim().length < 5}
                        loading={act.isPending}
                        onClick={() =>
                          act.mutate({ kind: "decide", costId: cost.id, decision: "REJECT" })
                        }
                      >
                        <XCircle aria-hidden /> Reject cost
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setRejecting(cost.id)}>
                      <XCircle aria-hidden /> Reject
                    </Button>
                    <Button
                      size="sm"
                      loading={act.isPending}
                      onClick={() =>
                        act.mutate({ kind: "decide", costId: cost.id, decision: "APPROVE" })
                      }
                      aria-label={`Approve extra cost ${rupees(cost.amount)}`}
                    >
                      <BadgeCheck aria-hidden /> Approve
                    </Button>
                  </div>
                )
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500">No extra cost.</p>
      )}
      {mode === "vendor" ? (
        adding ? (
          <form
            className="grid gap-2 rounded-lg border border-blue-100 bg-blue-50/40 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (amountOk && reason.trim().length >= 10) act.mutate({ kind: "add" });
            }}
          >
            <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <input
                type="number"
                min={1}
                max={100000}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Amount (₹)"
                aria-label="Extra cost amount"
                className="h-9 rounded-lg border border-slate-200 bg-white px-3"
              />
              <input
                value={reason}
                maxLength={1000}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why was it needed? e.g. travelled 40 km outside the city"
                aria-label="Why the extra cost was needed"
                className="h-9 rounded-lg border border-slate-200 bg-white px-3"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" type="button" onClick={() => setAdding(false)}>
                Back
              </Button>
              <Button
                size="sm"
                type="submit"
                disabled={!amountOk || reason.trim().length < 10}
                loading={act.isPending}
              >
                <Plus aria-hidden /> Add extra cost
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus aria-hidden /> Add extra cost
            </Button>
          </div>
        )
      ) : null}
    </section>
  );
}
