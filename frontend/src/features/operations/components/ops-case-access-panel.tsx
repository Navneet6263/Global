"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Link2, Send } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { OpsCaseDetail } from "../contracts/case";
import { opsKeys } from "../hooks/use-operations";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/backend-api/auth";
import { issueCandidateAccess } from "@/lib/backend-api/candidate-portal";
import { requestConsent } from "@/lib/backend-api/consents";
import { formatDateTime } from "@/lib/formatting";

const CLOSED_STAGES = new Set(["completed", "cancelled"]);

export function OpsCaseAccessPanel({ item }: { item: OpsCaseDetail }) {
  const queryClient = useQueryClient();
  const [origin, setOrigin] = useState("");
  const [candidateUrl, setCandidateUrl] = useState("");
  const [consentOtp, setConsentOtp] = useState("");
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const canIssueCandidate = hasPermission(session.data?.permissions, "case:create");
  const canManageConsent = hasPermission(session.data?.permissions, "consent:manage");
  const closed = CLOSED_STAGES.has(item.stage);
  const consentUrl = item.consent.id && origin ? `${origin}/consent/${item.consent.id}` : "";

  useEffect(() => setOrigin(window.location.origin), []);

  const candidate = useMutation({
    mutationFn: () => issueCandidateAccess(item.id),
    onSuccess: (result) => {
      setCandidateUrl(
        `${window.location.origin}/candidate/${result.id}#token=${encodeURIComponent(result.token)}`,
      );
      toast.success("Candidate document link rotated", {
        description: `Valid until ${formatDateTime(result.expiresAt)}. Copy it before closing this drawer.`,
      });
      void queryClient.invalidateQueries({ queryKey: opsKeys.case(item.id) });
    },
    onError: (error: Error) =>
      toast.error("Candidate link could not be issued", {
        description: error.message,
      }),
  });

  const consent = useMutation({
    mutationFn: () => requestConsent(item.id),
    onSuccess: (result) => {
      setConsentOtp(result.developmentOtp ?? "");
      toast.success("New consent OTP issued", {
        description: result.developmentOtp
          ? "Local development OTP is available below."
          : `Valid until ${formatDateTime(result.expiresAt)}.`,
      });
      void queryClient.invalidateQueries({ queryKey: opsKeys.case(item.id) });
    },
    onError: (error: Error) =>
      toast.error("Consent OTP could not be issued", {
        description: error.message,
      }),
  });

  return (
    <div className="grid gap-3 pt-4 sm:grid-cols-2">
      <AccessCard
        icon={<Link2 className="size-4" aria-hidden />}
        title="Document upload link"
        description="Rotating this link revokes the candidate's previous document link."
        value={candidateUrl}
        actionLabel={candidateUrl ? "Rotate link" : "Issue link"}
        disabled={!canIssueCandidate || closed || candidate.isPending}
        busy={candidate.isPending}
        onAction={() => candidate.mutate()}
      />
      <AccessCard
        icon={<KeyRound className="size-4" aria-hidden />}
        title="Consent link & OTP"
        description={
          item.consent.status === "signed"
            ? "Consent has already been accepted and cannot be reissued."
            : "The consent link is separate from the document-upload link."
        }
        value={consentUrl}
        secondaryValue={consentOtp}
        actionLabel="Issue new OTP"
        disabled={
          !canManageConsent ||
          !item.consent.id ||
          item.consent.status === "signed" ||
          closed ||
          consent.isPending
        }
        busy={consent.isPending}
        onAction={() => consent.mutate()}
      />
    </div>
  );
}

function AccessCard(props: {
  icon: ReactNode;
  title: string;
  description: string;
  value: string;
  secondaryValue?: string;
  actionLabel: string;
  disabled: boolean;
  busy: boolean;
  onAction: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-muted/25 p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-primary">
          {props.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground">{props.title}</p>
          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{props.description}</p>
        </div>
      </div>
      {props.value ? <CopyValue value={props.value} label={props.title} /> : null}
      {props.secondaryValue ? (
        <CopyValue value={props.secondaryValue} label="Development OTP" code />
      ) : null}
      <Button size="sm" className="mt-3 w-full" disabled={props.disabled} onClick={props.onAction}>
        <Send className="size-3.5" aria-hidden />
        {props.busy ? "Issuing…" : props.actionLabel}
      </Button>
    </section>
  );
}

function CopyValue({
  value,
  label,
  code = false,
}: {
  value: string;
  label: string;
  code?: boolean;
}) {
  const copy = () =>
    void navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error("Copy failed"));
  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-2">
      <p
        className={
          code
            ? "min-w-0 flex-1 font-mono text-sm font-semibold tracking-widest"
            : "min-w-0 flex-1 truncate text-[10px]"
        }
      >
        {value}
      </p>
      <button
        type="button"
        onClick={copy}
        className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-primary"
        aria-label={`Copy ${label}`}
      >
        <Copy className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function hasPermission(permissions: readonly string[] | undefined, permission: string) {
  return Boolean(permissions?.includes("*") || permissions?.includes(permission));
}
