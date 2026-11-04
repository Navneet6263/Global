import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackagePlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AddPackageDialog } from "@/features/settings/components/settings-create-dialogs";
import {
  createPackage,
  listPackages,
  updatePackage,
  type PackageItem,
} from "@/lib/backend-api/packages";
import { daysToHours, formatInr, formatTatDays, hoursToDays } from "@/lib/formatting";
import { SERVICE_CHECKS } from "@/features/settings/components/service-policy-options";
import { PackageCheckPricing } from "./PackageCheckPricing";
import { toCheckPrices, type CheckPriceDraft } from "./check-prices";
import { RequiredDocumentFields } from "@/features/settings/components/service-policy-fields";
import { documentPlan, packageRequiredDocuments, type CheckOptions } from "./check-catalogue";
import { packageKeys } from "./package-keys";

/** Operations / Admin: build packages and decide how much an RM may discount each. */
export function PackagesBoard() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PackageItem | null>(null);
  const packages = useQuery({ queryKey: packageKeys.all, queryFn: listPackages });
  const create = useMutation({
    mutationFn: createPackage,
    onSuccess: (row) => {
      setAdding(false);
      toast.success(`${row.name} created`);
      void queryClient.invalidateQueries({ queryKey: packageKeys.all });
    },
    onError: (error: Error) =>
      toast.error("Package could not be created", { description: error.message }),
  });
  const rows = packages.data?.items ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card" aria-labelledby="pkg-title">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5">
        <div className="min-w-0">
          <h2 id="pkg-title" className="text-sm font-semibold">
            Packages
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The checks, list price and turnaround for each package, and the most a client RM may
            discount it.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <PackagePlus className="size-3.5" aria-hidden /> New package
        </Button>
      </header>
      {packages.isError ? (
        <p role="alert" className="px-4 py-6 text-sm text-destructive">
          {packages.error.message}
        </p>
      ) : packages.isLoading ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Loading packages…</p>
      ) : rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs" aria-label="Packages">
            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Package</th>
                <th className="px-3 py-2.5 font-medium">Checks</th>
                <th className="px-3 py-2.5 text-right font-medium">List price</th>
                <th className="px-3 py-2.5 text-right font-medium">TAT</th>
                <th className="px-3 py-2.5 font-medium">Candidate uploads</th>
                <th className="px-3 py-2.5 text-right font-medium">Max RM discount</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{row.name}</p>
                    <p className="text-[11px] text-muted-foreground">{row.code}</p>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {row.checks.map((check) => check.replaceAll("_", " ").toLowerCase()).join(", ")}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {row.price === null ? "—" : formatInr(row.price)}
                    <small className="block text-[11px] text-muted-foreground">
                      + {row.taxRate}% GST
                    </small>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatTatDays(row.tatHours)}
                  </td>
                  <td className="px-3 py-3">
                    <UploadsCell row={row} />
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {row.maxRmDiscountPercent ? `${row.maxRmDiscountPercent}%` : "Ops only"}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        row.isActive
                          ? "bg-success-soft text-success-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {row.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(row)}
                      aria-label={`Edit ${row.name}`}
                    >
                      <Pencil className="size-3.5" aria-hidden /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No packages yet. Create the first one.
        </p>
      )}
      <AddPackageDialog
        open={adding}
        withRmDiscount
        submitting={create.isPending}
        onOpenChange={setAdding}
        onSubmit={(draft) => create.mutate(draft)}
      />
      {editing ? (
        <EditPackageDialog
          key={editing.id}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void queryClient.invalidateQueries({ queryKey: packageKeys.all });
          }}
        />
      ) : null}
    </section>
  );
}

/** "5 uploads · 7 documents" with the list on hover / focus. */
function UploadsCell({ row }: { row: PackageItem }) {
  const plan =
    row.documentPlan ?? documentPlan(row.checks, row.checkOptions ?? {}, row.requiredDocuments);
  if (!plan.totalUploads) return <span className="text-muted-foreground">None</span>;
  return (
    <span title={plan.uploads.map((upload) => upload.label).join(", ")}>
      {plan.totalUploads} {plan.totalUploads === 1 ? "upload" : "uploads"}
      {plan.totalPapers > plan.totalUploads ? (
        <small className="block text-[11px] text-muted-foreground">
          {plan.totalPapers} documents in all
        </small>
      ) : null}
    </span>
  );
}

