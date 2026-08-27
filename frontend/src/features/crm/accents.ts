/** Unique accent per CRM metric, sharing the Sapling Global soft-glow token system. */
export interface CrmAccent {
  colour: string;
  wash: string;
  fill: string;
  edge: string;
}

const accent = (l: number, c: number, h: number): CrmAccent => ({
  colour: `oklch(${l} ${c} ${h})`,
  wash: `oklch(${l} ${c} ${h} / 0.05)`,
  fill: `oklch(${l} ${c} ${h} / 0.12)`,
  edge: `oklch(${l} ${c} ${h} / 0.3)`,
});

export const CRM_ACCENTS: Record<string, CrmAccent> = {
  openPipeline: accent(0.62, 0.13, 168), // revenue green
  weightedForecast: accent(0.64, 0.16, 48), // brand orange
  closedWon: accent(0.6, 0.14, 145), // deep mint
  winRate: accent(0.58, 0.12, 250), // indigo
  overdueFollowUps: accent(0.6, 0.17, 18), // ember
  activeOwners: accent(0.6, 0.12, 205), // steel blue
};

export const CRM_FALLBACK_ACCENT = accent(0.62, 0.06, 60);

export function crmAccent(id: string): CrmAccent {
  return CRM_ACCENTS[id] ?? CRM_FALLBACK_ACCENT;
}

export const STAGE_ACCENT_KEYS: readonly string[] = [
  "activeOwners",
  "winRate",
  "weightedForecast",
  "overdueFollowUps",
  "closedWon",
  "openPipeline",
];
