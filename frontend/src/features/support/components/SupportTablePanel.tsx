import type { ReactNode } from "react";
import { ErrorState } from "@/components/feedback/error-state";
import { TableSkeleton } from "@/components/feedback/skeletons";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { OversightPanel } from "@/features/admin-dashboard/components/oversight-ui";
import { SpocDataTable, type SpocColumn } from "@/features/spoc-rm/components/SpocDataTable";
import type { SupportPage } from "../api/support-contracts";

/** One paged support list: loading, error, empty, rows and pagination in one place. */
export function SupportTablePanel<T extends { id: string }>({
  title,
  description,
  toolbar,
  data,
  error,
  retrying,
  onRetry,
  columns,
  onOpen,
  openLabel,
  onPage,
  emptyTitle,
  emptyDetail,
  minWidth,
}: {
  title: string;
  description: string;
  toolbar?: ReactNode;
  data: SupportPage<T> | undefined;
  error: Error | null;
  retrying: boolean;
  onRetry: () => void;
  columns: readonly SpocColumn<T>[];
  onOpen: (row: T) => void;
  openLabel: (row: T) => string;
  onPage: (page: number) => void;
  emptyTitle: string;
  emptyDetail: string;
  minWidth?: number;
}) {
  return (
    <OversightPanel title={title} description={description} count={data?.total} toolbar={toolbar}>
      {error ? (
        <div className="p-4">
          <ErrorState description={error.message} onRetry={onRetry} retrying={retrying} />
        </div>
      ) : !data ? (
        <TableSkeleton rows={6} />
      ) : (
        <SpocDataTable
          rows={data.items}
          columns={columns}
          onOpen={onOpen}
          openLabel={openLabel}
          emptyTitle={emptyTitle}
          emptyDetail={emptyDetail}
          minWidth={minWidth}
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
