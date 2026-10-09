import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, MessageSquareWarning, Send, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { COLOUR_CODES, hexFor } from "@/features/workflow-ui/colour-legend";
import {
  downloadBillingAnnexure,
  getBillingAnnexure,
  queryBill,
  sendBillingAnnexure,
  validateBill,
  type AnnexureAudience,
} from "@/lib/backend-api/billing-annexure";
import { formatDateTime } from "@/lib/formatting";

const STATUS_COPY = {
  PENDING: { label: "Waiting for validation", tone: "is-warn" },
  VALIDATED: { label: "Validated", tone: "is-good" },
  QUERIED: { label: "Query raised", tone: "is-bad" },
} as const;

const money = (value: string) =>
  Number(value).toLocaleString("en-IN", { style: "currency", currency: "INR" });

/**
 * Monthly billing annexure (BGV process): one row per billed case with its colour code.
 * Finance sends it; the company validates the bill or raises a query.
 */
export function BillingAnnexurePanel({
  audience,
  invoiceId,
}: {
  audience: AnnexureAudience;
  invoiceId: string;
}) {
  const queryClient = useQueryClient();
  const key = ["billing-annexure", audience, invoiceId];
  const annexure = useQuery({
    queryKey: key,
    queryFn: () => getBillingAnnexure(audience, invoiceId),
  });
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState(false);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: key });
    await queryClient.invalidateQueries({
      queryKey: [audience === "client" ? "client-finance" : "finance"],
    });
  };
  const act = useMutation({
    mutationFn: async (kind: "send" | "validate" | "query" | "download") => {
      const data = annexure.data!;
      if (kind === "download")
        return downloadBillingAnnexure(audience, invoiceId, data.invoice.invoiceNumber);
      if (kind === "send") await sendBillingAnnexure(invoiceId);
      if (kind === "validate") await validateBill(invoiceId);
      if (kind === "query") await queryBill(invoiceId, query.trim());
      toast.success(
        kind === "send"
          ? "Annexure sent for validation"
          : kind === "validate"
            ? "Bill validated"
            : "Query sent to Finance",
      );
      setAsking(false);
      setQuery("");
      await refresh();
    },
    onError: (error: Error) => toast.error("Not done", { description: error.message }),
  });
  if (annexure.isPending) return <p className="mis-empty">Loading annexure…</p>;
  if (annexure.isError) return <p className="mis-empty">{annexure.error.message}</p>;
  const { invoice, validation, rows, colours } = annexure.data;
  const status = validation.status ? STATUS_COPY[validation.status] : null;
  return (
    <section className="bax" aria-label={`Billing annexure ${invoice.invoiceNumber}`}>
      <header className="bax-head">
        <div>
          <h3>Billing annexure · {invoice.invoiceNumber}</h3>
          <p>
            {rows.length} billed {rows.length === 1 ? "case" : "cases"} · total{" "}
            {money(invoice.totalAmount)}
          </p>
        </div>
        <div className="bax-status">
          {status ? (
            <span className={`rmo-pill ${status.tone}`}>{status.label}</span>
          ) : (
            <span className="rmo-pill">Not sent yet</span>
          )}
          {validation.ageing ? (
            <span className="rmo-pill is-bad">
              <TimerReset aria-hidden className="mr-1 inline size-3" />
              Over 3 days
            </span>
          ) : null}
        </div>
      </header>
      {validation.status === "QUERIED" && validation.query ? (
        <p className="bax-query">
          <MessageSquareWarning aria-hidden /> {validation.query}
        </p>
      ) : null}
      <div className="ann-colours mis-colours" aria-label="Colour code summary">
        {COLOUR_CODES.filter((code) => colours[code.value]).map((code) => (
          <span key={code.value} className="ann-chip">
            <i style={{ background: code.hex }} aria-hidden />
            {code.label}
            <strong>{colours[code.value]}</strong>
          </span>
        ))}
      </div>
      <div className="rmo-table-scroll">
        <table className="rmo-table">
          <thead>
            <tr>
              <th>Sapling ID</th>
              <th>Candidate</th>
              <th>Service</th>
              <th>Released</th>
              <th>Amount</th>
              <th>Colour code</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.caseNumber}-${index}`}>
                <td>{row.caseNumber || "—"}</td>
                <td>{row.candidateName || "—"}</td>
                <td>{row.description}</td>
                <td className="whitespace-nowrap">
                  {row.releasedAt ? formatDateTime(row.releasedAt) : "—"}
                </td>
                <td className="whitespace-nowrap">{money(row.lineTotal)}</td>
                <td>
                  {row.colour ? (
                    <span className="ann-status">
                      <i style={{ background: hexFor(row.colour) }} aria-hidden />
                      {row.colourLabel}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {asking ? (
        <label className="ops-field">
          <span>What is wrong with this bill? *</span>
          <textarea
            rows={3}
            maxLength={1000}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Bill query"
          />
        </label>
      ) : null}
      <footer className="bax-actions">
        <small>
          {validation.validatedAt
            ? `Validated ${formatDateTime(validation.validatedAt)}`
            : validation.sentAt
              ? `Sent ${formatDateTime(validation.sentAt)}`
              : ""}
        </small>
        <span className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => act.mutate("download")}>
            <Download aria-hidden /> CSV
          </Button>
          {audience === "finance" && validation.status !== "VALIDATED" ? (
            <Button
              size="sm"
              loading={act.isPending && act.variables === "send"}
              onClick={() => act.mutate("send")}
            >
              <Send aria-hidden /> {validation.status ? "Send again" : "Send for validation"}
            </Button>
          ) : null}
          {audience === "client" && validation.status === "PENDING" ? (
            asking ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setAsking(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={query.trim().length < 10}
                  loading={act.isPending && act.variables === "query"}
                  onClick={() => act.mutate("query")}
                >
                  Send query
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setAsking(true)}>
                  <MessageSquareWarning aria-hidden /> Raise a query
                </Button>
                <Button
                  size="sm"
                  loading={act.isPending && act.variables === "validate"}
                  onClick={() => act.mutate("validate")}
                >
                  <CheckCircle2 aria-hidden /> Validate bill
                </Button>
              </>
            )
          ) : null}
        </span>
      </footer>
    </section>
  );
}
