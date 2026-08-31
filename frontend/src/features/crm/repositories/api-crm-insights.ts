import { getCrmOverview, listSalesOwners } from "@/lib/backend-api/crm";
import type {
  AccountQuery,
  ForecastQuery,
  Opportunity,
  RevenueForecast,
  SalesAccount,
  SalesOwner,
} from "../contracts/crm";
import { allOpportunities, paginate } from "./api-crm-helpers";

export async function getAccounts(query: AccountQuery) {
  let opportunities = await allOpportunities();
  if (query.owner && query.owner !== "all") {
    opportunities = opportunities.filter((row) => row.ownerId === query.owner);
  }
  const groups = new Map<string, Opportunity[]>();
  opportunities.forEach((row) =>
    groups.set(row.accountId, [...(groups.get(row.accountId) ?? []), row]),
  );
  let rows: SalesAccount[] = Array.from(groups, ([id, items]) => accountFrom(id, items));
  if (query.search) {
    const search = query.search.toLowerCase();
    rows = rows.filter((row) =>
      `${row.company} ${row.primaryContact}`.toLowerCase().includes(search),
    );
  }
  if (query.status && query.status !== "all")
    rows = rows.filter((row) => row.status === query.status);
  return paginate(rows, query.page, query.pageSize);
}

export async function getForecast(query: ForecastQuery): Promise<RevenueForecast> {
  let rows = await allOpportunities();
  if (query.owner && query.owner !== "all")
    rows = rows.filter((row) => row.ownerId === query.owner);
  if (query.stage && query.stage !== "all") rows = rows.filter((row) => row.stage === query.stage);
  if (query.source && query.source !== "all")
    rows = rows.filter((row) => row.source === query.source);
  if (query.minValue !== undefined) {
    rows = rows.filter((row) => row.estimatedValue >= query.minValue!);
  }
  const window = forecastWindow(query.period ?? "month", new Date());
  const open = rows.filter(
    (row) =>
      !["WON", "LOST"].includes(row.stage) &&
      row.expectedCloseDate !== null &&
      inWindow(row.expectedCloseDate, window),
  );
  const won = rows.filter(
    (row) => row.stage === "WON" && row.closedAt && inWindow(row.closedAt, window),
  );
  const overview = await getCrmOverview();
  const weightedForecast = sum(open, (row) => row.weightedValue);
  const wonValue = sum(won, (row) => row.estimatedValue);
  return {
    period: query.period ?? "month",
    openPipeline: sum(open, (row) => row.estimatedValue),
    weightedForecast,
    commitForecast:
      wonValue +
      sum(
        open.filter((row) => row.probability >= 75),
        (row) => row.estimatedValue,
      ),
    bestCaseForecast:
      wonValue +
      sum(
        open.filter((row) => row.probability >= 50),
        (row) => row.estimatedValue,
      ),
    closedWon: wonValue,
    target: null,
    gapToTarget: null,
    monthly: overview.trend.map((row) => ({
      label: row.month,
      pipeline: row.pipelineValue,
      weighted: row.weightedValue,
      won: row.wonValue,
    })),
    byOwner: buckets(open, (row) => row.ownerName ?? "Unassigned"),
    byStage: buckets(open, (row) => row.stage),
    calendar: closeCalendar(open),
    atRisk: riskRows(open, new Date()),
  };
}

export async function getSalesOwners(): Promise<SalesOwner[]> {
  const owners = await listSalesOwners();
  return owners.items.map((owner) => ({
    id: owner.id,
    name: owner.displayName,
    email: owner.email,
    territory: owner.branch?.name ?? null,
    activeOpportunities: owner.activeOpportunities,
    pipelineValue: owner.pipelineValue,
    weightedForecast: owner.weightedForecast,
    wonRevenue: owner.wonRevenue,
    winRate: owner.winRate,
    overdueFollowUps: owner.overdueFollowUps,
    activitiesThisWeek: owner.activitiesThisWeek,
    closingThisMonth: owner.closingThisMonth,
  }));
}

