import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CalendarClock, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportExecutiveDashboard, scheduleExecutiveDashboard } from "@/lib/api/dashboards";
import type { Option } from "../workspace/OpsWorkQueue";

const periods = [
  { months: 1, label: "Last month" },
  { months: 3, label: "Last 3 months" },
  { months: 6, label: "Last 6 months" },
  { months: 12, label: "Last 12 months" },
];

/** Standard MIS pack from the audited executive export: daily, weekly or monthly delivery. */
export function OpsMisCard({ clients }: { clients: Option[] }) {
  const [months, setMonths] = useState(1);
  const [clientId, setClientId] = useState("");
  const [email, setEmail] = useState("");
  const [deliveryAt, setDeliveryAt] = useState("");
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const filters = { months, clientId: clientId || undefined };
  const download = useMutation({
    mutationFn: (kind: "pdf" | "csv") => exportExecutiveDashboard(kind, filters),
    onSuccess: () => toast.success("MIS downloaded"),
    onError: (error: Error) => toast.error("MIS download failed", { description: error.message }),
  });
  const schedule = useMutation({
    mutationFn: () =>
      scheduleExecutiveDashboard({
        ...filters,
        recipientEmail: email.trim(),
        deliveryAt: new Date(deliveryAt).toISOString(),
        format,
      }),
    onSuccess: (result) => {
      toast.success("MIS delivery scheduled", {
        description:
          new Date(result.deliveryAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) +
          " IST",
      });
      setEmail("");
      setDeliveryAt("");
    },
    onError: (error: Error) => toast.error("Could not schedule", { description: error.message }),
  });
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const future = Boolean(deliveryAt) && Date.parse(deliveryAt) > Date.now();
  return (
    <section className="client-panel ops-mis" aria-label="Standard MIS">
      <header className="client-panel-head">
        <div>
          <h2>Standard MIS pack</h2>
          <p className="ops-subtle">
            Performance, SLA, client and team summary with the case register.
          </p>
        </div>
      </header>
      <div className="ops-report-filters is-compact">
        <label>
          <span>Period</span>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {periods.map((period) => (
              <option key={period.months} value={period.months}>
                {period.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Client</span>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.value} value={client.value}>
                {client.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => download.mutate("pdf")}
          loading={download.isPending && download.variables === "pdf"}
          disabled={download.isPending}
        >
          <Download aria-hidden />
          PDF
        </Button>
        <Button
          variant="outline"
          onClick={() => download.mutate("csv")}
          loading={download.isPending && download.variables === "csv"}
          disabled={download.isPending}
        >
          <Download aria-hidden />
          CSV
        </Button>
      </div>
      <form
        className="ops-schedule"
        onSubmit={(event) => {
          event.preventDefault();
          if (validEmail && future) schedule.mutate();
        }}
      >
        <p className="ops-label">
          <CalendarClock aria-hidden className="mr-1 inline size-4" />
          Email it later
        </p>
        <div className="ops-report-filters is-compact">
          <label>
            <span>Recipient email</span>
            <input
              type="email"
              value={email}
              maxLength={254}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </label>
          <label>
            <span>Deliver at</span>
            <input
              type="datetime-local"
              value={deliveryAt}
              onChange={(e) => setDeliveryAt(e.target.value)}
            />
          </label>
          <label>
            <span>Format</span>
            <select value={format} onChange={(e) => setFormat(e.target.value as "pdf" | "csv")}>
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
            </select>
          </label>
        </div>
        {deliveryAt && !future ? <p className="ops-report-error">Choose a future time.</p> : null}
        <Button
          type="submit"
          className="mt-3"
          disabled={!validEmail || !future}
          loading={schedule.isPending}
        >
          Schedule delivery
        </Button>
      </form>
    </section>
  );
}
