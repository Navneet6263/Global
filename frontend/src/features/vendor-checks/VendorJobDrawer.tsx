import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CircleAlert,
  FileText,
  Paperclip,
  Plus,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/features/workflow-ui/CheckInitiation";
import { vendorWorkApi, type Entry, type VendorJobDetail } from "@/lib/backend-api/vendor-checks";
import { formatDateTime } from "@/lib/formatting";
import { STATUS_COPY, fileSize, readable } from "./vendor-job-format";

const WORKING = ["IN_PROGRESS", "RETURNED"];

/** The vendor works one check here: accept, record, attach proof, submit. */
export function VendorJobDrawer({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ["vendor-checks", "job", jobId],
    queryFn: () => vendorWorkApi.detail(jobId!),
    enabled: Boolean(jobId),
  });
  return (
    <Dialog open={Boolean(jobId)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto rounded-2xl">
        {detail.data ? (
          <JobBody key={`${detail.data.id}-${detail.data.version}`} job={detail.data} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Check</DialogTitle>
              <DialogDescription>
                {detail.isError ? detail.error.message : "Loading…"}
              </DialogDescription>
            </DialogHeader>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function JobBody({ job }: { job: VendorJobDetail }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["vendor-checks"] });
  const working = WORKING.includes(job.status);
  const [entries, setEntries] = useState<Entry[]>(job.submission.length ? job.submission : [{}]);
  const [result, setResult] = useState(job.result ?? "");
  const [remarks, setRemarks] = useState(job.remarks ?? "");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [handler, setHandler] = useState(job.handler?.id ?? "");
  const fileInput = useRef<HTMLInputElement>(null);
  const act = useMutation({
    mutationFn: async (kind: "accept" | "decline" | "save" | "submit" | "delegate") => {
      if (kind === "accept") return vendorWorkApi.accept(job.id, job.version);
      if (kind === "decline") return vendorWorkApi.decline(job.id, job.version, reason.trim());
      if (kind === "delegate") return vendorWorkApi.delegate(job.id, job.version, handler || null);
      const saved = await vendorWorkApi.saveDraft(job.id, {
        version: job.version,
        entries,
        result: result || undefined,
        remarks: remarks.trim() || undefined,
      });
      if (kind === "submit") return vendorWorkApi.submit(job.id, saved.version);
      return saved;
    },
    onSuccess: async (_, kind) => {
      toast.success(
        {
          accept: "Check accepted",
          decline: "Check declined",
          save: "Saved",
          submit: "Submitted for review",
          delegate: handler ? "Handed to your team member" : "Back with you",
        }[kind],
      );
      await refresh();
    },
    onError: (error: Error) => toast.error("Not done", { description: error.message }),
  });
  const upload = useMutation({
    mutationFn: (file: File) => vendorWorkApi.uploadEvidence(job.id, file),
    onSuccess: async () => {
      toast.success("Proof attached");
      await refresh();
    },
    onError: (error: Error) => toast.error("Not attached", { description: error.message }),
  });
  const remove = useMutation({
    mutationFn: (fileId: string) => vendorWorkApi.removeEvidence(job.id, fileId),
    onSuccess: refresh,
    onError: (error: Error) => toast.error("Not removed", { description: error.message }),
  });
  const set = (index: number, key: string, value: string) =>
    setEntries((current) =>
      current.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)),
    );
  const missing = entries.some((entry) =>
    job.rhsForm.fields.some((field) => field.required && !entry[field.key]?.trim()),
  );
  const canSubmit =
    !missing &&
    Boolean(result) &&
    remarks.trim().length >= 10 &&
    (result === "UNABLE_TO_VERIFY" || job.evidence.length > 0);
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {readable(job.checkType)} · {job.caseNumber}
          <span className={`rmo-pill ${STATUS_COPY[job.status].tone}`}>
            {STATUS_COPY[job.status].vendor}
          </span>
        </DialogTitle>
        <DialogDescription>
          {job.candidateName} · {job.clientName}
          {job.dueAt ? ` · due ${formatDateTime(job.dueAt)}` : ""} · assigned by {job.assignedBy}
        </DialogDescription>
      </DialogHeader>

      {job.note ? <p className="vjd-note">{job.note}</p> : null}
      {job.status === "RETURNED" && job.reviewNote ? (
        <p className="vjd-alert" role="status">
          <CircleAlert aria-hidden /> Returned: {job.reviewNote}
        </p>
      ) : null}
      {job.overdue ? (
        <p className="vjd-alert" role="status">
          <CalendarClock aria-hidden /> This check is past its due date.
        </p>
      ) : null}

      {job.status === "ASSIGNED" ? (
        <section className="vjd-card">
          <h3>Do you take this check?</h3>
          {declining ? (
            <label className="ops-field">
              <span>Why can't you take it? *</span>
              <textarea
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-label="Decline reason"
              />
            </label>
          ) : null}
          <div className="vjd-actions">
            {declining ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setDeclining(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={reason.trim().length < 10}
                  loading={act.isPending}
                  onClick={() => act.mutate("decline")}
                >
                  Decline check
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setDeclining(true)}>
                  Decline
                </Button>
                <Button size="sm" loading={act.isPending} onClick={() => act.mutate("accept")}>
                  Accept and start
                </Button>
              </>
            )}
          </div>
        </section>
      ) : null}

      {job.canDelegate && (job.status === "ASSIGNED" || working) ? (
        <section className="vjd-card vjd-row">
          <UserRound aria-hidden />
          <label className="ops-field flex-1">
            <span>Who works on it</span>
            <select
              value={handler}
              onChange={(event) => setHandler(event.target.value)}
              aria-label="Team member"
            >
              <option value="">Me (main account)</option>
              {job.team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={handler === (job.handler?.id ?? "")}
            loading={act.isPending}
            onClick={() => act.mutate("delegate")}
          >
            Save
          </Button>
        </section>
      ) : null}

      <div className="vjd-grid">
        <section className="vd-lhs" aria-label="Details to verify">
          <h3>Details to verify</h3>
          {job.lhs.form && job.lhs.entries.length ? (
            job.lhs.entries.map((entry, index) => (
              <dl key={index}>
                {job.lhs
                  .form!.fields.filter((field) => entry[field.key])
                  .map((field) => (
                    <div key={field.key}>
                      <dt>{field.label}</dt>
                      <dd>{entry[field.key]}</dd>
                    </div>
                  ))}
              </dl>
            ))
          ) : (
            <p className="vd-empty">No details were recorded for this check.</p>
          )}
          <h3>Shared documents</h3>
          {job.documents.length ? (
            <ul className="vjd-files">
              {job.documents.map((document) => (
                <li key={document.id}>
                  <FileText aria-hidden />
                  <button
                    type="button"
                    onClick={() =>
                      void vendorWorkApi
                        .openDocument(job.id, document.id)
                        .catch((error: Error) => toast.error(error.message))
                    }
                  >
                    {readable(document.type)} · {document.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="vd-empty">No documents were shared.</p>
          )}
        </section>

        <section className="vd-rhs" aria-label="What you verified">
          <h3 className="vjd-h">What you verified</h3>
          <fieldset disabled={!working || act.isPending} className="grid gap-3">
            {entries.map((entry, index) => (
              <div key={index} className="cki-grid">
                {job.rhsForm.fields.map((field) => (
                  <Field
                    key={field.key}
                    field={field}
                    value={entry[field.key] ?? ""}
                    onChange={(value) => set(index, field.key, value)}
                    label={`Vendor ${index + 1} ${field.label}`}
                  />
                ))}
              </div>
            ))}
            {job.rhsForm.repeatable && entries.length < 10 && working ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="justify-self-start"
                onClick={() => setEntries((current) => [...current, {}])}
              >
                <Plus aria-hidden /> Add entry
              </Button>
            ) : null}
            <div className="se-row">
              <label className="ops-field">
                <span>Result *</span>
                <select
                  value={result}
                  onChange={(event) => setResult(event.target.value)}
                  aria-label="Result"
                >
                  <option value="">Choose…</option>
                  {job.results.map((value) => (
                    <option key={value} value={value}>
                      {readable(value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="ops-field">
              <span>Remarks * (what you did and found)</span>
              <textarea
                rows={3}
                value={remarks}
                maxLength={2000}
                onChange={(event) => setRemarks(event.target.value)}
                aria-label="Remarks"
              />
            </label>
          </fieldset>

          <div className="se-attachments" aria-label="Proof">
            <strong>
              <Paperclip aria-hidden /> Proof <small>({job.evidence.length}/10)</small>
            </strong>
            {job.evidence.map((file) => (
              <div key={file.id} className="se-doc">
                <button
                  type="button"
                  className="rmo-link"
                  onClick={() =>
                    void vendorWorkApi
                      .openEvidence(job.id, file.id)
                      .catch((error: Error) => toast.error(error.message))
                  }
                >
                  {file.name}
                </button>
                <small>{fileSize(file.sizeBytes)}</small>
                {working ? (
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    className="text-red-600"
                    onClick={() => remove.mutate(file.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                ) : null}
              </div>
            ))}
            {working ? (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  className="sr-only"
                  aria-label="Upload proof"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) upload.mutate(file);
                    event.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="justify-self-start"
                  loading={upload.isPending}
                  disabled={job.evidence.length >= 10}
                  onClick={() => fileInput.current?.click()}
                >
                  <Plus aria-hidden /> Add proof (PDF, PNG, JPEG · 5 MB)
                </Button>
              </>
            ) : null}
          </div>
        </section>
      </div>

      {working ? (
        <div className="vd-actions">
          <Button
            variant="outline"
            size="sm"
            loading={act.isPending && act.variables === "save"}
            onClick={() => act.mutate("save")}
          >
            Save draft
          </Button>
          <Button
            size="sm"
            disabled={!canSubmit}
            loading={act.isPending && act.variables === "submit"}
            onClick={() => act.mutate("submit")}
          >
            <Send aria-hidden /> Submit for review
          </Button>
        </div>
      ) : job.status === "SUBMITTED" ? (
        <p className="vjd-note">
          Submitted {formatDateTime(job.submittedAt!)}. Waiting for review.
        </p>
      ) : null}
    </>
  );
}
