import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  Info,
  PlusCircle,
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
import {
  currentIstMonth,
  monthLabel,
  shiftMonth,
} from "@/features/vendor-checks/vendor-home-model";
import { readable, rupees } from "@/features/vendor-checks/vendor-job-format";
import { vendorWorkApi } from "@/lib/backend-api/vendor-checks";
import { formatDate } from "@/lib/formatting";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export const Route = createFileRoute("/vendor/earnings")({
  head: () => ({ meta: [{ title: "Earnings — Sapling Global" }] }),
  validateSearch: (input: Record<string, unknown>): { month?: string } =>
    typeof input["month"] === "string" && MONTH.test(input["month"])
      ? { month: input["month"] }
      : {},
  component: VendorEarningsPage,
});

/**
 * What the vendor earned, month by month (India time): each check the RM accepted, at its
 * payment plus approved extra cost, and what is still waiting for approval.
 */
function VendorEarningsPage() {
  const thisMonth = currentIstMonth();
  const month = Route.useSearch().month ?? thisMonth;
  const navigate = useNavigate({ from: Route.fullPath });
  const go = (next: string) =>
    void navigate({ search: next === thisMonth ? {} : { month: next }, replace: true });
  const earnings = useQuery({
    queryKey: ["vendor-earnings", month],
    queryFn: () => vendorWorkApi.earnings(month),
    placeholderData: keepPreviousData,
  });
  const data = earnings.data?.month === month ? earnings.data : undefined;
  const totals = data?.totals;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Earnings"
        description="Checks accepted by Sapling Global each month, with payment and approved extra cost."
        actions={
          <div
            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1"
            role="group"
            aria-label="Month"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              onClick={() => go(shiftMonth(month, -1))}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <strong className="min-w-36 text-center text-[14px] font-semibold text-slate-900">
              {monthLabel(month)}
            </strong>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Next month"
              disabled={month >= thisMonth}
              onClick={() => go(shiftMonth(month, 1))}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        }
      />

      <StatGrid label="Month totals">
        <StatCard
          icon={Wallet}
          tone="good"
          label="Earned"
          value={totals ? rupees(totals.total) : "—"}
          hint="Payment + approved extra cost"
        />
        <StatCard
          icon={BadgeCheck}
          tone="info"
          label="Checks accepted"
          value={totals ? totals.checks : "—"}
          hint={totals ? `${rupees(totals.payment)} payment` : undefined}
        />
        <StatCard
          icon={PlusCircle}
          tone="violet"
          label="Extra cost approved"
          value={totals ? rupees(totals.extra) : "—"}
          hint="Travel and fees the RM approved"
        />
        <StatCard
          icon={Hourglass}
          tone="warn"
          label="In review now"
          value={data ? rupees(data.inReview.value) : "—"}
          hint={
            data
              ? `${data.inReview.checks} ${data.inReview.checks === 1 ? "check" : "checks"} waiting for approval`
              : undefined
          }
        />
      </StatGrid>

      {totals?.rateToConfirm ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {totals.rateToConfirm === 1 ? "1 check was" : `${totals.rateToConfirm} checks were`} sent
          to you directly without a payment amount. Sapling Global Finance will confirm the rate for
          {totals.rateToConfirm === 1 ? " it" : " them"}.
        </p>
      ) : null}

      <Panel
        title="Accepted checks"
        count={data?.items.length}
        description={`Checks the RM accepted in ${monthLabel(month)}.`}
      >
        {earnings.isError ? (
          <EmptyState tone="bad" title="Earnings unavailable" detail={earnings.error.message} />
        ) : !data ? (
          <LoadingState label="Loading earnings" />
        ) : !data.items.length ? (
          <EmptyState
            icon={Wallet}
            tone="neutral"
            title="No accepted checks this month"
            detail="A check counts here once the RM accepts your result."
          />
        ) : (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="bg-slate-50 text-[11.5px] font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-2.5">Accepted</th>
                  <th className="px-3 py-2.5">Check</th>
                  <th className="px-3 py-2.5">Place</th>
                  <th className="px-3 py-2.5">Done by</th>
                  <th className="px-3 py-2.5 text-right">Payment</th>
                  <th className="px-3 py-2.5 text-right">Extra cost</th>
                  <th className="px-5 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 whitespace-nowrap text-slate-600">
                      {line.acceptedAt ? formatDate(line.acceptedAt) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <strong className="block font-semibold text-slate-900">
                        {readable(line.checkType)}
                      </strong>
                      <span className="text-[12px] text-slate-500">{line.caseNumber}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {line.city ?? "—"}
                      {line.pincode ? ` · ${line.pincode}` : ""}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{line.handledBy ?? "You"}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                      {line.rateToConfirm ? (
                        <Pill tone="warn" dot={false}>
                          To confirm
                        </Pill>
                      ) : (
                        rupees(line.payment)
                      )}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap text-slate-600 tabular-nums">
                      {line.extra ? rupees(line.extra) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold whitespace-nowrap text-slate-900 tabular-nums">
                      {rupees(line.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50/60 font-semibold text-slate-900">
                <tr>
                  <td className="px-5 py-3" colSpan={4}>
                    Total for {monthLabel(month)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {rupees(data.totals.payment)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{rupees(data.totals.extra)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{rupees(data.totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="How payment works" label="How payment works">
        <ul className="grid gap-2 px-5 pb-5 text-[13px] leading-6 text-slate-600">
          <li>• The payment is the amount shown in the open queue when you picked the check.</li>
          <li>• Extra cost counts once the RM approves it. Rejected extra cost is not added.</li>
          <li>• A check counts in the month the RM accepted your result, in India time.</li>
          <li>
            • Sapling Global Finance settles payments. Monthly statements and invoices are coming
            soon.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
