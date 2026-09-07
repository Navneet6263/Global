import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  MessageSquarePlus,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { formatBytes, formatDateTime, humanize } from "@/features/cases/case-detail-formatting";
import { createClarification, listClarifications } from "@/lib/api/clarifications";
import { downloadDocument } from "@/lib/api/documents";
import type { VerifierTaskContext } from "@/lib/api/tasks";

type Context = VerifierTaskContext;

export function CaseContextView({ context }: { context: Context }) {
  const item = context.check.case;
  const consent = item.consents[0];
  const rows = [
    ["Candidate", item.subject.fullName],
    ["Email", item.subject.email ?? "Not provided"],
    ["Mobile", item.subject.phone ?? "Not provided"],
    ["Employee reference", item.subject.employeeCode ?? "Not provided"],
    ["Requesting client", item.client.displayName],
    ["Service package", item.servicePackage?.name ?? "Custom checks"],
    [
      "Branch",
      item.branch
        ? `${item.branch.name}${item.branch.city ? ` · ${item.branch.city}` : ""}`
        : "Tenant-wide",
    ],
    ["Consent", consent ? humanize(consent.status) : "Not recorded"],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="rounded-[1.05rem] border border-white/80 bg-background/60 p-3.5 shadow-[var(--shadow-card)]"
        >
          <p className="text-[8.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 break-words text-[11.5px] font-medium">{value}</p>
        </div>
      ))}
    </div>
  );
}

