import type { OpsTeamMember } from "../contracts/operations";

export type LoadState = "overdue" | "full" | "busy" | "free";

/** One plain word for how loaded a person is; overdue work always comes first. */
export function loadState(member: OpsTeamMember): LoadState {
  if (member.overdue > 0) return "overdue";
  if (member.relativeLoadPercent >= 90) return "full";
  if (member.relativeLoadPercent >= 60) return "busy";
  return "free";
}

export const LOAD_LABEL: Record<LoadState, string> = {
  overdue: "Has overdue",
  full: "At capacity",
  busy: "Busy",
  free: "Has room",
};

export type TeamSort = "load" | "overdue" | "name";

export function filterTeam(
  members: readonly OpsTeamMember[],
  input: { search: string; branch: string; state: LoadState | "all"; sort: TeamSort },
) {
  const text = input.search.trim().toLowerCase();
  return members
    .filter(
      (member) =>
        (!text ||
          member.name.toLowerCase().includes(text) ||
          member.role.toLowerCase().includes(text)) &&
        (input.branch === "all" || member.branch === input.branch) &&
        (input.state === "all" || loadState(member) === input.state),
    )
    .sort((a, b) =>
      input.sort === "name"
        ? a.name.localeCompare(b.name)
        : input.sort === "overdue"
          ? b.overdue - a.overdue || b.activeChecks - a.activeChecks
          : b.relativeLoadPercent - a.relativeLoadPercent || b.overdue - a.overdue,
    );
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
}
