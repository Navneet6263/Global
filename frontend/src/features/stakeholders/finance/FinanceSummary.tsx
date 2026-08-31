import { AlertTriangle, Landmark, ReceiptIndianRupee, WalletCards } from "lucide-react";

import type { FinanceOverview } from "@/lib/api/finance";
import { money } from "./finance-utils";

type Tone = "success" | "warning" | "critical";

export function FinanceSummary({ data }: { data: FinanceOverview | undefined }) {
  const summary = data?.summary;
  const billed = summary?.billed ?? 0;
  const collected = summary?.collected ?? 0;
  const outstanding = summary?.outstanding ?? 0;
  const realised = ratio(collected, billed);
  const cards = [
    {
      label: "Collected",
      value: money(collected),
      detail: `${realised}% of billed value realised`,
      icon: Landmark,
      progress: realised,
      tone: "success",
    },
    {
      label: "Outstanding",
      value: money(outstanding),
      detail: `${summary?.openInvoiceCount ?? 0} open invoices`,
      icon: WalletCards,
      progress: ratio(outstanding, billed),
      tone: "warning",
    },
    {
      label: "Overdue",
      value: money(summary?.overdueAmount ?? 0),
      detail: `${summary?.overdueCount ?? 0} beyond due date`,
      icon: AlertTriangle,
      progress: ratio(summary?.overdueAmount ?? 0, billed),
      tone: summary?.overdueCount ? "critical" : "success",
    },
  ] satisfies Array<{
    label: string;
    value: string;
    detail: string;
    icon: typeof Landmark;
    progress: number;
    tone: Tone;
  }>;

  return (
    <section
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]"
      aria-label="Finance summary"
    >
      <article
        className="relative min-h-48 overflow-hidden rounded-[1.75rem] p-5 text-white shadow-[var(--shadow-raise)]"
        style={{
          background: "linear-gradient(145deg, oklch(0.43 0.07 168), oklch(0.29 0.045 172) 72%)",
        }}
      >
        <span aria-hidden className="absolute -right-10 -top-12 size-40 rounded-full bg-white/10" />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
                Total billed
              </p>
              <p className="num mt-5 text-[2.1rem] font-medium leading-none tracking-[-0.05em]">
                {money(billed)}
              </p>
            </div>
            <span className="grid size-10 place-items-center rounded-full bg-white/10 text-amber-200">
              <ReceiptIndianRupee className="size-4.5" aria-hidden />
            </span>
          </div>
          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between text-[10px] text-white/65">
              <span>{summary?.invoiceCount ?? 0} invoices in register</span>
              <span className="num font-semibold text-white">{realised}% realised</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full rounded-full bg-amber-300"
                style={{ width: `${realised}%` }}
              />
            </div>
          </div>
        </div>
      </article>

      {cards.map((card) => {
        const tone = tones[card.tone];
        return (
          <article
            key={card.label}
            className="flex min-h-48 flex-col rounded-[1.75rem] border border-white/80 bg-card/85 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-raise)]"
            style={{
              borderTop: `2px solid ${tone.edge}`,
              background: `linear-gradient(180deg, ${tone.fill}, color-mix(in oklab, var(--card) 90%, transparent) 62%)`,
            }}
          >
            <div className="flex items-center gap-2.5">
              <span className={`grid size-9 place-items-center rounded-xl ${tone.icon}`}>
                <card.icon className="size-4" aria-hidden />
              </span>
              <p className="text-[13px] font-semibold text-foreground">{card.label}</p>
            </div>
            <div className="mt-auto">
              <p className="num text-[1.45rem] font-medium leading-none tracking-[-0.04em] text-foreground">
                {card.value}
              </p>
              <p className="mt-2 text-[10px] text-muted-foreground">{card.detail}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className={`block h-full rounded-full ${tone.bar}`}
                  style={{ width: `${card.progress}%` }}
                />
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

const tones: Record<Tone, { edge: string; fill: string; icon: string; bar: string }> = {
  success: {
    edge: "var(--success)",
    fill: "var(--success-soft)",
    icon: "bg-success-soft text-success-foreground",
    bar: "bg-success",
  },
  warning: {
    edge: "var(--warning)",
    fill: "var(--warning-soft)",
    icon: "bg-warning-soft text-warning-foreground",
    bar: "bg-warning",
  },
  critical: {
    edge: "var(--critical)",
    fill: "var(--critical-soft)",
    icon: "bg-critical-soft text-critical-foreground",
    bar: "bg-critical",
  },
};

function ratio(value: number, total: number) {
  return total ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0;
}
