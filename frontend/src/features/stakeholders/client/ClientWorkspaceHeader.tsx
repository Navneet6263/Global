import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import { lazy, Suspense } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/api/auth";
import { exportCases } from "@/lib/api/cases";
import type { ClientQueueSearch } from "./client-queue-model";

const NewCaseDialog = lazy(() =>
  import("@/components/ops/NewCaseDialog").then((module) => ({ default: module.NewCaseDialog })),
);
const ClientBulkIntake = lazy(() =>
  import("./ClientBulkIntake").then((module) => ({ default: module.ClientBulkIntake })),
);

export function ClientWorkspaceHeader({
  title,
  description,
  allowCreate = false,
  exportFilter,
}: {
  title: string;
  description: string;
  allowCreate?: boolean;
  exportFilter?: ClientQueueSearch;
}) {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const can = (permission: string) =>
    Boolean(session.data?.permissions.some((p) => p === "*" || p === permission));
  const canCreate = allowCreate && can("case:create");
  const exportMutation = useMutation({
    mutationFn: () => exportCases({ search: exportFilter?.q, status: exportFilter?.status }),
    onError: (error) => toast.error("Export failed", { description: error.message }),
  });
  return (
    <header className="client-heading">
      <div>
        <h1>{title}</h1>
        <p>
          {session.data?.clientName ? `${session.data.clientName} · ` : ""}
          {description}
        </p>
      </div>
      <div className="client-heading-actions">
        {canCreate ? (
          <div className="client-import-control">
            <Suspense
              fallback={
                <Button variant="outline" loading disabled>
                  Loading import
                </Button>
              }
            >
              <ClientBulkIntake />
            </Suspense>
          </div>
        ) : null}
        {exportFilter && can("case:read") ? (
          <Button
            variant="outline"
            className="bg-white text-primary"
            loading={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
            aria-label="Export CSV"
          >
            <Download aria-hidden />
            {exportMutation.isPending ? "Exporting…" : "Export"}
          </Button>
        ) : null}
        {canCreate ? (
          <Suspense
            fallback={
              <Button loading disabled>
                Loading new verification
              </Button>
            }
          >
            <NewCaseDialog
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center gap-2 bg-primary px-4 font-semibold text-white hover:bg-primary/90"
                >
                  <Plus className="size-4" aria-hidden />
                  New verification
                </button>
              }
            />
          </Suspense>
        ) : null}
      </div>
    </header>
  );
}
