import { ColumnChart, MeterRow } from "@/components/dashboards/ui";
import type { OperationsDashboard } from "@/lib/api/dashboards";
import { StakeholderPanel } from "../StakeholderShell";

export function ClientInsights({ data }: { data: OperationsDashboard | undefined }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
      <StakeholderPanel title="Portfolio movement" detail="Monthly intake and completed cases">
        <div className="p-5">
          <ColumnChart
            data={(data?.trend ?? []).map((point) => ({
              label: point.month,
              value: point.created,
              tone: "info" as const,
            }))}
          />
          {!data?.trend.length ? (
            <Empty text="Volume trend will appear after case intake." />
          ) : null}
        </div>
      </StakeholderPanel>
      <StakeholderPanel title="Outcome health" detail="Results across completed checks">
        <div className="space-y-4 p-5">
          <OutcomeMix values={data?.outcomeMix ?? {}} />
        </div>
      </StakeholderPanel>
    </div>
  );
}

function OutcomeMix({ values }: { values: Record<string, number> }) {
  const entries = Object.entries(values);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return <Empty text="No completed check outcomes yet." />;
  return entries.map(([label, value]) => (
    <MeterRow
      key={label}
      label={humanize(label)}
      hint={String(value)}
      value={(value / total) * 100}
      tone={label === "CLEAR" ? "success" : label === "DISCREPANCY" ? "destructive" : "warning"}
    />
  ));
}
function Empty({ text }: { text: string }) {
  return <p className="py-12 text-center text-xs text-slate-500">{text}</p>;
}
function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
