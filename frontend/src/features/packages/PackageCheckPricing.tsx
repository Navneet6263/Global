import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatInr } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import type { CheckPriceDraft } from "./check-prices";

const readable = (check: string) =>
  check
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Checks and their prices in one list: tick a check and its own price box opens on the same
 * row. A case that orders fewer checks pays only those (never more than the package); an
 * empty box uses an equal share of the package price.
 */
export function PackageCheckPricing({
  allChecks,
  selected,
  onToggle,
  prices,
  onPrices,
  packagePrice,
  onPackagePrice,
  taxRate,
  onTaxRate,
  showPrices = true,
}: {
  allChecks: readonly string[];
  selected: readonly string[];
  onToggle: (check: string) => void;
  prices: CheckPriceDraft;
  onPrices: (value: CheckPriceDraft) => void;
  packagePrice: number | null;
  /** Lets "Use the total as the package price" fill the package price. */
  onPackagePrice?: (value: string) => void;
  taxRate: string;
  onTaxRate: (value: string) => void;
  /** Without commercial fields (Settings) only the checks are ticked. */
  showPrices?: boolean;
}) {
  const ordered = allChecks.filter((check) => selected.includes(check));
  const share = packagePrice && ordered.length ? packagePrice / ordered.length : null;
  const priced = ordered.filter((check) => (prices[check] ?? "") !== "");
  const sum = ordered.reduce((total, check) => {
    const own = prices[check];
    return total + (own !== undefined && own !== "" ? Number(own) : (share ?? 0));
  }, 0);
  const gst = Number(taxRate) || 0;
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white"
      aria-label="Checks and prices"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-[13px] font-semibold text-slate-900">Checks in this package</h3>
          <p className="text-[11.5px] text-slate-500">
            {showPrices
              ? "Tick a check, then give it its own price. Leave a price empty to use an equal share."
              : "Tick every check this package includes."}
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11.5px] font-semibold text-blue-700">
          {ordered.length} of {allChecks.length} selected
        </span>
      </header>
      <ul className="divide-y divide-slate-100">
        {allChecks.map((check) => {
          const on = selected.includes(check);
          const name = readable(check);
          return (
            <li
              key={check}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 transition",
                on ? "bg-blue-50/40" : "hover:bg-slate-50",
              )}
            >
              <label className="flex min-w-0 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={on}
                  onChange={() => onToggle(check)}
                  aria-label={name}
                />
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-md border transition peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40",
                    on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white",
                  )}
                  aria-hidden
                >
                  {on ? <Check className="size-3.5" /> : null}
                </span>
                <span
                  className={cn(
                    "truncate text-[13px]",
                    on ? "font-semibold text-slate-900" : "text-slate-600",
                  )}
                >
                  {name}
                </span>
              </label>
              {showPrices && on ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-[12px] text-slate-400" aria-hidden>
                    ₹
                  </span>
                  <Input
                    type="number"
                    min="0"
                    inputMode="decimal"
                    className="h-8 w-28 text-right"
                    placeholder={share ? String(round(share)) : "Price"}
                    value={prices[check] ?? ""}
                    onChange={(event) => onPrices({ ...prices, [check]: event.target.value })}
                    aria-label={`${name} price`}
                  />
                </span>
              ) : showPrices ? (
                <span className="text-[11.5px] text-slate-400">Not included</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {showPrices ? (
        <footer className="grid gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
          <label className="grid gap-1 text-[11.5px] text-slate-500">
            GST %
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              className="h-8 w-24"
              value={taxRate}
              onChange={(event) => onTaxRate(event.target.value)}
              aria-label="GST percent"
            />
          </label>
          <dl className="grid gap-0.5 text-right text-[12px] text-slate-600">
            <div>
              <dt className="inline">Checks bought one by one: </dt>
              <dd className="inline font-semibold text-slate-900">{formatInr(round(sum))}</dd>
              {priced.length < ordered.length && share ? (
                <span className="text-slate-400"> (empty boxes use {formatInr(round(share))})</span>
              ) : null}
            </div>
            <div>
              <dt className="inline">Full package: </dt>
              <dd className="inline font-semibold text-slate-900">
                {packagePrice !== null ? formatInr(packagePrice) : "Set a package price"}
              </dd>
              {packagePrice !== null ? (
                <span className="text-slate-400">
                  {" "}
                  · {formatInr(round(packagePrice * (1 + gst / 100)))} with GST
                </span>
              ) : null}
            </div>
            {onPackagePrice && priced.length === ordered.length && ordered.length > 0 ? (
              <div>
                <button
                  type="button"
                  className="text-[12px] font-semibold text-blue-700 hover:underline"
                  onClick={() => onPackagePrice(String(round(sum)))}
                >
                  Use the total ({formatInr(round(sum))}) as the package price
                </button>
              </div>
            ) : null}
          </dl>
        </footer>
      ) : null}
    </section>
  );
}
