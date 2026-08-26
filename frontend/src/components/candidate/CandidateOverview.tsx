import { Clock3, FileCheck2, ShieldCheck } from "lucide-react";

import { formatDate, humanize } from "./candidate-utils";
import { CandidateStatus } from "./candidate-ui";
import type { CandidateCase } from "@/lib/api/candidate-portal";

export function CandidateOverview({ data, expiresAt }: { data: CandidateCase; expiresAt: string }) {
  const completed = data.checks.filter((check) => check.status === "COMPLETED").length;
  const progress = data.checks.length ? Math.round((completed / data.checks.length) * 100) : 0;
  return (
    <section className="surface-float overflow-hidden rounded-[2rem]">
      <header className="bg-slate-950 p-6 text-white sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-300">
          {data.caseNumber}
        </p>
        <h1 className="mt-3 text-3xl font-bold">Hello, {data.candidateName}</h1>
        <p className="mt-2 text-sm text-white/65">
          Verification requested by {data.clientName} · access expires {formatDate(expiresAt)}
        </p>
      </header>
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Overall progress
            </p>
            <p className="mt-1 text-3xl font-bold">{progress}%</p>
          </div>
          <CandidateStatus value={data.status} />
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-orange-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Fact icon={ShieldCheck} label="Consent" value={humanize(data.consentStatus)} />
          <Fact
            icon={FileCheck2}
            label="Checks"
            value={`${completed} of ${data.checks.length} complete`}
          />
          <Fact
            icon={Clock3}
            label="Expected by"
            value={data.dueAt ? formatDate(data.dueAt) : "To be confirmed"}
          />
        </div>
      </div>
    </section>
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
    <div className="rounded-2xl bg-secondary/45 p-4">
      <Icon className="h-4 w-4 text-orange-700" />
      <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs font-semibold">{value}</p>
    </div>
  );
}
