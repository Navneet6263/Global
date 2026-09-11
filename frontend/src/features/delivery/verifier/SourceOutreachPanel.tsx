import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, History, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, humanize } from "@/features/cases/case-detail-formatting";
import { listSourceContacts, recordSourceContact } from "@/lib/backend-api/source-outreach";
import type { MethodRun } from "@/lib/backend-api/verification-methods";

export function SourceOutreachPanel({
  checkId,
  run,
  locked,
  onSaved,
}: {
  checkId: string;
  run: MethodRun;
  locked: boolean;
  onSaved: () => void;
}) {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState("EMAIL");
  const [outcome, setOutcome] = useState("NO_RESPONSE");
  const [notes, setNotes] = useState("");
  const [next, setNext] = useState("");
  const query = useQuery({
    queryKey: ["source-outreach", checkId, run.id, page],
    queryFn: () => listSourceContacts(checkId, run.id, page),
  });
  const save = useMutation({
    mutationFn: () =>
      recordSourceContact(checkId, run.id, {
        version: run.version,
        channel,
        outcome,
        notes: notes.trim(),
        occurredAt: new Date().toISOString(),
        ...(next ? { nextFollowUpAt: new Date(next).toISOString() } : {}),
      }),
    onSuccess: () => {
      setNotes("");
      setNext("");
      setPage(1);
      void client.invalidateQueries({ queryKey: ["source-outreach", checkId, run.id] });
      onSaved();
      toast.success("Contact recorded in source history");
    },
    onError: (error) => {
      toast.error(error.message);
      onSaved();
    },
  });
  const copyTemplate = async () => {
    if (!query.data) return;
    try {
      await navigator.clipboard.writeText(
        `${query.data.template.subject}\n\n${query.data.template.body}`,
      );
      toast.success("Request template copied — nothing has been sent");
    } catch {
      toast.error("Clipboard is unavailable. Select and copy the request text below.");
    }
  };
  return (
    <section
      className="mt-4 space-y-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4"
      aria-label="Source outreach history"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="flex items-center gap-2 text-sm font-semibold">
          <History className="size-4 text-blue-600" /> Contact tracker
        </h5>
        <span className="text-xs text-muted-foreground">
          {query.data?.total ?? 0} recorded attempts
        </span>
      </div>
      {query.isPending && (
        <p className="text-xs" role="status">
          Loading contact history…
        </p>
      )}
      {query.isError && (
        <div role="alert" className="text-xs text-destructive">
          {query.error.message}
          <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {query.data && (
        <details className="rounded-xl bg-white/70 p-3 text-xs">
          <summary className="cursor-pointer font-medium">
            Request wording · {humanize(run.method)}
          </summary>
          <p className="mt-2 whitespace-pre-wrap">
            {query.data.template.subject}
            {"\n\n"}
            {query.data.template.body}
          </p>
          <Button className="mt-2" size="sm" variant="outline" onClick={() => void copyTemplate()}>
            <Copy className="size-3.5" /> Copy request
          </Button>
          <p className="mt-2 text-muted-foreground">
            Copy only. Send through your authorised communication channel; log the actual contact
            below.
          </p>
        </details>
      )}
      {!locked && run.status === "REQUESTED" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              Channel
              <select
                aria-label="Contact channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="h-10 w-full rounded-xl border bg-white px-3"
              >
                {["EMAIL", "PHONE", "PORTAL", "IN_PERSON", "OTHER"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              Outcome
              <select
                aria-label="Contact outcome"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="h-10 w-full rounded-xl border bg-white px-3"
              >
                {["NO_RESPONSE", "CONTACTED", "INFORMATION_REQUESTED", "DECLINED"].map((x) => (
                  <option key={x} value={x}>
                    {humanize(x)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-xs">
            What happened?
            <Textarea
              required
              minLength={10}
              maxLength={1500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record factual contact notes; avoid unrelated personal information."
            />
          </label>
          <label className="block space-y-1 text-xs">
            Next follow-up (optional)
            <Input type="datetime-local" value={next} onChange={(e) => setNext(e.target.value)} />
          </label>
          <p className="text-[11px] text-muted-foreground">
            Records contact at the current time. This does not complete the check or record a
            verification result.
          </p>
          <Button
            size="sm"
            type="submit"
            disabled={save.isPending || notes.trim().length < 10}
            loading={save.isPending}
          >
            <PhoneCall className="size-3.5" />
            {save.isPending ? "Saving…" : "Record contact"}
          </Button>
        </form>
      )}
      {query.data?.items.map((item) => (
        <article key={item.id} className="border-l-2 border-blue-200 pl-3 text-xs">
          <div className="font-medium">
            {humanize(item.channel)} · {humanize(item.outcome)}
          </div>
          <p className="mt-1 whitespace-pre-wrap">{item.notes}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {item.actorName} · {formatDateTime(item.occurredAt)}
            {item.nextFollowUpAt ? ` · Next ${formatDateTime(item.nextFollowUpAt)}` : ""}
          </p>
        </article>
      ))}
      {query.data && !query.data.total && (
        <p className="text-xs text-muted-foreground">No contact attempts recorded.</p>
      )}
      {query.data && query.data.total > 8 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1 || query.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs">
            {page} / {Math.ceil(query.data.total / 8)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page * 8 >= query.data.total || query.isFetching}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
