"use client";

import { Search, X } from "lucide-react";
import type { CrmStage, LeadSource, OpportunityQuery, SalesOwner } from "../contracts/crm";
import { CRM_STAGES, SAVED_VIEWS, SOURCE_LABEL, STAGE_LABEL, LEAD_SOURCES } from "../config/crm";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CrmOpportunityFiltersProps {
  query: OpportunityQuery;
  owners: readonly SalesOwner[];
  onChange: (patch: Partial<OpportunityQuery>) => void;
  onReset: () => void;
}

export function CrmOpportunityFilters({
  query,
  owners,
  onChange,
  onReset,
}: CrmOpportunityFiltersProps) {
  return (
    <div className="space-y-3 rounded-[1.5rem] border border-white/80 bg-card/85 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm">
      <div className="flex flex-wrap gap-1.5">
        {SAVED_VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            title={view.description}
            onClick={() => onChange({ savedView: view.id, page: 1 })}
            className={cn(
              "rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors",
              (query.savedView ?? "all") === view.id
                ? "bg-mint-deep text-white"
                : "bg-mint-soft/70 text-mint-deep hover:bg-mint-soft",
            )}
          >
            {view.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2 lg:col-span-2">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query.search ?? ""}
            onChange={(event) => onChange({ search: event.target.value, page: 1 })}
            placeholder="Search company, contact, city or deal id"
            className="pl-9"
            aria-label="Search opportunities"
          />
        </div>

        <Select
          value={query.stage ?? "all"}
          onValueChange={(value) => onChange({ stage: value as CrmStage | "all", page: 1 })}
        >
          <SelectTrigger aria-label="Stage">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {CRM_STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {STAGE_LABEL[stage]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={query.owner ?? "all"}
          onValueChange={(value) => onChange({ owner: value, page: 1 })}
        >
          <SelectTrigger aria-label="Owner">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {owners.map((owner) => (
              <SelectItem key={owner.id} value={owner.id}>
                {owner.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={query.source ?? "all"}
          onValueChange={(value) => onChange({ source: value as LeadSource | "all", page: 1 })}
        >
          <SelectTrigger aria-label="Lead source">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {LEAD_SOURCES.map((source) => (
              <SelectItem key={source} value={source}>
                {SOURCE_LABEL[source]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={query.followUp ?? "all"}
          onValueChange={(value) =>
            onChange({ followUp: value as OpportunityQuery["followUp"], page: 1 })
          }
        >
          <SelectTrigger className="w-[190px]" aria-label="Follow-up state">
            <SelectValue placeholder="Follow-up" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any follow-up</SelectItem>
            <SelectItem value="overdue">Follow-up overdue</SelectItem>
            <SelectItem value="today">Due today</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="none">No next action</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={query.sort ?? "recent"}
          onValueChange={(value) => onChange({ sort: value as OpportunityQuery["sort"] })}
        >
          <SelectTrigger className="w-[190px]" aria-label="Sort by">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent activity</SelectItem>
            <SelectItem value="value">Deal value</SelectItem>
            <SelectItem value="probability">Probability</SelectItem>
            <SelectItem value="close">Expected close</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="sm" onClick={onReset} className="ml-auto">
          <X className="size-3.5" aria-hidden />
          Clear filters
        </Button>
      </div>
    </div>
  );
}