export function DocumentsView({ context }: { context: Context }) {
  const download = useMutation({
    mutationFn: (document: Context["check"]["case"]["documents"][number]) =>
      downloadDocument(
        document.publicId,
        document.versions[0]?.originalName ?? `${humanize(document.type)}.pdf`,
      ),
    onError: (error: Error) => toast.error(error.message),
  });
  const documents = context.check.case.documents;
  return (
    <div className="space-y-2.5">
      {documents.map((document) => {
        const version = document.versions[0];
        return (
          <article
            key={document.publicId}
            className="flex flex-wrap items-center gap-3 rounded-[1.15rem] border border-border/70 bg-background/60 p-3.5"
          >
            <span className="grid size-10 place-items-center rounded-full bg-info-soft text-info-foreground">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold">{humanize(document.type)}</p>
              <p className="mt-0.5 truncate text-[9.5px] text-muted-foreground">
                {version
                  ? `v${version.version} · ${formatBytes(version.sizeBytes)} · ${humanize(version.malwareState)}`
                  : "Awaiting document"}
              </p>
              {version ? (
                <p className="mt-1 truncate font-mono text-[8px] text-muted-foreground">
                  SHA-256 {version.sha256}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={!version || download.isPending}
              onClick={() => download.mutate(document)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white/85 px-3 py-2 text-[10px] font-semibold transition hover:bg-info-soft disabled:opacity-40"
            >
              {download.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}{" "}
              Open securely
            </button>
          </article>
        );
      })}
      {!documents.length ? (
        <EmptyContext
          icon={FileText}
          title="No documents available"
          detail="The candidate or client has not uploaded supporting evidence yet."
        />
      ) : null}
    </div>
  );
}

export function ClarificationsView({ context }: { context: Context }) {
  const caseId = context.check.case.publicId;
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const clarifications = useQuery({
    queryKey: ["clarifications", caseId],
    queryFn: () => listClarifications(caseId),
  });
  const create = useMutation({
    mutationFn: () =>
      createClarification(caseId, {
        checkId: context.check.publicId,
        subject: subject.trim(),
        message: message.trim(),
      }),
    onSuccess: () => {
      toast.success("Clarification raised and delivery queued");
      setSubject("");
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["clarifications", caseId] });
      void queryClient.invalidateQueries({ queryKey: ["tasks", context.publicId, "context"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (subject.trim().length >= 3 && message.trim().length >= 3) create.mutate();
        }}
        className="rounded-[1.2rem] border border-warning/20 bg-warning-soft/45 p-4"
      >
        <div className="flex items-center gap-2 text-[12px] font-semibold">
          <MessageSquarePlus className="size-4 text-warning-foreground" /> Raise a precise
          clarification
        </div>
        <div className="mt-3 grid gap-2">
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={180}
            placeholder="What information is missing?"
            className="h-10 rounded-xl border border-border bg-white/85 px-3 text-[11px] outline-none focus:border-warning/50"
          />
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            maxLength={1200}
            placeholder="State exactly what must be corrected or supplied"
            className="rounded-xl border border-border bg-white/85 px-3 py-2.5 text-[11px] outline-none focus:border-warning/50"
          />
          <button
            disabled={create.isPending || subject.trim().length < 3 || message.trim().length < 3}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-warning px-4 py-2 text-[10.5px] font-semibold text-warning-foreground disabled:opacity-45"
          >
            {create.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <MessageSquarePlus className="size-3.5" />
            )}{" "}
            Raise clarification
          </button>
        </div>
      </form>
      {clarifications.data?.items.map((item) => (
        <article
          key={item.id}
          className="rounded-[1.1rem] border border-border/70 bg-background/55 p-3.5"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11.5px] font-semibold">{item.subject}</p>
            <span className="rounded-full bg-mint-soft px-2 py-1 text-[8.5px] font-semibold text-mint-deep">
              {humanize(item.status)}
            </span>
          </div>
          <p className="mt-1 text-[9px] text-muted-foreground">
            Raised {formatDateTime(item.createdAt)} · {item.messages.length} messages
          </p>
          {item.messages.at(-1) ? (
            <p className="mt-2 rounded-xl bg-white/75 p-3 text-[10.5px] leading-relaxed text-muted-foreground">
              {item.messages.at(-1)!.body}
            </p>
          ) : null}
        </article>
      ))}
      {!clarifications.isLoading && !clarifications.data?.items.length ? (
        <EmptyContext
          icon={CheckCircle2}
          title="No open clarification history"
          detail="Source questions and candidate responses will remain attached to this case."
        />
      ) : null}
    </div>
  );
}

export function ActivityView({ context }: { context: Context }) {
  const taskEvents = [
    { label: "Assignment created", at: context.createdAt },
    ...(context.startedAt ? [{ label: "Verification started", at: context.startedAt }] : []),
    ...(context.blockedAt ? [{ label: "Blocker recorded", at: context.blockedAt }] : []),
    ...(context.completedAt ? [{ label: "Check completed", at: context.completedAt }] : []),
  ];
  return (
    <div className="space-y-2">
      {[...taskEvents].reverse().map((event) => (
        <TimelineRow
          key={`${event.label}-${event.at}`}
          label={event.label}
          detail="Verifier task event"
          at={event.at}
        />
      ))}
      {context.check.case.statusHistory.map((event) => (
        <TimelineRow
          key={`${event.toStatus}-${event.createdAt}`}
          label={`Case moved to ${humanize(event.toStatus)}`}
          detail={event.reason ?? "Controlled workflow transition"}
          at={event.createdAt}
        />
      ))}
    </div>
  );
}

function TimelineRow({ label, detail, at }: { label: string; detail: string; at: string }) {
  return (
    <div className="relative ml-2 border-l border-mint/25 py-2 pl-5 before:absolute before:-left-1 before:top-4 before:size-2 before:rounded-full before:bg-mint-deep">
      <p className="text-[11px] font-semibold">{label}</p>
      <p className="mt-0.5 text-[9.5px] text-muted-foreground">
        {detail} · {formatDateTime(at)}
      </p>
    </div>
  );
}

function EmptyContext({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof ShieldCheck;
  title: string;
  detail: string;
}) {
  return (
    <div className="grid min-h-40 place-items-center rounded-[1.2rem] border border-dashed border-border bg-background/35 p-6 text-center">
      <div>
        <Icon className="mx-auto size-5 text-muted-foreground" />
        <p className="mt-2 text-[11.5px] font-semibold">{title}</p>
        <p className="mt-1 max-w-sm text-[9.5px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
