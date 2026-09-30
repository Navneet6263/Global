import type { ReactNode } from "react";
import { Eye, FileCheck2 } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { TableSkeleton } from "@/components/feedback/skeletons";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PaginationBar } from "@/components/layout/pagination-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OversightEmpty, OversightPanel } from "@/features/admin-dashboard/components/oversight-ui";
import { oversightLabel } from "@/features/admin-dashboard/oversight-format";
import { formatDateTime } from "@/lib/formatting";
import type { VendorRequestPage, VendorRequestRow } from "./vendor-contracts";
import { REQUEST_STATUS_META } from "./vendor-request-model";

const HEADERS = ["Assigned", "Client", "Case", "Document", "Assigned by", "Handled by", "Status"];

/** The vendor's own requests. Rows only open the request drawer. */
export function VendorRequestTable({
  data,
  error,
  retrying,
  toolbar,
  title = "Assigned documents",
  description = "Open a request to view the document, then approve it or reject it with a reason.",
  onRetry,
  onPage,
  onOpen,
}: {
  data: VendorRequestPage | undefined;
  error: Error | null;
  retrying: boolean;
  toolbar?: ReactNode;
  title?: string;
  description?: string;
  onRetry: () => void;
  /** Omit to show one page only (the overview's latest requests). */
  onPage?: (page: number) => void;
  onOpen: (row: VendorRequestRow) => void;
}) {
  return (
    <OversightPanel
      title={title}
      description={description}
      count={onPage ? data?.total : undefined}
      toolbar={toolbar}
    >
      {error ? (
        <div className="p-4">
          <ErrorState description={error.message} onRetry={onRetry} retrying={retrying} />
        </div>
      ) : !data ? (
        <TableSkeleton rows={5} />
      ) : !data.items.length ? (
        <OversightEmpty
          title="No requests here"
          detail="New assignments appear here and in your notifications."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[760px] text-xs">
            <TableHeader>
              <TableRow>
                {HEADERS.map((header) => (
                  <TableHead key={header} className="text-[10px] uppercase">
                    {header}
                  </TableHead>
                ))}
                <TableHead>
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((row) => {
                const status = REQUEST_STATUS_META[row.status];
                return (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => onOpen(row)}>
                    <TableCell>{formatDateTime(row.assignedAt)}</TableCell>
                    <TableCell className="font-medium">{row.clientName}</TableCell>
                    <TableCell>{row.caseNumber}</TableCell>
                    <TableCell>{oversightLabel(row.documentType)}</TableCell>
                    <TableCell>{row.assignedBy}</TableCell>
                    <TableCell className="text-muted-foreground">{row.handledBy ?? "—"}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <StatusBadge label={status.label} tone={status.tone} />
                        {row.hasReport ? (
                          <span title="Report uploaded" className="text-primary">
                            <FileCheck2 className="size-3.5" aria-hidden />
                            <span className="sr-only">Report uploaded</span>
                          </span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        aria-label={`Open ${row.caseNumber}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(row);
                        }}
                        className="inline-grid size-8 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-primary/35 hover:text-primary"
                      >
                        <Eye className="size-3.5" aria-hidden />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
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
