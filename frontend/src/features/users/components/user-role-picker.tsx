import { Checkbox } from "@/components/ui/checkbox";
import { ROLES, ROLE_DEFINITIONS, type Role } from "@/config/roles";

export function UserRolePicker({
  selected,
  onChange,
}: {
  selected: readonly Role[];
  onChange: (roles: Role[]) => void;
}) {
  const toggle = (role: Role) =>
    onChange(
      selected.includes(role) ? selected.filter((entry) => entry !== role) : [...selected, role],
    );

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-foreground">Choose role</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {ROLES.map((role) => (
          <label
            key={role}
            className="flex items-start gap-2 rounded-2xl border border-border bg-muted/35 px-3 py-2.5 transition-colors hover:bg-muted/60"
          >
            <Checkbox checked={selected.includes(role)} onCheckedChange={() => toggle(role)} />
            <span className="min-w-0">
              <span className="block text-[12px] font-medium text-foreground">
                {ROLE_DEFINITIONS[role].label}
              </span>
              <span className="block text-[10px] leading-4 text-muted-foreground">
                {ROLE_DEFINITIONS[role].description}
              </span>
            </span>
          </label>
        ))}
      </div>
      {selected.length === 0 ? (
        <p className="text-[11px] text-critical-foreground">Select at least one role.</p>
      ) : null}
    </fieldset>
  );
}
