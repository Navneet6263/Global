import type { StatusTone } from "@/lib/contracts/common";
import type { TeamMember, VendorTeamOverview } from "./vendor-team-contracts";

/** "1 of 2 active" and whether another team user can be created right now. */
export function teamCapacity(team: Pick<VendorTeamOverview, "limit" | "active">) {
  const remaining = Math.max(0, team.limit - team.active);
  return {
    remaining,
    canCreate: team.limit > 0 && remaining > 0,
    label: `${team.active} of ${team.limit} active`,
    hint:
      team.limit === 0
        ? "Team users are not enabled for your account yet. Ask the Platform Admin."
        : remaining === 0
          ? "Limit reached. Suspend a team user to free a slot, or ask the Platform Admin."
          : `${remaining} slot${remaining === 1 ? "" : "s"} left.`,
  };
}

export function memberStatus(member: Pick<TeamMember, "status" | "mustChangePassword">): {
  label: string;
  tone: StatusTone;
} {
  if (member.status === "SUSPENDED") return { label: "Suspended", tone: "warning" };
  return member.mustChangePassword
    ? { label: "Invited", tone: "info" }
    : { label: "Active", tone: "success" };
}

/** Row actions the Main Vendor may take; reactivation also needs a free slot. */
export function memberActions(
  member: Pick<TeamMember, "status">,
  team: Pick<VendorTeamOverview, "limit" | "active">,
) {
  const suspended = member.status === "SUSPENDED";
  return {
    canSuspend: !suspended,
    canReactivate: suspended && teamCapacity(team).canCreate,
    canReset: true,
  };
}
