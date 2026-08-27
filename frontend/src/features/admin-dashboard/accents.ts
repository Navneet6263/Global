/** Unique accent colour per Control Tower summary card, so each box reads distinctly. */
export interface CardAccent {
  /** Chart stroke / gradient colour. */
  colour: string;
  /** Soft tint used for the card wash. */
  wash: string;
  /** Slightly stronger tint for icon / card backgrounds. */
  fill: string;
  /** Hairline colour for the card's accent edge. */
  edge: string;
  /** Brighter glow tint for hero washes. */
  glow: string;
}

const accent = (l: number, c: number, h: number): CardAccent => ({
  colour: `oklch(${l} ${c} ${h})`,
  wash: `oklch(${l} ${c} ${h} / 0.045)`,
  fill: `oklch(${l} ${c} ${h} / 0.11)`,
  edge: `oklch(${l} ${c} ${h} / 0.28)`,
  glow: `oklch(${Math.min(l + 0.28, 0.96)} ${c * 0.5} ${h} / 0.42)`,
});

export const CARD_ACCENTS: Record<string, CardAccent> = {
  portfolio: accent(0.64, 0.16, 48), // warm orange (brand)
  "sla-health": accent(0.62, 0.13, 168), // teal
  "completion-time": accent(0.58, 0.12, 250), // indigo
  "client-action": accent(0.68, 0.14, 88), // olive gold
  "completed-month": accent(0.6, 0.13, 205), // steel blue
  "critical-exceptions": accent(0.6, 0.17, 18), // ember red
};

export const FALLBACK_ACCENT = accent(0.62, 0.06, 60);

export function cardAccent(id: string): CardAccent {
  return CARD_ACCENTS[id] ?? FALLBACK_ACCENT;
}
