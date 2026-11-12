import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Download, FileCheck2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { downloadInvoice } from "@/lib/backend-api/finance";
import { sendBillingAnnexure } from "@/lib/backend-api/billing-annexure";
import {
  issueMonthlyBill,
  listMonthlyBills,
  prepareMonthlyBills,
  type MonthlyBill,
  type PreparedBills,
} from "@/lib/backend-api/monthly-bills";
import { cn } from "@/lib/utils";

const rupees = (value: number) =>
  value.toLocaleString("en-IN", { style: "currency", currency: "INR" });

/** The month before today in India, "2026-10". */
function lastMonth() {
  const ist = new Date(Date.now() + 330 * 60_000);
  const previous = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - 1, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** One label per step of the bill: with the company, queried, validated, issued. */
function stage(bill: MonthlyBill) {
  if (bill.status === "CANCELLED")
    return { label: "Cancelled", tone: "bg-slate-100 text-slate-600" };
  if (bill.status !== "DRAFT")
    return { label: "Tax invoice issued", tone: "bg-blue-50 text-blue-700" };
  if (bill.validation.status === "VALIDATED")
    return { label: "Validated · ready to invoice", tone: "bg-emerald-50 text-emerald-700" };
  if (bill.validation.status === "QUERIED")
    return { label: "Company raised a query", tone: "bg-red-50 text-red-700" };
  return { label: "With the company to validate", tone: "bg-amber-50 text-amber-800" };
}

/**
 * Monthly billing: the month's released reports become one bill per company, the company
 * validates it, then Finance issues the tax invoice (Sample Invoice Format).
 */
export function MonthlyBills({ canWrite }: { canWrite: boolean }) {
  const [period, setPeriod] = useState(lastMonth);
  const [result, setResult] = useState<PreparedBills>();
  const queryClient = useQueryClient();
  const bills = useQuery({
    queryKey: ["finance", "monthly-bills", period],
    queryFn: () => listMonthlyBills(period),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["finance"] });
  const prepare = useMutation({
    mutationFn: () => prepareMonthlyBills(period),
    onSuccess: async (data) => {
      setResult(data);
      toast.success(
        data.prepared.length
          ? `${data.prepared.length} ${data.prepared.length === 1 ? "bill" : "bills"} sent to companies to validate`
          : "Nothing new to bill for this month",
      );
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const act = useMutation({
    mutationFn: async ({ kind, bill }: { kind: "issue" | "resend" | "pdf"; bill: MonthlyBill }) => {
      if (kind === "issue") return issueMonthlyBill(bill);
      if (kind === "resend") return sendBillingAnnexure(bill.id);
      return downloadInvoice(bill.id, bill.invoiceNumber);
    },
    onSuccess: async (data, { kind }) => {
      if (kind === "issue" && data && typeof data === "object" && "invoiceNumber" in data)
        toast.success(`Tax invoice ${String(data.invoiceNumber)} issued`, {
          description: "The company has been told; download the PDF from the list.",
        });
      if (kind === "resend") toast.success("Bill sent to the company again");
      if (kind !== "pdf") await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const items = bills.data?.items ?? [];
  const busy = (kind: string, bill: MonthlyBill) =>
    act.isPending && act.variables?.kind === kind && act.variables.bill.id === bill.id;

  return (
    <section
      aria-label="Monthly bills"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.05)]"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold text-slate-900">
            <CalendarRange className="size-4 text-blue-700" aria-hidden /> Monthly bills
          </h2>
          <p className="mt-0.5 max-w-2xl text-[13px] text-slate-500">
            Reports released in the month become one bill per company. The company validates it,
            then you issue the tax invoice. Bills are also prepared on their own when a month
            closes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[13px] text-slate-600">
            Month
            <input
              type="month"
              value={period}
              max={lastMonth()}
              onChange={(event) => {
                if (event.target.value) setPeriod(event.target.value);
                setResult(undefined);
              }}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-[13px]"
            />
          </label>
          {canWrite ? (
            <Button loading={prepare.isPending} onClick={() => prepare.mutate()}>
              <Sparkles aria-hidden /> Prepare bills
            </Button>
          ) : null}
        </div>
      </header>

      {result?.skipped.length ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900"
        >
          <p className="font-semibold">
            {result.skipped.length} {result.skipped.length === 1 ? "case was" : "cases were"} not
            billed
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {result.skipped.slice(0, 8).map((item, index) => (
              <li key={`${item.client}-${item.caseNumber ?? index}`}>
                {item.client}
                {item.caseNumber ? ` · ${item.caseNumber}` : ""}: {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {bills.isPending ? (
        <ListSkeleton rows={3} />
      ) : bills.isError ? (
        <ErrorState description={bills.error.message} onRetry={() => void bills.refetch()} />
      ) : items.length ? (
        <div className="-mx-1 mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-2 py-2">
                  Company
                </th>
                <th scope="col" className="px-2 py-2">
                  Bill / invoice
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  Cases
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  Total
                </th>
                <th scope="col" className="px-2 py-2">
                  Where it is
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((bill) => {
                const { label, tone } = stage(bill);
                const validated = bill.status === "DRAFT" && bill.validation.status === "VALIDATED";
                return (
                  <tr key={bill.id} className="border-b border-slate-100 align-top last:border-0">
                    <td className="px-2 py-3">
                      <strong className="block font-semibold text-slate-900">
                        {bill.client.name}
                      </strong>
                      <span className="text-[12px] text-slate-500">
                        {bill.client.gstin ? `GSTIN ${bill.client.gstin}` : "No GSTIN on record"}
                      </span>
                    </td>
                    <td className="px-2 py-3 font-medium text-slate-800">{bill.invoiceNumber}</td>
                    <td className="num px-2 py-3 text-right">{bill.cases}</td>
                    <td className="num px-2 py-3 text-right font-semibold">
                      {rupees(bill.totalAmount)}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold",
                          tone,
                        )}
                      >
                        {label}
                      </span>
                      {bill.status === "DRAFT" && bill.validation.query ? (
                        <p className="mt-1 max-w-xs text-[12px] text-red-700">
                          “{bill.validation.query}”
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {canWrite && validated ? (
                          <Button
                            size="sm"
                            loading={busy("issue", bill)}
                            onClick={() => act.mutate({ kind: "issue", bill })}
                          >
                            <FileCheck2 aria-hidden /> Issue tax invoice
                          </Button>
                        ) : null}
                        {canWrite &&
                        bill.status === "DRAFT" &&
                        bill.validation.status === "QUERIED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={busy("resend", bill)}
                            onClick={() => act.mutate({ kind: "resend", bill })}
                          >
                            <Send aria-hidden /> Send again
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busy("pdf", bill)}
                          onClick={() => act.mutate({ kind: "pdf", bill })}
                          aria-label={`Download ${bill.invoiceNumber}`}
                        >
                          <Download aria-hidden />{" "}
                          {bill.status === "DRAFT" ? "Proforma" : "Invoice"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-[13px] text-slate-500">
          No bills for {bills.data?.label ?? "this month"} yet.
          {canWrite ? " Choose Prepare bills to make them from the released reports." : ""}
        </p>
      )}
    </section>
  );
}
