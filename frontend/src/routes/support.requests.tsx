import { useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OversightSearch } from "@/features/admin-dashboard/components/oversight-ui";
import { REQUEST_COLUMNS } from "@/features/support/components/support-columns";
import { SupportRequestDrawer } from "@/features/support/components/SupportRequestDrawer";
import { SupportTablePanel } from "@/features/support/components/SupportTablePanel";
import { useSearchText } from "@/features/support/hooks/use-search-text";
import { useSupportRequests } from "@/features/support/hooks/use-support";
import { REQUEST_TABS, REQUESTER_LABEL } from "@/features/support/support-model";
import {
  supportRequestsSearch,
  type SupportRequestsSearch,
} from "@/features/support/support-search";

export const Route = createFileRoute("/support/requests")({
  validateSearch: supportRequestsSearch,
  head: () => ({ meta: [{ title: "Support requests — Sapling Global" }] }),
  component: SupportRequestsPage,
});

const REQUESTER_FILTERS = [undefined, "CANDIDATE", "CLIENT_ADMIN"] as const;

function SupportRequestsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const update = useCallback(
    (patch: Partial<SupportRequestsSearch>) =>
      void navigate({ search: (current) => ({ ...current, ...patch }), replace: true }),
    [navigate],
  );
  const [text, setText] = useSearchText(
    search.search,
    useCallback((value?: string) => update({ search: value, page: undefined }), [update]),
  );
  const tab = search.status ?? "OPEN";
  const requests = useSupportRequests({
    page: search.page ?? 1,
    pageSize: 20,
    search: search.search,
    status: tab === "ALL" ? undefined : tab,
    requesterType: search.requesterType,
    mine: search.mine,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support requests"
        description="Requests from candidates and Client Admins. Take one, then resolve it with a reply."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={tab}
          onValueChange={(next) =>
            update({ status: next as SupportRequestsSearch["status"], page: undefined })
          }
        >
          <TabsList>
            {REQUEST_TABS.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="text-xs">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {REQUESTER_FILTERS.map((type) => (
          <Button
            key={type ?? "all"}
            type="button"
            size="sm"
            variant={search.requesterType === type ? "default" : "outline"}
            onClick={() => update({ requesterType: type, page: undefined })}
          >
            {type ? REQUESTER_LABEL[type] : "All requesters"}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={search.mine ? "default" : "outline"}
          onClick={() => update({ mine: search.mine ? undefined : true, page: undefined })}
        >
          Taken by me
        </Button>
      </div>
      <SupportTablePanel
        title="Inbox"
        description="Newest first. Open a request to read it and reply."
        toolbar={
          <OversightSearch
            value={text}
            onChange={setText}
            placeholder="Request ID, employee, case or client"
          />
        }
        data={requests.data}
        error={requests.error}
        retrying={requests.isFetching}
        onRetry={() => void requests.refetch()}
        columns={REQUEST_COLUMNS}
        onOpen={(row) => update({ requestId: row.id })}
        openLabel={(row) => `Open ${row.requestNumber}`}
        onPage={(page) => update({ page })}
        emptyTitle="No requests here"
        emptyDetail="New requests appear here and in your notifications."
        minWidth={1040}
      />
      <SupportRequestDrawer
        requestId={search.requestId}
        onClose={() => update({ requestId: undefined })}
        onOpenEmployee={(caseId) => void navigate({ to: "/support/employees", search: { caseId } })}
      />
    </div>
  );
}
