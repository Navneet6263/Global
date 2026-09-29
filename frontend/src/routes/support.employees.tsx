import { useCallback } from "react";
import { X } from "lucide-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OversightSearch } from "@/features/admin-dashboard/components/oversight-ui";
import { EMPLOYEE_COLUMNS } from "@/features/support/components/support-columns";
import { SupportEmployeeDrawer } from "@/features/support/components/SupportEmployeeDrawer";
import { SupportTablePanel } from "@/features/support/components/SupportTablePanel";
import { useSearchText } from "@/features/support/hooks/use-search-text";
import { useSupportEmployees } from "@/features/support/hooks/use-support";
import { EMPLOYEE_TABS } from "@/features/support/support-model";
import {
  supportEmployeesSearch,
  type SupportEmployeesSearch,
} from "@/features/support/support-search";

export const Route = createFileRoute("/support/employees")({
  validateSearch: supportEmployeesSearch,
  head: () => ({ meta: [{ title: "All employees — Sapling Global" }] }),
  component: SupportEmployeesPage,
});

function SupportEmployeesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const update = useCallback(
    (patch: Partial<SupportEmployeesSearch>) =>
      void navigate({ search: (current) => ({ ...current, ...patch }), replace: true }),
    [navigate],
  );
  const [text, setText] = useSearchText(
    search.search,
    useCallback((value?: string) => update({ search: value, page: undefined }), [update]),
  );
  const employees = useSupportEmployees({
    page: search.page ?? 1,
    pageSize: 20,
    search: search.search,
    clientId: search.clientId,
    state: search.state,
  });
  const clientName = search.clientId
    ? (employees.data?.items[0]?.client.displayName ?? "Selected client")
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="All employees"
        description="Each employee's stage, documents, pending work and what is stuck."
      />
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={search.state ?? "ALL"}
          onValueChange={(next) =>
            update({
              state: next === "ALL" ? undefined : (next as SupportEmployeesSearch["state"]),
              page: undefined,
            })
          }
        >
          <TabsList>
            {EMPLOYEE_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {clientName ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => update({ clientId: undefined, page: undefined })}
          >
            Client: {clientName} <X className="size-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>
      <SupportTablePanel
        title={clientName ? `${clientName} employees` : "Employees across all clients"}
        description="Open an employee to see documents, checks, pending items and stage history."
        toolbar={
          <OversightSearch
            value={text}
            onChange={setText}
            placeholder="Name, case number or client"
          />
        }
        data={employees.data}
        error={employees.error}
        retrying={employees.isFetching}
        onRetry={() => void employees.refetch()}
        columns={EMPLOYEE_COLUMNS}
        onOpen={(row) => update({ caseId: row.id })}
        openLabel={(row) => `Open ${row.candidateName}`}
        onPage={(page) => update({ page })}
        emptyTitle="No employees here"
        emptyDetail="Change the filter or search."
        minWidth={1040}
      />
      <SupportEmployeeDrawer caseId={search.caseId} onClose={() => update({ caseId: undefined })} />
    </div>
  );
}
