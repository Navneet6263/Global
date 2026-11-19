import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Mail, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { DOT, SOFT, type Tone } from "@/kit";
import { getSession } from "@/lib/api/auth";
import type { ExceptionsDashboard, OperationsDashboard } from "@/lib/api/dashboards";
import { apiRequest } from "@/lib/backend-api/client";
import { cn } from "@/lib/utils";
import { ClientCreateActions } from "./ClientWorkspaceHeader";
import { useClientRm } from "./use-client-rm";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function greeting(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Pill({
  tone,
  to,
  search,
  children,
}: {
  tone: Tone;
  to: string;
  search?: Record<string, string>;
  children: ReactNode;
}) {
  return (
    <Link
      to={to as "/client-portal"}
      search={search as never}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-current/25 px-3 py-1 text-xs font-semibold transition hover:brightness-95",
        SOFT[tone],
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT[tone])} aria-hidden />
      {children}
    </Link>
  );
}

/** Greeting card like the Task dashboard: date, greeting, today's pills, main actions. */
export function ClientHero({
  operations,
  exceptions,
}: {
  operations?: OperationsDashboard;
  exceptions?: ExceptionsDashboard;
}) {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const counts = useQuery({
    queryKey: ["navigation-counts", "client-admin"],
    queryFn: ({ signal }) =>
      apiRequest<{ counts: Record<string, number> }>("/dashboards/navigation", { signal }),
    enabled: Boolean(session.data),
    staleTime: 30_000,
  });
  const rm = useClientRm();
  const person = rm.data?.rm ?? null;
  const now = new Date();
  const first = session.data?.displayName?.split(" ")[0] ?? "there";
  const actions = exceptions?.summary.clientActions ?? 0;
  const reviews = counts.data?.counts["clientReviews"] ?? 0;
  const overdue = operations?.summary.overdue ?? 0;
  const ready = operations?.statusMix["COMPLETED"] ?? 0;

  const pills: ReactNode[] = [];
  if (reviews)
    pills.push(
      <Pill key="review" tone="brand" to="/client-portal/review">
        {plural(reviews, "submission")} to review
      </Pill>,
    );
  if (actions)
    pills.push(
      <Pill key="action" tone="warn" to="/client-portal/actions">
        {plural(actions, "request")} need your action
      </Pill>,
    );
  if (overdue)
    pills.push(
      <Pill key="overdue" tone="bad" to="/client-portal/verifications">
        {overdue} past turnaround
      </Pill>,
    );
  if (ready)
    pills.push(
      <Pill
        key="ready"
        tone="good"
        to="/client-portal/verifications"
        search={{ status: "COMPLETED" }}
      >
        {plural(ready, "verification")} completed
      </Pill>,
    );
  if (operations && exceptions && !pills.length)
    pills.push(
      <Pill key="clear" tone="good" to="/client-portal/verifications">
        Nothing needs you today
      </Pill>,
    );

  return (
    <section aria-label="Welcome" className="rounded-xl border border-line bg-surface shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6 pb-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wider text-brand uppercase">
            {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-1 text-[28px] leading-tight font-bold tracking-tight text-ink sm:text-[32px]">
            {greeting(now)}, {first}
          </h1>
          {pills.length ? <div className="mt-3 flex flex-wrap gap-2">{pills}</div> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ClientCreateActions />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-line bg-subtle/50 px-6 py-3 text-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[11px] font-semibold tracking-wider text-dim uppercase">
            Your relationship manager
          </span>
          {person ? (
            <>
              <strong className="font-semibold text-ink">{person.name}</strong>
              <a
                href={`mailto:${person.email}`}
                className="inline-flex items-center gap-1 text-dim hover:text-brand"
              >
                <Mail className="size-3.5" aria-hidden />
                {person.email}
              </a>
              {person.phone ? (
                <a
                  href={`tel:${person.phone}`}
                  className="inline-flex items-center gap-1 text-dim hover:text-brand"
                >
                  <Phone className="size-3.5" aria-hidden />
                  {person.phone}
                </a>
              ) : null}
            </>
          ) : (
            <span className="text-dim">
              {rm.isLoading ? "Loading…" : "Being assigned. Use Queries & support meanwhile."}
            </span>
          )}
        </div>
        <span className="text-xs text-dim">
          {session.data?.clientName ? `${session.data.clientName} · ` : ""}Reports are downloadable
          only after authorised release.
        </span>
      </div>
    </section>
  );
}
