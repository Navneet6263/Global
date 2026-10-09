import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CircleAlert,
  Eye,
  Hourglass,
  Paperclip,
  Send,
  ShieldCheck,
  Truck,
  Undo2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/workspace/kit";
import type { Tone } from "@/components/workspace/tones";
import { WorkspaceError, WorkspaceLoading } from "@/features/delivery/WorkspaceStates";
import {
  internalVendorApi,
  type CheckVendorState,
  type VendorAssignedAs,
  type VendorJobStatus,
} from "@/lib/backend-api/vendor-checks";
import { formatDateTime } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { STATUS_COPY, fileSize, readable } from "./vendor-job-format";

const TONE: Record<VendorJobStatus, Tone> = {
  PENDING_APPROVAL: "warn",
  REJECTED: "neutral",
  ASSIGNED: "info",
  IN_PROGRESS: "info",
  SUBMITTED: "action",
  RETURNED: "bad",
  APPROVED: "good",
  DECLINED: "bad",
  CANCELLED: "neutral",
};

const SENT_AS: Record<VendorAssignedAs, string> = {
  RM: "RM",
  TEAM_LEADER: "Team Leader",
  OPERATIONS: "Operations",
};

const field =
  "grid gap-1.5 text-[13px] [&_input]:h-10 [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-200 [&_input]:px-3 [&_select]:h-10 [&_select]:rounded-xl [&_select]:border [&_select]:border-slate-200 [&_select]:bg-white [&_select]:px-3 [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-slate-200 [&_textarea]:px-3 [&_textarea]:py-2";

/**
 * A check's vendor work. The case RM or the Team Leader sends it (a Team Leader's request
 * waits for the RM's approval, with its reason); whoever sent it reviews the result.
 * The verifier of the check only sees the progress.
 */
