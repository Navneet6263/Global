"use client";

import { createFileRoute } from "@tanstack/react-router";
import { Database } from "lucide-react";
import { SOURCE_LABEL, STAGE_LABEL, STAGE_DEFAULT_PROBABILITY } from "@/features/crm/config/crm";
import type { CrmStage, LeadSource } from "@/features/crm/contracts/crm";
import { useSalesOwners } from "@/features/crm/hooks/use-crm";
import { PageHeader } from "@/components/layout/page-header";
import { formatPercent } from "@/lib/formatting";
import { crmAccent } from "@/features/crm/accents";

export const Route = createFileRoute("/sales-crm/settings")({
  head: () => ({
    meta: [
      { title: "CRM Settings — Sapling Global Sales & CRM" },
      {
        name: "description",
        content:
          "Stage probability defaults, lead source taxonomy and live data controls for the CRM workspace.",
      },
      { property: "og:title", content: "CRM Settings — Sapling Global Sales & CRM" },
      {
        property: "og:description",
        content: "Review pipeline stage weightings and live CRM data configuration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CrmSettingsPage,
});

function CrmSettingsPage() {
  const ownersQuery = useSalesOwners();
  const accent = crmAccent("openPipeline");

  return (
    <>
      <PageHeader
        title="CRM settings"
        description="Pipeline weightings, source taxonomy and live workspace controls."
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-card/85 px-3 py-2 text-[12px] font-medium text-foreground shadow-[var(--shadow-card)]">
            <Database className="size-4 text-primary" aria-hidden />
            Live SQL data
          </span>
        }
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Stage probability defaults" hint="Applied when a deal moves stage.">
          <ul className="space-y-2.5">
            {(Object.keys(STAGE_DEFAULT_PROBABILITY) as CrmStage[]).map((stage) => (
              <li key={stage} className="space-y-1.5">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="font-medium text-foreground">{STAGE_LABEL[stage]}</span>
                  <span className="num text-muted-foreground">
                    {formatPercent(STAGE_DEFAULT_PROBABILITY[stage], 0)}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full"
                  style={{ background: "oklch(0.95 0.008 150)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${STAGE_DEFAULT_PROBABILITY[stage]}%`,
                      background: accent.colour,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Lead sources" hint="Available when creating or editing an opportunity.">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SOURCE_LABEL) as LeadSource[]).map((source) => (
              <span
                key={source}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium"
                style={{ background: accent.fill, color: accent.colour }}
              >
                {SOURCE_LABEL[source]}
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="Territories & owners" hint="Owners available for deal assignment.">
          <ul className="divide-y divide-border/70 text-[12.5px]">
            {(ownersQuery.data ?? []).map((owner) => (
              <li key={owner.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{owner.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{owner.email}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {owner.territory}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Workspace data"
          hint="CRM records are stored in the authorised Sapling Global workspace."
        >
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            Creating deals, moving stages, logging activities and managing follow-ups now write
            through the secured NestJS API to SQL Server. Browser-local sample records are not used.
          </p>
        </Panel>
      </div>
    </>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.6rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-card)] backdrop-blur-sm">
      <h2 className="text-[1.02rem] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
      <p className="mt-1 mb-4 text-[12px] text-muted-foreground">{hint}</p>
      {children}
    </section>
  );
}
