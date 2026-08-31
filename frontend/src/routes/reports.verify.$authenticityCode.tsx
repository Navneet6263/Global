import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Fingerprint, FileCheck2, ShieldAlert, ShieldCheck } from "lucide-react";

import { PublicPageShell } from "@/features/public/PublicPageShell";
import { PublicLoading, PublicUnavailable } from "@/features/public/PublicStates";
import { verifyReport } from "@/lib/api/reports";

export const Route = createFileRoute("/reports/verify/$authenticityCode")({
  component: ReportVerificationPage,
  head: () => ({ meta: [{ title: "Verify report — Sapling Global" }] }),
});

function ReportVerificationPage() {
  const { authenticityCode } = Route.useParams();
  const verification = useQuery({
    queryKey: ["report-verification", authenticityCode],
    queryFn: () => verifyReport(authenticityCode),
    retry: false,
  });

  return (
    <PublicPageShell context="Report authenticity verification" width="compact">
      {verification.isLoading ? <PublicLoading label="Verifying released report" /> : null}
      {verification.isError ? (
        <PublicUnavailable
          title="Report could not be verified"
          message={verification.error.message}
          onRetry={() => void verification.refetch()}
        />
      ) : null}
      {verification.data ? (
        <section className="surface-float overflow-hidden rounded-[1.75rem] p-4 sm:p-5">
          <div className="relative overflow-hidden rounded-[1.4rem] bg-mint-deep p-5 text-white sm:p-7">
            <span
              aria-hidden
              className="absolute -right-12 -top-14 size-44 rounded-full bg-white/10"
            />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
                  Authenticity check
                </p>
                <h1 className="mt-5 text-3xl font-medium tracking-[-0.04em]">
                  Verify a released report
                </h1>
                <p className="mt-2 break-all font-mono text-[10px] leading-5 text-white/55">
                  {authenticityCode}
                </p>
              </div>
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10">
                <Fingerprint className="size-5" />
              </span>
            </div>
          </div>

          <div className="space-y-5 p-2 pt-5 sm:p-3 sm:pt-6">
            {verification.data.valid ? (
              <>
                <div className="rounded-[1.2rem] bg-success-soft p-6 text-center">
                  <span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-success">
                    <CheckCircle2 className="size-6" />
                  </span>
                  <h2 className="mt-4 text-lg font-semibold">Authentic Sapling Global report</h2>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                    The released version and integrity fingerprint match our records.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Fact
                    icon={FileCheck2}
                    label="Case number"
                    value={verification.data.caseNumber}
                  />
                  <Fact
                    icon={ShieldCheck}
                    label="Report version"
                    value={`Version ${verification.data.reportVersion}`}
                  />
                  <Fact
                    icon={FileCheck2}
                    label="Generated"
                    value={formatDate(verification.data.generatedAt)}
                  />
                  <Fact icon={CheckCircle2} label="Status" value="Published" />
                  {verification.data.completedAt ? (
                    <Fact
                      icon={CheckCircle2}
                      label="Case completed"
                      value={formatDate(verification.data.completedAt)}
                    />
                  ) : null}
                </div>
                <div className="rounded-[1.15rem] border border-white/80 bg-white/75 p-4 shadow-[var(--shadow-card)]">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Fingerprint className="size-3.5 text-primary" /> SHA-256 document fingerprint
                  </div>
                  <p className="mt-3 break-all font-mono text-[10px] leading-5">
                    {verification.data.sha256}
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-[1.2rem] bg-critical-soft p-6 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-critical">
                  <ShieldAlert className="size-6" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">Report is not valid</h2>
                <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                  This code does not match a currently published Sapling Global report.
                </p>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </PublicPageShell>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[1rem] bg-secondary/45 px-3 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-primary">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-xs font-medium">{value}</span>
      </span>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(value),
  );
}
