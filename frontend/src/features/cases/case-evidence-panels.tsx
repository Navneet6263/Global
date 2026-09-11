import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Send, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [developmentAccess, setDevelopmentAccess] = useState<{
    developmentOtp?: string;
    expiresAt: string;
  }>();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const consent = item.consents[0];
  const consentPublicId = consent?.publicId;
  const [consentUrl, setConsentUrl] = useState("");
  useEffect(() => {
    setConsentUrl(consentPublicId ? `${window.location.origin}/consent/${consentPublicId}` : "");
  }, [consentPublicId]);
  const canManage =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("consent:manage");
  const mutation = useMutation({
    mutationFn: () => requestConsent(item.id),
    onSuccess: (result) => {
      setDevelopmentAccess({
        expiresAt: result.expiresAt,
        ...(result.developmentOtp ? { developmentOtp: result.developmentOtp } : {}),
      });
      toast.success("Consent OTP queued", {
        description: result.developmentOtp
          ? "Development OTP is shown in the Consent panel."
          : `Request expires ${formatDateTime(result.expiresAt)}`,
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
          {canManage && consent.status !== "ACCEPTED" ? (
            <div className="mt-4 rounded-xl border border-border bg-background/80 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Candidate consent link
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  readOnly
                  value={consentUrl}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-[10px]"
                />
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(consentUrl)
                      .then(() => toast.success("Consent link copied"))
                      .catch(() => toast.error("Copy failed"))
                  }
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-primary"
                  aria-label="Copy candidate consent link"
                >
                  <Copy className="size-3.5" aria-hidden />
                </button>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                This is separate from the document-upload link and opens the six-digit OTP page.
              </p>
            </div>
          ) : null}
          {developmentAccess?.developmentOtp ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-accent/45 p-3">
              <KeyRound className="size-4 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground">Development OTP</p>
                <code className="text-lg font-semibold tracking-[0.2em]">
                  {developmentAccess.developmentOtp}
                </code>
              </div>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(developmentAccess.developmentOtp!)
                    .then(() => toast.success("OTP copied"))
                    .catch(() => toast.error("Copy failed"))
                }
                className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
                aria-label="Copy development consent OTP"
              >
                <Copy className="size-3.5" aria-hidden />
              </button>
            </div>
          ) : null}
          {canManage && consent.status !== "ACCEPTED" ? (
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              aria-busy={mutation.isPending}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {mutation.isPending ? "Queuing…" : "Issue a new consent OTP"}
            </button>
          ) : null}
        </div>
      ) : (
        <Empty text="Consent has not been requested" />
      )}
    </Panel>
  );
}
