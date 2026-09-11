import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  FileCheck2,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

import { PublicPageShell } from "@/features/public/PublicPageShell";
import { PublicLoading, PublicUnavailable } from "@/features/public/PublicStates";
import { confirmConsent, getPublicConsent } from "@/lib/api/consents";

export const Route = createFileRoute("/consent/$consentId")({
  component: ConsentPage,
  head: () => ({ meta: [{ title: "Secure consent — Sapling Global" }] }),
});

function ConsentPage() {
  const { consentId } = Route.useParams();
  const queryClient = useQueryClient();
  const [otp, setOtp] = useState("");
  const consent = useQuery({
    queryKey: ["public-consent", consentId],
    queryFn: () => getPublicConsent(consentId),
    retry: false,
  });
  const confirm = useMutation({
    mutationFn: () => confirmConsent(consentId, otp),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["public-consent", consentId] });
    },
  });

  return (
    <PublicPageShell context="Secure candidate consent" width="compact">
      {consent.isLoading ? <PublicLoading label="Loading consent request" /> : null}
      {consent.isError ? (
        <PublicUnavailable
          title="Consent link is unavailable"
          message={consent.error.message}
          onRetry={() => void consent.refetch()}
        />
      ) : null}
      {consent.data ? (
        <section className="surface-float overflow-hidden rounded-[1.75rem] p-4 sm:p-5">
          <div className="relative overflow-hidden rounded-[1.4rem] bg-mint-deep p-5 text-white sm:p-7">
            <span
              aria-hidden
              className="absolute -right-12 -top-14 size-44 rounded-full bg-white/10"
            />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
                  {consent.data.caseNumber}
                </p>
                <h1 className="mt-5 text-3xl font-medium tracking-[-0.04em]">
                  Background verification consent
                </h1>
                <p className="mt-2 text-xs leading-5 text-white/65">
                  Requested for {consent.data.candidateName} by {consent.data.requestedBy}
                </p>
              </div>
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10">
                <ShieldCheck className="size-5" />
              </span>
            </div>
          </div>

          <div className="space-y-5 p-2 pt-5 sm:p-3 sm:pt-6">
            <div className="rounded-[1.15rem] bg-secondary/45 p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-primary">
                  <FileCheck2 className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold">Purpose and authorisation</h2>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    {consent.data.purpose}
                  </p>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Consent notice version {consent.data.noticeVersion}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <TrustPoint icon={FileCheck2} text="Only approved checks" />
              <TrustPoint icon={LockKeyhole} text="Protected audit trail" />
              <TrustPoint icon={ShieldCheck} text="Quality review controls" />
            </div>

            {consent.data.status === "ACCEPTED" ? (
              <div className="rounded-[1.25rem] bg-success-soft p-6 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-success">
                  <CheckCircle2 className="size-6" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">Consent recorded</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Accepted{" "}
                  {consent.data.acceptedAt ? formatDate(consent.data.acceptedAt) : "successfully"}.
                  You may close this page.
                </p>
              </div>
            ) : consent.data.status !== "REQUESTED" ? (
              <div className="rounded-[1.25rem] bg-warning-soft p-6 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-warning-foreground">
                  <LockKeyhole className="size-6" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">Consent request is no longer active</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Current status: {consent.data.status.replaceAll("_", " ").toLowerCase()}. Contact
                  the requesting organisation if a new consent request is required.
                </p>
              </div>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (/^\d{6}$/.test(otp)) confirm.mutate();
                }}
                className="rounded-[1.25rem] border border-white/80 bg-white/75 p-4 shadow-[var(--shadow-card)] sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-primary">
                    <KeyRound className="size-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold">Confirm your decision</h2>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      Enter the 6-digit OTP sent to your registered contact.
                    </p>
                  </div>
                </div>
                <input
                  aria-label="Six-digit consent OTP"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  className="mt-4 h-14 w-full rounded-[1rem] border border-input bg-secondary/35 px-4 text-center text-2xl font-semibold tracking-[0.5em] outline-none placeholder:tracking-[0.35em] focus:ring-2 focus:ring-primary/15"
                />
                {confirm.isError ? (
                  <p className="mt-3 rounded-xl bg-critical-soft px-3 py-2 text-xs text-critical-foreground">
                    {confirm.error.message}
                  </p>
                ) : null}
                <button
                  disabled={!/^\d{6}$/.test(otp) || confirm.isPending}
                  aria-busy={confirm.isPending}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-card)] disabled:opacity-45"
                >
                  {confirm.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  {confirm.isPending ? "Recording consent" : "Confirm consent securely"}
                </button>
                <p className="mt-3 text-center text-[10px] leading-5 text-muted-foreground">
                  Submitting a valid OTP confirms that you read the purpose and voluntarily
                  authorise the stated verification.
                </p>
              </form>
            )}
          </div>
        </section>
      ) : null}
    </PublicPageShell>
  );
}

function TrustPoint({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[1rem] bg-mint-soft/55 px-3 py-3">
      <Icon className="size-3.5 shrink-0 text-mint-deep" />
      <p className="text-[10px] font-medium leading-4">{text}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(value),
  );
}
