import { Check } from "lucide-react";
import { ROLE_DEFINITIONS, type Role } from "@/config/roles";
import { COMING_SOON, ROLE_GUIDE, SINGLE_ROLES } from "../role-guide";

const GROUPS: ReadonlyArray<{ label: string; roles: readonly Role[] }> = [
  { label: "Delivery team", roles: ["DATA_ENTRY", "VERIFIER", "QA_REVIEWER", "FIELD_EXECUTIVE"] },
  { label: "Client facing", roles: ["SPOC_RM", "CLIENT_ADMIN"] },
  { label: "Management", roles: ["OPS_MANAGER", "FINANCE_MANAGER", "SALES_MANAGER"] },
  { label: "Other", roles: ["SUPPORT_AGENT", "VENDOR", "PLATFORM_ADMIN"] },
];

export function RoleCards({
  available,
  selected,
  onToggle,
  disabledReason,
}: {
  available: readonly Role[];
  selected: readonly Role[];
  onToggle: (role: Role) => void;
  /** A role that cannot be picked here, with the reason shown on its card. */
  disabledReason?: (role: Role) => string | null;
}) {
  return (
    <>
      {GROUPS.map((group) => {
        const list = group.roles.filter((role) => available.includes(role));
        if (!list.length) return null;
        return (
          <div key={group.label} className="cu-group">
            <p>{group.label}</p>
            <div className="cu-roles">
              {list.map((role) => {
                const guide = ROLE_GUIDE[role];
                const picked = selected.includes(role);
                const soon = COMING_SOON.includes(role) && !picked;
                const blocked = soon ? "Coming soon" : (disabledReason?.(role) ?? null);
                return (
                  <button
                    key={role}
                    type="button"
                    aria-pressed={picked}
                    disabled={Boolean(blocked)}
                    onClick={() => onToggle(role)}
                    className="cu-role"
                  >
                    <span className="cu-check">{picked ? <Check aria-hidden /> : null}</span>
                    <span className="cu-role-text">
                      <strong>
                        {ROLE_DEFINITIONS[role].label}
                        {soon ? (
                          <em className="is-soon">Coming soon</em>
                        ) : SINGLE_ROLES.includes(role) ? (
                          <em>single role</em>
                        ) : null}
                      </strong>
                      <small>{guide?.does ?? ROLE_DEFINITIONS[role].description}</small>
                      {blocked && !soon ? (
                        <small className="cu-cannot">{blocked}</small>
                      ) : guide && !soon ? (
                        <small className="cu-cannot">Cannot: {guide.cannot}</small>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
