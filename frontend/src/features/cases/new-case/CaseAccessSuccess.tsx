import { CheckCircle2, Copy, KeyRound, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

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
  const copy = (value: string, label: string) =>
    void navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error("Copy failed; select and copy the value manually"));

  return (
    <div className="p-6 sm:p-8">
      <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success-foreground">
        <CheckCircle2 className="size-6" aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-semibold">Verification initiated</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {result.caseNumber} is created. You can continue while secure access is prepared.
      </p>

      <div className="mt-5 space-y-3">
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

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Done
        </button>
      </div>
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
        <span className="grid size-10 place-items-center rounded-full bg-card text-info-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        </span>
        <div>
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
      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
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
        <Icon className="size-4 text-primary" aria-hidden />
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
