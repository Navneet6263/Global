"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Database, Loader2, Save, ShieldCheck } from "lucide-react";
import { crmAccent } from "../accents";
import { CRM_STAGES, LEAD_SOURCES, SOURCE_LABEL, STAGE_LABEL } from "../config/crm";
import type { CrmStage, LeadSource, UpdateCrmSettingsInput } from "../contracts/crm";
import { useCrmSettings, useSalesOwners, useUpdateCrmSettings } from "../hooks/use-crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatPercent } from "@/lib/formatting";

export function CrmSettingsWorkspace() {
  const settingsQuery = useCrmSettings();
  const ownersQuery = useSalesOwners();
  const saveMutation = useUpdateCrmSettings();
  const [draft, setDraft] = useState<UpdateCrmSettingsInput | null>(null);
  const settings = settingsQuery.data;

  useEffect(() => {
    if (!settings || saveMutation.isPending) return;
    setDraft({
      version: settings.version,
      stageProbabilities: { ...settings.stageProbabilities },
      leadSources: [...settings.leadSources],
    });
  }, [settings, saveMutation.isPending]);

  const isValid = useMemo(() => {
    if (!draft || draft.leadSources.length === 0) return false;
    const values = ["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION"].map(
      (stage) => draft.stageProbabilities[stage as CrmStage],
    );
    return values.every((value, index) => {
      const previous = values[index - 1];
      return value >= 0 && value <= 100 && (previous === undefined || value >= previous);
    });
  }, [draft]);

  if (settingsQuery.isError) {
    return (
      <Panel title="Settings unavailable" hint="The live CRM configuration could not be loaded.">
        <Button variant="outline" onClick={() => void settingsQuery.refetch()}>
          Try again
        </Button>
      </Panel>
    );
  }
  if (settingsQuery.isPending || !settings || !draft) return <SettingsSkeleton />;

  const setProbability = (stage: CrmStage, value: number) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            stageProbabilities: {
              ...current.stageProbabilities,
              [stage]: Math.min(100, Math.max(0, value || 0)),
            },
          }
        : current,
    );
  };
  const toggleSource = (source: LeadSource, enabled: boolean) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        leadSources: enabled
          ? [...new Set([...current.leadSources, source])]
          : current.leadSources.filter((item) => item !== source),
      };
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-white/80 bg-card/75 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[12px] font-medium text-foreground">
          <Database className="size-4 text-primary" aria-hidden />
          Connected tenant workspace
          {!settings.canEdit && (
            <span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">
              Read-only oversight
            </span>
          )}
        </div>
        {settings.canEdit && (
          <Button
            size="sm"
            disabled={!isValid || saveMutation.isPending}
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate(draft)}
          >
            {saveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            Save configuration
          </Button>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Stage probability defaults" hint="Applied when an opportunity moves stage.">
          <ul className="space-y-2.5">
            {CRM_STAGES.map((stage) => {
              const locked = stage === "WON" || stage === "LOST" || !settings.canEdit;
              const value = draft.stageProbabilities[stage];
              return (
                <li key={stage} className="grid grid-cols-[1fr_5rem] items-center gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="font-medium text-foreground">{STAGE_LABEL[stage]}</span>
                      <span className="num text-muted-foreground">{formatPercent(value, 0)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[oklch(0.95_0.008_150)]">
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                  <Input
                    aria-label={`${STAGE_LABEL[stage]} probability`}
                    type="number"
                    min={0}
                    max={100}
                    value={value}
                    disabled={locked}
                    onChange={(event) => setProbability(stage, event.currentTarget.valueAsNumber)}
                    className="num h-9 text-right"
                  />
                </li>
              );
            })}
          </ul>
          {!isValid && (
            <p className="mt-3 text-[11px] font-medium text-destructive">
              Keep at least one source and increase probability as a deal advances.
            </p>
          )}
        </Panel>

        <Panel
          title="Lead sources"
          hint="Control which sources are available on new opportunities."
        >
          <ul className="grid gap-2 sm:grid-cols-2">
            {LEAD_SOURCES.map((source) => {
              const enabled = draft.leadSources.includes(source);
              return (
                <li
                  key={source}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/60 px-3 py-2.5"
                >
                  <span className="text-[12px] font-medium text-foreground">
                    {SOURCE_LABEL[source]}
                  </span>
                  <Switch
                    checked={enabled}
                    disabled={!settings.canEdit}
                    onCheckedChange={(checked) => toggleSource(source, checked)}
                    aria-label={`Enable ${SOURCE_LABEL[source]}`}
                  />
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Territories & owners" hint="Live owners available for deal assignment.">
          <ul className="divide-y divide-border/70 text-[12.5px]">
            {(ownersQuery.data ?? []).map((owner) => (
              <li key={owner.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{owner.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{owner.email}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {owner.territory ?? "All territories"}
                </span>
              </li>
            ))}
            {!ownersQuery.isPending && !ownersQuery.data?.length && (
              <li className="py-3 text-muted-foreground">No active Sales Manager IDs found.</li>
            )}
          </ul>
        </Panel>

        <Panel title="Workspace data" hint="Tenant-scoped, versioned and audit protected.">
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-4" aria-hidden />
            </span>
            <div className="text-[12.5px] leading-relaxed text-muted-foreground">
              <p>Changes are validated by the API and recorded in the immutable audit trail.</p>
              <p className="mt-2 text-[11px]">
                {settings.updatedAt
                  ? `Last saved ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(settings.updatedAt))}`
                  : "Using secure tenant defaults until the first save."}
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  const accent = crmAccent("openPipeline");
  return (
    <section
      className="rounded-[1.6rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-card)] backdrop-blur-sm"
      style={{ borderTop: `2px solid ${accent.edge}` }}
    >
      <h2 className="text-[1.02rem] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
      <p className="mt-1 mb-4 text-[12px] text-muted-foreground">{hint}</p>
      {children}
    </section>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-5 xl:grid-cols-2" aria-label="Loading CRM settings">
      {[0, 1, 2, 3].map((item) => (
        <Skeleton key={item} className="h-64 rounded-[1.6rem]" />
      ))}
    </div>
  );
}
