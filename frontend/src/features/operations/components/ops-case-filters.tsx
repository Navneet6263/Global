"use client";

import { Search, X } from "lucide-react";
import type { OpsCaseQuery, OpsStage } from "../contracts/case";
import { OPS_STAGE_META, OPS_STAGE_ORDER } from "../contracts/case";
import type { Option } from "@/lib/contracts/common";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OpsCaseFiltersProps {
  query: OpsCaseQuery;
  clients: readonly Option[];
  owners: readonly Option[];
  onChange: (patch: Partial<OpsCaseQuery>) => void;
  onReset: () => void;
}

export function OpsCaseFilters({ query, clients, owners, onChange, onReset }: OpsCaseFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3.5">
      <div className="relative min-w-[220px] flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query.search ?? ""}
          onChange={(event) => onChange({ search: event.target.value, page: 1 })}
          placeholder="Search candidate, case number or client"
          className="pl-9"
          aria-label="Search cases"
        />
      </div>

      <Select
        value={query.stage ?? "all"}
        onValueChange={(value) => onChange({ stage: value as OpsStage | "all", page: 1 })}
      >
        <SelectTrigger className="w-[168px]" aria-label="Filter by stage">
          <SelectValue placeholder="Stage" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stages</SelectItem>
          {OPS_STAGE_ORDER.map((stage) => (
            <SelectItem key={stage} value={stage}>
              {OPS_STAGE_META[stage].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={query.clientId ?? "all"}
        onValueChange={(value) => onChange({ clientId: value, page: 1 })}
      >
        <SelectTrigger className="w-[178px]" aria-label="Filter by client">
          <SelectValue placeholder="Client" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All clients</SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.value} value={client.value}>
              {client.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={query.sla ?? "all"}
        onValueChange={(value) => onChange({ sla: value as OpsCaseQuery["sla"], page: 1 })}
      >
        <SelectTrigger className="w-[150px]" aria-label="Filter by SLA state">
          <SelectValue placeholder="SLA" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any SLA state</SelectItem>
          <SelectItem value="healthy">On track</SelectItem>
          <SelectItem value="approaching">At risk</SelectItem>
          <SelectItem value="overdue">Overdue</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={query.priority ?? "all"}
        onValueChange={(value) =>
          onChange({ priority: value as OpsCaseQuery["priority"], page: 1 })
        }
      >
        <SelectTrigger className="w-[142px]" aria-label="Filter by priority">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any priority</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="standard">Standard</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={query.owner ?? "all"}
        onValueChange={(value) => onChange({ owner: value, page: 1 })}
      >
        <SelectTrigger className="w-[168px]" aria-label="Filter by owner">
          <SelectValue placeholder="Owner" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any owner</SelectItem>
          {owners.map((owner) => (
            <SelectItem key={owner.value} value={owner.value}>
              {owner.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant={query.unassigned ? "default" : "outline"}
        size="sm"
        onClick={() => onChange({ unassigned: !query.unassigned, page: 1 })}
      >
        Unassigned
      </Button>
      <Button
        variant={query.dueToday ? "default" : "outline"}
        size="sm"
        onClick={() => onChange({ dueToday: !query.dueToday, page: 1 })}
      >
        Due today
      </Button>
      <Button variant="ghost" size="sm" onClick={onReset}>
        <X className="size-3.5" aria-hidden />
        Reset
      </Button>
    </div>
  );
}
