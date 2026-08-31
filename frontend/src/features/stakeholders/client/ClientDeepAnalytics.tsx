import type { LucideIcon } from "lucide-react";
import { AlertTriangle, FileWarning, Gauge, RotateCcw } from "lucide-react";

import { Section } from "@/components/layout/section";
import type { ClientAnalyticsDashboard } from "@/lib/api/dashboards";
import { cn } from "@/lib/utils";
import {
  clientAnalyticsTones as tones,
  type ClientAnalyticsTone as Tone,
} from "./client-analytics-tones";
import { caseStatusLabel, humanize } from "./client-portal-utils";

export function ClientDeepAnalytics({ data }: { data: ClientAnalyticsDashboard }) {
  const summary = data.summary;
  const cards: Array<{
    label: string;
    value: string | number;
    detail: string;
    icon: LucideIcon;
    tone: Tone;
  }> = [
    {
      label: "Non-clear outcomes",
      value: `${summary.nonClearRate}%`,
      detail: `${summary.nonClear} of ${summary.returnedOutcomes} returned checks`,
      icon: AlertTriangle,
      tone: summary.nonClear ? "amber" : "mint",
    },
    {
      label: "Document corrections",
      value: summary.rejectedDocuments,
      detail: "Rejected versions awaiting a cleaner upload",
      icon: FileWarning,
      tone: summary.rejectedDocuments ? "rose" : "mint",
    },
    {
      label: "QA rework",
      value: summary.qaRework,
      detail: "Cases returned from final quality review",
      icon: RotateCcw,
      tone: summary.qaRework ? "violet" : "mint",
    },
    {
      label: "Largest live stage",
      value: data.bottleneck?.count ?? 0,
      detail: data.bottleneck
        ? `${caseStatusLabel(data.bottleneck.status)} · oldest ${age(data.bottleneck.oldestAgeHours)}`
        : "No active bottleneck",
      icon: Gauge,
      tone: data.bottleneck ? "blue" : "mint",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Quality summary">
        {cards.map((card) => (
          <QualityCard key={card.label} {...card} />
        ))}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Section
          title="Stage ageing"
          description="Where active cases are concentrated and how long the oldest case has waited"
          className="border-mint/15 bg-card/90"
        >
          <MetricBars
            rows={data.stageHealth.map((row) => ({
              key: row.status,
              label: caseStatusLabel(row.status),
              value: row.count,
              detail: `Oldest ${age(row.oldestAgeHours)}`,
              tone: stageTone(row.status),
            }))}
          />
        </Section>
        <Section
          title="Check outcome hotspots"
          description="Discrepancy and unable-to-verify outcomes by verification type"
          className="border-warning/15 bg-card/90"
        >
          <CheckHotspots rows={data.checkHealth} />
        </Section>
      </div>

      <Section
        title="Document correction hotspots"
        description="Document types most often rejected and needing a replacement upload"
        className="border-info/15 bg-card/90"
      >
        <DocumentHotspots rows={data.documentHealth} />
      </Section>
    </div>
  );
}

function QualityCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone: Tone;
}) {
  const style = tones[tone];
  return (
    <article
      className={cn(
        "group relative min-h-40 overflow-hidden rounded-[1.5rem] border p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-raise)]",
        style.wash,
      )}
    >
      <span className="absolute -right-8 -top-10 size-28 rounded-full bg-white/45" aria-hidden />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <span className={cn("grid size-9 place-items-center rounded-xl ring-1", style.icon)}>
            <Icon className="size-4" aria-hidden />
          </span>
        </div>
        <p className="num mt-4 text-3xl font-semibold tracking-[-0.05em] text-foreground">
          {value}
        </p>
        <p className="mt-auto pt-3 text-[10px] leading-4 text-muted-foreground">{detail}</p>
      </div>
      <span className={cn("absolute inset-x-5 bottom-0 h-1 rounded-t-full", style.bar)} />
    </article>
  );
}

function MetricBars({
  rows,
}: {
  rows: Array<{ key: string; label: string; value: number; detail: string; tone: Tone }>;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <Empty text="Stage analytics will appear after the first case." />;
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const style = tones[row.tone];
        return (
          <div key={row.key} className={cn("rounded-2xl border p-3.5", style.wash)}>
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="font-semibold text-foreground">{row.label}</span>
              <span className={cn("num rounded-full px-2.5 py-1 text-[10px]", style.pill)}>
                {row.value} cases · {row.detail}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70 ring-1 ring-border/50">
              <div
                className={cn("h-full rounded-full", style.bar)}
                style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CheckHotspots({ rows }: { rows: ClientAnalyticsDashboard["checkHealth"] }) {
  if (!rows.length) return <Empty text="Check outcomes will appear after verification starts." />;
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const nonClear = row.discrepancies + row.unableToVerify;
        const rate = row.returned ? Math.round((nonClear / row.returned) * 100) : 0;
        const tone: Tone = rate >= 30 ? "rose" : rate > 0 ? "amber" : "mint";
        return (
          <article key={row.type} className={cn("rounded-2xl border p-3.5", tones[tone].wash)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-foreground">{humanize(row.type)}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {row.discrepancies} discrepancies · {row.unableToVerify} unable to verify
                </p>
              </div>
              <span
                className={cn(
                  "num rounded-full px-2.5 py-1 text-[10px] font-semibold",
                  tones[tone].pill,
                )}
              >
                {rate}% non-clear
              </span>
            </div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/70 ring-1 ring-border/50">
              <span className="bg-success" style={{ width: `${percent(row.clear, row.total)}%` }} />
              <span
                className="bg-warning"
                style={{ width: `${percent(row.discrepancies, row.total)}%` }}
              />
              <span
                className="bg-critical"
                style={{ width: `${percent(row.unableToVerify, row.total)}%` }}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function DocumentHotspots({ rows }: { rows: ClientAnalyticsDashboard["documentHealth"] }) {
  if (!rows.length) return <Empty text="Document quality data will appear after uploads." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map((row) => {
        const tone: Tone = row.rejected ? "rose" : row.verified ? "mint" : "blue";
        return (
          <article
            key={row.type}
            className={cn("relative overflow-hidden rounded-2xl border p-4", tones[tone].wash)}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-semibold text-foreground">{humanize(row.type)}</p>
              <span
                className={cn(
                  "num rounded-full px-2 py-0.5 text-[9px] font-semibold",
                  tones[tone].pill,
                )}
              >
                {row.rejected} rejected
              </span>
            </div>
            <p className="num mt-5 text-2xl font-semibold tracking-[-0.04em]">{row.total}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {row.verified} verified · {row.available} available
            </p>
            <span
              className={cn("absolute inset-x-4 bottom-0 h-1 rounded-t-full", tones[tone].bar)}
            />
          </article>
        );
      })}
    </div>
  );
}

function stageTone(status: string): Tone {
  if (status.includes("CLARIFICATION")) return "rose";
  if (status.includes("CONSENT")) return "amber";
  if (status.includes("DOCUMENT")) return "blue";
  if (status.includes("QA")) return "violet";
  return "mint";
}

function percent(value: number, total: number) {
  return total ? (value / total) * 100 : 0;
}

function age(hours: number) {
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-mint/25 bg-gradient-to-br from-mint-soft/45 to-card py-14 text-center text-xs text-muted-foreground">
      {text}
    </p>
  );
}
