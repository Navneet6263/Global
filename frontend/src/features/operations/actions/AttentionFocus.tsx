import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { navigationCountsQuery } from "../workspace/ops-workspace-api";

/** Today's focus: one quiet summary strip; each number opens the matching list. */
export function AttentionFocus() {
  const counts = useQuery(navigationCountsQuery);
  const c = counts.data?.counts;
  const tiles = [
    {
      label: "Overdue cases",
      value: c?.opsSlaRisk,
      hint: "Past their due time",
      tone: "bad",
      to: "/operations" as const,
      search: { view: "overdue" as const },
    },
    {
      label: "Escalated",
      value: c?.opsEscalated,
      hint: "Handle on high priority",
      tone: "bad",
      to: "/operations" as const,
      search: { view: "escalated" as const },
    },
    {
      label: "Cases without an RM",
      value: c?.opsUnassigned,
      hint: "Assign from the work queue",
      tone: "warn",
      to: "/operations" as const,
      search: { view: "needs-rm" as const },
    },
    {
      label: "Companies without an RM",
      value: c?.opsClientsWithoutRm,
      hint: "Set once, cases follow",
      tone: "warn",
      to: "/operations/clients" as const,
      search: { view: "without_rm" as const },
    },
    {
      label: "New sign-ups",
      value: c?.opsSignups,
      hint: "Review and approve",
      tone: "info",
      to: "/operations/onboarding" as const,
      search: {},
    },
    {
      label: "Stopped",
      value: c?.opsStopped,
      hint: "On client instruction",
      tone: "neutral",
      to: "/operations" as const,
      search: { view: "stopped" as const },
    },
    {
      label: "Re-opened",
      value: c?.opsReopened,
      hint: "Live after a reopening",
      tone: "info",
      to: "/operations/cases" as const,
      search: {},
    },
  ];
  return (
    <section className="attn-card attn-summary" aria-label="Today's focus">
      {tiles.map(({ label, value, hint, tone, to, search }) => (
        <Link
          key={label}
          to={to}
          search={search as never}
          className={`attn-stat ${value ? `is-${tone}` : value === 0 ? "is-clear" : ""}`}
        >
          <small>{label}</small>
          <strong className="num">
            {value === undefined ? "—" : value.toLocaleString("en-IN")}
          </strong>
          <span>{value === 0 ? "All clear" : hint}</span>
        </Link>
      ))}
    </section>
  );
}
