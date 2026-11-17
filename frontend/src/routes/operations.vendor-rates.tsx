import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IndianRupee, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WorkspaceError, WorkspaceLoading } from "@/features/delivery/WorkspaceStates";
import { readable, rupees } from "@/features/vendor-checks/vendor-job-format";
import { vendorRatesApi, type VendorRateRow } from "@/lib/backend-api/vendor-checks";
import { formatDateTime } from "@/lib/formatting";

export const Route = createFileRoute("/operations/vendor-rates")({
  head: () => ({ meta: [{ title: "Vendor rates — Sapling Global" }] }),
  component: VendorRatesPage,
});

/** Operations sets what a vendor is paid for each check type in the open queue. */
function VendorRatesPage() {
  const rates = useQuery({ queryKey: ["vendor-rates"], queryFn: vendorRatesApi.list });
  return (
    <div className="grid gap-4">
      <header className="client-heading">
        <div>
          <h1>Vendor rates</h1>
          <p>
            The payment vendors see in the open queue for each check type. Whoever posts a check can
            still change the payment for that one check. Every change is recorded.
          </p>
        </div>
      </header>
      {rates.isPending ? (
        <WorkspaceLoading label="Loading vendor rates" />
      ) : rates.isError ? (
        <WorkspaceError message={rates.error.message} onRetry={() => void rates.refetch()} />
      ) : (
        <section
          aria-label="Rates by check type"
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="hidden grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)_14rem] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[11.5px] font-semibold tracking-wide text-slate-500 uppercase md:grid">
            <span>Check type</span>
            <span>Current rate</span>
            <span>Last changed</span>
            <span className="text-right">New rate</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {rates.data.items.map((row) => (
              <RateRow key={row.checkType} row={row} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RateRow({ row }: { row: VendorRateRow }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(row.price === null ? "" : String(row.price));
  const price = Number(value);
  const valid = value !== "" && price >= 0 && price <= 1_000_000;
  const changed = valid && price !== row.price;
  const save = useMutation({
    mutationFn: () => vendorRatesApi.set(row.checkType, { price, version: row.version }),
    onSuccess: async () => {
      toast.success(`${readable(row.checkType)} rate saved`);
      await queryClient.invalidateQueries({ queryKey: ["vendor-rates"] });
    },
    onError: (error: Error) => toast.error("Not saved", { description: error.message }),
  });
  return (
    <li className="grid items-center gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)_14rem] md:gap-3">
      <strong className="text-[14px] font-semibold text-slate-900">
        {readable(row.checkType)}
      </strong>
      <span className="text-[13.5px] text-slate-700">
        {row.price === null ? <em className="text-slate-400">Not set</em> : rupees(row.price)}
      </span>
      <span className="text-[12.5px] text-slate-500">
        {row.updatedAt ? `${row.updatedBy ?? "—"} · ${formatDateTime(row.updatedAt)}` : "Never set"}
      </span>
      <form
        className="flex items-center gap-2 md:justify-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (changed) save.mutate();
        }}
      >
        <span className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5">
          <IndianRupee className="size-3.5 text-slate-400" aria-hidden />
          <input
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-label={`${readable(row.checkType)} rate`}
            className="w-24 bg-transparent text-[13.5px] outline-none"
          />
        </span>
        <Button type="submit" size="sm" disabled={!changed} loading={save.isPending}>
          <Save aria-hidden /> Save
        </Button>
      </form>
    </li>
  );
}
