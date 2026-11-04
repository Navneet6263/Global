import { Check, Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatInr } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import type { CheckPriceDraft } from "./check-prices";
import {
  CHECK_CATALOGUE,
  catalogueCheck,
  defaultOptions,
  type CatalogueCheck,
  type CheckGroup,
  type CheckOptions,
} from "./check-catalogue";
import { PackageDocumentSummary } from "./PackageDocumentSummary";

const round = (value: number) => Math.round(value * 100) / 100;

const GROUPS: readonly CheckGroup[] = [
  "Identity",
  "Address",
  "Employment",
  "Education",
  "Court & police",
  "Databases",
  "Financial",
  "Other",
];

/** Checks on the price sheet; the rest sit under "More checks". */
const onSheet = (entry: CatalogueCheck) => entry.price !== undefined;

/**
 * The package builder: checks grouped as on the price sheet. Ticking a check opens its
 * price (pre-filled from the sheet, always editable) and its options on the same row: which
 * IDs, addresses or qualifications, how many employers or references, which drug panel.
 * Below, the documents the candidate will upload and why. A case that orders fewer checks
 * pays only those; an empty price box shares what the priced checks leave of the package.
 */
export function PackageCheckPricing({
  allChecks,
  selected,
  onToggle,
  prices,
  onPrices,
  options,
  onOptions,
  extraDocuments = [],
  packagePrice,
  onPackagePrice,
  taxRate,
  onTaxRate,
  onTatDays,
  showPrices = true,
}: {
  allChecks: readonly string[];
  selected: readonly string[];
  onToggle: (check: string) => void;
  prices: CheckPriceDraft;
  onPrices: (value: CheckPriceDraft) => void;
  options: Readonly<Record<string, CheckOptions>>;
  onOptions: (value: Record<string, CheckOptions>) => void;
  /** Documents asked for besides the checks' own (shown in the summary). */
  extraDocuments?: readonly string[];
  packagePrice: number | null;
  /** Lets "Use the total as the package price" fill the package price. */
  onPackagePrice?: (value: string) => void;
  taxRate: string;
  onTaxRate: (value: string) => void;
  /** Lets "Use the longest check TAT" fill the package TAT (working days). */
  onTatDays?: (value: string) => void;
  /** Without commercial fields (Settings) only checks and options are set. */
  showPrices?: boolean;
}) {
  const catalogue = CHECK_CATALOGUE.filter((entry) => allChecks.includes(entry.type));
  const ordered = catalogue.map((entry) => entry.type).filter((type) => selected.includes(type));
  const priced = ordered.filter((check) => (prices[check] ?? "") !== "");
  const pricedSum = priced.reduce((total, check) => total + Number(prices[check]), 0);
  const empty = ordered.length - priced.length;
  const share = packagePrice && empty ? Math.max(packagePrice - pricedSum, 0) / empty : null;
  const sum = ordered.reduce((total, check) => {
    const own = prices[check];
    return total + (own !== undefined && own !== "" ? Number(own) : (share ?? 0));
  }, 0);
  const gst = Number(taxRate) || 0;
  const longestTat = Math.max(0, ...ordered.map((type) => catalogueCheck(type)?.tatDays ?? 0));

  const toggle = (entry: CatalogueCheck) => {
    const on = selected.includes(entry.type);
    onToggle(entry.type);
    if (on) return;
    // A newly ticked check starts from the sheet's price and its default options.
    if (showPrices && entry.price !== undefined && (prices[entry.type] ?? "") === "")
      onPrices({ ...prices, [entry.type]: String(entry.price) });
    const preset = defaultOptions(entry.type);
    if (preset && !options[entry.type]) onOptions({ ...options, [entry.type]: preset });
  };
  const setOption = (type: string, value: CheckOptions) => onOptions({ ...options, [type]: value });

  const row = (entry: CatalogueCheck) => {
    const on = selected.includes(entry.type);
    return (
      <li
        key={entry.type}
        className={cn("px-4 py-2.5 transition", on ? "bg-blue-50/40" : "hover:bg-slate-50")}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <label className="flex min-w-0 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={on}
              onChange={() => toggle(entry)}
              aria-label={entry.label}
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
            <span className="min-w-0">
              <span
                className={cn(
                  "block truncate text-[13px]",
                  on ? "font-semibold text-slate-900" : "text-slate-700",
                )}
              >
                {entry.label}
              </span>
              {entry.price !== undefined || entry.tatDays !== undefined ? (
                <span className="block text-[11px] text-slate-500">
                  {entry.price !== undefined ? `Sheet ${formatInr(entry.price)}` : ""}
                  {entry.priceNote ? ` ${entry.priceNote}` : ""}
                  {entry.tatDays !== undefined ? ` · ${entry.tatDays} working days` : ""}
                </span>
              ) : null}
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
                value={prices[entry.type] ?? ""}
                onChange={(event) => onPrices({ ...prices, [entry.type]: event.target.value })}
                aria-label={`${entry.label} price`}
              />
            </span>
          ) : showPrices ? (
            <span className="text-[11.5px] text-slate-400">Not included</span>
          ) : null}
        </div>
        {on && entry.option ? (
          <CheckOptionControl
            entry={entry}
            value={options[entry.type] ?? defaultOptions(entry.type) ?? {}}
            onChange={(value) => {
              const before = options[entry.type]?.panel ?? "5";
              setOption(entry.type, value);
              // Changing the drug panel moves the price with it, unless it was edited.
              if (showPrices && entry.option?.kind === "PANEL" && value.panel !== before) {
                const price = (panel: string) =>
                  entry.option?.choices?.find((choice) => choice.value === panel)?.price;
                const current = prices[entry.type] ?? "";
                if (current === "" || Number(current) === price(before))
                  onPrices({ ...prices, [entry.type]: String(price(value.panel ?? "5") ?? "") });
              }
            }}
          />
        ) : null}
      </li>
    );
  };

  const more = catalogue.filter((entry) => !onSheet(entry));
  return (
    <div className="space-y-4">
      <section
        className="rounded-2xl border border-slate-200 bg-white"
        aria-label="Checks and prices"
      >
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-[13px] font-semibold text-slate-900">Checks in this package</h3>
            <p className="text-[11.5px] text-slate-500">
              {showPrices
                ? "Tick a check: its price comes from the price sheet and you can change it. Leave a price empty to share what is left of the package price."
                : "Tick every check this package includes, and set what each one covers."}
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11.5px] font-semibold text-blue-700">
            {ordered.length} of {catalogue.length} selected
          </span>
        </header>
        {GROUPS.map((group) => {
          const entries = catalogue.filter((entry) => entry.group === group && onSheet(entry));
          if (!entries.length) return null;
          return (
            <div key={group} className="border-b border-slate-100 last:border-0">
              <p className="bg-slate-50/70 px-4 py-1.5 text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase">
                {group}
              </p>
              <ul className="divide-y divide-slate-100">{entries.map(row)}</ul>
            </div>
          );
        })}
        {more.length ? (
          <details
            className="group border-t border-slate-100"
            open={more.some((entry) => selected.includes(entry.type)) || undefined}
          >
            <summary className="cursor-pointer px-4 py-2 text-[12px] font-semibold text-slate-600 hover:text-slate-900">
              More checks ({more.length}) — not on the price sheet
            </summary>
            <ul className="divide-y divide-slate-100">{more.map(row)}</ul>
          </details>
        ) : null}
        <footer className="grid gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
          {showPrices ? (
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
          ) : (
            <span />
          )}
          <dl className="grid gap-0.5 text-right text-[12px] text-slate-600">
            {showPrices ? (
              <>
                <div>
                  <dt className="inline">Checks bought one by one: </dt>
                  <dd className="inline font-semibold text-slate-900">{formatInr(round(sum))}</dd>
                  {priced.length < ordered.length && share ? (
                    <span className="text-slate-400">
                      {" "}
                      (empty boxes use {formatInr(round(share))})
                    </span>
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
                {packagePrice !== null &&
                packagePrice > 0 &&
                ordered.length > 0 &&
                Math.abs(round(sum) - packagePrice) >= 0.01 ? (
                  <p className="text-[11.5px] font-medium text-amber-700">
                    The checks do not add up to the package, so cases adjust each check to fit it.
                    Removing a check then takes off more or less than its price here.
                  </p>
                ) : null}
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
              </>
            ) : null}
            {onTatDays && longestTat > 0 ? (
              <div>
                <span>Longest check: {longestTat} working days · </span>
                <button
                  type="button"
                  className="text-[12px] font-semibold text-blue-700 hover:underline"
                  onClick={() => onTatDays(String(longestTat))}
                >
                  Use as the package TAT
                </button>
              </div>
            ) : null}
          </dl>
        </footer>
      </section>
      <PackageDocumentSummary checks={ordered} options={options} extraDocuments={extraDocuments} />
    </div>
  );
}

