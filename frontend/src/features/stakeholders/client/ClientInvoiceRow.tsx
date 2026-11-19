import { Fragment, useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, Download, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Button, Td } from "@/kit";
import { cn } from "@/lib/utils";
import { downloadClientInvoice, type ClientInvoice } from "@/lib/backend-api/client-finance";
import { ClientPill } from "./ClientPageParts";
import { invoiceMoney } from "./client-billing-format";
import { BillingAnnexurePanel } from "@/features/finance/BillingAnnexurePanel";
const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("en-IN") : "Not recorded";

export function ClientInvoiceRow({
  invoice,
  stale,
  allowDownload = false,
}: {
  invoice: ClientInvoice;
  stale: boolean;
  allowDownload?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const money = (value: number | string) => invoiceMoney(value, invoice.currency);
  const download = useMutation({
    mutationFn: () => downloadClientInvoice(invoice),
    onError: (error: Error) =>
      toast.error("Invoice download failed", { description: error.message }),
  });
  const tone = invoice.status === "OVERDUE" ? "red" : invoice.balance === 0 ? "green" : "amber";
  const breakdown: Array<[string, number | string]> = [
    ["Invoice total", invoice.totalAmount],
    ["Payments recorded", invoice.paidAmount],
    ["Credit applied", invoice.creditedAmount],
    ["Balance remaining", invoice.balance],
  ];
  return (
    <Fragment>
      <tr className={cn("hover:bg-subtle/40", open ? "bg-subtle/40" : "last:[&>td]:border-b-0")}>
        <Td>
          <div className="flex min-w-[180px] items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-soft text-brand">
              <ReceiptText className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <strong className="block truncate font-mono font-semibold text-ink">
                {invoice.invoiceNumber}
              </strong>
              <small className="block text-xs text-dim">
                {invoice.status === "DRAFT"
                  ? "Monthly bill: please validate it"
                  : `Issued ${date(invoice.issuedAt)}`}
              </small>
            </div>
          </div>
        </Td>
        <Td mono className="whitespace-nowrap text-ink">
          {date(invoice.dueAt)}
        </Td>
        <Td align="right" mono className="whitespace-nowrap text-ink">
          {money(invoice.totalAmount)}
        </Td>
        <Td align="right" mono className="whitespace-nowrap">
          <strong className={cn("font-semibold", invoice.balance === 0 ? "text-ink" : "text-warn")}>
            {money(invoice.balance)}
          </strong>
        </Td>
        <Td>
          <div className="flex flex-wrap gap-1">
            <ClientPill tone={tone}>
              {invoice.status === "DRAFT"
                ? "Bill (not invoiced yet)"
                : invoice.status.replaceAll("_", " ")}
            </ClientPill>
            {invoice.annexureStatus === "PENDING" ? (
              <ClientPill tone="amber">Validate bill</ClientPill>
            ) : invoice.annexureStatus === "QUERIED" ? (
              <ClientPill tone="red">Query raised</ClientPill>
            ) : invoice.annexureStatus === "VALIDATED" ? (
              <ClientPill tone="green">Bill validated</ClientPill>
            ) : null}
          </div>
        </Td>
        <Td align="right">
          <div className="inline-flex flex-nowrap items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={open}
              aria-controls={id}
              onClick={() => setOpen(!open)}
              aria-label={`Details for ${invoice.invoiceNumber}`}
            >
              Details <ChevronDown aria-hidden className={cn("transition", open && "rotate-180")} />
            </Button>
            {allowDownload && (
              <Button
                size="sm"
                variant="primary"
                loading={download.isPending}
                disabled={stale || download.isPending}
                onClick={() => download.mutate()}
                aria-label={`Download ${invoice.invoiceNumber}`}
              >
                <Download aria-hidden /> {download.isPending ? "Preparing…" : "PDF"}
              </Button>
            )}
          </div>
        </Td>
      </tr>
      {open && (
        <tr id={id} className="bg-subtle/40">
          <td colSpan={6} className="border-b border-line px-4 py-4">
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {breakdown.map(([label, value]) => (
                <div
                  key={label}
                  className="flex min-w-0 flex-col gap-1 rounded-md border border-line bg-surface px-3 py-2.5"
                >
                  <dt className="truncate text-[11px] font-semibold tracking-wider text-dim uppercase">
                    {label}
                  </dt>
                  <dd className="font-mono text-sm font-semibold text-ink tabular-nums">
                    {money(value)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-dim">
              Payments and credits are recorded by Finance. A zero balance does not bypass report
              approval.
            </p>
            {invoice.annexureStatus ? (
              <div className="mt-3">
                <BillingAnnexurePanel audience="client" invoiceId={invoice.id} />
              </div>
            ) : null}
          </td>
        </tr>
      )}
    </Fragment>
  );
}
