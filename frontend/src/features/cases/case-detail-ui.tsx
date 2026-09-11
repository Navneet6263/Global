import { Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, FileText, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import type { CaseDetail } from "@/lib/api/cases";
import { humanize } from "@/features/cases/case-detail-formatting";

export function WorkflowStrip({ item }: { item: CaseDetail }) {
  const steps = [
    { label: "Case created", complete: true },
    { label: "Consent", complete: item.consents.some((c) => c.status === "ACCEPTED") },
    {
      label: "Checks",
      complete: item.checks.length > 0 && item.checks.every((c) => c.status === "COMPLETED"),
    },
    ...(item.checks.some((check) => check.type === "ADDRESS") || item.fieldVisits.length
      ? [
          {
            label: "Field visit",
            complete:
              item.fieldVisits.some((visit) => visit.status === "COMPLETED") &&
              item.fieldVisits.every((visit) => ["COMPLETED", "CANCELLED"].includes(visit.status)),
          },
        ]
      : []),
    { label: "QA review", complete: item.qaReviews.some((q) => q.decision === "APPROVED") },
    { label: "Report", complete: item.reports.some((r) => r.status === "PUBLISHED") },
  ];
  return (
    <section className="surface overflow-x-auto rounded-3xl p-5">
      <div className="flex min-w-[650px] items-center">
        {steps.map((step, index) => (
          <div key={step.label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full ${step.complete ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"}`}
              >
                {step.complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </span>
              <span className="text-xs font-semibold">{step.label}</span>
            </div>
            {index < steps.length - 1 ? (
              <div className={`mx-3 h-px flex-1 ${step.complete ? "bg-accent" : "bg-border"}`} />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="surface rounded-3xl p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export function EntityList({
  items,
  empty,
}: {
  items: Array<{
    id: string;
    icon: typeof FileText;
    title: string;
    detail: string;
    status: string;
  }>;
  empty: string;
}) {
  return items.length ? (
    <div className="divide-y divide-[var(--hairline)]">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary">
            <item.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
          </div>
          <Status status={item.status} />
        </div>
      ))}
    </div>
  ) : (
    <Empty text={empty} />
  );
}

export function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-[var(--hairline)] py-3 first:pt-0 last:border-0 last:pb-0">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export function Metric({
  label,
  value,
  light = false,
}: {
  label: string;
  value: string;
  light?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 ${light ? "bg-secondary/55" : "bg-primary-foreground/10"}`}
    >
      <p className="text-[10px] uppercase tracking-[0.1em] opacity-55">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

export function Status({ status }: { status: string }) {
  const success = [
    "COMPLETED",
    "APPROVED",
    "ACCEPTED",
    "AVAILABLE",
    "PUBLISHED",
    "CLOSED",
  ].includes(status);
  const danger = ["REJECTED", "FAILED", "CANCELLED", "EXPIRED"].includes(status);
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${success ? "bg-success text-success-foreground" : danger ? "bg-destructive/10 text-destructive" : "bg-warning/20 text-warning-foreground"}`}
    >
      {humanize(status)}
    </span>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
      <AlertCircle className="mx-auto h-5 w-5 text-muted-foreground" />
      <p className="mt-2 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
export function CaseSkeleton() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="h-6 w-40 animate-pulse rounded bg-secondary" />
      <div className="h-56 animate-pulse rounded-[2rem] bg-primary/80" />
      <div className="h-24 animate-pulse rounded-3xl bg-card" />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="h-96 animate-pulse rounded-3xl bg-card xl:col-span-2" />
        <div className="h-96 animate-pulse rounded-3xl bg-card" />
      </div>
    </div>
  );
}
export function CaseError({ message }: { message: string }) {
  return (
    <div className="surface mx-auto max-w-xl rounded-3xl p-8 text-center">
      <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
      <h1 className="mt-3 font-semibold">Case could not be loaded</h1>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <Link
        to="/"
        className="mt-5 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Return to operations
      </Link>
    </div>
  );
}