/** The option row under a ticked check. */
function CheckOptionControl({
  entry,
  value,
  onChange,
}: {
  entry: CatalogueCheck;
  value: CheckOptions;
  onChange: (value: CheckOptions) => void;
}) {
  const rule = entry.option!;
  const label = <span className="text-[11px] font-medium text-slate-500">{rule.label}:</span>;
  if (rule.kind === "COUNT") {
    const count = value.count ?? 1;
    const max = rule.max ?? 5;
    return (
      <div className="mt-2 ml-8 flex items-center gap-2">
        {label}
        <span className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            className="grid size-7 place-items-center text-slate-500 hover:text-slate-900 disabled:opacity-40"
            disabled={count <= 1}
            onClick={() => onChange({ count: count - 1 })}
            aria-label={`Fewer: ${entry.label}`}
          >
            <Minus className="size-3.5" />
          </button>
          <span
            className="w-6 text-center text-[12.5px] font-semibold tabular-nums"
            aria-live="polite"
          >
            {count}
          </span>
          <button
            type="button"
            className="grid size-7 place-items-center text-slate-500 hover:text-slate-900 disabled:opacity-40"
            disabled={count >= max}
            onClick={() => onChange({ count: count + 1 })}
            aria-label={`More: ${entry.label}`}
          >
            <Plus className="size-3.5" />
          </button>
        </span>
      </div>
    );
  }
  if (rule.kind === "PANEL") {
    return (
      <label className="mt-2 ml-8 flex items-center gap-2">
        {label}
        <select
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12.5px]"
          value={value.panel ?? "5"}
          onChange={(event) => onChange({ panel: event.target.value })}
          aria-label={`${entry.label} panel`}
        >
          {(rule.choices ?? []).map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
              {choice.price !== undefined ? ` (sheet ${formatInr(choice.price)})` : ""}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const key = rule.kind === "LEVELS" ? "levels" : rule.kind === "ADDRESSES" ? "addresses" : "ids";
  const picked = value[key] ?? [];
  return (
    <div
      className="mt-2 ml-8 flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label={`${entry.label}: ${rule.label}`}
    >
      {label}
      {(rule.choices ?? []).map((choice) => {
        const on = picked.includes(choice.value);
        return (
          <button
            key={choice.value}
            type="button"
            aria-pressed={on}
            // At least one stays picked.
            disabled={on && picked.length === 1}
            onClick={() =>
              onChange({
                [key]: on
                  ? picked.filter((item) => item !== choice.value)
                  : (rule.choices ?? [])
                      .map((item) => item.value)
                      .filter((item) => item === choice.value || picked.includes(item)),
              })
            }
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium transition disabled:cursor-not-allowed",
              on
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