export function CheckVendorPanel({ checkId }: { checkId: string }) {
  const state = useQuery({
    queryKey: ["vendor-checks", "check", checkId],
    queryFn: () => internalVendorApi.forCheck(checkId),
  });
  if (state.isPending) return <WorkspaceLoading label="Loading vendor work" />;
  if (state.isError)
    return <WorkspaceError message={state.error.message} onRetry={() => void state.refetch()} />;
  const data = state.data;
  return (
    <section
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-label="Vendor work"
    >
      <header className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <Truck className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-[16px] font-bold text-slate-900">
            Vendor / field · {readable(data.checkType)}
          </h2>
          <p className="text-[12.5px] text-slate-500">
            {data.needsApproval
              ? "As Team Leader you can request a vendor; the case RM approves it before the vendor sees it."
              : data.canManage
                ? "Send this check to a vendor with only the documents it needs. Its result comes back here for review."
                : "Vendor work on this check is managed by the case RM or the Team Leader. You can follow it here."}
          </p>
        </div>
      </header>
      {data.canAssign ? <AssignForm data={data} /> : null}
      {!data.canManage && !data.attempts.length ? (
        <p className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-[12.5px] text-slate-500">
          <Eye className="size-4" aria-hidden /> Not sent to a vendor.
        </p>
      ) : null}
      {data.attempts.length ? (
        <div className="grid gap-3">
          {data.attempts.map((attempt) => (
            <Attempt key={attempt.id} attempt={attempt} data={data} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function AssignForm({ data }: { data: CheckVendorState }) {
  const queryClient = useQueryClient();
  const [vendorId, setVendorId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [documentIds, setDocumentIds] = useState(
    data.documents.filter((document) => document.suggested).map((document) => document.id),
  );
  const assign = useMutation({
    mutationFn: () =>
      internalVendorApi.assign(data.checkId, {
        vendorId,
        dueAt: dueAt ? new Date(`${dueAt}T18:00:00+05:30`).toISOString() : undefined,
        note: note.trim() || undefined,
        ...(data.needsApproval ? { reason: reason.trim() } : {}),
        documentIds,
      }),
    onSuccess: async () => {
      toast.success(data.needsApproval ? "Sent to the RM for approval" : "Sent to the vendor", {
        description: data.needsApproval
          ? "The vendor gets it once the case RM approves."
          : "They are notified in their portal.",
      });
      await queryClient.invalidateQueries({ queryKey: ["vendor-checks"] });
    },
    onError: (error: Error) => toast.error("Not sent", { description: error.message }),
  });
  const toggle = (id: string) =>
    setDocumentIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  const reasonOk = !data.needsApproval || reason.trim().length >= 10;
  return (
    <form
      className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (vendorId && reasonOk) assign.mutate();
      }}
    >
      <fieldset disabled={assign.isPending} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={field}>
            <span className="font-medium text-slate-700">Vendor *</span>
            <select
              value={vendorId}
              onChange={(event) => setVendorId(event.target.value)}
              aria-label="Vendor"
            >
              <option value="">Choose a vendor…</option>
              {data.vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            <span className="font-medium text-slate-700">Due by</span>
            <input
              type="date"
              value={dueAt}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setDueAt(event.target.value)}
              aria-label="Vendor due date"
            />
          </label>
        </div>
        {data.needsApproval ? (
          <label className={field}>
            <span className="font-medium text-slate-700">
              Why does this check need a vendor? *{" "}
              <small className="font-normal text-slate-500">(for the RM)</small>
            </span>
            <textarea
              rows={2}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Remote address; a field visit is needed and the source has not replied"
              aria-label="Reason for the RM"
            />
            {reason && !reasonOk ? (
              <small className="text-red-600">Write at least 10 characters.</small>
            ) : null}
          </label>
        ) : null}
        <label className={field}>
          <span className="font-medium text-slate-700">Instructions for the vendor</span>
          <input
            value={note}
            maxLength={1000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Visit between 10 am and 6 pm; take a photo of the house number"
            aria-label="Vendor instructions"
          />
        </label>
        <div role="group" aria-label="Documents to share" className="grid gap-1.5">
          <strong className="flex items-center gap-1.5 text-[13px] text-slate-800">
            <Paperclip className="size-4" aria-hidden /> Share documents
            <small className="font-normal text-slate-500">(only what this check needs)</small>
          </strong>
          {data.documents.length ? (
            data.documents.map((document) => (
              <label
                key={document.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12.5px]"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-blue-600"
                  checked={documentIds.includes(document.id)}
                  onChange={() => toggle(document.id)}
                />
                <span className="min-w-0 flex-1 truncate">
                  {readable(document.type)} · {document.name}
                </span>
                {document.suggested ? (
                  <Pill tone="info" dot={false}>
                    Suggested
                  </Pill>
                ) : null}
              </label>
            ))
          ) : (
            <p className="text-[12.5px] text-slate-500">This case has no clean documents yet.</p>
          )}
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={!vendorId || !reasonOk} loading={assign.isPending}>
            {data.needsApproval ? (
              <>
                <Send aria-hidden /> Send to RM for approval
              </>
            ) : (
              <>
                <Truck aria-hidden /> Send to vendor
              </>
            )}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

type Mode = "return" | "cancel" | "reject" | null;

function Attempt({
  attempt,
  data,
}: {
  attempt: CheckVendorState["attempts"][number];
  data: CheckVendorState;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState("");
  const act = useMutation({
    mutationFn: async (kind: "approve" | "return" | "cancel" | "allow" | "reject") => {
      if (kind === "cancel") return internalVendorApi.cancel(attempt.id, note.trim());
      if (kind === "allow" || kind === "reject")
        return internalVendorApi.decide(attempt.id, {
          decision: kind === "allow" ? "APPROVE" : "REJECT",
          note: note.trim() || undefined,
          version: attempt.version,
        });
      return internalVendorApi.review(attempt.id, {
        decision: kind === "approve" ? "APPROVE" : "RETURN",
        note: note.trim() || undefined,
        version: attempt.version,
      });
    },
    onSuccess: async (_, kind) => {
      toast.success(
        {
          approve: "Result accepted — copied into Verified details",
          return: "Returned to the vendor",
          cancel: "Vendor job cancelled",
          allow: "Approved — sent to the vendor",
          reject: "Request turned down",
        }[kind],
      );
      setMode(null);
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["vendor-checks"] });
      await queryClient.invalidateQueries({ queryKey: ["checks", data.checkId] });
    },
    onError: (error: Error) => toast.error("Not done", { description: error.message }),
  });
  const labels = new Map(data.rhsForm.fields.map((field) => [field.key, field.label]));
  const pending = attempt.status === "PENDING_APPROVAL";
  const reviewer =
    attempt.assignedAs === "TEAM_LEADER" ? "the Team Leader" : attempt.assignedAs ? "the RM" : "";
  return (
    <article
      className={cn(
        "grid gap-3 rounded-xl border p-4",
        pending ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-white",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[13.5px] text-slate-900">
            Attempt {attempt.attempt} · {attempt.vendor.name}
            {attempt.handler ? ` (${attempt.handler.name})` : ""}
          </strong>
          <small className="text-[12px] text-slate-500">
            {pending ? "Requested" : "Sent"} {formatDateTime(attempt.assignedAt)} by{" "}
            {attempt.assignedBy}
            {attempt.assignedAs ? ` (${SENT_AS[attempt.assignedAs]})` : ""}
            {attempt.dueAt ? ` · due ${formatDateTime(attempt.dueAt)}` : ""}
          </small>
        </div>
        <Pill tone={TONE[attempt.status]}>{STATUS_COPY[attempt.status].internal}</Pill>
      </header>
      {attempt.requestReason ? (
        <p className="rounded-lg border-l-4 border-amber-300 bg-white px-3 py-2 text-[12.5px] text-slate-700">
          <strong className="block text-[11.5px] uppercase tracking-wide text-amber-700">
            Team Leader&apos;s reason
          </strong>
          {attempt.requestReason}
        </p>
      ) : null}
      {attempt.approval ? (
        <p className="flex items-start gap-2 text-[12.5px] text-slate-600">
          <ShieldCheck className="mt-0.5 size-4 text-emerald-600" aria-hidden />
          <span>
            {attempt.status === "REJECTED" ? "Turned down" : "Approved"} by{" "}
            {attempt.approval.by ?? "the RM"} on {formatDateTime(attempt.approval.at)}
            {attempt.approval.note ? ` · “${attempt.approval.note}”` : ""}
          </span>
        </p>
      ) : null}
      {attempt.overdue ? (
        <p className="flex items-center gap-2 text-[12.5px] font-medium text-red-600">
          <CircleAlert className="size-4" aria-hidden /> Overdue — the vendor is reminded daily.
        </p>
      ) : null}
      {attempt.declineReason ? (
        <p className="text-[12.5px] text-slate-600">Declined: {attempt.declineReason}</p>
      ) : null}
      {attempt.reviewNote ? (
        <p className="text-[12.5px] text-slate-600">Note: {attempt.reviewNote}</p>
      ) : null}
      {attempt.submission.length && !["ASSIGNED", "PENDING_APPROVAL"].includes(attempt.status) ? (
        <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-[12.5px]">
          <p>
            <strong>Result:</strong> {attempt.result ? readable(attempt.result) : "—"}
            {attempt.remarks ? ` · ${attempt.remarks}` : ""}
          </p>
          {attempt.submission.map((entry, index) => (
            <dl key={index} className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {Object.entries(entry)
                .filter(([, value]) => value)
                .map(([key, value]) => (
                  <div key={key} className="min-w-0">
                    <dt className="text-[11.5px] text-slate-500">{labels.get(key) ?? key}</dt>
                    <dd className="truncate font-medium text-slate-800">{value}</dd>
                  </div>
                ))}
            </dl>
          ))}
          {attempt.evidence.length ? (
            <div className="flex flex-wrap gap-2">
              {attempt.evidence.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-blue-700 hover:underline"
                  onClick={() =>
                    void internalVendorApi
                      .openEvidence(attempt.id, file.id)
                      .catch((error: Error) => toast.error(error.message))
                  }
                >
                  <Paperclip className="size-3.5" aria-hidden /> {file.name} ·{" "}
                  {fileSize(file.sizeBytes)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {mode ? (
        <label className={field}>
          <span className="font-medium text-slate-700">
            {mode === "return"
              ? "What should the vendor fix? *"
              : mode === "reject"
                ? "Why turn this request down? *"
                : "Why cancel? *"}
          </span>
          <textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            aria-label={
              mode === "return"
                ? "Return reason"
                : mode === "reject"
                  ? "Turn-down reason"
                  : "Cancel reason"
            }
          />
        </label>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {mode ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setMode(null)}>
              Back
            </Button>
            <Button
              size="sm"
              variant={mode === "return" ? "default" : "destructive"}
              disabled={note.trim().length < 10}
              loading={act.isPending}
              onClick={() => act.mutate(mode)}
            >
              {mode === "return" ? (
                <>
                  <Undo2 aria-hidden /> Return to vendor
                </>
              ) : mode === "reject" ? (
                <>
                  <XCircle aria-hidden /> Turn down
                </>
              ) : (
                <>
                  <XCircle aria-hidden /> Cancel job
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            {attempt.canCancel ? (
              <Button size="sm" variant="ghost" onClick={() => setMode("cancel")}>
                {pending ? "Withdraw request" : "Cancel job"}
              </Button>
            ) : null}
            {attempt.canApprove ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setMode("reject")}>
                  <XCircle aria-hidden /> Turn down
                </Button>
                <Button size="sm" loading={act.isPending} onClick={() => act.mutate("allow")}>
                  <BadgeCheck aria-hidden /> Approve &amp; send to vendor
                </Button>
              </>
            ) : pending ? (
              <span className="flex items-center gap-1.5 text-[12.5px] text-amber-700">
                <Hourglass className="size-3.5" aria-hidden /> Waiting for the case RM to approve
              </span>
            ) : null}
            {attempt.canReview ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setMode("return")}>
                  <Undo2 aria-hidden /> Return
                </Button>
                <Button size="sm" loading={act.isPending} onClick={() => act.mutate("approve")}>
                  <BadgeCheck aria-hidden /> Accept result
                </Button>
              </>
            ) : attempt.status === "SUBMITTED" ? (
              <span className="text-[12.5px] text-slate-500">
                Result is reviewed by {reviewer || "whoever sent it"}
              </span>
            ) : ["ASSIGNED", "IN_PROGRESS", "RETURNED"].includes(attempt.status) ? (
              <span className="flex items-center gap-1.5 text-[12.5px] text-slate-500">
                <Send className="size-3.5" aria-hidden /> With the vendor
              </span>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}
