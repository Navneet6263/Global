import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CalendarDays, Download } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiDownload, saveBlob } from "@/lib/backend-api/client";
import { InvoiceClientSearch } from "./InvoiceEntitySelectors";

export function MonthlyStatement({ ownClient = false }: { ownClient?: boolean }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    return `${parts.find((part) => part.type === "year")!.value}-${parts.find((part) => part.type === "month")!.value}`;
  });
  const [clientId, setClientId] = useState("");
  const [clientLabel, setClientLabel] = useState("");
  const download = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({ month });
      if (!ownClient) params.set("clientId", clientId);
      const path = ownClient ? "/client-finance/statement" : "/finance/client-statement";
      const file = await apiDownload(`${path}?${params}`);
      saveBlob(file, `Sapling-monthly-statement-${month}.csv`);
    },
    onSuccess: () => toast.success("Monthly statement downloaded"),
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex h-9 items-center gap-2 rounded-full border border-info/25 bg-info-soft/40 px-4 text-xs font-semibold text-info-foreground">
          <CalendarDays className="size-3.5" /> Monthly statement
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Monthly client statement</DialogTitle>
          <DialogDescription>
            Opening balance, dated invoices, payments, credit notes and cancellations, with a
            running and closing balance. CSV format, INR and India calendar months.
          </DialogDescription>
        </DialogHeader>
        {!ownClient ? (
          <InvoiceClientSearch
            value={clientId}
            label={clientLabel}
            onChange={(id, label) => {
              setClientId(id);
              setClientLabel(label);
            }}
          />
        ) : null}
        <label className="space-y-1 text-xs font-medium">
          Statement month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm"
          />
        </label>
        <p className="rounded-xl bg-warning-soft/30 p-3 text-xs text-muted-foreground">
          Generated from the current recorded ledger, not a frozen month-end snapshot. Later
          backdated payments may change an earlier month's figures.
        </p>
        <button
          disabled={
            download.isPending ||
            !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) ||
            (!ownClient && !clientId)
          }
          aria-busy={download.isPending}
          onClick={() => download.mutate()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          <Download className="size-3.5" />
          {download.isPending ? "Preparing statement…" : "Download statement CSV"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
