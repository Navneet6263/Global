import { Fragment, useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  return (
    <Fragment>
      <tr>
        <td>
          <strong>{invoice.invoiceNumber}</strong>
          <small>Issued {date(invoice.issuedAt)}</small>
        </td>
        <td>{date(invoice.dueAt)}</td>
        <td className="client-number">{money(invoice.totalAmount)}</td>
        <td className="client-number">
          <strong>{money(invoice.balance)}</strong>
        </td>
        <td>
          <ClientPill tone={tone}>{invoice.status.replaceAll("_", " ")}</ClientPill>
          {invoice.annexureStatus === "PENDING" ? (
            <ClientPill tone="amber">Validate bill</ClientPill>
          ) : invoice.annexureStatus === "QUERIED" ? (
            <ClientPill tone="red">Query raised</ClientPill>
          ) : invoice.annexureStatus === "VALIDATED" ? (
            <ClientPill tone="green">Bill validated</ClientPill>
          ) : null}
        </td>
        <td>
          <div className="client-row-actions">
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={open}
              aria-controls={id}
              onClick={() => setOpen(!open)}
              aria-label={`Details for ${invoice.invoiceNumber}`}
            >
              Details <ChevronDown aria-hidden className={open ? "rotate-180" : ""} />
            </Button>
            {allowDownload && (
              <Button
                size="sm"
                variant="outline"
                loading={download.isPending}
                disabled={stale || download.isPending}
                onClick={() => download.mutate()}
                aria-label={`Download ${invoice.invoiceNumber}`}
              >
                <Download aria-hidden /> {download.isPending ? "Preparing…" : "PDF"}
              </Button>
            )}
          </div>
        </td>
      </tr>
      {open && (
        <tr id={id}>
          <td colSpan={6} className="client-invoice-detail">
            <dl>
              <div>
                <dt>Invoice total</dt>
                <dd>{money(invoice.totalAmount)}</dd>
              </div>
              <div>
                <dt>Payments recorded</dt>
                <dd>{money(invoice.paidAmount)}</dd>
              </div>
              <div>
                <dt>Credit applied</dt>
                <dd>{money(invoice.creditedAmount)}</dd>
              </div>
              <div>
                <dt>Balance remaining</dt>
                <dd>{money(invoice.balance)}</dd>
              </div>
            </dl>
            <p>
              Payments and credits are recorded by Finance. A zero balance does not bypass report
              approval.
            </p>
            {invoice.annexureStatus ? (
              <BillingAnnexurePanel audience="client" invoiceId={invoice.id} />
            ) : null}
          </td>
        </tr>
      )}
    </Fragment>
  );
}
