import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react";

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
    <main className="canvas-mesh grid min-h-screen place-items-center bg-background px-4 py-12 text-foreground">
      <section className="surface-float w-full max-w-2xl overflow-hidden rounded-[2rem]">
        <header className="ink-panel p-7 sm:p-9">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-foreground/10">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold">Sapling Global</p>
              <p className="text-xs opacity-60">Report authenticity verification</p>
            </div>
          </div>
          <h1 className="mt-8 text-3xl font-bold">Verify a released report</h1>
          <p className="mt-2 text-sm opacity-65">Authenticity code {authenticityCode}</p>
        </header>
        <div className="p-7 sm:p-9">
          {verification.isLoading ? (
            <div className="h-52 animate-pulse rounded-3xl bg-secondary" />
          ) : null}
          {verification.isError ? (
            <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-6 text-center">
              <LockKeyhole className="mx-auto h-8 w-8 text-destructive" />
              <h2 className="mt-3 text-lg font-bold">Report could not be verified</h2>
              <p className="mt-1 text-sm text-muted-foreground">{verification.error.message}</p>
            </div>
          ) : null}
          {verification.data ? (
            <div className="space-y-5">
              <div className="rounded-3xl bg-accent/15 p-6 text-center">
                <CheckCircle2 className="mx-auto h-9 w-9 text-accent-foreground" />
                <h2 className="mt-3 text-xl font-bold">Authentic Sapling Global report</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The released version and integrity hash match our records.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Fact label="Case number" value={verification.data.caseNumber} />
                <Fact label="Report version" value={`v${verification.data.reportVersion}`} />
                <Fact label="Generated" value={formatDate(verification.data.generatedAt)} />
                <Fact
                  label="Status"
                  value={verification.data.valid ? "Published" : "Unavailable"}
                />
              </div>
              <div className="rounded-2xl border border-[var(--hairline)] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Fingerprint className="h-4 w-4" /> SHA-256 document fingerprint
                </div>
                <p className="mt-2 break-all font-mono text-xs leading-5">
                  {verification.data.sha256}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/45 p-4">
      <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(value),
  );
}
