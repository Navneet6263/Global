import { CalendarClock, CheckCircle2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { scheduleExecutiveDashboard, type ExecutiveDashboardFilters } from "@/lib/api/dashboards";

export function ExecutiveScheduleDialog({
  open,
  filters,
  onClose,
}: {
  open: boolean;
  filters: ExecutiveDashboardFilters;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [deliveryAt, setDeliveryAt] = useState(defaultDelivery());
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const [pending, setPending] = useState(false);
  if (!open) return null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      const result = await scheduleExecutiveDashboard({
        ...filters,
        recipientEmail: email,
        deliveryAt: new Date(deliveryAt).toISOString(),
        format,
      });
      toast.success("Executive brief scheduled", {
        description: `Delivery queued for ${new Date(result.deliveryAt).toLocaleString("en-IN")}`,
      });
      onClose();
    } catch (error) {
      toast.error("Could not schedule the brief", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPending(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-stone-950/25 p-4 backdrop-blur-[1px]"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-50 text-orange-700">
              <CalendarClock className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold">Schedule portfolio brief</h2>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Current filters are locked into this delivery.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg bg-secondary"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <Field label="Recipient email">
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="leadership@company.com"
              className="h-11 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </Field>
          <Field label="Delivery time">
            <input
              required
              type="datetime-local"
              min={minimumDelivery()}
              value={deliveryAt}
              onChange={(event) => setDeliveryAt(event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-[10px] font-semibold">Preferred format</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["pdf", "csv"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFormat(item)}
                  className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-[10px] font-bold uppercase ${format === item ? "border-orange-300 bg-orange-50 text-orange-800" : "border-border bg-white"}`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> {item}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-xl px-3 text-[10px] font-semibold hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="h-9 rounded-xl bg-foreground px-4 text-[10px] font-semibold text-background disabled:opacity-50"
          >
            {pending ? "Scheduling…" : "Schedule delivery"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold">{label}</span>
      {children}
    </label>
  );
}
function minimumDelivery() {
  return localDate(new Date(Date.now() + 60_000));
}
function defaultDelivery() {
  return localDate(new Date(Date.now() + 86_400_000));
}
function localDate(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
