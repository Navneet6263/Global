import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  filterClientOptions,
  selectAllClients,
  toggleClient,
  type ScopeOption,
} from "../client-scope";

/**
 * SPOC-RM client workspaces: a searchable checkbox list. The server re-checks every
 * selected client (same tenant, active) and enforces the scope on every request.
 */
export function ClientScopePicker({
  options,
  value,
  onChange,
  error,
  disabled = false,
}: {
  options: readonly ScopeOption[];
  value: readonly string[];
  onChange: (ids: string[]) => void;
  error?: string;
  disabled?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const visible = filterClientOptions(options, filter);
  const checked = (id: string) => value.some((entry) => entry.toLowerCase() === id.toLowerCase());

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <legend className="text-xs font-medium">Client workspaces</legend>
        <span className="text-[11px] text-muted-foreground">{value.length} selected</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search clients"
          aria-label="Search clients"
          className="h-8 min-w-0 flex-1 text-xs"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(selectAllClients(value, visible))}
        >
          Select all
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
          Clear
        </Button>
      </div>
      <div
        role="group"
        aria-label="Client workspaces"
        className="grid max-h-56 gap-1 overflow-y-auto rounded-2xl border border-border p-2 sm:grid-cols-2"
      >
        {visible.length ? (
          visible.map((client) => (
            <label
              key={client.id}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs hover:bg-muted/50 has-[[data-state=checked]]:bg-primary/5"
            >
              <Checkbox
                checked={checked(client.id)}
                onCheckedChange={() => onChange(toggleClient(value, client.id))}
              />
              <span className="truncate">{client.label}</span>
            </label>
          ))
        ) : (
          <p className="p-2 text-xs text-muted-foreground">
            {options.length ? "No clients match this search." : "No active clients found."}
          </p>
        )}
      </div>
      <Label className="block text-[10px] font-normal text-muted-foreground">
        This SPOC-RM sees and manages vendor work only for the selected clients.
      </Label>
      {error ? <p className="text-[11px] text-critical-foreground">{error}</p> : null}
    </fieldset>
  );
}
