/** Unique accent colour per operations metric, mirroring the Control Tower card system. */
export interface OpsAccent {
  colour: string;
  wash: string;
  fill: string;
  edge: string;
}

const accent = (l: number, c: number, h: number): OpsAccent => ({
  colour: `oklch(${l} ${c} ${h})`,
  wash: `oklch(${l} ${c} ${h} / 0.045)`,
  fill: `oklch(${l} ${c} ${h} / 0.11)`,
  edge: `oklch(${l} ${c} ${h} / 0.28)`,
});

export const OPS_ACCENTS: Record<string, OpsAccent> = {
  active: accent(0.64, 0.16, 48), // warm orange (brand)
  unassigned: accent(0.68, 0.14, 88), // olive gold
  dueToday: accent(0.58, 0.12, 250), // indigo
  slaRisk: accent(0.6, 0.17, 18), // ember red
  clarifications: accent(0.6, 0.13, 205), // steel blue
  completedToday: accent(0.62, 0.13, 168), // teal
};

export const OPS_FALLBACK_ACCENT = accent(0.62, 0.06, 60);

export function opsAccent(id: string): OpsAccent {
  return OPS_ACCENTS[id] ?? OPS_FALLBACK_ACCENT;
}
