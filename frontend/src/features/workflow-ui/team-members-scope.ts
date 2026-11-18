export interface ScopedTeam {
  id: string;
  memberRole: "VERIFIER" | "DATA_ENTRY";
}

/**
 * Which teams the Team members page shows: Data Entry teams on the Data Entry page, and on the
 * Verifier page only the team the Team Leader is working as (all verification teams when none is
 * chosen). A Team Leader of five teams working as "TL Vendor" sees the Vendor team only.
 */
export function visibleTeamsFor<T extends ScopedTeam>(
  teams: readonly T[],
  workspace: "verifier" | "data-entry",
  activeDepartmentId?: string,
): T[] {
  const ofWorkspace = teams.filter((team) =>
    workspace === "data-entry" ? team.memberRole === "DATA_ENTRY" : team.memberRole === "VERIFIER",
  );
  if (workspace === "verifier" && activeDepartmentId) {
    const active = ofWorkspace.filter((team) => team.id === activeDepartmentId);
    if (active.length) return active;
  }
  return ofWorkspace.length ? ofWorkspace : [...teams];
}