function EditPackageDialog({
  item,
  onClose,
  onSaved,
}: {
  item: PackageItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price === null ? "" : String(item.price));
  const [tat, setTat] = useState(String(hoursToDays(item.tatHours)));
  const [maxRm, setMaxRm] = useState(String(item.maxRmDiscountPercent));
  const [checkPrices, setCheckPrices] = useState<CheckPriceDraft>(() =>
    Object.fromEntries(
      Object.entries(item.checkPrices ?? {}).map(([check, value]) => [check, String(value)]),
    ),
  );
  const [taxRate, setTaxRate] = useState(String(item.taxRate ?? 18));
  const [active, setActive] = useState(item.isActive);
  const [checks, setChecks] = useState<string[]>([...item.checks]);
  const [checkOptions, setCheckOptions] = useState<Record<string, CheckOptions>>(
    () => item.checkOptions ?? {},
  );
  // Extra documents: what the package asks for beyond its checks' own documents.
  const [extras, setExtras] = useState<string[]>(() => {
    const own = packageRequiredDocuments(item.checks, item.checkOptions ?? {});
    return item.requiredDocuments.filter((type) => !own.includes(type));
  });
  const fromChecks = packageRequiredDocuments(checks, pickOptions(checkOptions, checks));
  const checksChanged =
    checks.length !== item.checks.length || checks.some((check) => !item.checks.includes(check));
  const optionsChanged =
    JSON.stringify(pickOptions(checkOptions, checks)) !==
    JSON.stringify(pickOptions(item.checkOptions ?? {}, checks));
  const extrasChanged =
    JSON.stringify([...extras].sort()) !==
    JSON.stringify(
      item.requiredDocuments
        .filter(
          (type) => !packageRequiredDocuments(item.checks, item.checkOptions ?? {}).includes(type),
        )
        .sort(),
    );
  const toggleCheck = (check: string) =>
    setChecks((current) =>
      current.includes(check) ? current.filter((value) => value !== check) : [...current, check],
    );
  const save = useMutation({
    mutationFn: () =>
      updatePackage(item.id, {
        updatedAt: item.updatedAt,
        name: name.trim(),
        ...(price !== "" ? { price: Number(price) } : {}),
        tatHours: daysToHours(Number(tat)),
        maxRmDiscountPercent: Number(maxRm),
        ...(checksChanged ? { checks } : {}),
        // The documents are worked out again from the checks, options and extras.
        ...(checksChanged || optionsChanged || extrasChanged
          ? {
              checkOptions: pickOptions(checkOptions, checks),
              requiredDocuments: extras.filter((type) => !fromChecks.includes(type)),
            }
          : {}),
        checkPrices: toCheckPrices(checkPrices, checks),
        taxRate: Number(taxRate),
        isActive: active,
      }),
    onSuccess: () => {
      toast.success(`${name.trim()} saved`);
      onSaved();
    },
    onError: (error: Error) => toast.error("Not saved", { description: error.message }),
  });
  const valid =
    name.trim().length >= 2 &&
    daysToHours(Number(tat)) >= 1 &&
    Number(tat) <= 365 &&
    Number(maxRm) >= 0 &&
    Number(maxRm) <= 100 &&
    Number(taxRate) >= 0 &&
    Number(taxRate) <= 100 &&
    checks.length > 0 &&
    (price === "" || Number(price) >= 0);
  return (
    <Dialog open onOpenChange={(open) => (!open && !save.isPending ? onClose() : undefined)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit {item.code}</DialogTitle>
          <DialogDescription>
            Price changes apply to new cases only. Cases already created keep their price.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="pkg-name">Name</Label>
            <Input id="pkg-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pkg-price">List price (₹)</Label>
            <Input
              id="pkg-price"
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pkg-tat">Turnaround (days)</Label>
            <Input
              id="pkg-tat"
              type="number"
              min="0.5"
              max="365"
              step="0.5"
              value={tat}
              onChange={(e) => setTat(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="pkg-max">Max RM discount (%)</Label>
            <Input
              id="pkg-max"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={maxRm}
              onChange={(e) => setMaxRm(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Client RMs can give up to this much. Operations can always give more.
            </p>
          </div>
          <div className="sm:col-span-2">
            <PackageCheckPricing
              allChecks={SERVICE_CHECKS}
              selected={checks}
              onToggle={toggleCheck}
              prices={checkPrices}
              onPrices={setCheckPrices}
              options={checkOptions}
              onOptions={setCheckOptions}
              extraDocuments={extras.filter((type) => !fromChecks.includes(type))}
              packagePrice={price !== "" ? Number(price) : null}
              onPackagePrice={setPrice}
              taxRate={taxRate}
              onTaxRate={setTaxRate}
              onTatDays={setTat}
            />
          </div>
          <div className="sm:col-span-2">
            <RequiredDocumentFields
              value={extras}
              onChange={setExtras}
              exclude={fromChecks}
              legend="Extra documents (optional)"
              description="The checks decide the candidate's documents (see the summary above). Tick a document here only if this package needs one more."
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-sm sm:col-span-2">
            Active — clients can order it
            <Switch checked={active} onCheckedChange={setActive} aria-label="Package active" />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Options of the package's checks only. */
function pickOptions(options: Record<string, CheckOptions>, checks: readonly string[]) {
  return Object.fromEntries(
    checks.filter((check) => options[check]).map((check) => [check, options[check]!]),
  );
}
