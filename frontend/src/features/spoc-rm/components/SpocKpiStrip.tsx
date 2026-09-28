import { Link } from "@tanstack/react-router";
import {
  AlarmClock,
  BriefcaseBusiness,
  Hourglass,
  MessageSquareWarning,
  RotateCcw,
  TrendingUp,
  UserX,
  Wallet,
} from "lucide-react";
import { OversightMetric } from "@/features/admin-dashboard/components/oversight-ui";
import type { SpocOverview } from "../contracts/spoc";
import type { SpocRecordsSearch } from "../config/spoc-search";
import { compactMoney, date } from "../utils/spoc-format";
import type { SpocScopeFilters } from "./SpocFilterBar";

type Target =
  | { to: "/spoc-rm/records"; search: SpocRecordsSearch }
  | { to: "/spoc-rm"; search: SpocScopeFilters & { category: "client_clarifications" } };

/** Eight headline figures; each opens the exact records behind it. */
export function SpocKpiStrip({ data, scope }: { data: SpocOverview; scope: SpocScopeFilters }) {
  const { kpis, window } = data;
  const cases = (search: SpocRecordsSearch): Target => ({
    to: "/spoc-rm/records",
    search: { ...scope, domain: "cases", ...search },
  });
  const cards = [
    {
      label: "Active cases",
      value: kpis.activeCases,
      detail: `${kpis.completed} completed since ${date(window.from)}`,
      icon: BriefcaseBusiness,
      tone: "blue" as const,
      target: cases({ activeOnly: true }),
    },
    {
      label: "Overdue",
      value: kpis.overdue,
      detail: "Active cases past their SLA date",
      icon: AlarmClock,
      tone: kpis.overdue ? ("rose" as const) : ("mint" as const),
      target: cases({ sla: "overdue" }),
    },
    {
      label: "SLA due in 8h",
      value: kpis.slaApproaching,
      detail: "At risk of breaching soon",
      icon: Hourglass,
      tone: kpis.slaApproaching ? ("amber" as const) : ("mint" as const),
      target: cases({ sla: "approaching" }),
    },
    {
      label: "No ops owner",
      value: kpis.unassigned,
      detail: "Active cases not yet allocated",
      icon: UserX,
      tone: kpis.unassigned ? ("amber" as const) : ("mint" as const),
      target: cases({ bucket: "pending", bucketRole: "OPS_MANAGER" }),
    },
    {
      label: "QA rework",
      value: kpis.qaRework,
      detail: `Returned by QA since ${date(window.from)}`,
      icon: RotateCcw,
      tone: kpis.qaRework ? ("violet" as const) : ("mint" as const),
      target: {
        to: "/spoc-rm/records",
        search: { ...scope, domain: "qa", bucket: "exceptions" },
      } as Target,
    },
    {
      label: "Client actions",
      value: kpis.openClientActions,
      detail: "Open clarifications + rejected documents",
      icon: MessageSquareWarning,
      tone: kpis.openClientActions ? ("amber" as const) : ("mint" as const),
      target: { to: "/spoc-rm", search: { ...scope, category: "client_clarifications" } } as Target,
    },
    {
      label: "Outstanding",
      value: compactMoney(kpis.outstanding),
      detail: `${compactMoney(kpis.overdueReceivable)} overdue receivable`,
      icon: Wallet,
      tone: kpis.overdueReceivable ? ("rose" as const) : ("mint" as const),
      target: {
        to: "/spoc-rm/records",
        search: { clientId: scope.clientId, domain: "invoices" },
      } as Target,
    },
    {
      label: "Open pipeline",
      value: compactMoney(kpis.openPipeline),
      detail: "Estimated value of open opportunities",
      icon: TrendingUp,
      tone: "blue" as const,
      target: {
        to: "/spoc-rm/records",
        search: { clientId: scope.clientId, domain: "opportunities" },
      } as Target,
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Headline figures">
      {cards.map(({ target, ...card }) => (
        <Link
          key={card.label}
          to={target.to}
          search={target.search}
          className="rounded-[1.35rem] transition hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none"
        >
          <OversightMetric {...card} />
        </Link>
      ))}
    </section>
  );
}
