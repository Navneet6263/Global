import { useQuery } from "@tanstack/react-query";
import { Lock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/api/auth";
import { useSpocFilters } from "../hooks/use-spoc";

export interface SpocScopeFilters {
  clientId?: string;
  branchId?: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  from?: string;
  to?: string;
}

const control =
  "h-9 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground outline-none focus:border-primary/45 focus:ring-4 focus:ring-primary/8";

/** Global client / branch / priority / window filters, all backed by real /spoc data. */
export function SpocFilterBar({
  value,
  onChange,
}: {
  value: SpocScopeFilters;
  onChange: (next: SpocScopeFilters) => void;
}) {
  const options = useSpocFilters();
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const spoc = Boolean(session.data && !session.data.roles.includes("PLATFORM_ADMIN"));
  const assigned = spoc ? (session.data?.clientScope ?? []) : [];
  // One assigned client is shown locked; several can be switched between, and the
  // options come from /spoc/filters, which the server limits to the assigned clients.
  const pinnedClient = spoc && assigned.length === 1 ? assigned[0]?.name : undefined;
  const set = (patch: Partial<SpocScopeFilters>) => onChange({ ...value, ...patch });
  const active = Object.entries(value).some(
    ([key, entry]) => Boolean(entry) && !(pinnedClient && key === "clientId"),
  );

  return (
    <section
      aria-label="Monitoring filters"
      className="flex flex-wrap items-center gap-2 rounded-[1.35rem] border border-white/80 bg-card/85 p-3 shadow-[var(--shadow-card)]"
    >
      {pinnedClient ? (
        // The server limits a SPOC-RM to its clients; this only mirrors that scope in the UI.
        <span className={`${control} inline-flex items-center gap-1.5`}>
          <Lock className="size-3.5 text-muted-foreground" aria-hidden />
          {pinnedClient}
        </span>
      ) : (
        <select
          aria-label="Client"
          className={control}
          value={value.clientId ?? ""}
          onChange={(event) => set({ clientId: event.target.value || undefined })}
        >
          <option value="">{spoc ? "All assigned clients" : "All clients"}</option>
          {options.data?.clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.displayName}
            </option>
          ))}
        </select>
      )}
      <select
        aria-label="Branch"
        className={control}
        value={value.branchId ?? ""}
        onChange={(event) => set({ branchId: event.target.value || undefined })}
      >
        <option value="">All branches</option>
        {options.data?.branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.city ? `${branch.name} · ${branch.city}` : branch.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Priority"
        className={control}
        value={value.priority ?? ""}
        onChange={(event) =>
          set({ priority: (event.target.value || undefined) as SpocScopeFilters["priority"] })
        }
      >
        <option value="">All priorities</option>
        {(["URGENT", "HIGH", "NORMAL", "LOW"] as const).map((priority) => (
          <option key={priority} value={priority}>
            {priority.charAt(0) + priority.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        Completed from
        <input
          type="date"
          className={control}
          value={value.from ?? ""}
          max={value.to}
          onChange={(event) => set({ from: event.target.value || undefined })}
        />
      </label>
      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        to
        <input
          type="date"
          className={control}
          value={value.to ?? ""}
          min={value.from}
          onChange={(event) => set({ to: event.target.value || undefined })}
        />
      </label>
      {active ? (
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onChange({})}>
          <RotateCcw className="size-3.5" aria-hidden /> Reset
        </Button>
      ) : null}
    </section>
  );
}
