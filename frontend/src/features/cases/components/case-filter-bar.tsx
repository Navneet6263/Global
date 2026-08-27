"use client";

import { Columns3, Download, Filter, Search, X } from "lucide-react";
import type { CaseQuery } from "@/lib/contracts/case";
import type { CaseColumnId } from "../config/table";
import {
  CASE_COLUMNS,
  PRIORITY_OPTIONS,
  SAVED_VIEWS,
  SLA_OPTIONS,
  STAGE_OPTIONS,
} from "../config/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface CaseFilterBarProps {
  query: CaseQuery;
  clients: readonly { value: string; label: string }[];
  visibleColumns: readonly CaseColumnId[];
  activeView: string;
  onQueryChange: (patch: Partial<CaseQuery>) => void;
  onViewChange: (viewId: string) => void;
  onToggleColumn: (id: CaseColumnId) => void;
  onExport: () => void;
  onReset: () => void;
}

export function CaseFilterBar({
  query,
  clients,
  visibleColumns,
  activeView,
  onQueryChange,
  onViewChange,
  onToggleColumn,
  onExport,
  onReset,
}: CaseFilterBarProps) {
  return (
    <div className="space-y-4 border-b border-border px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        {SAVED_VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            title={view.description}
            onClick={() => onViewChange(view.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              activeView === view.id
                ? "border-primary/35 bg-primary/12 text-accent-foreground"
                : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            {view.label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="size-3.5" aria-hidden />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Visible columns
              </DropdownMenuLabel>
              {CASE_COLUMNS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={visibleColumns.includes(column.id)}
                  disabled={column.alwaysVisible}
                  onCheckedChange={() => onToggleColumn(column.id)}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="size-3.5" aria-hidden />
            Export
          </Button>
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div className="relative xl:col-span-2">
          <Label htmlFor="case-search" className="sr-only">
            Search cases
          </Label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="case-search"
            value={query.search ?? ""}
            onChange={(event) => onQueryChange({ search: event.target.value, page: 1 })}
            placeholder="Candidate, case number, client or owner"
            className="h-9 rounded-xl pl-9"
          />
        </div>

        <FilterSelect
          label="Stage"
          value={query.stage ?? "all"}
          options={STAGE_OPTIONS}
          onChange={(value) => onQueryChange({ stage: value as CaseQuery["stage"], page: 1 })}
        />
        <FilterSelect
          label="Client"
          value={query.clientId ?? "all"}
          options={[{ value: "all", label: "All clients" }, ...clients]}
          onChange={(value) => onQueryChange({ clientId: value, page: 1 })}
        />
        <FilterSelect
          label="Priority"
          value={query.priority ?? "all"}
          options={PRIORITY_OPTIONS}
          onChange={(value) => onQueryChange({ priority: value as CaseQuery["priority"], page: 1 })}
        />
        <FilterSelect
          label="SLA"
          value={query.sla ?? "all"}
          options={SLA_OPTIONS}
          onChange={(value) => onQueryChange({ sla: value as CaseQuery["sla"], page: 1 })}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="case-from" className="text-[11px] text-muted-foreground">
            Updated from
          </Label>
          <Input
            id="case-from"
            type="date"
            value={query.from ?? ""}
            onChange={(event) => onQueryChange({ from: event.target.value, page: 1 })}
            className="h-9 w-40 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="case-to" className="text-[11px] text-muted-foreground">
            Updated to
          </Label>
          <Input
            id="case-to"
            type="date"
            value={query.to ?? ""}
            onChange={(event) => onQueryChange({ to: event.target.value, page: 1 })}
            className="h-9 w-40 rounded-xl"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onReset} className="mb-0.5">
          <X className="size-3.5" aria-hidden />
          Clear filters
        </Button>
        <span className="mb-1.5 ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Filter className="size-3.5" aria-hidden />
          Filters apply to the register and export
        </span>
      </div>
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full rounded-xl">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
