import { AlertTriangle, Calculator, ShieldCheck } from "lucide-react";

import { MeterRow } from "@/components/dashboards/ui";
import type { FinanceOverview } from "@/lib/api/finance";
import { StakeholderPanel } from "../StakeholderShell";
import { money } from "./finance-utils";

export function FinanceInsights({ data }: { data: FinanceOverview | undefined }) {
  const ageingTotal = (data?.ageing ?? []).reduce((sum, item) => sum + item.value, 0);
  return (
    <StakeholderPanel
      title="Receivables intelligence"
      detail="Outstanding balance by collection age"
    >
      <div className="space-y-4 p-5">
        {data?.ageing.map((item) => (
          <MeterRow
            key={item.label}
            label={item.label}
            hint={money(item.value)}
            value={ageingTotal ? (item.value / ageingTotal) * 100 : 0}
            tone={
              item.label.startsWith("0")
                ? "success"
                : item.label.startsWith("31")
                  ? "warning"
                  : "destructive"
            }
          />
        ))}
        {!ageingTotal ? (
          <p className="py-8 text-center text-xs text-slate-500">No outstanding receivables.</p>
        ) : null}
      </div>
      <div className="grid border-t border-slate-200 sm:grid-cols-3 xl:grid-cols-1">
        <Control
          icon={Calculator}
          title="Server totals"
          text="Line values and tax are calculated before issue."
        />
        <Control
          icon={ShieldCheck}
          title="Payment guard"
          text="Overpayments and stale updates are rejected."
        />
        <Control
          icon={AlertTriangle}
          title="Due-date signal"
          text="Overdue status follows live balance and due date."
        />
      </div>
    </StakeholderPanel>
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
    <div className="flex gap-3 border-t border-slate-100 p-4 first:border-0 sm:border-l sm:border-t-0 sm:first:border-l-0 xl:border-l-0 xl:border-t xl:first:border-t-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-700">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xs font-semibold">{title}</p>
        <p className="mt-1 text-[10px] leading-4 text-slate-500">{text}</p>
      </div>
    </div>
  );
}
