import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CircleHelp, RotateCcw, SearchX, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  EmptyState,
  LoadingState,
  PagerFooter,
  Panel,
  Pill,
  SearchField,
  StatCard,
} from "@/components/workspace/kit";
import { ExportSheetButton, type SheetColumn } from "@/components/workspace/export-sheet";
import { collectNumberedPages, humanizeCode, istText } from "@/components/workspace/format";
import { getUtvBucket, type UtvItem } from "@/lib/backend-api/rework";
import { ReworkDialog, type ReworkTarget } from "./ReworkDialog";

const EXPORT_COLUMNS: readonly SheetColumn<UtvItem>[] = [
  { key: "caseNumber", label: "Sapling ID", value: (i) => i.caseNumber },
  { key: "candidate", label: "Candidate", value: (i) => i.candidateName },
  { key: "company", label: "Company", value: (i) => i.clientName },
  { key: "check", label: "Check", value: (i) => humanizeCode(i.checkType) },
  { key: "reason", label: "UTV reason", value: (i) => i.reason },
  { key: "verifier", label: "Verifier", value: (i) => i.verifier },
  { key: "closedAt", label: "Closed", value: (i) => istText(i.closedAt) },
  { key: "caseStatus", label: "Case status", value: (i) => humanizeCode(i.caseStatus) },
];
const EXPORT_DEFAULTS = ["caseNumber", "candidate", "company", "check", "reason", "closedAt"];

/**
 * UTV bucket (BGV process): checks closed as Unable To Verify, with the reason. Operations
 * and Team Leaders can re-open (same verifier) or re-initiate (back to allocation).
 */
export function UtvBucket() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<ReworkTarget | null>(null);
  const bucket = useQuery({
    queryKey: ["workflow", "utv", page, search],
    queryFn: () => getUtvBucket({ page, search: search.trim() || undefined }),
    placeholderData: keepPreviousData,
  });
  const data = bucket.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const actionable = data?.items.filter((item) => item.canRework).length ?? 0;
  const rework = (item: UtvItem, mode: ReworkTarget["mode"]) =>
    setTarget({
      checkId: item.checkId,
      mode,
      label: `${item.caseNumber} · ${humanizeCode(item.checkType)}`,
    });
  return (
    <div className="grid gap-4">
      <section aria-label="UTV summary" className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <StatCard
          icon={CircleHelp}
          tone={data?.total ? "action" : "good"}
          label="Unable to verify"
          value={data?.total ?? "—"}
          hint="Closed as UTV, with a reason"
        />
        <StatCard
          icon={RotateCcw}
          tone="info"
          label="Can be re-worked (this page)"
          value={data ? actionable : "—"}
          hint="Case still open"
        />
        <StatCard
          icon={ShieldCheck}
          tone="neutral"
          label="Every action is audited"
          value={data ? data.items.length - actionable : "—"}
          hint="On closed cases (open from the case page)"
        />
      </section>
      <Panel
        label="UTV checks"
        title="UTV bucket"
        count={data?.total}
        description="Re-open sends a check back to its verifier; re-initiate returns it for allocation."
        actions={
          <ExportSheetButton
            source="utv"
            title="Export UTV checks"
            filename="Sapling-Global-utv"
            columns={EXPORT_COLUMNS}
            defaults={EXPORT_DEFAULTS}
            scopeNote={search.trim() ? `search “${search.trim()}”` : "all UTV checks"}
            loadRows={() =>
              collectNumberedPages((n) =>
                getUtvBucket({ page: n, search: search.trim() || undefined }),
              )
            }
          />
        }
      >
        <div className="px-5 pb-3">
          <SearchField
            className="max-w-md"
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search Sapling ID or candidate"
            label="Search UTV checks"
          />
        </div>
        {bucket.isError ? (
          <EmptyState
            tone="bad"
            title="Could not load the UTV bucket"
            detail={bucket.error.message}
          />
        ) : !data ? (
          <LoadingState />
        ) : !data.items.length ? (
          <EmptyState
            icon={search ? SearchX : ShieldCheck}
            tone={search ? "neutral" : "good"}
            title={search ? "No UTV checks match" : "No UTV checks"}
            detail="Checks closed as unable to verify will appear here."
          />
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {data.items.map((item) => (
              <li
                key={item.checkId}
                className="grid gap-3 px-5 py-3.5 transition hover:bg-slate-50 lg:grid-cols-[minmax(200px,1.1fr)_minmax(0,1.6fr)_minmax(140px,0.7fr)_240px] lg:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={item.candidateName} tone="warn" />
                  <div className="min-w-0">
                    <strong className="block truncate text-[13.5px] text-slate-900">
                      {item.candidateName}
                    </strong>
                    <small className="block truncate text-[11.5px] text-slate-500">
                      {item.clientName} · {item.caseNumber}
                    </small>
                  </div>
                </div>
                <div className="min-w-0">
                  <Pill tone="warn">{humanizeCode(item.checkType)}</Pill>
                  <p className="mt-1 line-clamp-2 text-[12.5px] text-slate-600">{item.reason}</p>
                </div>
                <div className="text-[12.5px] text-slate-600">
                  {item.verifier ?? "—"}
                  <small className="block text-[11.5px] text-slate-400">
                    {item.closedAt ? `Closed ${istText(item.closedAt)}` : "—"}
                  </small>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {item.canRework ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => rework(item, "REOPEN")}>
                        <RotateCcw aria-hidden /> Re-open
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rework(item, "REINITIATE")}
                      >
                        <Send aria-hidden /> Re-initiate
                      </Button>
                    </>
                  ) : (
                    <Pill tone="neutral" dot={false}>
                      {humanizeCode(item.caseStatus)}
                    </Pill>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {data && data.total > data.pageSize ? (
          <PagerFooter
            summary={`${data.total} checks`}
            page={page}
            pages={pages}
            hasPrevious={page > 1}
            hasNext={page < pages}
            onPrevious={() => setPage(page - 1)}
            onNext={() => setPage(page + 1)}
          />
        ) : null}
      </Panel>
      <ReworkDialog
        target={target}
        onClose={() => setTarget(null)}
        onDone={() => bucket.refetch()}
      />
    </div>
  );
}
