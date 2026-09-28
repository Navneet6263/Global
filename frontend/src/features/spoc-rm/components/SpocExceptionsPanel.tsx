import { Link } from "@tanstack/react-router";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { OversightEmpty, OversightPanel } from "@/features/admin-dashboard/components/oversight-ui";
import { cn } from "@/lib/utils";
import type { SpocExceptionCategory, SpocExceptionItem } from "../contracts/spoc";
import { EXCEPTION_META, SPOC_ROLE_META, statusTone } from "../config/spoc-meta";
import { useSpocExceptions } from "../hooks/use-spoc";
import { date, label, relative } from "../utils/spoc-format";
import type { SpocScopeFilters } from "./SpocFilterBar";

const PAGE_SIZE = 8;

function ItemRow({
  item,
  category,
  onOpenCase,
}: {
  item: SpocExceptionItem;
  category: SpocExceptionCategory;
  onOpenCase: (caseId: string) => void;
}) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {item.subtitle}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
        <StatusBadge label={label(item.status)} tone={statusTone(item.status)} />
        <span>{item.owner ?? "—"}</span>
        <span>
          {item.dueAt ? `Due ${date(item.dueAt)}` : `Updated ${relative(item.updatedAt)}`}
        </span>
      </span>
    </>
  );
  const rowClass =
    "grid w-full gap-2 px-5 py-3 text-left transition hover:bg-mint-soft/30 sm:grid-cols-[minmax(0,1.2fr)_auto] sm:items-center";
  if (item.caseId) {
    const caseId = item.caseId;
    return (
      <button type="button" className={rowClass} onClick={() => onOpenCase(caseId)}>
        {body}
      </button>
    );
  }
  const domain = category === "followup_overdue" ? "opportunities" : "invoices";
  if (category === "credit_hold") {
    return (
      <Link to="/spoc-rm/clients" search={{ search: item.title }} className={rowClass}>
        {body}
      </Link>
    );
  }
  return (
    <Link to="/spoc-rm/records" search={{ domain, search: item.title }} className={rowClass}>
      {body}
    </Link>
  );
}

/** Every real exception category with its live count, and the records behind the selected one. */
export function SpocExceptionsPanel({
  scope,
  category,
  page,
  onCategory,
  onPage,
  onOpenCase,
}: {
  scope: SpocScopeFilters;
  category: SpocExceptionCategory;
  page: number;
  onCategory: (category: SpocExceptionCategory) => void;
  onPage: (page: number) => void;
  onOpenCase: (caseId: string) => void;
}) {
  const query = useSpocExceptions({
    category,
    page,
    pageSize: PAGE_SIZE,
    clientId: scope.clientId,
    branchId: scope.branchId,
    priority: scope.priority,
  });
  const data = query.data;

  return (
    <OversightPanel
      title="Needs attention"
      description="Only exception types that exist in the data. Counts are live across the tenant."
      count={data?.categories.reduce((sum, row) => sum + row.count, 0)}
    >
      <div id="spoc-exceptions" className="flex flex-wrap gap-2 border-b border-border/70 p-4">
        {(data?.categories ?? []).map((row) => {
          const meta = EXCEPTION_META[row.category];
          const selected = row.category === category;
          return (
            <button
              key={row.category}
              type="button"
              aria-pressed={selected}
              onClick={() => onCategory(row.category)}
              title={`Owned by ${SPOC_ROLE_META[meta.role].label}`}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {meta.label}
              <span
                className={cn(
                  "num rounded-full px-1.5 text-[10px] font-semibold",
                  selected
                    ? "bg-white/20"
                    : row.count
                      ? "bg-critical-soft text-critical-foreground"
                      : "bg-muted",
                )}
              >
                {row.count}
              </span>
            </button>
          );
        })}
      </div>
      {query.isError ? (
        <div className="p-4">
          <ErrorState
            description={query.error.message}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        </div>
      ) : !data ? (
        <div className="p-4">
          <ListSkeleton rows={4} />
        </div>
      ) : data.items.length ? (
        <div className="divide-y divide-border/70">
          {data.items.map((item) => (
            <ItemRow key={item.id} item={item} category={category} onOpenCase={onOpenCase} />
          ))}
        </div>
      ) : (
        <OversightEmpty
          title={`No ${EXCEPTION_META[category].label.toLowerCase()}`}
          detail="Nothing in this category needs attention right now."
        />
      )}
      {data && data.total > PAGE_SIZE ? (
        <div className="border-t border-border/70 px-4 py-3">
          <PaginationBar
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={onPage}
          />
        </div>
      ) : null}
    </OversightPanel>
  );
}
