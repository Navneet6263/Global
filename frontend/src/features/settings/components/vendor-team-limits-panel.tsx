import { useState } from "react";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VendorTeamLimit } from "@/lib/backend-api/settings";
import { useUpdateVendorTeamLimit, useVendorTeamLimits } from "../hooks/use-vendor-team-limits";

/**
 * Platform Admin sets, per Main Vendor, how many ACTIVE team logins it may create.
 * The server refuses a limit below the vendor's current active team.
 */
export function VendorTeamLimitsPanel() {
  const limits = useVendorTeamLimits();
  const save = useUpdateVendorTeamLimit();
  return (
    <Section
      title="Vendor team limits"
      description="How many active team user IDs each vendor may create and manage from its own workspace. 0 turns team users off. Every change is audited."
      padded={false}
    >
      {limits.isError ? (
        <div className="p-5">
          <ErrorState
            description={limits.error.message}
            onRetry={() => void limits.refetch()}
            retrying={limits.isFetching}
          />
        </div>
      ) : !limits.data ? (
        <div className="p-5">
          <ListSkeleton rows={3} />
        </div>
      ) : !limits.data.items.length ? (
        <p className="px-5 py-4 text-xs text-muted-foreground">No vendor IDs yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {limits.data.items.map((vendor) => (
            <LimitRow
              key={`${vendor.id}-${vendor.version}`}
              vendor={vendor}
              max={limits.data.maxLimit}
              busy={save.isPending && save.variables?.vendorId === vendor.id}
              onSave={(maxActiveUsers) =>
                save.mutate({ vendorId: vendor.id, maxActiveUsers, version: vendor.version })
              }
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function LimitRow({
  vendor,
  max,
  busy,
  onSave,
}: {
  vendor: VendorTeamLimit;
  max: number;
  busy: boolean;
  onSave: (limit: number) => void;
}) {
  const [value, setValue] = useState(String(vendor.limit));
  const limit = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(limit) && limit >= 0 && limit <= max;
  const belowActive = valid && limit < vendor.activeTeamUsers;
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground">{vendor.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {vendor.email} · Active team users: {vendor.activeTeamUsers} / {vendor.limit}
          {vendor.inactiveTeamUsers ? ` · ${vendor.inactiveTeamUsers} suspended` : ""}
        </p>
        {belowActive ? (
          <p className="mt-0.5 text-[10px] text-critical-foreground">
            Suspend some team users before lowering the limit below {vendor.activeTeamUsers}.
          </p>
        ) : null}
      </div>
      {vendor.status !== "ACTIVE" ? <StatusBadge label="Suspended" tone="warning" /> : null}
      <Input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label={`Team limit for ${vendor.name}`}
        className="h-8 w-20 text-xs"
      />
      <Button
        type="button"
        size="sm"
        disabled={!valid || belowActive || limit === vendor.limit || busy}
        loading={busy}
        onClick={() => onSave(limit)}
      >
        Save
      </Button>
    </li>
  );
}
