import { Clock3, FileCheck2, ShieldCheck, Sparkles } from "lucide-react";

import type { CandidateCase } from "@/lib/api/candidate-portal";
import { CandidateStatus } from "./candidate-ui";
import { formatDate, humanize } from "./candidate-utils";

export function CandidateOverview({ data, expiresAt }: { data: CandidateCase; expiresAt: string }) {
  const completed = data.checks.filter((check) => check.status === "COMPLETED").length;
  const progress = data.checks.length ? Math.round((completed / data.checks.length) * 100) : 0;

  return (
    <section className="surface-float overflow-hidden rounded-[1.75rem] p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative overflow-hidden rounded-[1.4rem] bg-mint-deep p-5 text-white sm:p-6">
          <span
            aria-hidden
            className="absolute -right-12 -top-14 size-44 rounded-full bg-white/10"
          />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
                {data.caseNumber}
              </p>
              <h1 className="mt-5 text-3xl font-medium tracking-[-0.045em]">
                Hello, {data.candidateName}
              </h1>
              <p className="mt-2 max-w-md text-xs leading-5 text-white/65">
                {data.clientName} requested this verification. Follow any action shown below to keep
                it moving.
              </p>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10">
              <Sparkles className="size-4" />
            </span>
          </div>
          <div className="relative mt-7 flex flex-wrap items-center gap-2 text-[10px] text-white/65">
            <span className="rounded-full bg-white/10 px-3 py-1.5">
              Access expires {formatDate(expiresAt)}
            </span>
            {data.reportAvailable ? (
              <span className="rounded-full bg-white/10 px-3 py-1.5">
                Final report released to requester
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-[1.4rem] bg-white/70 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Overall progress
              </p>
              <p className="num mt-2 text-4xl font-medium tracking-[-0.045em]">{progress}%</p>
            </div>
            <CandidateStatus value={data.status} />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-5 grid gap-2.5">
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
    <div className="flex items-center gap-3 rounded-[1rem] bg-secondary/50 px-3 py-2.5">
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
