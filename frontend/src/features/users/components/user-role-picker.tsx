import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ROLES, ROLE_DEFINITIONS, type Role } from "@/config/roles";

const EXCLUSIVE_ROLES: readonly Role[] = ["PLATFORM_ADMIN", "CLIENT_ADMIN"];

export function UserRolePicker({
  selected,
  onChange,
}: {
  selected: readonly Role[];
  onChange: (roles: Role[]) => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const primary = selected[0];
  const additional = selected.slice(1);
  const canAddAccess = Boolean(primary && !EXCLUSIVE_ROLES.includes(primary));

  const choosePrimary = (role: Role) => {
    setAdvanced(false);
    onChange([role]);
  };
  const toggleAdditional = (role: Role) => {
    onChange(
      additional.includes(role) ? selected.filter((entry) => entry !== role) : [...selected, role],
    );
  };

  return (
    <fieldset className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <legend className="text-sm font-semibold text-foreground">Primary role</legend>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            This decides the person&apos;s home workspace and normal access.
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
          {selected.length
            ? `${selected.length} role${selected.length > 1 ? "s" : ""}`
            : "Required"}
        </span>
      </div>

      <RadioGroup
        value={primary}
        onValueChange={(value) => choosePrimary(value as Role)}
        className="grid gap-2 sm:grid-cols-2"
      >
        {ROLES.map((role) => (
          <label
            key={role}
            className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-border bg-muted/35 px-3 py-2.5 transition-colors hover:bg-muted/60 has-[[data-state=checked]]:border-primary/35 has-[[data-state=checked]]:bg-primary/5"
          >
            <RadioGroupItem value={role} className="mt-0.5" />
            <RoleCopy role={role} />
          </label>
        ))}
      </RadioGroup>

      {canAddAccess ? (
        <div className="rounded-2xl border border-border bg-background">
          <button
            type="button"
            onClick={() => {
              setAdvanced((value) => !value);
              if (advanced) onChange(primary ? [primary] : []);
            }}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left"
          >
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-foreground">
                Additional role access
              </span>
              <span className="block text-[10px] text-muted-foreground">
                Advanced: permissions from every selected role are combined.
              </span>
            </span>
            <ChevronDown
              className={`size-4 text-muted-foreground transition-transform ${advanced ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {advanced ? (
            <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2">
              {ROLES.filter((role) => role !== primary && !EXCLUSIVE_ROLES.includes(role)).map(
                (role) => (
                  <label
                    key={role}
                    className="flex cursor-pointer items-start gap-2 rounded-xl bg-muted/40 px-3 py-2"
                  >
                    <Checkbox
                      checked={additional.includes(role)}
                      onCheckedChange={() => toggleAdditional(role)}
                    />
                    <RoleCopy role={role} compact />
                  </label>
                ),
              )}
              <p className="sm:col-span-2 text-[10px] leading-4 text-warning-foreground">
                Use this only when one employee genuinely performs both jobs. Platform Admin and
                Client Admin stay exclusive to prevent cross-scope access.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {!primary ? (
        <p className="text-[11px] text-critical-foreground">Select one primary role.</p>
      ) : null}
    </fieldset>
  );
}

function RoleCopy({ role, compact = false }: { role: Role; compact?: boolean }) {
  return (
    <span className="min-w-0">
      <span className="block text-[12px] font-medium text-foreground">
        {ROLE_DEFINITIONS[role].label}
      </span>
      {!compact ? (
        <span className="block text-[10px] leading-4 text-muted-foreground">
          {ROLE_DEFINITIONS[role].description}
        </span>
      ) : null}
    </span>
  );
}
