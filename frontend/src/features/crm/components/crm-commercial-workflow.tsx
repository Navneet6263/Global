import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getCrmSequence, listProposals, setCrmSequence } from "@/lib/backend-api/crm-proposals";
import { formatDateTime } from "@/lib/formatting";
import { ProposalCard } from "./proposal-card";
import { ProposalCreateForm } from "./proposal-create-form";

export function CrmCommercialWorkflow({ id, canWrite }: { id: string; canWrite: boolean }) {
  const [tab, setTab] = useState<"proposals" | "follow-ups" | null>(null);
  return (
    <section className="space-y-3 rounded-2xl border border-violet-100 bg-violet-50/30 p-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={tab === "proposals" ? "secondary" : "outline"}
          size="sm"
          onClick={() => setTab(tab === "proposals" ? null : "proposals")}
        >
          <FileText className="size-3.5" /> Proposals
        </Button>
        <Button
          variant={tab === "follow-ups" ? "secondary" : "outline"}
          size="sm"
          onClick={() => setTab(tab === "follow-ups" ? null : "follow-ups")}
        >
          <CalendarClock className="size-3.5" /> Follow-up sequence
        </Button>
      </div>
      {tab === "proposals" && <ProposalWorkspace key={id} id={id} canWrite={canWrite} />}
      {tab === "follow-ups" && <SequenceWorkspace key={id} id={id} canWrite={canWrite} />}
    </section>
  );
}
function ProposalWorkspace({ id, canWrite }: { id: string; canWrite: boolean }) {
  const client = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(0);
  const query = useQuery({ queryKey: ["crm-proposals", id], queryFn: () => listProposals(id) });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["crm-proposals", id] });
    void client.invalidateQueries({ queryKey: ["crm"] });
  };
  if (query.isPending)
    return (
      <p role="status" className="text-xs">
        Loading proposals…
      </p>
    );
  if (query.isError)
    return (
      <p role="alert" className="text-xs text-destructive">
        {query.error.message}
        <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </p>
    );
  const pages = Math.max(1, Math.ceil(query.data.items.length / 4));
  const safePage = Math.min(page, pages - 1);
  return (
    <div className="space-y-3">
      {canWrite && !["WON", "LOST"].includes(query.data.stage) && (
        <Button size="sm" variant="outline" onClick={() => setCreating(!creating)}>
          {creating ? "Cancel draft" : "New proposal revision"}
        </Button>
      )}
      {creating && (
        <ProposalCreateForm
          id={id}
          version={query.data.opportunityVersion}
          catalog={query.data.catalog}
          onSaved={() => {
            setCreating(false);
            setPage(0);
            refresh();
          }}
        />
      )}
      {query.data.items.slice(safePage * 4, safePage * 4 + 4).map((item) => (
        <ProposalCard key={item.id} id={id} item={item} canWrite={canWrite} onSaved={refresh} />
      ))}
      {!query.data.items.length && (
        <p className="text-xs text-muted-foreground">
          No proposals yet. Prepare a service quote and get it reviewed before sending.
        </p>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={!safePage}
            onClick={() => setPage(safePage - 1)}
          >
            Previous
          </Button>
          <span className="text-xs">
            {safePage + 1} / {pages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={safePage + 1 >= pages}
            onClick={() => setPage(safePage + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
function SequenceWorkspace({ id, canWrite }: { id: string; canWrite: boolean }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["crm-sequence", id], queryFn: () => getCrmSequence(id) });
  const mutation = useMutation({
    mutationFn: (enabled: boolean) => setCrmSequence(id, query.data!.version, enabled),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["crm-sequence", id] });
      void client.invalidateQueries({ queryKey: ["crm"] });
      toast.success("Follow-up sequence updated");
    },
    onError: (error) => {
      toast.error(error.message);
      void query.refetch();
    },
  });
  if (query.isPending)
    return (
      <p role="status" className="text-xs">
        Loading follow-up schedule…
      </p>
    );
  if (query.isError)
    return (
      <p role="alert" className="text-xs text-destructive">
        {query.error.message}
        <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </p>
    );
  const row = query.data;
  const active = row.followUpSequenceStep !== null && row.followUpSequenceStep < 3;
  const closed = ["WON", "LOST"].includes(row.stage);
  return (
    <div className="space-y-3 text-xs">
      <p>
        Three owner follow-ups: 24 hours, day 3 and day 7 after starting. Complete each in the
        Follow-ups workspace to advance. Late work stays overdue.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {["24 hours", "Day 3", "Day 7"].map((label, i) => (
          <div
            key={label}
            className={`rounded-xl p-3 text-center ${row.followUpSequenceStep !== null && row.followUpSequenceStep > i ? "bg-mint-soft text-mint-deep" : row.followUpSequenceStep === i ? "bg-amber-100 text-amber-800" : "bg-white text-muted-foreground"}`}
          >
            {label}
            <span className="mt-1 block text-[10px]">
              {row.followUpSequenceStep !== null && row.followUpSequenceStep > i
                ? "Recorded"
                : row.followUpSequenceStep === i
                  ? "Next"
                  : "—"}
            </span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground">
        {row.nextFollowUpAt
          ? `Next follow-up: ${formatDateTime(row.nextFollowUpAt)}`
          : "No scheduled follow-up"}
        . In-app reminders; no automatic emails or calls.
      </p>
      {!row.hasOwner && <p>Assign a sales owner first.</p>}
      {row.nextFollowUpAt && !active && (
        <p>Finish the existing manual follow-up before starting this sequence.</p>
      )}
      {canWrite && !closed && (
        <Button
          size="sm"
          variant="outline"
          disabled={mutation.isPending || (!active && (!row.hasOwner || !!row.nextFollowUpAt))}
          loading={mutation.isPending}
          onClick={() => mutation.mutate(!active)}
        >
          {mutation.isPending ? "Saving…" : active ? "Stop sequence" : "Start sequence"}
        </Button>
      )}
    </div>
  );
}
