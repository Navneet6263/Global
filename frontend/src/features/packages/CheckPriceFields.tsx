import { Input } from "@/components/ui/input";
import { formatInr } from "@/lib/formatting";
import type { CheckPriceDraft } from "./check-prices";

/**
 * Price of each check on its own. A case that orders fewer checks pays the sum of these
 * (never more than the package); an empty box uses an equal share of the package price.
 */
export function CheckPriceFields({
  checks,
  value,
  onChange,
  packagePrice,
  taxRate,
  onTaxRate,
}: {
  checks: readonly string[];
  value: CheckPriceDraft;
  onChange: (value: CheckPriceDraft) => void;
  packagePrice: number | null;
  taxRate: string;
  onTaxRate: (value: string) => void;
}) {
  const share = packagePrice && checks.length ? packagePrice / checks.length : null;
  const sum = checks.reduce((total, check) => {
    const own = value[check];
    return total + (own !== undefined && own !== "" ? Number(own) : (share ?? 0));
  }, 0);
  return (
    <fieldset className="space-y-2 rounded-xl border border-border p-3">
      <legend className="px-1 text-xs font-medium">Price per check & GST</legend>
      <p className="text-[11px] leading-4 text-muted-foreground">
        A client ordering fewer checks pays only those checks (never more than the package). Leave a
        box empty to use an equal share
        {share ? ` (${formatInr(Math.round(share * 100) / 100)})` : ""}.
      </p>
      {checks.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {checks.map((check) => (
            <label key={check} className="grid gap-1 text-[11px] text-muted-foreground">
              {check.replaceAll("_", " ")}
              <Input
                type="number"
                min="0"
                inputMode="decimal"
                placeholder={share ? String(Math.round(share * 100) / 100) : "₹"}
                value={value[check] ?? ""}
                onChange={(event) => onChange({ ...value, [check]: event.target.value })}
                aria-label={`${check.replaceAll("_", " ")} price`}
              />
            </label>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Select the included checks first.</p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-2">
        <label className="grid gap-1 text-[11px] text-muted-foreground">
          GST %
          <Input
            type="number"
            min="0"
            max="100"
            step="0.5"
            className="w-24"
            value={taxRate}
            onChange={(event) => onTaxRate(event.target.value)}
            aria-label="GST percent"
          />
        </label>
        {checks.length && packagePrice !== null ? (
          <p className="text-right text-[11px] text-muted-foreground">
            All checks bought one by one: {formatInr(Math.round(sum * 100) / 100)}
            <br />
            Full package: <strong className="text-foreground">{formatInr(packagePrice)}</strong>
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
