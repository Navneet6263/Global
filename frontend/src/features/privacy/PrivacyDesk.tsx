import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, FileLock2, Plus, ShieldAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { formatDateTime } from "@/lib/formatting";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  listPrivacyRecords,
  privacyLabel,
  privacyNotice,
  privacyStatus,
  type PrivacyKind,
} from "@/lib/backend-api/privacy";
import { PrivacyCreateDialog, privacyInput } from "./PrivacyCreateDialog";
import { PrivacyRecordDialog } from "./PrivacyRecordDialog";
import { RetentionPreview } from "./RetentionPreview";
import { VendorSharingRegister } from "./VendorSharingRegister";

export function PrivacyDesk() {
  const [kind, setKind] = useState<PrivacyKind>("DATA_REQUEST");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const term = useDebouncedValue(search, 300);
  const query = useQuery({
    queryKey: ["privacy", "list", kind, status, term, page],
    queryFn: () => listPrivacyRecords({ kind, status, search: term, page, pageSize: 12 }),
    placeholderData: keepPreviousData,
  });
  return (
    <div className="space-y-5">
      <PageHeader
        title="Privacy desk"
        description="Data requests and privacy incidents, with controlled human decisions."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            {kind === "DATA_REQUEST" ? "Record request" : "Record incident"}
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            {
              id: "DATA_REQUEST",
              label: "Data subject requests",
              description: "Access, corrections and erasure review",
              icon: FileLock2,
              tone: "bg-info-soft/40 border-info/20",
            },
            {
              id: "INCIDENT",
              label: "Privacy incidents",
              description: "Investigation, containment and closure",
              icon: ShieldAlert,
              tone: "bg-warning-soft/40 border-warning/20",
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={kind === tab.id}
            onClick={() => {
              setKind(tab.id);
              setStatus("");
              setPage(1);
            }}
            className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${kind === tab.id ? `${tab.tone} ring-1 ring-primary/25` : "border-border bg-card hover:bg-secondary/40"}`}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background/80">
              <tab.icon className="size-5 text-primary" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{tab.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{tab.description}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex gap-3 rounded-2xl border border-border bg-secondary/25 p-4 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        <p>
          {privacyNotice} Keep originals in your approved secure repository; only short references
          belong here.
        </p>
      </div>
      <section className="surface overflow-hidden">
        <div className="p-4">
          <RetentionPreview />
          <div className="mt-3">
            <VendorSharingRegister />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Input
            className="sm:max-w-sm"
            aria-label="Search privacy records"
            placeholder="Search title or subject reference"
            maxLength={160}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Filter privacy status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={`${privacyInput} sm:w-48`}
          >
            <option value="">All statuses</option>
            {privacyStatus[kind].map((value) => (
              <option key={value} value={value}>
                {privacyLabel(value)}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
            {query.isFetching ? "Updating…" : `${query.data?.total ?? 0} matching records`}
          </span>
        </div>
        {query.isPending ? (
          <div className="p-5">
            <ListSkeleton rows={5} />
          </div>
        ) : query.isError ? (
          <div className="p-5">
            <ErrorState description={query.error.message} onRetry={() => void query.refetch()} />
          </div>
        ) : !query.data?.items.length ? (
          <div className="p-6">
            <EmptyState
              icon={FileLock2}
              title="No matching privacy records"
              description="Record a request or incident, or adjust the current filters."
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {query.data.items.map((record) => {
              const final = ["FULFILLED", "CLOSED", "REJECTED"].includes(record.status);
              const overdue =
                !final && record.dueAt && new Date(record.dueAt).getTime() < Date.now();
              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setRecordId(record.id)}
                  className="flex w-full flex-wrap items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/35"
                >
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${record.kind === "INCIDENT" ? "bg-warning-soft text-warning-foreground" : "bg-info-soft text-info-foreground"}`}
                  >
                    <FileLock2 className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{record.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {record.subjectReference ?? privacyLabel(record.severity ?? record.kind)} ·{" "}
                      {record.createdBy.displayName}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(record.createdAt)}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${record.status === "REJECTED" ? "bg-critical-soft text-critical-foreground" : final ? "bg-success-soft text-success-foreground" : "bg-review-soft text-review-foreground"}`}
                  >
                    {privacyLabel(record.status)}
                  </span>
                  {overdue ? (
                    <span className="text-xs text-warning-foreground">Review target passed</span>
                  ) : null}
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
        {query.data ? (
          <PaginationBar
            page={page}
            pageSize={12}
            total={query.data.total}
            onPageChange={setPage}
          />
        ) : null}
      </section>
      {creating ? (
        <PrivacyCreateDialog
          kind={kind}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setRecordId(id);
            setPage(1);
          }}
        />
      ) : null}
      {recordId ? (
        <PrivacyRecordDialog key={recordId} id={recordId} onClose={() => setRecordId(null)} />
      ) : null}
    </div>
  );
}
