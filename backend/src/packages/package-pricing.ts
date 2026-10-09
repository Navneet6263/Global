import { discountedPrice } from "./package-discount";

type DecimalLike = { toString(): string } | number | string | null | undefined;

const num = (value: DecimalLike) =>
  value === null || value === undefined ? null : Number(value.toString());
const round = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/** Reads {"EMPLOYMENT": 2500, ...}; anything malformed is ignored. */
export function parseCheckPrices(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" &&
          Number.isFinite(entry[1]) &&
          entry[1] >= 0,
      ),
    );
  } catch {
    return {};
  }
}

/**
 * What a client pays for a package and for each check in it, after its agreed rate and
 * any discount. Checks without their own price share the list price equally. The
 * client's agreed rate scales every check by the same ratio as the full package.
 */
export function effectivePackagePricing(input: {
  listPrice: DecimalLike;
  agreedPrice?: DecimalLike;
  checks: readonly string[];
  checkPrices: Record<string, number>;
  discountPercent?: DecimalLike;
}) {
  const list = num(input.listPrice) ?? 0;
  const agreed = num(input.agreedPrice) ?? list;
  const ratio = list > 0 ? agreed / list : 1;
  // No list price: share the agreed price instead (the ratio is then 1).
  const basis = list > 0 ? list : agreed;
  const share = input.checks.length ? basis / input.checks.length : 0;
  const discount = num(input.discountPercent) ?? 0;
  const full = discountedPrice(agreed, discount);
  const perCheck = Object.fromEntries(
    input.checks.map((check) => [
      check,
      discountedPrice(
        round((input.checkPrices[check] ?? share) * ratio),
        discount,
      ),
    ]),
  );
  return { full, perCheck };
}

/**
 * The price for the checks a case actually orders: the full package price when every
 * check is chosen, otherwise the selected checks' prices — never more than the package.
 */
export function priceForSelectedChecks(
  pricing: { full: number; perCheck: Record<string, number> },
  checks: readonly string[],
  selected: readonly string[],
) {
  const everything = checks.every((check) => selected.includes(check));
  if (everything) return pricing.full;
  return Math.min(
    pricing.full,
    round(
      selected.reduce((sum, check) => sum + (pricing.perCheck[check] ?? 0), 0),
    ),
  );
}
