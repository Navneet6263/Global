import { ErrorState } from "@/components/feedback/error-state";
import { TableSkeleton } from "@/components/feedback/skeletons";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { OversightPanel } from "@/features/admin-dashboard/components/oversight-ui";
import { cn } from "@/lib/utils";
import type { SpocDomainRows } from "../api/spoc-api";
import type { SpocDomain } from "../contracts/spoc";
import { caseColumns, qaColumns, taskColumns } from "../config/spoc-case-columns";
import { DOMAIN_META } from "../config/spoc-meta";
import type { SpocRecordsSearch } from "../config/spoc-search";
import { invoiceColumns, opportunityColumns, visitColumns } from "../config/spoc-work-columns";
import { useSpocRecords } from "../hooks/use-spoc";
import { recordsQuery } from "../utils/spoc-query";
import { SpocDataTable, type SpocColumn } from "./SpocDataTable";
import { SpocRecordFilters } from "./SpocRecordFilters";

const DOMAINS: readonly SpocDomain[] = [
  "cases",
  "tasks",
  "qa",
  "visits",
  "opportunities",
  "invoices",
];

function RecordsTable<D extends SpocDomain>({
  domain,
  search,
  columns,
  onOpen,
  openLabel,
  minWidth,
}: {
  domain: D;
  search: SpocRecordsSearch;
  columns: readonly SpocColumn<SpocDomainRows[D]>[];
  onOpen?: (row: SpocDomainRows[D]) => void;
  openLabel?: (row: SpocDomainRows[D]) => string;
  minWidth?: number;
}) {
  const query = useSpocRecords(domain, recordsQuery(domain, search));
  if (query.isError)
    return (
      <div className="p-4">
        <ErrorState
          description={query.error.message}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </div>
    );
  if (!query.data) return <TableSkeleton rows={8} />;
  return (
    <SpocDataTable
      rows={query.data.items}
      columns={columns}
      onOpen={onOpen}
      openLabel={openLabel}
      minWidth={minWidth}
      emptyTitle="No matching records"
      emptyDetail="Try another filter or clear the drill-down."
    />
  );
}

function DomainTable({
  domain,
  search,
  onOpenCase,
}: {
  domain: SpocDomain;
  search: SpocRecordsSearch;
  onOpenCase: (caseId: string) => void;
}) {
  const view = (row: { caseNumber: string }) => `View ${row.caseNumber}`;
  switch (domain) {
    case "cases":
      return (
        <RecordsTable
          domain="cases"
          search={search}
          columns={caseColumns}
          onOpen={(row) => onOpenCase(row.id)}
          openLabel={view}
        />
      );
    case "tasks":
      return (
        <RecordsTable
          domain="tasks"
          search={search}
          columns={taskColumns}
          onOpen={(row) => onOpenCase(row.caseId)}
          openLabel={view}
        />
      );
    case "qa":
      return (
        <RecordsTable
          domain="qa"
          search={search}
          columns={qaColumns}
          onOpen={(row) => onOpenCase(row.caseId)}
          openLabel={view}
        />
      );
    case "visits":
      return (
        <RecordsTable
          domain="visits"
          search={search}
          columns={visitColumns}
          onOpen={(row) => onOpenCase(row.caseId)}
          openLabel={view}
        />
      );
    case "opportunities":
      return <RecordsTable domain="opportunities" search={search} columns={opportunityColumns} />;
    case "invoices":
      return (
        <RecordsTable domain="invoices" search={search} columns={invoiceColumns} minWidth={760} />
      );
  }
}

/** View-only record explorer: one tab per operational domain, URL-driven filters and paging. */
export function SpocRecordsView({
  search,
  onChange,
  onOpenCase,
}: {
  search: SpocRecordsSearch;
  onChange: (patch: Partial<SpocRecordsSearch>) => void;
  onOpenCase: (caseId: string) => void;
}) {
  const domain = search.domain ?? "cases";
  const total = useSpocRecords(domain, recordsQuery(domain, search)).data;

  return (
    <OversightPanel
      title={DOMAIN_META[domain].label}
      description="View-only. Select a row to inspect the full case context."
      count={total?.total}
    >
      <nav
        aria-label="Record domain"
        className="flex flex-wrap gap-1 border-b border-border/70 px-4 pt-3"
      >
        {DOMAINS.map((entry) => (
          <button
            key={entry}
            type="button"
            aria-current={entry === domain ? "page" : undefined}
            onClick={() =>
              onChange({
                domain: entry,
                page: undefined,
                status: undefined,
                bucket: undefined,
                bucketRole: undefined,
                holderRole: undefined,
                activeOnly: undefined,
                ownerId: undefined,
                assigneeId: undefined,
                sla: undefined,
                view: undefined,
                followUp: undefined,
                search: undefined,
              })
            }
            className={cn(
              "-mb-px rounded-t-xl border-b-2 px-3 py-2 text-xs font-semibold transition",
              entry === domain
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {DOMAIN_META[entry].label}
          </button>
        ))}
      </nav>
      <div className="border-b border-border/70 p-4">
        <SpocRecordFilters key={domain} domain={domain} search={search} onChange={onChange} />
      </div>
      <DomainTable domain={domain} search={search} onOpenCase={onOpenCase} />
      {total && total.total > total.pageSize ? (
        <div className="border-t border-border/70 px-4 py-3">
          <PaginationBar
            page={total.page}
            pageSize={total.pageSize}
            total={total.total}
            onPageChange={(page) => onChange({ page })}
          />
        </div>
      ) : null}
    </OversightPanel>
  );
}
