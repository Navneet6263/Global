import { useNavigate } from "@tanstack/react-router";
import { ErrorState } from "@/components/feedback/error-state";
import { TableSkeleton } from "@/components/feedback/skeletons";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { OversightPanel } from "@/features/admin-dashboard/components/oversight-ui";
import type { ReactNode } from "react";
import type { SpocQuery } from "../contracts/spoc";
import { clientColumns } from "../config/spoc-work-columns";
import { useSpocClients } from "../hooks/use-spoc";
import { SpocDataTable } from "./SpocDataTable";

/** Per-client roll-up. Selecting a client opens its profile (details, logins, packages). */
export function SpocClientTable({
  query,
  title,
  description,
  toolbar,
  onPage,
}: {
  query: SpocQuery;
  title: string;
  description: string;
  toolbar?: ReactNode;
  onPage?: (page: number) => void;
}) {
  const navigate = useNavigate();
  const clients = useSpocClients(query);
  const data = clients.data;

  return (
    <OversightPanel title={title} description={description} count={data?.total} toolbar={toolbar}>
      {clients.isError ? (
        <div className="p-4">
          <ErrorState
            description={clients.error.message}
            onRetry={() => void clients.refetch()}
            retrying={clients.isFetching}
          />
        </div>
      ) : !data ? (
        <TableSkeleton rows={6} />
      ) : (
        <SpocDataTable
          rows={data.items}
          columns={clientColumns}
          minWidth={900}
          onOpen={(row) =>
            void navigate({ to: "/spoc-rm/clients/$clientId", params: { clientId: row.id } })
          }
          openLabel={(row) => `Open profile of ${row.displayName}`}
          emptyTitle="No clients found"
          emptyDetail="Try another search or status."
        />
      )}
      {onPage && data && data.total > data.pageSize ? (
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
