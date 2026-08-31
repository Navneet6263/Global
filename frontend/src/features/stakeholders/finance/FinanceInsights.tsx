import { AlertTriangle, Calculator, ShieldCheck, WalletCards } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Section } from "@/components/layout/section";
import type { FinanceOverview } from "@/lib/api/finance";
import { money } from "./finance-utils";

export function FinanceInsights({ data }: { data: FinanceOverview | undefined }) {
  const ageing = data?.ageing ?? [];
  const total = ageing.reduce((sum, item) => sum + item.value, 0);
  const peak = Math.max(1, ...ageing.map((item) => item.value));
  return (
    <Section
      title="Receivables intelligence"
      description="Outstanding balance grouped by collection age"
      padded={false}
      className="h-fit"
    >
      {total ? (
        <div className="space-y-4 p-5">
          {ageing.map((item, index) => {
            const share = Math.round((item.value / total) * 100);
            return (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${index === 0 ? "bg-success" : index === 1 ? "bg-warning" : "bg-critical"}`}
                    />
                    <span className="truncate text-[11px] font-medium text-foreground">
                      {item.label}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="num text-[11px] font-semibold text-foreground">
                      {money(item.value)}
                    </p>
                    <p className="num text-[9px] text-muted-foreground">{share}%</p>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <span
                    className={`block h-full rounded-full ${index === 0 ? "bg-success" : index === 1 ? "bg-warning" : "bg-critical"}`}
                    style={{ width: `${Math.max(3, (item.value / peak) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-5">
          <EmptyState
            icon={WalletCards}
            title="No outstanding receivables"
            description="Ageing buckets will appear when an issued invoice has an open balance."
            className="py-9"
          />
        </div>
      )}
      <div className="grid border-t border-border">
        <Control
          icon={Calculator}
          title="Server-calculated totals"
          text="Line value and tax are recalculated before issue."
        />
        <Control
          icon={ShieldCheck}
          title="Reconciliation guard"
          text="Stale updates and overpayments are rejected."
        />
        <Control
          icon={AlertTriangle}
          title="Live due-date signal"
          text="Overdue exposure follows balance and due date."
        />
      </div>
    </Section>
  );
}

function Control({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Calculator;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 border-t border-border/70 p-4 first:border-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mint-soft text-mint-deep">
        <Icon className="size-4" aria-hidden />
      </span>
      <div>
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
