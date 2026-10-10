import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  Building2,
  Download,
  FileClock,
  IndianRupee,
  ReceiptIndianRupee,
  TimerReset,
  Wallet,
  type LucideIcon,
} from "lucide-react";
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
import {
  downloadRmInvoice,
  getRmPayments,
  recordRmPayment,
  sendPaymentReminder,
  type PaymentMethod,
  type RmPaymentClient,
} from "@/lib/backend-api/rm-payments";
import { formatDateTime } from "@/lib/formatting";
import { cn } from "@/lib/utils";

type Invoice = RmPaymentClient["invoices"][number];

const money = (value: number) =>
  value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const day = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
const METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "BANK_TRANSFER", label: "Bank transfer (NEFT / RTGS / IMPS)" },
  { value: "UPI", label: "UPI" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
];

/**
 * RM payments: what each of the RM's companies owes, invoice by invoice. The RM records
 * money received (Finance is notified), downloads the invoice and sends reminders.
 */
export function RmPayments() {
  const payments = useQuery({ queryKey: ["rm", "payments"], queryFn: getRmPayments });
  const data = payments.data;
  const [paying, setPaying] = useState<{ client: string; invoice: Invoice } | null>(null);
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <section aria-label="Payments summary" className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Outstanding"
          value={data ? money(data.totals.outstanding) : "—"}
          icon={IndianRupee}
          tone="bg-blue-50 text-blue-700"
          foot={data ? `${data.items.length} companies with dues` : "Loading…"}
        />
        <Kpi
          label="Overdue"
          value={data ? money(data.totals.overdue) : "—"}
          icon={TimerReset}
          tone="bg-red-50 text-red-600"
          alert={Boolean(data?.totals.overdue)}
          foot="Past the invoice due date"
        />
        <Kpi
          label="Released, not billed yet"
          value={data ? String(data.totals.unbilledReports) : "—"}
          icon={FileClock}
          tone="bg-amber-50 text-amber-700"
          foot="Finance bills these at month end"
        />
      </section>
      {payments.isError ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700"
        >
          {payments.error.message}
        </p>
      ) : !data ? (
        <div className="grid gap-3" aria-busy="true">
          {[0, 1].map((key) => (
            <div key={key} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : !data.items.length ? (
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Wallet className="size-6 text-slate-400" aria-hidden />
          <p className="text-[14px] font-semibold text-slate-900">Nothing due</p>
          <p className="text-[12.5px] text-slate-500">Your companies have no unpaid invoices.</p>
        </div>
      ) : (
        <ul aria-label="Payments by company" className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {data.items.map((client) => (
            <CompanyCard
              key={client.clientId}
              client={client}
              onPay={(invoice) => setPaying({ client: client.clientName, invoice })}
            />
          ))}
        </ul>
      )}
      {paying ? (
        <RecordPaymentDialog
          clientName={paying.client}
          invoice={paying.invoice}
          onClose={() => setPaying(null)}
        />
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  foot,
  alert,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
  foot: string;
  alert?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[12.5px] font-medium text-slate-500">{label}</p>
        <span className={cn("grid size-8 place-items-center rounded-lg", tone)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p
        className={cn(
          "num mt-1 text-[26px] font-semibold tracking-tight",
          alert ? "text-red-600" : "text-slate-900",
        )}
      >
        {value}
      </p>
      <p className="truncate text-[12px] text-slate-500">{foot}</p>
    </div>
  );
}

function CompanyCard({
  client,
  onPay,
}: {
  client: RmPaymentClient;
  onPay: (invoice: Invoice) => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [reminding, setReminding] = useState(false);
  const remind = useMutation({
    mutationFn: () => sendPaymentReminder(client.clientId, note.trim() || undefined),
    onSuccess: async (result) => {
      toast.success("Payment reminder sent", {
        description: `${result.clientAdmins} company admin${result.clientAdmins === 1 ? "" : "s"} told by app and email.`,
      });
      setReminding(false);
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["rm", "payments"] });
    },
    onError: (error: Error) => toast.error("Not sent", { description: error.message }),
  });
  const pdf = useMutation({
    mutationFn: (invoice: Invoice) => downloadRmInvoice(invoice.id, invoice.invoiceNumber),
    onError: (error: Error) =>
      toast.error("Invoice not downloaded", { description: error.message }),
  });
  return (
    <li
      aria-label={client.clientName}
      className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-slate-900">
              {client.clientName}
            </h2>
            <p className="text-[12px] text-slate-500">
              {client.invoices.length} unpaid invoice{client.invoices.length === 1 ? "" : "s"}
              {client.unbilledReports
                ? ` · ${client.unbilledReports} released report${client.unbilledReports === 1 ? "" : "s"} to bill`
                : ""}
              {client.lastReminderAt
                ? ` · last reminder ${formatDateTime(client.lastReminderAt)}`
                : " · not reminded yet"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="num text-[18px] font-semibold text-slate-900">
              {money(client.outstanding)}
            </p>
            {client.overdue ? (
              <p className="text-[12px] font-medium text-red-600">
                {money(client.overdue)} overdue
              </p>
            ) : (
              <p className="text-[12px] text-slate-500">outstanding</p>
            )}
          </div>
          {client.outstanding > 0 && !reminding ? (
            <Button size="sm" variant="outline" onClick={() => setReminding(true)}>
              <BellRing aria-hidden /> Send payment reminder
            </Button>
          ) : null}
        </div>
      </header>
      {reminding ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <label className="grid min-w-0 flex-1 gap-1 text-[12.5px] font-medium text-slate-600">
            Note for the company (optional)
            <input
              value={note}
              maxLength={300}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. September billing, please clear by the 10th"
              aria-label={`Reminder note for ${client.clientName}`}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <Button size="sm" variant="outline" onClick={() => setReminding(false)}>
            Cancel
          </Button>
          <Button size="sm" loading={remind.isPending} onClick={() => remind.mutate()}>
            Send
          </Button>
        </div>
      ) : null}
      {client.invoices.length ? (
        <div className="relative overflow-x-auto border-t border-slate-100">
          <table className="w-full min-w-[40rem] text-left text-[12.5px]">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2 font-semibold">Invoice</th>
                <th className="px-3 py-2 font-semibold">Due</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2 text-right font-semibold">Paid</th>
                <th className="px-3 py-2 text-right font-semibold">Balance</th>
                <th className="px-5 py-2 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {client.invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-5 py-2.5">
                    <span className="font-semibold text-slate-900">{invoice.invoiceNumber}</span>
                    {invoice.billValidation === "QUERIED" ? (
                      <span className="ml-2 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                        Bill queried
                      </span>
                    ) : null}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5",
                      invoice.overdue ? "font-semibold text-red-600" : "text-slate-600",
                    )}
                  >
                    {day(invoice.dueAt)}
                    {invoice.overdue ? " · overdue" : ""}
                  </td>
                  <td className="num px-3 py-2.5 text-right text-slate-600">
                    {money(invoice.total)}
                  </td>
                  <td className="num px-3 py-2.5 text-right text-slate-600">
                    {money(invoice.paid)}
                  </td>
                  <td className="num px-3 py-2.5 text-right font-semibold text-slate-900">
                    {money(invoice.balance)}
                  </td>
                  <td className="px-5 py-2.5">
                    <span className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Download ${invoice.invoiceNumber}`}
                        loading={pdf.isPending && pdf.variables?.id === invoice.id}
                        onClick={() => pdf.mutate(invoice)}
                      >
                        <Download aria-hidden /> PDF
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onPay(invoice)}
                        aria-label={`Record payment for ${invoice.invoiceNumber}`}
                      >
                        <ReceiptIndianRupee aria-hidden /> Record payment
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="border-t border-slate-100 px-5 py-3 text-[12.5px] text-slate-500">
          No invoice yet — Finance bills the released reports at month end.
        </p>
      )}
    </li>
  );
}

function RecordPaymentDialog({
  clientName,
  invoice,
  onClose,
}: {
  clientName: string;
  invoice: Invoice;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(String(invoice.balance));
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const value = Number(amount);
  const tooMuch = value > invoice.balance + 0.001;
  const valid =
    Number.isFinite(value) &&
    value > 0 &&
    !tooMuch &&
    Boolean(receivedAt) &&
    (method === "OTHER" || reference.trim().length >= 2);
  const save = useMutation({
    mutationFn: () =>
      recordRmPayment(invoice.id, {
        amount: Math.round(value * 100) / 100,
        method,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        receivedAt,
        version: invoice.version,
      }),
    onSuccess: async (result) => {
      toast.success(
        result.status === "PAID"
          ? `${invoice.invoiceNumber} is fully paid`
          : `Payment of ${money(value)} recorded`,
        { description: "Finance has been notified." },
      );
      await queryClient.invalidateQueries({ queryKey: ["rm", "payments"] });
      onClose();
    },
    onError: (error: Error) => toast.error("Payment not recorded", { description: error.message }),
  });
  const input =
    "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100";
  return (
    <Dialog open onOpenChange={(open) => (!open && !save.isPending ? onClose() : undefined)}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {clientName} · {invoice.invoiceNumber} · balance {money(invoice.balance)}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) save.mutate();
          }}
        >
          <label className="grid gap-1 text-[12.5px] font-medium text-slate-700">
            Amount received (₹)
            <input
              type="number"
              inputMode="decimal"
              min={0.01}
              step="0.01"
              max={invoice.balance}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={cn(input, tooMuch && "border-red-300")}
            />
            {tooMuch ? (
              <span className="text-[12px] text-red-600">More than the balance due.</span>
            ) : value > 0 && value < invoice.balance ? (
              <span className="text-[12px] text-slate-500">
                Part payment · {money(invoice.balance - value)} will remain due.
              </span>
            ) : null}
          </label>
          <label className="grid gap-1 text-[12.5px] font-medium text-slate-700">
            Method
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
              className={input}
            >
              {METHODS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[12.5px] font-medium text-slate-700">
            Reference {method === "OTHER" ? "(optional)" : "(UTR / cheque no. / transaction id)"}
            <input
              value={reference}
              maxLength={100}
              onChange={(event) => setReference(event.target.value)}
              placeholder={method === "CHEQUE" ? "Cheque number" : "e.g. UTR 4410023"}
              className={input}
            />
          </label>
          <label className="grid gap-1 text-[12.5px] font-medium text-slate-700">
            Received on
            <input
              type="date"
              value={receivedAt}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setReceivedAt(event.target.value)}
              className={input}
            />
          </label>
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
            The payment is recorded on the invoice and audited under your name. Finance is notified;
            reports waiting for payment are released once the invoice is paid.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid} loading={save.isPending}>
              Record {Number.isFinite(value) && value > 0 ? money(value) : "payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
