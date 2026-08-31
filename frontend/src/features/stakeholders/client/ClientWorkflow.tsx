import {
  ArrowRight,
  CircleCheck,
  FileCheck2,
  Flame,
  ScanSearch,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import { Section } from "@/components/layout/section";
import type { OperationsDashboard } from "@/lib/api/dashboards";

export function ClientWorkflow({ data }: { data: OperationsDashboard | undefined }) {
  const stages = [
    {
      label: "Intake & consent",
      hint: "Case setup",
      count: count(data, ["DRAFT", "CONSENT_PENDING"]),
      icon: UserCheck,
      colour: "var(--info)",
      soft: "var(--info-soft)",
    },
    {
      label: "Documents",
      hint: "Collection",
      count: count(data, ["DOCUMENT_PENDING"]),
      icon: FileCheck2,
      colour: "var(--warning)",
      soft: "var(--warning-soft)",
    },
    {
      label: "Verification",
      hint: "Checks running",
      count: count(data, ["READY", "IN_PROGRESS"]),
      icon: ScanSearch,
      colour: "var(--mint)",
      soft: "var(--mint-soft)",
    },
    {
      label: "Information needed",
      hint: "Client action",
      count: count(data, ["CLARIFICATION_PENDING"]),
      icon: CircleCheck,
      colour: "var(--primary)",
      soft: "var(--accent)",
    },
    {
      label: "Quality review",
      hint: "Final review",
      count: count(data, ["QA_PENDING", "QA_REVIEW", "APPROVED"]),
      icon: ShieldCheck,
      colour: "var(--review)",
      soft: "var(--review-soft)",
    },
    {
      label: "Completed",
      hint: "Report ready",
      count: count(data, ["COMPLETED", "CLOSED"]),
      icon: CircleCheck,
      colour: "var(--success)",
      soft: "var(--success-soft)",
    },
  ];
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);
  const activeStages = stages.slice(0, -1);
  const bottleneck = activeStages.reduce((largest, stage) =>
    stage.count > largest.count ? stage : largest,
  );

  return (
    <Section
      title="Verification flow"
      description="Live distribution of your portfolio. The busiest waiting stage is highlighted automatically."
      actions={
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Flame className="size-3.5 text-primary" aria-hidden />
          {bottleneck?.count ? `${bottleneck.label} is busiest` : "No active bottleneck"}
        </span>
      }
      bodyClassName="p-4"
    >
      <ol className="flex snap-x gap-1 overflow-x-auto pb-1">
        {stages.map((stage, index) => {
          const isBottleneck = stage === bottleneck && stage.count > 0;
          const share = total ? Math.round((stage.count / total) * 100) : 0;
          return (
            <li key={stage.label} className="flex min-w-[170px] flex-1 snap-start items-stretch">
              <article
                className="flex min-h-40 flex-1 flex-col justify-between rounded-2xl border p-3.5 shadow-[var(--shadow-card)]"
                style={{
                  borderColor: isBottleneck
                    ? "color-mix(in oklab, var(--primary) 40%, white)"
                    : "var(--border)",
                  borderTop: `2px solid ${stage.colour}`,
                  background: `linear-gradient(180deg, ${stage.soft}, color-mix(in oklab, var(--card) 92%, transparent) 58%)`,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="grid size-9 place-items-center rounded-xl border border-white/70"
                    style={{ color: stage.colour, background: stage.soft }}
                  >
                    <stage.icon className="size-4" aria-hidden />
                  </span>
                  <span className="num text-[10px] text-muted-foreground">{share}%</span>
                </div>
                <div className="mt-5">
                  <p className="num text-2xl font-medium tracking-[-0.03em] text-foreground">
                    {stage.count}
                  </p>
                  <p className="mt-2 text-[12px] font-semibold text-foreground">{stage.label}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{stage.hint}</p>
                </div>
              </article>
              {index < stages.length - 1 ? (
                <span className="flex w-4 items-center justify-center" aria-hidden>
                  <ArrowRight className="size-3.5 text-border-strong" />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function count(data: OperationsDashboard | undefined, statuses: string[]) {
  return statuses.reduce((sum, status) => sum + (data?.statusMix[status] ?? 0), 0);
}
