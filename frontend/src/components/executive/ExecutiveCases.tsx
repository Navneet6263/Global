import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Gauge,
  ShieldCheck,
} from "lucide-react";

import type { ExecutiveDashboard } from "@/lib/api/dashboards";

const statusTone: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-emerald-50 text-emerald-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  QA_REVIEW: "bg-violet-50 text-violet-700",
  CONSENT_PENDING: "bg-amber-50 text-amber-700",
  CANCELLED: "bg-red-50 text-red-700",
};

export function DeliverySignals({ data }: { data: ExecutiveDashboard }) {
  const signals = [
    {
      label: "Completed today",
      value: data.summary.completedToday,
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "New intake today",
      value: data.summary.createdToday,
      icon: Gauge,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "Average turnaround",
      value: `${data.performance.averageTatHours}h`,
      icon: Clock3,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Overdue exposure",
      value: data.summary.overdue,
      icon: AlertTriangle,
      tone: data.summary.overdue ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700",
    },
  ];
  return (
    <section className="surface rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-bold">Delivery signals</h2>
          <p className="text-[10px] text-muted-foreground">What needs leadership attention</p>
        </div>
      </div>
      <div className="mt-4 divide-y divide-border/70">
        {signals.map(({ icon: Icon, ...signal }) => (
          <div
            key={signal.label}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex items-center gap-3">
              <span className={`grid h-8 w-8 place-items-center rounded-lg ${signal.tone}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-[11px] text-muted-foreground">{signal.label}</span>
            </div>
            <strong className="num text-sm">{signal.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ExecutiveCaseMovement({ items }: { items: ExecutiveDashboard["recentCases"] }) {
  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="text-sm font-bold">Latest portfolio movement</h2>
          <p className="text-[10px] text-muted-foreground">Recently updated cases across clients</p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700"
        >
          View all <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="bg-secondary/35 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Case</th>
                <th className="px-3 py-2.5 font-semibold">Candidate</th>
                <th className="px-3 py-2.5 font-semibold">Client</th>
                <th className="px-3 py-2.5 font-semibold">Priority</th>
                <th className="px-5 py-2.5 font-semibold">State</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-border/60 text-xs transition hover:bg-orange-50/35"
                >
                  <td className="px-5 py-3">
                    <Link
                      to="/cases/$caseId"
                      params={{ caseId: item.id }}
                      className="font-bold hover:text-orange-700"
                    >
                      {item.caseNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-3 font-medium">{item.subject.fullName}</td>
                  <td className="px-3 py-3 text-muted-foreground">{item.client.displayName}</td>
                  <td className="px-3 py-3 text-muted-foreground">{humanize(item.priority)}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${statusTone[item.status] ?? "bg-stone-100 text-stone-600"}`}
                    >
                      {humanize(item.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid h-36 place-items-center text-xs text-muted-foreground">
          No case movement recorded yet.
        </div>
      )}
    </section>
  );
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
