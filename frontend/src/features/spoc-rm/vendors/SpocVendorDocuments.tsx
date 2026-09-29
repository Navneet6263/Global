import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { TableSkeleton } from "@/components/feedback/skeletons";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Button } from "@/components/ui/button";
import { OversightPanel } from "@/features/admin-dashboard/components/oversight-ui";
import { SpocCell, SpocDataTable, type SpocColumn } from "../components/SpocDataTable";
import { statusTone } from "../config/spoc-meta";
import type { SpocQuery } from "../contracts/spoc";
import { dateTime, label } from "../utils/spoc-format";
import type { SpocVendorDocumentRow } from "./spoc-vendor-contracts";
import { REUPLOAD_META, VENDOR_STATUS_META } from "./spoc-vendor-model";
import { useSpocVendorDocuments } from "./use-spoc-vendors";

const columns: readonly SpocColumn<SpocVendorDocumentRow>[] = [
  {
    key: "candidate",
    header: "Candidate",
    cell: (row) => <SpocCell primary={row.candidateName} secondary={row.caseNumber} />,
  },
  {
    key: "document",
    header: "Document",
    cell: (row) => (
      <SpocCell
        primary={label(row.type)}
        secondary={row.file ? `${row.file.name} · v${row.file.version}` : "No safe version"}
      />
    ),
  },
  { key: "uploaded", header: "Uploaded", cell: (row) => dateTime(row.file?.uploadedAt) },
  {
    key: "internal",
    header: "Internal review",
    cell: (row) => (
      <StatusBadge label={label(row.internalStatus)} tone={statusTone(row.internalStatus)} />
    ),
  },
  {
    key: "vendor",
    header: "Vendor status",
    cell: (row) => {
      const meta = VENDOR_STATUS_META[row.vendorStatus];
      return (
        <div className="space-y-1">
          <StatusBadge label={meta.label} tone={meta.tone} />
          {row.reupload.state !== "NONE" ? (
            <StatusBadge
              label={REUPLOAD_META[row.reupload.state].label}
              tone={REUPLOAD_META[row.reupload.state].tone}
            />
          ) : null}
          {row.current ? (
            <p className="text-[10px] text-muted-foreground">
              {row.current.vendor.name} ·{" "}
              {dateTime(row.current.decidedAt ?? row.current.assignedAt)}
            </p>
          ) : null}
        </div>
      );
    },
  },
];

/** Uploaded documents of one client with their current vendor status. Rows open the drawer. */
export function SpocVendorDocuments({
  clientId,
  query,
  toolbar,
  onBack,
  onPage,
  onOpen,
}: {
  clientId: string;
  query: SpocQuery;
  toolbar?: ReactNode;
  onBack: () => void;
  onPage: (page: number) => void;
  onOpen: (documentId: string) => void;
}) {
  const documents = useSpocVendorDocuments(clientId, query);
  const data = documents.data;
  return (
    <div className="space-y-3">
      <Button type="button" variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden /> All clients
      </Button>
      <OversightPanel
        title={data ? `${data.client.displayName} · documents` : "Client documents"}
        description="Open a document to preview it, assign a vendor or re-assign after a rejection."
        count={data?.total}
        toolbar={toolbar}
      >
        {documents.isError ? (
          <div className="p-4">
            <ErrorState
              description={documents.error.message}
              onRetry={() => void documents.refetch()}
              retrying={documents.isFetching}
            />
          </div>
        ) : !data ? (
          <TableSkeleton rows={6} />
        ) : (
          <SpocDataTable
            rows={data.items}
            columns={columns}
            minWidth={900}
            onOpen={(row) => onOpen(row.id)}
            openLabel={(row) => `Open ${label(row.type)} for ${row.candidateName}`}
            emptyTitle="No uploaded documents"
            emptyDetail="Documents appear here once a safe file has been uploaded to a case."
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
    </div>
  );
}
