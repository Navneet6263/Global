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
 * any discount. Check prices always add up to the package, so removing a check always
 * lowers the case: checks without their own price share what the priced checks leave,
 * and every check is scaled by the same ratio to the client's price. A package with no
 * price of its own (and no agreed rate above zero) costs the total of its checks.
 */
export function effectivePackagePricing(input: {
  listPrice: DecimalLike;
  agreedPrice?: DecimalLike;
  checks: readonly string[];
  checkPrices: Record<string, number>;
  discountPercent?: DecimalLike;
}) {
  const priced = input.checks.filter(
    (check) => input.checkPrices[check] !== undefined,
  );
  const pricedTotal = priced.reduce(
    (sum, check) => sum + input.checkPrices[check]!,
    0,
  );
  const list = num(input.listPrice) ?? 0;
  const rate = num(input.agreedPrice);
  const basis = list > 0 ? list : rate || pricedTotal;
  const agreed = list > 0 ? (rate ?? list) : basis;
  const unpriced = input.checks.length - priced.length;
  const share = unpriced ? Math.max(basis - pricedTotal, 0) / unpriced : 0;
  const weight = (check: string) => input.checkPrices[check] ?? share;
  const weights = input.checks.reduce((sum, check) => sum + weight(check), 0);
  const discount = num(input.discountPercent) ?? 0;
  const full = discountedPrice(agreed, discount);
  const perCheck = Object.fromEntries(
    input.checks.map((check) => [
      check,
      discountedPrice(
        round(
          weights > 0
            ? (weight(check) / weights) * agreed
            : agreed / input.checks.length,
        ),
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
