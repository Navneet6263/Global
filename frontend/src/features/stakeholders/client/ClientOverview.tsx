import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock3, Files, UserRound } from "lucide-react";
import type { ExceptionsDashboard, OperationsDashboard } from "@/lib/api/dashboards";

export function ClientOverview({
  operations,
  exceptions,
}: {
  operations: OperationsDashboard;
  exceptions?: ExceptionsDashboard;
}) {
  const cards = [
    {
      label: "All verifications",
      value: operations.summary.total,
      icon: Files,
      tone: "#1d4ed8",
      status: undefined,
      to: "/client-portal/verifications" as const,
    },
    {
      label: "Needs your action",
      value: exceptions?.summary.clientActions ?? "—",
      icon: UserRound,
      tone: "#b45309",
      status: undefined,
      to: "/client-portal/actions" as const,
    },
    {
      label: "Completed",
      value: operations.statusMix["COMPLETED"] ?? 0,
      icon: CheckCircle2,
      tone: "#15803d",
      status: "COMPLETED",
      to: "/client-portal/verifications" as const,
    },
    {
      label: "Awaiting documents",
      value: operations.statusMix["DOCUMENT_PENDING"] ?? 0,
      icon: Clock3,
      tone: "#475569",
      status: "DOCUMENT_PENDING",
      to: "/client-portal/verifications" as const,
    },
  ];
  return (
    <section className="client-panel client-metrics" aria-label="Portfolio summary">
      {cards.map(({ label, value, icon: Icon, tone, status, to }) => (
        <Link
          key={label}
          to={to}
          search={{ status }}
          className="client-metric"
          style={{ color: tone }}
        >
          <Icon aria-hidden />
          <div>
            <small>{label}</small>
            <strong className="num">{value}</strong>
          </div>
        </Link>
      ))}
      <div className="client-metric" style={{ color: "#b45309" }}>
        <AlertTriangle aria-hidden />
        <div>
          <small>Overdue cases</small>
          <strong className="num">{operations.summary.overdue}</strong>
        </div>
      </div>
    </section>
  );
}
