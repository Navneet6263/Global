import type { ReactNode } from "react";
import { ErrorState } from "@/components/feedback/error-state";
import { TableSkeleton } from "@/components/feedback/skeletons";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { OversightPanel } from "@/features/admin-dashboard/components/oversight-ui";
import { SpocCell, SpocDataTable, type SpocColumn } from "../components/SpocDataTable";
import { statusTone } from "../config/spoc-meta";
import type { SpocQuery } from "../contracts/spoc";
import { label } from "../utils/spoc-format";
import type { SpocVendorClientRow } from "./spoc-vendor-contracts";
import { useSpocVendorClients } from "./use-spoc-vendors";

const count = (value: number, tone?: string) => (
  <span className={`num font-semibold ${value && tone ? tone : "text-foreground"}`}>{value}</span>
);

const columns: readonly SpocColumn<SpocVendorClientRow>[] = [
  {
    key: "client",
    header: "Client",
    cell: (row) => <SpocCell primary={row.displayName} secondary={row.code} />,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <StatusBadge label={label(row.status)} tone={statusTone(row.status)} />,
  },
  { key: "uploaded", header: "Uploaded documents", cell: (row) => count(row.uploaded) },
  { key: "notAssigned", header: "Not assigned", cell: (row) => count(row.notAssigned) },
  { key: "pending", header: "With vendor", cell: (row) => count(row.pending) },
  { key: "approved", header: "Approved", cell: (row) => count(row.approved) },
  {
    key: "rejected",
    header: "Rejected",
    cell: (row) => count(row.rejected, "text-critical-foreground"),
  },
];

/** Clients available to the SPOC-RM (its own client; every client for Platform Admin). */
export function SpocVendorClients({
  query,
  toolbar,
  onPage,
  onOpen,
}: {
  query: SpocQuery;
  toolbar?: ReactNode;
  onPage: (page: number) => void;
  onOpen: (clientId: string) => void;
}) {
  const clients = useSpocVendorClients(query);
  const data = clients.data;
  return (
    <OversightPanel
      title="Clients"
      description="Select a client to see its uploaded documents and vendor decisions."
      count={data?.total}
      toolbar={toolbar}
    >
      {clients.isError ? (
        <div className="p-4">
          <ErrorState
            description={clients.error.message}
            onRetry={() => void clients.refetch()}
            retrying={clients.isFetching}
          />
        </div>
      ) : !data ? (
        <TableSkeleton rows={4} />
      ) : (
        <SpocDataTable
          rows={data.items}
          columns={columns}
          minWidth={820}
          onOpen={(row) => onOpen(row.id)}
          openLabel={(row) => `Open documents for ${row.displayName}`}
          emptyTitle="No clients found"
          emptyDetail="Try another search."
        />
      )}
      {data && data.total > data.pageSize ? (
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
