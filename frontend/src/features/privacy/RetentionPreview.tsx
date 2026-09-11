import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/backend-api/client";
import { formatDateTime } from "@/lib/formatting";
import { useDebouncedValue } from "@/lib/use-debounced-value";

interface RetentionCase {
  id: string;
  caseNumber: string;
  status: string;
  completedAt: string | null;
  retentionHoldAt: string | null;
  retentionHoldReason: string | null;
  version: number;
  needsReview: boolean;
  _count: { documents: number; reports: number; fieldVisits: number };
}
export function RetentionPreview() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-mint/30 bg-mint-soft/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <LockKeyhole className="size-4 text-mint-deep" />
            Retention preview & holds
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Review case age and preserve records. Automatic case deletion is disabled.
          </p>
        </div>
        <Button variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Close preview" : "Open preview"}
        </Button>
      </div>
      {open && <PreviewWorkspace />}
    </section>
  );
}
function PreviewWorkspace() {
  const [days, setDays] = useState("365");
  const [mode, setMode] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RetentionCase | null>(null);
  const term = useDebouncedValue(search, 300);
  const numberDays = Math.max(30, Math.min(3650, Number(days) || 365));
  const query = useQuery({
    queryKey: ["retention-preview", numberDays, mode, term, page],
    queryFn: () =>
      apiRequest<{ items: RetentionCase[]; total: number; executionEnabled: false }>(
        `/privacy-retention?${new URLSearchParams({ days: String(numberDays), mode, page: String(page), ...(term ? { search: term } : {}) })}`,
      ),
    placeholderData: keepPreviousData,
  });
  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2 rounded-xl bg-white/70 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0" />
        <p>
          Days below are a preview filter, not an approved deletion policy. Holds stop future
          field-evidence retention scheduling in this application. They cannot restore removed
          records or stop work already queued before the hold, and do not control external backups.
          Releasing a hold resumes the existing field policy; it does not trigger whole-case
          deletion.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs">
          Case number
          <Input
            maxLength={40}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="text-xs">
          Preview age (days)
          <Input
            type="number"
            min={30}
            max={3650}
            value={days}
            onChange={(e) => {
              setDays(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="text-xs">
          View
          <select
            className="h-10 w-full rounded-xl border bg-white px-3"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All cases</option>
            <option value="HELD">On hold</option>
            <option value="REVIEW">Closed, older than preview age</option>
          </select>
        </label>
      </div>
      {query.isPending && (
        <p role="status" className="text-xs">
          Loading retention preview…
        </p>
      )}
      {query.isError && (
        <p role="alert" className="text-xs text-destructive">
          {query.error.message}
          <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {query.data?.items.map((row) => (
        <article
          key={row.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3"
        >
          <div>
            <p className="text-sm font-medium">
              {row.caseNumber}{" "}
              <span
                className={`ml-2 rounded-full px-2 py-1 text-[10px] ${row.retentionHoldAt ? "bg-amber-50 text-amber-800" : "bg-mint-soft text-mint-deep"}`}
              >
                {row.retentionHoldAt
                  ? "On hold"
                  : row.needsReview
                    ? "Needs retention review"
                    : row.status}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {row._count.documents} documents · {row._count.reports} reports ·{" "}
              {row._count.fieldVisits} visits
              {row.completedAt ? ` · Completed ${formatDateTime(row.completedAt)}` : ""}
            </p>
            {row.retentionHoldReason && <p className="mt-1 text-xs">{row.retentionHoldReason}</p>}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={query.isPlaceholderData}
            onClick={() => setSelected(row)}
          >
            {row.retentionHoldAt ? "Release hold" : "Place hold"}
          </Button>
        </article>
      ))}
      {query.data && !query.data.items.length && <p className="text-xs">No matching cases.</p>}
      {query.data && query.data.total > 12 && (
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="ghost"
            disabled={page === 1 || query.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs">
            {page} / {Math.ceil(query.data.total / 12)}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={page * 12 >= query.data.total || query.isFetching}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
      {selected && (
        <HoldDecision key={selected.id} row={selected} close={() => setSelected(null)} />
      )}
    </div>
  );
}
function HoldDecision({ row, close }: { row: RetentionCase; close: () => void }) {
  const cache = useQueryClient();
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest(`/privacy-retention/${row.id}/hold`, {
        method: "PATCH",
        body: JSON.stringify({ version: row.version, hold: !row.retentionHoldAt, reason }),
      }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["retention-preview"] });
      toast.success("Retention hold updated and audited");
      close();
    },
    onError: (error) => {
      toast.error(error.message);
      void cache.invalidateQueries({ queryKey: ["retention-preview"] });
    },
  });
  return (
    <form
      className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <h4 className="text-sm font-medium">
        {row.retentionHoldAt ? "Release hold" : "Preserve records"} · {row.caseNumber}
      </h4>
      <label className="block text-xs">
        Reason and case/legal reference
        <Textarea
          autoFocus
          required
          minLength={10}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={mutation.isPending || reason.trim().length < 10}
          loading={mutation.isPending}
        >
          {mutation.isPending ? "Saving…" : "Confirm hold decision"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
