import type { ClientRate, CommercialSettings } from "@/lib/backend-api/client-commercial";

export const commercialInput =
  "h-10 w-full rounded-xl border border-border bg-card px-3 text-xs outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10";

export function CommercialRateEditor({
  rates,
  catalog,
  onChange,
}: {
  rates: ClientRate[];
  catalog: CommercialSettings["catalog"];
  onChange: (rates: ClientRate[]) => void;
}) {
  const update = (index: number, patch: Partial<ClientRate>) =>
    onChange(rates.map((rate, i) => (i === index ? { ...rate, ...patch } : rate)));
  return (
    <section className="space-y-3 rounded-2xl border border-mint/20 bg-mint-soft/20 p-4">
      <div>
        <h3 className="text-sm font-semibold">Contracted packages</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Once configured, only enabled packages are available for this client. Existing cases
          retain their agreed price.
        </p>
      </div>
      {rates.map((rate, index) => (
        <div
          key={rate.servicePackageId}
          className="space-y-3 rounded-xl border border-border bg-card p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold">
              {rate.name ??
                catalog.find((item) => item.id === rate.servicePackageId)?.name ??
                "Service package"}
            </span>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={rate.active}
                onChange={(e) => update(index, { active: e.target.checked })}
              />
              Enabled
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1 text-[10px] text-muted-foreground">
              Rate (₹)
              <input
                aria-label="Contracted rate"
                type="number"
                min="0"
                max="9999999999"
                step="0.01"
                required
                value={rate.unitPrice}
                onChange={(e) => update(index, { unitPrice: Number(e.target.value) })}
                className={commercialInput}
              />
            </label>
            <label className="space-y-1 text-[10px] text-muted-foreground">
              Tax %
              <input
                aria-label="Tax percentage"
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={rate.taxRate}
                onChange={(e) => update(index, { taxRate: Number(e.target.value) })}
                className={commercialInput}
              />
            </label>
            <label className="space-y-1 text-[10px] text-muted-foreground">
              TAT hours
              <input
                aria-label="Contract TAT hours"
                type="number"
                min="4"
                max="720"
                value={rate.tatHours ?? ""}
                placeholder="Default"
                onChange={(e) =>
                  update(index, { tatHours: e.target.value ? Number(e.target.value) : null })
                }
                className={commercialInput}
              />
            </label>
          </div>
        </div>
      ))}
      <select
        aria-label="Add contracted package"
        className={commercialInput}
        value=""
        onChange={(e) => {
          const item = catalog.find((option) => option.id === e.target.value);
          if (item)
            onChange([
              ...rates,
              {
                servicePackageId: item.id,
                name: item.name,
                unitPrice: item.price ?? 0,
                taxRate: 0,
                tatHours: item.tatHours,
                active: true,
              },
            ]);
        }}
      >
        <option value="">Add a package…</option>
        {catalog
          .filter((item) => !rates.some((rate) => rate.servicePackageId === item.id))
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
      </select>
    </section>
  );
}
