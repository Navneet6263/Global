import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgePercent } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getClientPricing,
  listPricingClients,
  setClientDiscount,
  type ClientPricingRow,
} from "@/lib/backend-api/packages";
import { formatInr } from "@/lib/formatting";
import { packageKeys } from "./package-keys";

/**
 * Discounts for one client. An RM sees only its own clients and can go up to each
 * package's limit; Operations / Admin can give any discount. Every change is audited.
 */
export function ClientPricingPanel() {
  const clients = useQuery({
    queryKey: ["client-pricing", "clients"],
    queryFn: listPricingClients,
  });
  const [picked, setClientId] = useState("");
  const options = clients.data?.items ?? [];
  // Until someone picks, show the first client in the list.
  const clientId = picked || options[0]?.id || "";
  const pricing = useQuery({
    queryKey: packageKeys.pricing(clientId),
    queryFn: () => getClientPricing(clientId),
    enabled: Boolean(clientId),
  });

  return (
    <section className="rounded-2xl border border-border bg-card" aria-labelledby="pricing-title">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3.5">
        <div className="min-w-0">
          <h2 id="pricing-title" className="flex items-center gap-2 text-sm font-semibold">
            <BadgePercent className="size-4 text-primary" aria-hidden /> Client discounts
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {pricing.data?.canSetAnyDiscount
              ? "You can give any discount. RMs can give up to each package's limit."
              : "You can give your clients up to the limit Operations set for each package."}
          </p>
        </div>
        <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
          Client
          <select
            aria-label="Client"
            className="h-9 min-w-[220px] rounded-xl border border-border bg-card px-3 text-sm text-foreground"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            disabled={!options.length}
          >
            {options.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
                {client.status === "ONBOARDING" ? " (onboarding)" : ""}
              </option>
            ))}
          </select>
        </label>
      </header>
      {clients.isError || pricing.isError ? (
        <p role="alert" className="px-4 py-6 text-sm text-destructive">
          {(clients.error ?? pricing.error)?.message}
        </p>
      ) : clients.isSuccess && !options.length ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No clients are assigned to you yet.
        </p>
      ) : pricing.isLoading || clients.isLoading ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Loading prices…</p>
      ) : pricing.data?.items.length ? (
        <ul className="divide-y divide-border/70" aria-label="Package prices">
          {pricing.data.items.map((row) => (
            <PricingRow key={`${clientId}-${row.packageId}`} clientId={clientId} row={row} />
          ))}
        </ul>
      ) : pricing.data ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          This client has no active packages.
        </p>
      ) : null}
    </section>
  );
}

function PricingRow({ clientId, row }: { clientId: string; row: ClientPricingRow }) {
  const queryClient = useQueryClient();
  const [percent, setPercent] = useState(String(row.discountPercent));
  const [note, setNote] = useState(row.note ?? "");
  const value = Number(percent);
  const valid = percent !== "" && value >= 0 && value <= 100;
  const overLimit = valid && value > row.yourLimitPercent;
  const changed = valid && (value !== row.discountPercent || note !== (row.note ?? ""));
  const preview = valid ? Math.round(row.listPrice * (100 - value)) / 100 : row.finalPrice;
  const save = useMutation({
    mutationFn: () =>
      setClientDiscount(clientId, row.packageId, {
        discountPercent: value,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success(value ? `${value}% discount saved on ${row.name}` : `Discount removed`);
      void queryClient.invalidateQueries({ queryKey: packageKeys.pricing(clientId) });
    },
    onError: (error: Error) => toast.error("Not saved", { description: error.message }),
  });

  return (
    <li className="grid gap-3 px-4 py-3.5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_auto] md:items-center">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{row.name}</p>
        <p className="text-[11px] text-muted-foreground">
          List {formatInr(row.listPrice)} · RM limit{" "}
          {row.maxRmDiscountPercent ? `${row.maxRmDiscountPercent}%` : "none (Ops only)"}
        </p>
        {row.setBy ? (
          <p className="text-[11px] text-muted-foreground">
            Last set by {row.setBy}
            {row.updatedAt ? ` · ${new Date(row.updatedAt).toLocaleDateString("en-IN")}` : ""}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-[110px_minmax(0,1fr)]">
        <label className="grid gap-1 text-[11px] text-muted-foreground">
          Discount %
          <Input
            type="number"
            min="0"
            max={row.yourLimitPercent}
            step="0.5"
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
            aria-label={`${row.name} discount percent`}
            aria-invalid={overLimit || !valid}
          />
        </label>
        <label className="grid gap-1 text-[11px] text-muted-foreground">
          Reason (optional)
          <Input
            value={note}
            maxLength={300}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. annual volume commitment"
            aria-label={`${row.name} discount reason`}
          />
        </label>
        {overLimit ? (
          <p role="alert" className="text-[11px] text-destructive sm:col-span-2">
            You can give up to {row.yourLimitPercent}% on this package. Ask Operations for more.
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
        <p className="text-right">
          <span className="block text-[11px] text-muted-foreground">Client pays</span>
          <span className="text-sm font-semibold tabular-nums">{formatInr(preview)}</span>
        </p>
        <Button
          size="sm"
          disabled={!changed || overLimit}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          Save
        </Button>
      </div>
    </li>
  );
}
