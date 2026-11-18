import { useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Hourglass,
  IndianRupee,
  Inbox,
  ListTodo,
  MapPin,
  Search,
  ShieldCheck,
  Upload,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  LoadingState,
  Panel,
  Pill,
  StatCard,
  StatGrid,
} from "@/components/workspace/kit";
import { useVendorRequests } from "@/features/vendor/use-vendor-requests";
import { vendorKpiCards } from "@/features/vendor/vendor-request-model";
import {
  currentIstMonth,
  homeCounts,
  monthLabel,
  nextActions,
} from "@/features/vendor-checks/vendor-home-model";
import { readable, rupees } from "@/features/vendor-checks/vendor-job-format";
import { cachedIdentity } from "@/lib/auth/platform-session";
import { vendorQueueApi, vendorWorkApi } from "@/lib/backend-api/vendor-checks";
import { formatDate } from "@/lib/formatting";

export const Route = createFileRoute("/vendor/")({
  head: () => ({ meta: [{ title: "Vendor home — Sapling Global" }] }),
  component: VendorHomePage,
});

const greeting = (hour: number) =>
  hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

/**
 * Vendor Home: what needs doing now, money this month, the open queue and the document
 * requests, each with one click to the full page.
 */
function VendorHomePage() {
  const identity = cachedIdentity();
  // A vendor login is usually a company ("Field Co"): greet it by its full name.
  const name = identity?.fullName.trim() ?? "";
  const month = currentIstMonth();
  const board = useQuery({
    queryKey: ["vendor-checks", "home"],
    queryFn: () => vendorWorkApi.list({}),
  });
  const queue = useQuery({
    queryKey: ["vendor-queue", "", ""],
    queryFn: () => vendorQueueApi.list({}),
    refetchInterval: 60_000,
  });
  const earnings = useQuery({
    queryKey: ["vendor-earnings", month],
    queryFn: () => vendorWorkApi.earnings(month),
  });
  const requests = useVendorRequests({ page: 1, pageSize: 1 });

  const counts = board.data ? homeCounts(board.data.summary) : null;
  const actions = useMemo(
    () => (board.data ? nextActions(board.data.items, identity?.userId ?? "") : []),
    [board.data, identity?.userId],
  );

  return (
    <div className="grid gap-5">
      <PageHeader
        title={`${greeting(new Date().getHours())}${name ? `, ${name}` : ""}`}
        description="Your verification work, payments and requests in one place."
        actions={
          <Button asChild>
            <Link to="/vendor/queue">
              <ListTodo aria-hidden /> Find new work
            </Link>
          </Button>
        }
      />

      <StatGrid label="Your work at a glance">
        <StatCard
          icon={Inbox}
          tone={counts?.toAccept ? "info" : "neutral"}
          label="New to accept"
          value={counts ? counts.toAccept : "—"}
          hint="Checks sent to you"
          to="/vendor/checks?status=ASSIGNED"
        />
        <StatCard
          icon={ClipboardCheck}
          tone={counts?.overdue ? "bad" : "action"}
          label="In progress"
          value={counts ? counts.working : "—"}
          hint={counts?.overdue ? `${counts.overdue} overdue` : "None overdue"}
          to="/vendor/checks?status=IN_PROGRESS"
        />
        <StatCard
          icon={Hourglass}
          tone="violet"
          label="In review"
          value={counts ? counts.inReview : "—"}
          hint="Submitted, waiting for approval"
          to="/vendor/checks?status=SUBMITTED"
        />
        <StatCard
          icon={Wallet}
          tone="good"
          label={`Earned in ${monthLabel(month).split(" ")[0]}`}
          value={earnings.data ? rupees(earnings.data.totals.total) : "—"}
          hint={
            earnings.data
              ? `${earnings.data.totals.checks} ${earnings.data.totals.checks === 1 ? "check" : "checks"} · ${rupees(earnings.data.inReview.value)} in review`
              : undefined
          }
          to="/vendor/earnings"
        />
      </StatGrid>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Panel
          title="Needs you now"
          count={actions.length}
          description="Most urgent first. Open a check to accept it, work on it or review it."
          actions={
            <Link
              to="/vendor/checks"
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-blue-700 hover:underline"
            >
              All my checks <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        >
          {board.isError ? (
            <EmptyState tone="bad" title="Checks unavailable" detail={board.error.message} />
          ) : !board.data ? (
            <LoadingState label="Loading your checks" />
          ) : !actions.length ? (
            <EmptyState
              icon={CheckCircle2}
              title="You are all caught up"
              detail="Nothing is waiting for you. Pick new work from the open queue."
              action={
                <Button asChild variant="outline">
                  <Link to="/vendor/queue">Browse the open queue</Link>
                </Button>
              }
            />
          ) : (
            <ul
              className="divide-y divide-slate-100 border-t border-slate-100"
              aria-label="Needs you now"
            >
              {actions.slice(0, 8).map(({ job, reason, tone }) => (
                <li key={job.id}>
                  <Link
                    to="/vendor/checks"
                    search={{ job: job.id }}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 no-underline transition hover:bg-slate-50"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                      <ClipboardCheck className="size-[18px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[14px] font-semibold text-slate-900">
                        {readable(job.checkType)} · {job.caseNumber}
                      </strong>
                      <span className="flex flex-wrap items-center gap-x-3 text-[12px] text-slate-500">
                        {job.city ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" aria-hidden /> {job.city}
                            {job.pincode ? ` · ${job.pincode}` : ""}
                          </span>
                        ) : null}
                        {job.dueAt ? (
                          <span className="flex items-center gap-1">
                            <CalendarClock className="size-3" aria-hidden /> Due{" "}
                            {formatDate(job.dueAt)}
                          </span>
                        ) : null}
                        {job.handler ? <span>With {job.handler.name}</span> : null}
                      </span>
                    </span>
                    <Pill tone={tone}>{reason}</Pill>
                    <ArrowRight className="size-4 text-slate-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="grid gap-5">
          <Panel
            title="Open queue"
            count={queue.data?.summary.count}
            description={
              queue.data?.summary.value
                ? `Work worth ${rupees(queue.data.summary.value)} is waiting to be picked.`
                : "Checks any approved vendor can pick. First to pick gets it."
            }
          >
            {queue.isError ? (
              <EmptyState tone="bad" title="Queue unavailable" detail={queue.error.message} />
            ) : !queue.data ? (
              <LoadingState label="Loading the queue" />
            ) : !queue.data.items.length ? (
              <EmptyState
                icon={Search}
                tone="neutral"
                title="The queue is empty"
                detail="New checks appear here as soon as they are posted. You get a notification too."
              />
            ) : (
              <div className="grid gap-2.5 px-5 pb-5">
                {queue.data.items.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[13.5px] font-semibold text-slate-900">
                        {readable(item.checkType)}
                      </strong>
                      <span className="flex flex-wrap items-center gap-x-3 text-[12px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden />
                          {item.city ?? "City not given"}
                          {item.pincode ? ` · ${item.pincode}` : ""}
                        </span>
                        {item.dueAt ? <span>Due {formatDate(item.dueAt)}</span> : null}
                      </span>
                    </span>
                    {item.price !== null ? (
                      <span className="flex items-center rounded-lg bg-emerald-50 px-2 py-1 text-[13px] font-semibold text-emerald-700">
                        <IndianRupee className="size-3.5" aria-hidden />
                        {item.price.toLocaleString("en-IN")}
                      </span>
                    ) : null}
                  </div>
                ))}
                <Button asChild variant="outline" className="mt-1">
                  <Link to="/vendor/queue">
                    See all and pick <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            )}
          </Panel>

          <Panel
            title="Document requests"
            description="Documents Sapling Global asked you to review."
          >
            <div className="grid grid-cols-2 gap-2.5 px-5 pb-5">
              {vendorKpiCards(requests.data?.counts).map((card) => (
                <Link
                  key={card.view}
                  to={card.to}
                  className="rounded-xl border border-slate-200 px-3.5 py-3 no-underline transition hover:border-blue-300 hover:bg-blue-50/40"
                >
                  <span className="block text-[12px] font-medium text-slate-500">{card.label}</span>
                  <strong className="text-[20px] font-semibold text-slate-900">
                    {requests.data ? card.value : "—"}
                  </strong>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="How to get paid faster" label="Tips">
        <ol className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: ListTodo,
              title: "Pick work near you",
              copy: "Filter the open queue by city. Payment and due date show before you pick.",
            },
            {
              icon: Upload,
              title: "Attach clear proof",
              copy: "Photos and records with your result. Missing proof is the top reason work is sent back.",
            },
            {
              icon: FileText,
              title: "Claim extra cost on time",
              copy: "Add travel or fees with a reason before you submit. The RM approves it.",
            },
            {
              icon: ShieldCheck,
              title: "Submit before the due date",
              copy: "Late work is flagged. Can't do it? Return it to the queue with a reason.",
            },
          ].map((tip) => (
            <li key={tip.title} className="flex gap-3 rounded-xl bg-slate-50 p-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-blue-700 shadow-sm">
                <tip.icon className="size-4" aria-hidden />
              </span>
              <span>
                <strong className="block text-[13.5px] font-semibold text-slate-900">
                  {tip.title}
                </strong>
                <span className="text-[12.5px] leading-5 text-slate-600">{tip.copy}</span>
              </span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
