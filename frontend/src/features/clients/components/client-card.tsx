"use client";

import { Building2, MoreHorizontal } from "lucide-react";
import type { ClientOrganisation } from "@/lib/contracts/client";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatInr, formatNumber, formatPercent, formatRelativeToNow } from "@/lib/formatting";
import { CLIENT_STATUS_META } from "../client-status-meta";

interface ClientCardProps {
  client: ClientOrganisation;
  onOpen: (id: string) => void;
  onToggleStatus: (client: ClientOrganisation) => void;
}

export function ClientCard({ client, onOpen, onToggleStatus }: ClientCardProps) {
  const status = CLIENT_STATUS_META[client.status];

  return (
    <article className="surface flex h-full flex-col gap-4 p-5">
      <header className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Building2 className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{client.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {client.industry} · {client.city}
          </p>
        </div>
        <StatusBadge label={status.label} tone={status.tone} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${client.name}`}>
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-2xl">
            <DropdownMenuItem onSelect={() => onOpen(client.id)}>View account</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onToggleStatus(client)}>
              {client.status === "suspended" ? "Reactivate client" : "Suspend client"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Metric label="Active cases" value={formatNumber(client.activeCases)} />
        <Metric label="Cases MTD" value={formatNumber(client.caseVolumeMtd)} />
        <Metric label="SLA attainment" value={formatPercent(client.slaAttainment)} />
        <Metric
          label="Outstanding"
          value={formatInr(client.billing.outstanding, { compact: true })}
        />
      </dl>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span>
          {client.primaryContact} · {client.slaCommitmentDays}-day SLA
        </span>
        <span>Active {formatRelativeToNow(client.lastActivityAt)}</span>
      </footer>

      <Button variant="outline" size="sm" onClick={() => onOpen(client.id)}>
        Open account detail
      </Button>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="num text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}
