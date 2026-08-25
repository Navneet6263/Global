import { ArrowUpRight, Banknote, CircleDollarSign, Gauge, Target } from "lucide-react";
import { Link } from "@tanstack/react-router";

import type { ExecutiveDashboard } from "@/lib/api/dashboards";

export function ExecutiveBusinessHealth({ data }: { data: ExecutiveDashboard }) {
  const crm = data.businessHealth.crm;
  const finance = data.businessHealth.finance;
  return (
    <section className="surface rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">Business health</h2>
          <p className="text-[10px] text-muted-foreground">
            Commercial pipeline and collection position for this portfolio lens
          </p>
        </div>
        <div className="flex gap-2">
          <WorkspaceLink to="/sales-crm" label="Sales" />
          <WorkspaceLink to="/finance" label="Finance" />
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Target}
          label="Open pipeline"
          value={money(crm.openPipeline)}
          detail={`${money(crm.weightedForecast)} weighted`}
          tone="bg-violet-50 text-violet-700"
        />
        <Metric
          icon={Gauge}
          label="Win rate"
          value={crm.winRate === null ? "—" : `${crm.winRate}%`}
          detail={`${money(crm.closedWon)} closed won`}
          tone="bg-blue-50 text-blue-700"
        />
        <Metric
          icon={CircleDollarSign}
          label="Collections"
          value={money(finance.collected)}
          detail={`${money(finance.billed)} billed`}
          tone="bg-emerald-50 text-emerald-700"
        />
        <Metric
          icon={Banknote}
          label="Receivables"
          value={money(finance.outstanding)}
          detail={`${money(finance.overdue)} overdue`}
          tone={finance.overdue ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}
        />
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-white p-3">
      <span className={`grid h-7 w-7 place-items-center rounded-lg ${tone}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <p className="mt-3 text-[9px] font-semibold text-muted-foreground">{label}</p>
      <strong className="num mt-0.5 block text-lg">{value}</strong>
      <span className="mt-1 block text-[8px] text-muted-foreground">{detail}</span>
    </div>
  );
}
function WorkspaceLink({ to, label }: { to: "/sales-crm" | "/finance"; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[9px] font-semibold hover:bg-secondary"
    >
      {label}
      <ArrowUpRight className="h-3 w-3" />
    </Link>
  );
}
function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
