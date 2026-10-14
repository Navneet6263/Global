/** A team the person can join; Data Entry teams need the Data Entry role, the rest Verifier. */
export interface TeamOption {
  id: string;
  name: string;
  kind: string;
}

export type TeamChoice = Record<string, { lead: boolean }>;

/** Team kinds the chosen roles may join. */
export function teamKindsFor(roles: readonly string[]): string[] {
  return [
    ...(roles.includes("DATA_ENTRY") ? ["DATA_ENTRY"] : []),
    ...(roles.includes("VERIFIER") ? ["VERIFICATION"] : []),
  ];
}