function accountFrom(id: string, items: Opportunity[]): SalesAccount {
  const first = items[0]!;
  const open = items.filter((row) => !["WON", "LOST"].includes(row.stage));
  const won = items.filter((row) => row.stage === "WON");
  const lastActivityAt =
    items
      .map((row) => row.lastActivityAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
  const overdue = open.some(
    (row) => row.nextFollowUpAt && Date.parse(row.nextFollowUpAt) < Date.now(),
  );
  const dormant =
    won.length > 0 &&
    open.length === 0 &&
    Boolean(lastActivityAt) &&
    Date.now() - Date.parse(lastActivityAt!) > 90 * 86_400_000;
  return {
    id,
    company: first.company,
    status:
      overdue && won.length
        ? "churn-risk"
        : dormant
          ? "dormant"
          : won.length
            ? "active"
            : "prospect",
    industry: first.industry,
    city: first.city,
    openOpportunities: open.length,
    pipelineValue: sum(open, (row) => row.estimatedValue),
    wonRevenue: sum(won, (row) => row.estimatedValue),
    primaryContact: first.contactName,
    contactEmail: first.contactEmail,
    contactMobile: first.contactMobile,
    ownerName: first.ownerName,
    lastActivityAt,
    nextFollowUpAt:
      items
        .map((row) => row.nextFollowUpAt)
        .filter((value): value is string => Boolean(value))
        .sort()[0] ?? null,
  };
}

function forecastWindow(period: "month" | "quarter" | "year", now: Date) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startMonth =
    period === "quarter" ? Math.floor(month / 3) * 3 : period === "year" ? 0 : month;
  const endMonth = period === "month" ? startMonth + 1 : period === "quarter" ? startMonth + 3 : 12;
  return {
    start: Date.UTC(year, startMonth, 1),
    end: Date.UTC(year, endMonth, 1),
  };
}

function inWindow(value: string, window: { start: number; end: number }) {
  const time = Date.parse(value);
  return time >= window.start && time < window.end;
}

function riskRows(rows: Opportunity[], now: Date) {
  const nearClose = now.getTime() + 14 * 86_400_000;
  const staleBefore = now.getTime() - 10 * 86_400_000;
  return rows
    .filter((row) => {
      const close = Date.parse(row.expectedCloseDate!);
      return (
        close <= nearClose &&
        (close < now.getTime() ||
          row.probability < 60 ||
          row.lastActivityAt === null ||
          Date.parse(row.lastActivityAt) < staleBefore)
      );
    })
    .sort((a, b) => Date.parse(a.expectedCloseDate!) - Date.parse(b.expectedCloseDate!));
}

function buckets(rows: Opportunity[], key: (row: Opportunity) => string) {
  return Array.from(new Set(rows.map(key))).map((label) => {
    const items = rows.filter((row) => key(row) === label);
    return {
      label,
      value: sum(items, (row) => row.estimatedValue),
      weighted: sum(items, (row) => row.weightedValue),
    };
  });
}

function closeCalendar(rows: Opportunity[]) {
  return Array.from(
    rows.filter(hasCloseDate).reduce((groups, row) => {
      const date = row.expectedCloseDate.slice(0, 10);
      const current = groups.get(date) ?? { date, count: 0, value: 0 };
      current.count += 1;
      current.value += row.estimatedValue;
      groups.set(date, current);
      return groups;
    }, new Map<string, { date: string; count: number; value: number }>()),
    ([, value]) => value,
  ).sort((a, b) => a.date.localeCompare(b.date));
}

function sum(rows: Opportunity[], value: (row: Opportunity) => number) {
  return rows.reduce((total, row) => total + value(row), 0);
}

function hasCloseDate(row: Opportunity): row is Opportunity & { expectedCloseDate: string } {
  return Boolean(row.expectedCloseDate);
}
