import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileCheck2, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";

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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["public-consent", consentId] });
    },
  });

  return (
    <main className="canvas-mesh min-h-screen bg-background px-4 py-8 text-foreground sm:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="ink-panel grid h-11 w-11 place-items-center rounded-2xl">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold">Sapling Global</p>
            <p className="text-xs text-muted-foreground">Secure candidate consent</p>
          </div>
        </div>

        {consent.isLoading ? <div className="surface h-96 animate-pulse rounded-[2rem]" /> : null}
        {consent.isError ? (
          <div className="surface rounded-[2rem] p-8 text-center">
            <LockKeyhole className="mx-auto h-7 w-7 text-destructive" />
            <h1 className="mt-4 text-xl font-bold">Consent link is unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">{consent.error.message}</p>
          </div>
        ) : null}
        {consent.data ? (
          <section className="surface-float overflow-hidden rounded-[2rem]">
            <header className="ink-panel p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                {consent.data.caseNumber}
              </p>
              <h1 className="mt-3 text-3xl font-bold">Background verification consent</h1>
              <p className="mt-2 text-sm opacity-65">
                Requested for {consent.data.candidateName} by {consent.data.requestedBy}
              </p>
            </header>
            <div className="space-y-6 p-6 sm:p-8">
              <div>
                <h2 className="text-sm font-semibold">Purpose and authorisation</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {consent.data.purpose}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Consent notice version {consent.data.noticeVersion}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <TrustPoint icon={FileCheck2} text="Only approved verification checks" />
                <TrustPoint icon={LockKeyhole} text="Protected access and audit trail" />
                <TrustPoint icon={ShieldCheck} text="Independent quality review" />
              </div>

              {consent.data.status === "ACCEPTED" ? (
                <div className="rounded-3xl bg-accent/15 p-6 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-accent-foreground" />
                  <h2 className="mt-3 text-lg font-bold">Consent recorded</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Accepted{" "}
                    {consent.data.acceptedAt ? formatDate(consent.data.acceptedAt) : "successfully"}
                    . You may close this page.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (/^\d{6}$/.test(otp)) confirm.mutate();
                  }}
                  className="rounded-3xl border border-[var(--hairline)] bg-secondary/35 p-5 sm:p-6"
                >
                  <label className="text-sm font-semibold">
                    Enter the 6-digit OTP sent to you
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={otp}
                      onChange={(event) =>
                        setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      className="mt-3 h-14 w-full rounded-2xl border border-input bg-background px-4 text-center text-2xl font-bold tracking-[0.45em] outline-none focus:ring-2 focus:ring-ring/25"
                    />
                  </label>
                  {confirm.isError ? (
                    <p className="mt-3 text-sm text-destructive">{confirm.error.message}</p>
                  ) : null}
                  <button
                    disabled={!/^\d{6}$/.test(otp) || confirm.isPending}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {confirm.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    Review and provide consent
                  </button>
                  <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
                    By submitting the valid OTP, you confirm that you have read the purpose above
                    and voluntarily authorise the stated verification.
                  </p>
                </form>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function TrustPoint({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  return (
    <div className="rounded-2xl bg-secondary/55 p-4">
      <Icon className="h-4 w-4 text-accent-foreground" />
      <p className="mt-2 text-xs font-medium leading-5">{text}</p>
    </div>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(value),
  );
}
