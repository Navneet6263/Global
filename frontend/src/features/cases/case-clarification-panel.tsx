import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Empty, Panel, Status } from "@/features/cases/case-detail-ui";
import { humanize } from "@/features/cases/case-detail-formatting";
import { getSession } from "@/lib/api/auth";
import type { CaseDetail } from "@/lib/api/cases";
import {
  createClarification,
  listClarifications,
  resolveClarification,
} from "@/lib/api/clarifications";

export function ClarificationPanel({ item }: { item: CaseDetail }) {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [checkId, setCheckId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const canRead =
    session.data?.permissions.includes("*") ||
    session.data?.permissions.includes("clarification:read");
  const canWrite =
    session.data?.permissions.includes("*") ||
    session.data?.permissions.includes("clarification:write");
  const clarifications = useQuery({
    queryKey: ["clarifications", item.id],
    queryFn: () => listClarifications(item.id),
    enabled: Boolean(canRead),
  });
  const create = useMutation({
    mutationFn: () =>
      createClarification(item.id, {
        subject: subject.trim(),
        message: message.trim(),
        ...(checkId ? { checkId } : {}),
      }),
    onSuccess: (result) => {
      const url = `${window.location.origin}/clarification/${result.id}#token=${encodeURIComponent(result.portalToken)}`;
      setShareUrl(url);
      setSubject("");
      setMessage("");
      setCheckId("");
      toast.success("Clarification raised", {
        description: "Secure candidate response link is ready to share.",
      });
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["case", item.id] }),
        queryClient.invalidateQueries({ queryKey: ["clarifications", item.id] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const resolve = useMutation({
    mutationFn: (clarificationId: string) => resolveClarification(item.id, clarificationId),
    onSuccess: (result) => {
      toast.success("Clarification resolved", {
        description:
          result.caseStatus === "IN_PROGRESS"
            ? "All responses are reviewed; verification has resumed."
            : "The reviewed response has been closed.",
      });
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["case", item.id] }),
        queryClient.invalidateQueries({ queryKey: ["clarifications", item.id] }),
        queryClient.invalidateQueries({ queryKey: ["cases"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const rows = clarifications.data?.items ?? [];

  return (
    <Panel title="Clarifications" subtitle="Secure questions and candidate responses">
      {canWrite && ["IN_PROGRESS", "CLARIFICATION_PENDING"].includes(item.status) ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (subject.trim().length >= 3 && message.trim().length >= 3) create.mutate();
          }}
          className="mb-4 grid gap-2 rounded-2xl bg-secondary/30 p-3"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={180}
              placeholder="Clarification subject"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
            <select
              value={checkId}
              onChange={(event) => setCheckId(event.target.value)}
              aria-label="Related verification check"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="">General case clarification</option>
              {item.checks.map((check) => (
                <option key={check.publicId} value={check.publicId}>
                  {humanize(check.type)}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={5000}
            rows={3}
            placeholder="Explain exactly what information or evidence is required"
            className="resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          />
          <div className="flex justify-end">
            <button
              disabled={subject.trim().length < 3 || message.trim().length < 3 || create.isPending}
              aria-busy={create.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <MessageSquareText className="h-3.5 w-3.5" />
              {create.isPending ? "Creating…" : "Raise clarification"}
            </button>
          </div>
        </form>
      ) : null}

      {shareUrl ? (
        <div className="mb-4 rounded-2xl border border-accent/30 bg-accent/10 p-3">
          <p className="text-xs font-semibold">Secure response link</p>
          <div className="mt-2 flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-xs"
            />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(shareUrl)
                  .then(() => toast.success("Secure link copied"))
                  .catch(() => toast.error("Copy failed; select the link manually"));
              }}
              className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"
              aria-label="Copy secure response link"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {clarifications.isLoading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-secondary" />
      ) : rows.length ? (
        <div className="divide-y divide-[var(--hairline)]">
          {rows.map((clarification) => (
            <div key={clarification.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{clarification.subject}</p>
                <Status status={clarification.status} />
              </div>
              {clarification.messages.at(-1) ? (
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {clarification.messages.at(-1)?.body}
                </p>
              ) : null}
              {canWrite && clarification.status === "RESPONDED" ? (
                <button
                  type="button"
                  onClick={() => resolve.mutate(clarification.id)}
                  disabled={resolve.isPending}
                  aria-busy={resolve.isPending && resolve.variables === clarification.id}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-foreground disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {resolve.isPending ? "Resolving…" : "Mark reviewed & resolve"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <Empty text="No clarifications raised" />
      )}
    </Panel>
  );
}
