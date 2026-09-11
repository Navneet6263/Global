import { CheckCircle2, Copy, KeyRound, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { CandidateAccessResult } from "@/lib/api/candidate-portal";

export interface CreatedCaseAccess {
  caseId: string;
  caseNumber: string;
  consentUrl: string;
  consentExpiresAt: string;
  developmentOtp?: string;
  candidate: {
    status: "issuing" | "ready" | "failed" | "skipped";
    url?: string;
    access?: CandidateAccessResult;
    error?: string;
  };
}

export function CaseAccessSuccess({
  result,
  onClose,
}: {
  result: CreatedCaseAccess;
  onClose: () => void;
}) {
  const [copyFeedback, setCopyFeedback] = useState("");
  const copy = (value: string, label: string) =>
    void navigator.clipboard
      .writeText(value)
      .then(() => setCopyFeedback(`${label} copied`))
      .catch(() => setCopyFeedback("Copy failed; select and copy the value manually"));

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-start gap-3 px-5 pb-4 pt-5 pr-12 sm:px-6 sm:pr-12 sm:pt-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success-soft text-success-foreground">
          <CheckCircle2 className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <DialogTitle className="text-lg font-semibold leading-tight sm:text-xl">
            Verification initiated
          </DialogTitle>
          <DialogDescription className="mt-1 break-words text-xs leading-5 text-muted-foreground sm:text-sm">
            {result.caseNumber} is created. You can continue while secure access is prepared.
          </DialogDescription>
        </div>
      </header>

      <div
        role="region"
        aria-label="Candidate access details"
        tabIndex={0}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 pb-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6"
      >
        <CandidateAccessBlock candidate={result.candidate} onCopy={copy} />
        <AccessBlock
          icon={ShieldCheck}
          title="2. Candidate consent link"
          description={`Opens the six-digit OTP consent page · OTP expires ${formatExpiry(result.consentExpiresAt)}`}
          value={result.consentUrl}
          onCopy={() => copy(result.consentUrl, "Consent link")}
        />
        {result.developmentOtp ? (
          <div className="rounded-2xl border border-primary/15 bg-accent/35 p-4">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" aria-hidden />
              <p className="text-xs font-semibold">Development consent OTP</p>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <code className="min-w-0 flex-1 text-2xl font-semibold tracking-[0.28em]">
                {result.developmentOtp}
              </code>
              <button
                type="button"
                onClick={() => copy(result.developmentOtp!, "OTP")}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
                aria-label="Copy development consent OTP"
              >
                <Copy className="size-4" aria-hidden />
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
              SMTP/SMS is not configured, so use this OTP on the consent link during local testing.
            </p>
          </div>
        ) : null}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 bg-secondary/30 px-5 py-4 sm:px-6">
        <p role="status" className="min-w-0 break-words text-xs text-muted-foreground">
          {copyFeedback}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="h-10 shrink-0 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Done
        </button>
      </footer>
    </div>
  );
}

function CandidateAccessBlock({
  candidate,
  onCopy,
}: {
  candidate: CreatedCaseAccess["candidate"];
  onCopy: (value: string, label: string) => void;
}) {
  if (candidate.status === "ready" && candidate.url && candidate.access) {
    return (
      <AccessBlock
        icon={Mail}
        title="1. Candidate document-upload link"
        description={`Opens the document workspace · expires ${formatExpiry(candidate.access.expiresAt)}`}
        value={candidate.url}
        onCopy={() => onCopy(candidate.url!, "Document link")}
      />
    );
  }
  if (candidate.status === "issuing") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-info/15 bg-info-soft/55 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-info-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold">Preparing candidate document link</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            The case is already created; this will update automatically.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-warning/20 bg-warning-soft/50 p-4 text-xs">
      <p className="font-semibold">
        {candidate.status === "skipped"
          ? "Document link was not requested"
          : "Document link was not issued"}
      </p>
      <p className="mt-1 break-words text-[10px] leading-4 text-muted-foreground">
        {candidate.error ?? "Open Case 360 later if you need to issue candidate access."}
      </p>
    </div>
  );
}

function AccessBlock({
  icon: Icon,
  title,
  description,
  value,
  onCopy,
}: {
  icon: typeof Mail;
  title: string;
  description: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
        <p className="text-xs font-semibold">{title}</p>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          readOnly
          value={value}
          aria-label={title}
          className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-xs"
        />
        <button
          type="button"
          onClick={onCopy}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
          aria-label={`Copy ${title}`}
        >
          <Copy className="size-4" aria-hidden />
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{description}</p>
    </div>
  );
}

function formatExpiry(value: string) {
  return new Date(value).toLocaleString("en-IN");
}
