import type { Disposition } from "./colour-codes";

/** Report colour codes (BGV process) with swatch colours, in legend order. */
export const COLOUR_CODES: Array<{ value: Disposition; label: string; hex: string }> = [
  { value: "GREEN", label: "Clear", hex: "#16a34a" },
  { value: "BLUE", label: "Verified verbally", hex: "#2563eb" },
  { value: "YELLOW", label: "Minor discrepancy", hex: "#ca8a04" },
  { value: "RED", label: "Major discrepancy", hex: "#dc2626" },
  { value: "AMBER", label: "Orange · Insufficient / UTV", hex: "#ea580c" },
  { value: "CLIENT_REVIEW", label: "Client review", hex: "#64748b" },
];

export const hexFor = (colour: string | null) =>
  COLOUR_CODES.find((item) => item.value === colour)?.hex ?? "#cbd5e1";
