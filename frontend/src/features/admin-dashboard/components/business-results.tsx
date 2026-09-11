import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChartNoAxesCombined, Wallet } from "lucide-react";
import type { ControlTowerSnapshot } from "@/lib/contracts/dashboard";

type BusinessData = NonNullable<ControlTowerSnapshot["business"]>;
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const outcomeStyles: Record<string, { label: string; colour: string }> = {
  CLEAR: { label: "Clear", colour: "bg-emerald-500" },
  DISCREPANCY: { label: "Discrepancy", colour: "bg-rose-400" },
  UNABLE_TO_VERIFY: { label: "Unable to verify", colour: "bg-violet-400" },
  PENDING: { label: "Result pending", colour: "bg-amber-400" },
};

export function BusinessResults({ data }: { data: BusinessData }) {
  const finance = data.finance;
  const metrics = [
    { label: "Billed", value: finance.billed, colour: "bg-sky-400" },
    { label: "Payment received", value: finance.collected, colour: "bg-emerald-500" },
    { label: "Payment pending", value: finance.outstanding, colour: "bg-amber-400" },
    { label: "Overdue payment", value: finance.overdue, colour: "bg-rose-400" },
  ];
  const peak = Math.max(1, ...metrics.map((metric) => metric.value));
  const outcomes = Object.entries(data.outcomes).map(([key, value]) => ({
    key,
    value,
    ...(outcomeStyles[key] ?? { label: key.replaceAll("_", " "), colour: "bg-slate-400" }),
  }));
  const total = outcomes.reduce((sum, row) => sum + row.value, 0);
  const pending = data.outcomes["PENDING"] ?? 0;
  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
      <section
        aria-label="Revenue and collections"
        className="min-w-0 overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-white shadow-[var(--shadow-card)]"
      >
        <header className="flex items-center justify-between gap-3 bg-emerald-50/70 px-5 py-4">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-emerald-700" aria-hidden />
            <h2 className="text-sm font-semibold">Revenue & collections</h2>
          </div>
          <Link
            to="/admin/finance"
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800"
          >
            Finance <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </header>
        <div className="p-5">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Payment received</p>
              <p className="num mt-1 text-2xl font-semibold tracking-tight text-emerald-800">
                {money(finance.collected)}
              </p>
            </div>
            <p className="max-w-52 text-xs text-muted-foreground">
              Invoices created in the last 12 months · current balances
            </p>
          </div>
          <ul className="space-y-3" aria-label="Billing comparison">
            {metrics.map((metric) => (
              <li key={metric.label}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span>{metric.label}</span>
                  <span className="num font-semibold">{money(metric.value)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary/60" aria-hidden>
                  <div
                    className={`h-full rounded-full ${metric.colour}`}
                    style={{ width: `${(metric.value / peak) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-muted-foreground">
            {metrics.every((metric) => metric.value === 0)
              ? "No billing activity in this period. "
              : ""}
            Overdue is part of pending. Credits can reduce the balance; CRM deal value is not
            payment received.
          </p>
        </div>
      </section>
      <section
        aria-label="Verification results"
        className="min-w-0 overflow-hidden rounded-[1.75rem] border border-violet-100 bg-white shadow-[var(--shadow-card)]"
      >
        <header className="flex items-center justify-between gap-3 bg-violet-50/70 px-5 py-4">
          <div className="flex items-center gap-2">
            <ChartNoAxesCombined className="size-4 text-violet-700" aria-hidden />
            <h2 className="text-sm font-semibold">Verification results</h2>
          </div>
          <Link
            to="/admin/analytics"
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-800"
          >
            Analytics <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </header>
        <div className="p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Checks with a recorded result</p>
              <p className="num mt-1 text-2xl font-semibold tracking-tight">
                {(total - pending).toLocaleString("en-IN")}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {total.toLocaleString("en-IN")}
                </span>
              </p>
            </div>
            <span className="num rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
              {pending.toLocaleString("en-IN")} pending
            </span>
          </div>
          {total ? (
            <>
              <div className="my-5 flex h-4 overflow-hidden rounded-full bg-secondary" aria-hidden>
                {outcomes.map((row) => (
                  <div
                    key={row.key}
                    className={row.colour}
                    style={{ width: `${(row.value / total) * 100}%` }}
                  />
                ))}
              </div>
              <ul
                className="grid gap-x-5 gap-y-4 sm:grid-cols-2"
                aria-label="Check outcome distribution"
              >
                {outcomes.map((row) => (
                  <li key={row.key} className="flex items-center gap-2 text-xs">
                    <span className={`size-2 shrink-0 rounded-full ${row.colour}`} aria-hidden />
                    <span className="flex-1">{row.label}</span>
                    <span className="num font-semibold">{row.value.toLocaleString("en-IN")}</span>
                    <span className="num text-muted-foreground">
                      {Math.round((row.value / total) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="my-6 rounded-xl bg-secondary/40 px-4 py-6 text-center text-xs text-muted-foreground">
              No verification checks in this period.
            </p>
          )}
          <p className="mt-5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            Checks on cases initiated in the last 12 months. A recorded result is not final QA
            approval or report release.
          </p>
        </div>
      </section>
    </div>
  );
}
