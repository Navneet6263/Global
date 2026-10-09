/** Anything Prisma may hand back for a DECIMAL column. */
type DecimalLike = { toString(): string } | number | string | null | undefined;

const toNumber = (value: DecimalLike) =>
  value === null || value === undefined ? 0 : Number(value.toString());

/**
 * Price after a client discount, rounded to whole paise. The discount sits on top of
 * the list or contracted price and never changes which packages a client may use.
 */
export function discountedPrice(base: DecimalLike, percent: DecimalLike) {
  const price = toNumber(base);
  const off = Math.min(Math.max(toNumber(percent), 0), 100);
  return Math.round(price * (100 - off)) / 100;
}

export function discountFor(
  discounts:
    | ReadonlyArray<{ servicePackageId: bigint; discountPercent: DecimalLike }>
    | undefined,
  servicePackageId: bigint,
) {
  return (discounts ?? []).find(
    (row) => row.servicePackageId === servicePackageId,
  )?.discountPercent;
}
