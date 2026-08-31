"use client";

import type { PlatformSettings, PolicyToggle } from "@/lib/contracts/settings";
import { Section } from "@/components/layout/section";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Switch } from "@/components/ui/switch";
import { formatInr } from "@/lib/formatting";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function OrganisationPanel({ settings }: { settings: PlatformSettings }) {
  const org = settings.organisation;
  return (
    <Section
      title="Workspace identity"
      description="Tenant identity and timezone stored by the platform."
    >
      <div className="flex flex-wrap items-end gap-x-12 gap-y-4">
        <dl className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
          <Detail label="Workspace name" value={org.name} />
          <Detail label="Timezone" value={org.timezone} />
        </dl>
        <StatusBadge
          label={org.status === "ACTIVE" ? "Active" : org.status}
          tone={org.status === "ACTIVE" ? "success" : "warning"}
        />
      </div>
    </Section>
  );
}

export function BranchesPanel({
  settings,
  onAdd,
}: {
  settings: PlatformSettings;
  onAdd?: () => void;
}) {
  return (
    <Section
      title="Branches"
      description="Operating locations and field capacity used for case routing."
      actions={
        onAdd ? (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="size-3.5" />
            Add branch
          </Button>
        ) : undefined
      }
      padded={false}
    >
      <ul className="divide-y divide-border">
        {settings.branches.map((branch) => (
          <li key={branch.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">{branch.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {[branch.code, branch.city].filter(Boolean).join(" · ")} · {branch.fieldExecutives}{" "}
                active field {branch.fieldExecutives === 1 ? "executive" : "executives"}
              </p>
            </div>
            <StatusBadge
              label={branch.status === "active" ? "Active" : "Paused"}
              tone={branch.status === "active" ? "success" : "warning"}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function PackagesPanel({
  settings,
  onAdd,
}: {
  settings: PlatformSettings;
  onAdd?: () => void;
}) {
  return (
    <Section
      title="Service packages"
      description="Check bundles offered to clients, with SLA and unit pricing."
      actions={
        onAdd ? (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="size-3.5" />
            Add package
          </Button>
        ) : undefined
      }
      padded={false}
    >
      <ul className="divide-y divide-border">
        {settings.packages.map((pkg) => (
          <li key={pkg.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">{pkg.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {pkg.checks} checks · {pkg.tatHours}h turnaround
              </p>
            </div>
            <span className="num text-[13px] font-semibold text-foreground">
              {pkg.unitPrice == null ? "Price not configured" : formatInr(pkg.unitPrice)}
            </span>
            <StatusBadge
              label={pkg.status === "published" ? "Published" : "Draft"}
              tone={pkg.status === "published" ? "success" : "neutral"}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function PolicyPanel({
  title,
  description,
  policies,
  onToggle,
  busy = false,
}: {
  title: string;
  description: string;
  policies: readonly PolicyToggle[];
  onToggle?: (policy: PolicyToggle) => void;
  busy?: boolean;
}) {
  return (
    <Section title={title} description={description} padded={false}>
      <ul className="divide-y divide-border">
        {policies.map((policy) => (
          <li key={policy.id} className="flex items-start gap-4 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">{policy.label}</p>
              <p className="text-[11px] text-muted-foreground">{policy.description}</p>
            </div>
            <Switch
              checked={policy.enabled}
              disabled={!onToggle || busy}
              onCheckedChange={() => onToggle?.(policy)}
              aria-label={policy.label}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function SlaDefaultsPanel({ settings }: { settings: PlatformSettings }) {
  return (
    <Section
      title="SLA defaults"
      description="Configured turnaround commitment for each service package."
      padded={false}
    >
      <ul className="divide-y divide-border">
        {settings.slaDefaults.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 px-5 py-3">
            <p className="min-w-0 flex-1 text-[13px] text-foreground">{entry.checkLabel}</p>
            <span className="num text-[12px] text-muted-foreground">
              {entry.standardHours} hours
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function RetentionPanel({ settings }: { settings: PlatformSettings }) {
  return (
    <Section
      title="Data retention"
      description="Configured retention window for evidence data."
      padded={false}
    >
      <ul className="divide-y divide-border">
        {settings.retention.map((rule) => (
          <li key={rule.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <p className="min-w-0 flex-1 text-[13px] text-foreground">{rule.dataClass}</p>
            <span className="num text-[12px] text-muted-foreground">{rule.retentionDays} days</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  if (!value.trim()) return null;
  return (
    <div className={className}>
      <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-[13px] text-foreground">{value}</dd>
    </div>
  );
}
