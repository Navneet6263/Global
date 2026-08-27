import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { Download, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { AUDIT_CATEGORY_META, type AuditCategory, type AuditQuery } from "@/lib/contracts/audit";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuditList } from "@/features/audit/components/audit-list";

const CATEGORIES = Object.keys(AUDIT_CATEGORY_META) as AuditCategory[];

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail — Sapling Global" },
      {
        name: "description",
        content:
          "Immutable, attributed record of every access, case, policy and report action across the platform.",
      },
      { property: "og:title", content: "Audit Trail — Sapling Global" },
      {
        property: "og:description",
        content: "Immutable, attributed record of every action across the platform.",
      },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const [query, setQuery] = useState<AuditQuery>({
    search: "",
    category: "all",
    actor: "all",
    page: 1,
    pageSize: 15,
  });

  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: queryKeys.audit(query),
    queryFn: () => api.audit.list(query),
    placeholderData: keepPreviousData,
  });

  const actors = useQuery({
    queryKey: queryKeys.auditFacets(),
    queryFn: () => api.audit.actors(),
    staleTime: 300_000,
  });

  const events = data?.rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit trail"
        description="Every privileged action, with actor, request ID and the before/after values captured at write time."
        meta={data ? `${data.total} audited events` : undefined}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.success("Audit export queued", { description: "Signed CSV by email." })
            }
          >
            <Download className="size-3.5" aria-hidden />
            Export
          </Button>
        }
      />

      <div className="surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
          <Input
            value={query.search ?? ""}
            onChange={(event) => setQuery((c) => ({ ...c, search: event.target.value, page: 1 }))}
            placeholder="Search action, resource or request ID"
            aria-label="Search audit events"
            className="w-full sm:max-w-xs"
          />
          <Select
            value={query.category ?? "all"}
            onValueChange={(value) =>
              setQuery((c) => ({ ...c, category: value as AuditCategory | "all", page: 1 }))
            }
          >
            <SelectTrigger className="w-[170px]" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {AUDIT_CATEGORY_META[category].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={query.actor ?? "all"}
            onValueChange={(value) => setQuery((c) => ({ ...c, actor: value, page: 1 }))}
          >
            <SelectTrigger className="w-[200px]" aria-label="Filter by actor">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actors</SelectItem>
              {(actors.data ?? []).map((actor) => (
                <SelectItem key={actor} value={actor}>
                  {actor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isError ? (
          <div className="p-5">
            <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
          </div>
        ) : null}

        {isPending ? (
          <div className="p-5">
            <ListSkeleton rows={6} />
          </div>
        ) : events.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={ScrollText}
              title="No audit events match"
              description="Widen the category or actor filter, or clear the search term."
            />
          </div>
        ) : (
          <>
            <AuditList events={events} />
            <PaginationBar
              page={query.page ?? 1}
              pageSize={query.pageSize ?? 15}
              total={data?.total ?? 0}
              onPageChange={(page) => setQuery((c) => ({ ...c, page }))}
              label="events"
            />
          </>
        )}
      </div>
    </div>
  );
}
