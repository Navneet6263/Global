/**
 * Vendor earnings: what a vendor has earned in a month. A check counts in the month the
 * case RM accepted its result (status APPROVED, `reviewedAt`), at its payment plus the
 * extra costs the RM approved. Months follow India time (IST, UTC+5:30).
 */

const IST_OFFSET_MS = 330 * 60_000;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "2026-11" for a moment, in India time. */
export function istMonth(at: Date): string {
  const ist = new Date(at.getTime() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The UTC moments where an IST month starts and the next one starts; null if malformed. */
export function istMonthRange(month: string): { from: Date; to: Date } | null {
  const match = MONTH.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const index = Number(match[2]) - 1;
  return {
    from: new Date(Date.UTC(year, index, 1) - IST_OFFSET_MS),
    to: new Date(Date.UTC(year, index + 1, 1) - IST_OFFSET_MS),
  };
}

export interface EarningSource {
  id: string;
  caseNumber: string;
  checkType: string;
  city: string | null;
  pincode: string | null;
  handler: { name: string } | null;
  reviewedAt: Date | null;
  price: number | null;
  fromQueue: boolean;
  extraCosts: Array<{ amount: number; status: string }>;
}

const sum = (values: number[]) =>
  Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;

/** One line per accepted check, plus the month's totals. */
export function earningsFor(rows: readonly EarningSource[]) {
  const items = rows.map((row) => {
    const base = row.price ?? 0;
    const extra = sum(
      row.extraCosts
        .filter((cost) => cost.status === "APPROVED")
        .map((cost) => cost.amount),
    );
    return {
      id: row.id,
      caseNumber: row.caseNumber,
      checkType: row.checkType,
      city: row.city,
      pincode: row.pincode,
      handledBy: row.handler?.name ?? null,
      acceptedAt: row.reviewedAt,
      fromQueue: row.fromQueue,
      /** Sent straight to the vendor with no payment saved: Finance confirms the rate. */
      rateToConfirm: row.price === null,
      payment: base,
      extra,
      total: sum([base, extra]),
    };
  });
  return {
    items,
    totals: {
      checks: items.length,
      payment: sum(items.map((item) => item.payment)),
      extra: sum(items.map((item) => item.extra)),
      total: sum(items.map((item) => item.total)),
      rateToConfirm: items.filter((item) => item.rateToConfirm).length,
    },
  };
}

/** Work already submitted but not yet accepted: what is on its way. */
export function inReviewValue(
  rows: ReadonlyArray<Pick<EarningSource, "price" | "extraCosts">>,
) {
  return {
    checks: rows.length,
    value: sum(
      rows.map(
        (row) =>
          (row.price ?? 0) +
          sum(
            row.extraCosts
              .filter((cost) => cost.status !== "REJECTED")
              .map((cost) => cost.amount),
          ),
      ),
    ),
  };
}
