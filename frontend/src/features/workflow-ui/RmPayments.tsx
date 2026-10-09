import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, FileClock, IndianRupee, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getRmPayments,
  sendPaymentReminder,
  type RmPaymentClient,
} from "@/lib/backend-api/rm-payments";
import { formatDateTime } from "@/lib/formatting";

const money = (value: number) =>
  value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/**
 * Monthly billing for the RM: reports go to the client after QC; at month end the RM
 * asks each company to pay. Company admins get the reminder in-app and by email.
 */
export function RmPayments() {
  const payments = useQuery({ queryKey: ["rm", "payments"], queryFn: getRmPayments });
  const data = payments.data;
  return (
    <div className="rmo">
      <section className="rmo-kpis pay-kpis" aria-label="Payments summary">
        <div className="rmo-kpi is-info">
          <IndianRupee aria-hidden />
          <div>
            <small>Outstanding</small>
            <strong>{data ? money(data.totals.outstanding) : "—"}</strong>
          </div>
        </div>
        <div className="rmo-kpi is-bad">
          <TimerReset aria-hidden />
          <div>
            <small>Overdue</small>
            <strong>{data ? money(data.totals.overdue) : "—"}</strong>
          </div>
        </div>
        <div className="rmo-kpi is-action">
          <FileClock aria-hidden />
          <div>
            <small>Released, not billed yet</small>
            <strong>{data ? data.totals.unbilledReports : "—"}</strong>
          </div>
        </div>
      </section>
      <section className="rmo-card rmo-queue">
        <header className="rmo-queue-head">
          <div>
            <h2>Payments by company</h2>
            <p>
              Reports are released after QC. At month end, remind each company to pay; overdue
              invoices also remind them automatically every 3 days.
            </p>
          </div>
        </header>
        {payments.isError ? (
          <div className="rmo-empty">
            <strong>Payments unavailable</strong>
            <span>{payments.error.message}</span>
          </div>
        ) : !data ? (
          <div className="rmo-empty">Loading…</div>
        ) : !data.items.length ? (
          <div className="rmo-empty">
            <strong>Nothing due</strong>
            <span>Your companies have no unpaid invoices.</span>
          </div>
        ) : (
          <ul className="pay-list">
            {data.items.map((client) => (
              <PaymentRow key={client.clientId} client={client} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PaymentRow({ client }: { client: RmPaymentClient }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const remind = useMutation({
    mutationFn: () => sendPaymentReminder(client.clientId, note.trim() || undefined),
    onSuccess: async (result) => {
      toast.success("Payment reminder sent", {
        description: `${result.clientAdmins} company admin${result.clientAdmins === 1 ? "" : "s"} told by app and email.`,
      });
      setOpen(false);
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["rm", "payments"] });
    },
    onError: (error: Error) => toast.error("Not sent", { description: error.message }),
  });
  return (
    <li className="pay-row">
      <div className="pay-main">
        <strong>{client.clientName}</strong>
        <small>
          {client.invoices.length} unpaid invoice{client.invoices.length === 1 ? "" : "s"}
          {client.unbilledReports
            ? ` · ${client.unbilledReports} released report${client.unbilledReports === 1 ? "" : "s"} to bill`
            : ""}
          {client.lastReminderAt
            ? ` · last reminder ${formatDateTime(client.lastReminderAt)}`
            : " · not reminded yet"}
        </small>
        {client.invoices.length ? (
          <div className="pay-invoices">
            {client.invoices.map((invoice) => (
              <span
                key={invoice.id}
                className={`rmo-pill ${invoice.overdue ? "is-bad" : "is-info"}`}
              >
                {invoice.invoiceNumber} · {money(invoice.balance)}
                {invoice.overdue ? " · overdue" : ""}
              </span>
            ))}
          </div>
        ) : null}
        {open ? (
          <label className="ops-field pay-note">
            <span>Note for the company (optional)</span>
            <input
              value={note}
              maxLength={300}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. September billing, please clear by the 10th"
              aria-label={`Reminder note for ${client.clientName}`}
            />
          </label>
        ) : null}
      </div>
      <div className="pay-side">
        <span className="pay-amount">
          {money(client.outstanding)}
          {client.overdue ? <small>{money(client.overdue)} overdue</small> : null}
        </span>
        {client.outstanding > 0 ? (
          open ? (
            <span className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" loading={remind.isPending} onClick={() => remind.mutate()}>
                Send
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <BellRing aria-hidden /> Send payment reminder
            </Button>
          )
        ) : (
          <span className="rmo-muted">Finance bills at month end</span>
        )}
      </div>
    </li>
  );
}
