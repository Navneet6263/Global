"use client";

import type { PlatformSettings, PolicyToggle } from "@/lib/contracts/settings";
import { Section } from "@/components/layout/section";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Switch } from "@/components/ui/switch";
import { formatInr } from "@/lib/formatting";

export function OrganisationPanel({ settings }: { settings: PlatformSettings }) {
  const org = settings.organisation;
  return (
    <Section
      title="Organisation profile"
      description="Legal identity used on candidate consent forms, reports and invoices."
    >
      <dl className="grid gap-4 sm:grid-cols-2">
        <Detail label="Legal name" value={org.legalName} />
        <Detail label="Brand name" value={org.brandName} />
        <Detail label="GSTIN" value={org.gstin} />
        <Detail label="Timezone" value={org.timezoneLabel} />
        <Detail label="Support email" value={org.supportEmail} />
        <Detail label="Support phone" value={org.supportPhone} />
        <Detail
          label="Registered address"
          value={org.registeredAddress}
          className="sm:col-span-2"
        />
      </dl>
    </Section>
  );
}

export function BranchesPanel({ settings }: { settings: PlatformSettings }) {
  return (
    <Section
      title="Branches"
      description="Operating locations and field capacity used for case routing."
      padded={false}
    >
      <ul className="divide-y divide-border">
        {settings.branches.map((branch) => (
          <li key={branch.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">{branch.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {branch.city}, {branch.state} · {branch.headOfBranch} · {branch.fieldExecutives}{" "}
                field executives
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

export function PackagesPanel({ settings }: { settings: PlatformSettings }) {
  return (
    <Section
      title="Service packages"
      description="Check bundles offered to clients, with SLA and unit pricing."
      padded={false}
    >
      <ul className="divide-y divide-border">
        {settings.packages.map((pkg) => (
          <li key={pkg.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">{pkg.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {pkg.checks} checks · {pkg.slaDays}-day SLA · {pkg.clientsUsing} clients
              </p>
            </div>
            <span className="num text-[13px] font-semibold text-foreground">
              {formatInr(pkg.unitPrice)}
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
}: {
  title: string;
  description: string;
  policies: readonly PolicyToggle[];
  onToggle: (policy: PolicyToggle) => void;
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
              onCheckedChange={() => onToggle(policy)}
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
      description="Baseline turnaround and escalation windows per check type."
      padded={false}
    >
      <ul className="divide-y divide-border">
        {settings.slaDefaults.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 px-5 py-3">
            <p className="min-w-0 flex-1 text-[13px] text-foreground">{entry.checkLabel}</p>
            <span className="num text-[12px] text-muted-foreground">
              {entry.standardHours}h standard · escalate at {entry.escalationHours}h
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
      description="Retention windows and disposal method per data class."
      padded={false}
    >
      <ul className="divide-y divide-border">
        {settings.retention.map((rule) => (
          <li key={rule.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <p className="min-w-0 flex-1 text-[13px] text-foreground">{rule.dataClass}</p>
            <span className="num text-[12px] text-muted-foreground">
              {rule.retentionMonths} months · {rule.disposalMethod}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function NotificationsPanel({
  settings,
  onToggle,
}: {
  settings: PlatformSettings;
  onToggle: (id: string) => void;
}) {
  return (
    <Section
      title="Notification matrix"
      description="Channels used to notify candidates, clients and internal teams."
      padded={false}
    >
      <ul className="divide-y divide-border">
        {settings.notifications.map((pref) => (
          <li key={pref.id} className="flex items-center gap-4 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-foreground">{pref.event}</p>
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                {pref.channel.replace("_", " ")}
              </p>
            </div>
            <Switch
              checked={pref.enabled}
              onCheckedChange={() => onToggle(pref.id)}
              aria-label={`${pref.event} via ${pref.channel}`}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-[13px] text-foreground">{value}</dd>
    </div>
  );
}
