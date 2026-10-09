import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Empty, Panel, Status } from "@/features/cases/case-detail-ui";
import { formatDateTime } from "@/features/cases/case-detail-formatting";
import { getSession } from "@/lib/api/auth";
import type { CaseDetail } from "@/lib/api/cases";
import { requestConsent } from "@/lib/api/consents";

export { DocumentPanel } from "./document-workspace-panel";

export { ReportsPanel } from "./report-workspace-panel";

export function ConsentPanel({ item }: { item: CaseDetail }) {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const consent = item.consents[0];
  const canManage =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("consent:manage");
  const mutation = useMutation({
    mutationFn: () => requestConsent(item.id),
    onSuccess: (result) => {
      toast.success("Candidate link re-sent", {
        description: result.delivery.queued
          ? `Emailed to ${result.delivery.destination}. Valid until ${formatDateTime(result.expiresAt)}.`
          : "No email or phone on file for this candidate.",
      });
      void queryClient.invalidateQueries({ queryKey: ["case", item.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Panel title="Consent" subtitle="Latest consent state">
      {consent ? (
        <div className="rounded-2xl bg-secondary/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <ShieldCheck className="h-5 w-5 text-accent-foreground" />
            <Status status={consent.status} />
          </div>
          <p className="mt-3 text-sm font-semibold">Notice {consent.noticeVersion}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{consent.purpose}</p>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            {consent.status === "ACCEPTED"
              ? "Recorded once for this case. A new upload link never asks again."
              : "The candidate confirms consent with a one-time code inside their single secure link, then uploads."}
          </p>
          {canManage && consent.status !== "ACCEPTED" ? (
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              aria-busy={mutation.isPending}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {mutation.isPending ? "Sending…" : "Re-send candidate link"}
            </button>
          ) : null}
        </div>
      ) : (
        <Empty text="Consent has not been requested" />
      )}
    </Panel>
  );
}
