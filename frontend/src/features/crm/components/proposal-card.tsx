import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { decideProposal, downloadProposal, type Proposal } from "@/lib/backend-api/crm-proposals";
import { formatDateTime, formatInr } from "@/lib/formatting";

export function ProposalCard({
  id,
  item,
  canWrite,
  onSaved,
}: {
  id: string;
  item: Proposal;
  canWrite: boolean;
  onSaved: () => void;
}) {
  const [action, setAction] = useState("");
  const [evidence, setEvidence] = useState("");
  const download = useMutation({
    mutationFn: () => downloadProposal(id, item),
    onError: (error) => toast.error(error.message),
  });
  const save = useMutation({
    mutationFn: () =>
      decideProposal(id, item.id, { version: item.version, status: action, evidence }),
    onSuccess: () => {
      setAction("");
      setEvidence("");
      onSaved();
      toast.success("Proposal decision recorded");
    },
    onError: (error) => {
      toast.error(error.message);
      onSaved();
    },
  });
  const expired = new Date(item.validUntil) <= new Date();
  const actions: Record<string, string[]> = {
    DRAFT: [...(!item.isAuthor && !expired ? ["APPROVED"] : []), "REJECTED", "WITHDRAWN"],
    APPROVED: [...(!expired ? ["SENT"] : []), "WITHDRAWN"],
    SENT: [...(!expired ? ["ACCEPTED"] : []), "DECLINED", "WITHDRAWN"],
  };
  const labels: Record<string, string> = {
    APPROVED: "Approve",
    REJECTED: "Return / reject",
    SENT: "Record sent",
    ACCEPTED: "Record acceptance",
    DECLINED: "Record declined",
    WITHDRAWN: "Withdraw quote",
  };
  return (
    <article className="space-y-3 rounded-2xl border border-violet-100 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Proposal r{item.revision}</h4>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] ${item.status === "ACCEPTED" ? "bg-mint-soft text-mint-deep" : "bg-violet-50 text-violet-700"}`}
        >
          {item.status}
          {expired ? " · Expired" : ""}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <strong className="text-lg">{formatInr(Number(item.snapshot.totalPaise) / 100)}</strong>
        <Button
          variant="outline"
          size="sm"
          disabled={download.isPending}
          loading={download.isPending}
          onClick={() => download.mutate()}
        >
          <Download className="size-3.5" />
          {download.isPending ? "Preparing…" : "PDF"}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {item.snapshot.lines.map((line) => `${line.name} × ${line.quantity}`).join(" · ")}
        <br />
        Valid until {formatDateTime(item.validUntil)} · Prepared by {item.snapshot.preparedBy}
      </p>
      {item.status === "DRAFT" && item.isAuthor && (
        <p className="flex items-center gap-2 text-xs text-violet-700">
          <ShieldCheck className="size-4 shrink-0" />A different authorised colleague must approve
          your draft.
        </p>
      )}
      {canWrite && (
        <div className="flex flex-wrap gap-1.5">
          {(actions[item.status] ?? []).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={action === status ? "default" : "outline"}
              onClick={() => setAction(action === status ? "" : status)}
            >
              {labels[status]}
            </Button>
          ))}
        </div>
      )}
      {canWrite && action && (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <label className="text-xs">
            {["SENT", "ACCEPTED", "DECLINED"].includes(action)
              ? "Actual communication reference / evidence"
              : "Decision rationale"}
            <Textarea
              required
              minLength={10}
              maxLength={1000}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
          </label>
          <p className="text-[11px] text-muted-foreground">
            Records human evidence only. Does not send email, sign a contract or mark the
            opportunity won.
          </p>
          <Button
            type="submit"
            size="sm"
            disabled={save.isPending || evidence.trim().length < 10}
            loading={save.isPending}
          >
            {save.isPending ? "Saving…" : "Confirm record"}
          </Button>
        </form>
      )}
    </article>
  );
}
