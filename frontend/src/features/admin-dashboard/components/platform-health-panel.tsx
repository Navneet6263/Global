"use client";

import { Section } from "@/components/layout/section";
import { StatusBadge } from "@/components/feedback/status-badge";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { ErrorState } from "@/components/feedback/error-state";
import { usePlatformHealth } from "../hooks/use-control-tower";
import { formatRelativeToNow } from "@/lib/formatting";
import type { HealthComponent } from "@/lib/contracts/common";
import type { StatusTone } from "@/lib/contracts/common";

const HEALTH_TONE: Record<HealthComponent["status"], StatusTone> = {
  healthy: "success",
  degraded: "warning",
  down: "critical",
  unknown: "neutral",
};

const HEALTH_LABEL: Record<HealthComponent["status"], string> = {
  healthy: "Operational",
  degraded: "Degraded",
  down: "Outage",
  unknown: "Unknown",
};

export function PlatformHealthPanel() {
  const { data, isPending, isError, refetch } = usePlatformHealth();

  return (
    <Section
      title="Platform health"
      description="Integration and service availability behind the verification workflow."
      padded={false}
    >
      <div className="p-5">
        {isPending ? <ListSkeleton rows={3} /> : null}
        {isError ? <ErrorState onRetry={() => void refetch()} /> : null}
        {data ? (
          <ul className="space-y-3">
            {data.map((component) => (
              <li
                key={component.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{component.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {component.metric} · checked {formatRelativeToNow(component.checkedAt)} ·{" "}
                    {component.detail}
                  </p>
                </div>
                <StatusBadge
                  label={HEALTH_LABEL[component.status]}
                  tone={HEALTH_TONE[component.status]}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Section>
  );
}
