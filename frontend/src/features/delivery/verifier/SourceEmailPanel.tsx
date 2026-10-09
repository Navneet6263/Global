import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleStop, Mail, Paperclip, Repeat, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WorkspaceError, WorkspaceLoading } from "@/features/delivery/WorkspaceStates";
import {
  getSourceEmails,
  sendSourceEmail,
  stopSourceEmail,
  type SourceEmailCompose,
  type SourceEmailItem,
} from "@/lib/backend-api/source-emails";
import { formatDateTime } from "@/lib/formatting";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const size = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
const readable = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());

/**
 * Employer / university email (BGV process): editable to, cc, subject, body and case
 * documents as attachments; automatic follow-ups every 24 hours until the source replies.
 */
export function SourceEmailPanel({ checkId, readOnly }: { checkId: string; readOnly: boolean }) {
  const data = useQuery({
    queryKey: ["checks", checkId, "source-emails"],
    queryFn: () => getSourceEmails(checkId),
  });
  if (data.isPending) return <WorkspaceLoading label="Loading source emails" />;
  if (data.isError)
    return <WorkspaceError message={data.error.message} onRetry={() => void data.refetch()} />;
  return (
    <section className="vd-panel se-panel" aria-label="Source email">
      <header className="vd-head">
        <div>
          <h2>Email the source</h2>
          <p>
            Send the verification request to the employer or university. Edit anything before it
            goes; attach only the documents the source needs.
          </p>
        </div>
        {data.data.followUps ? (
          <span className="vd-chip">
            <Repeat aria-hidden className="mr-1 inline size-3.5" />
            {data.data.followUps} automatic follow-ups
          </span>
        ) : null}
      </header>
      {!readOnly ? <Composer checkId={checkId} data={data.data} /> : null}
      <History checkId={checkId} items={data.data.items} readOnly={readOnly} />
    </section>
  );
}

function Composer({ checkId, data }: { checkId: string; data: SourceEmailCompose }) {
  const queryClient = useQueryClient();
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(data.draft.subject);
  const [body, setBody] = useState(data.draft.body);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [autoFollowUp, setAutoFollowUp] = useState(data.followUps > 0);
  const ccList = cc
    .split(/[,;\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const invalid =
    !EMAIL.test(to.trim()) ||
    ccList.some((value) => !EMAIL.test(value)) ||
    subject.trim().length < 5 ||
    body.trim().length < 20;
  const send = useMutation({
    mutationFn: () =>
      sendSourceEmail(checkId, {
        to: to.trim(),
        cc: ccList,
        subject: subject.trim(),
        body: body.trim(),
        documentIds,
        autoFollowUp,
      }),
    onSuccess: async (result) => {
      toast.success("Email sent to the source", {
        description: result.maxFollowUps
          ? `${result.maxFollowUps} follow-ups will go out every 24 hours until they reply.`
          : "No automatic follow-ups for this email.",
      });
      setTo("");
      setCc("");
      setDocumentIds([]);
      await queryClient.invalidateQueries({ queryKey: ["checks", checkId, "source-emails"] });
    },
    onError: (error: Error) => toast.error("Email not sent", { description: error.message }),
  });
  const toggle = (id: string) =>
    setDocumentIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  return (
    <form
      className="se-form"
      onSubmit={(event) => {
        event.preventDefault();
        send.mutate();
      }}
    >
      <fieldset disabled={send.isPending}>
        <div className="se-row">
          <label className="ops-field">
            <span>To *</span>
            <input
              type="email"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="hr@employer.com"
              aria-label="Source email to"
            />
          </label>
          <label className="ops-field">
            <span>Cc</span>
            <input
              value={cc}
              onChange={(event) => setCc(event.target.value)}
              placeholder="Separate addresses with commas"
              aria-label="Source email cc"
            />
          </label>
        </div>
        <label className="ops-field">
          <span>Subject *</span>
          <input
            value={subject}
            maxLength={300}
            onChange={(event) => setSubject(event.target.value)}
            aria-label="Source email subject"
          />
        </label>
        <label className="ops-field">
          <span>Message *</span>
          <textarea
            rows={9}
            value={body}
            maxLength={8000}
            onChange={(event) => setBody(event.target.value)}
            aria-label="Source email message"
          />
        </label>
        <div className="se-attachments" role="group" aria-label="Attachments">
          <strong>
            <Paperclip aria-hidden /> Attach case documents <small>({documentIds.length}/5)</small>
          </strong>
          {data.documents.length ? (
            data.documents.map((document) => (
              <label key={document.id} className="se-doc">
                <input
                  type="checkbox"
                  checked={documentIds.includes(document.id)}
                  disabled={!documentIds.includes(document.id) && documentIds.length >= 5}
                  onChange={() => toggle(document.id)}
                />
                <span>
                  {readable(document.type)} · {document.name}
                </span>
                <small>{size(document.sizeBytes)}</small>
              </label>
            ))
          ) : (
            <p className="vd-empty">No clean documents on this case yet.</p>
          )}
        </div>
        <div className="vd-actions">
          {data.followUps ? (
            <label className="se-toggle">
              <input
                type="checkbox"
                checked={autoFollowUp}
                onChange={(event) => setAutoFollowUp(event.target.checked)}
              />
              Send {data.followUps} automatic follow-ups (every 24 hours, stop on reply)
            </label>
          ) : (
            <span />
          )}
          <Button type="submit" size="sm" disabled={invalid} loading={send.isPending}>
            <Send aria-hidden /> Send email
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

function History({
  checkId,
  items,
  readOnly,
}: {
  checkId: string;
  items: SourceEmailItem[];
  readOnly: boolean;
}) {
  const queryClient = useQueryClient();
  const stop = useMutation({
    mutationFn: (id: string) => stopSourceEmail(checkId, id, "Response received"),
    onSuccess: async () => {
      toast.success("Follow-ups stopped");
      await queryClient.invalidateQueries({ queryKey: ["checks", checkId, "source-emails"] });
    },
    onError: (error: Error) => toast.error("Not stopped", { description: error.message }),
  });
  if (!items.length) return <p className="se-none">No emails sent for this check yet.</p>;
  return (
    <div className="se-history">
      <h3>Sent emails</h3>
      <ul>
        {items.map((item) => {
          const active = !item.stoppedAt && item.nextFollowUpAt;
          return (
            <li key={item.id}>
              <Mail aria-hidden />
              <div>
                <strong>{item.subject}</strong>
                <small>
                  To {item.to}
                  {item.cc.length ? ` · cc ${item.cc.join(", ")}` : ""} · sent{" "}
                  {formatDateTime(item.createdAt)}
                  {item.attachments.length ? ` · ${item.attachments.length} attached` : ""}
                </small>
                <span className={`se-state ${active ? "is-active" : ""}`}>
                  {item.maxFollowUps
                    ? `Follow-ups ${item.followUpsSent}/${item.maxFollowUps}`
                    : "No follow-ups"}
                  {active && item.nextFollowUpAt
                    ? ` · next ${formatDateTime(item.nextFollowUpAt)}`
                    : ""}
                  {item.stopReason ? ` · stopped: ${item.stopReason}` : ""}
                </span>
              </div>
              {active && !readOnly ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={stop.isPending && stop.variables === item.id}
                  onClick={() => stop.mutate(item.id)}
                >
                  <CircleStop aria-hidden /> Response received
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
