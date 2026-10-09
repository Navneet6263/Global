/** Text input values per check; "" means "use an equal share of the package price". */
export type CheckPriceDraft = Record<string, string>;

export function toCheckPrices(draft: CheckPriceDraft, checks: readonly string[]) {
  const out: Record<string, number> = {};
  for (const check of checks) {
    const value = draft[check];
    if (value !== undefined && value !== "" && Number(value) >= 0) out[check] = Number(value);
  }
  return out;
}
