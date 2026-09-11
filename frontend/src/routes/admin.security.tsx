import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import {
  AuthEventsPanel,
  SessionsPanel,
  TokenReuseAlert,
} from "@/features/security/components/security-panels";
import { formatDateTime } from "@/lib/formatting";

export const Route = createFileRoute("/admin/security")({
  head: () => ({
    meta: [
      { title: "Account Security — Sapling Global" },
      {
        name: "description",
        content:
          "Review active sessions, authentication activity and anomaly alerts for your Sapling Global admin identity.",
      },
      { property: "og:title", content: "Account Security — Sapling Global" },
      {
        property: "og:description",
        content: "Active sessions, authentication activity and anomaly alerts.",
      },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.security(),
    queryFn: () => api.security.getOverview(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.security() });

  const revoke = useMutation({
    mutationFn: (id: string) => api.security.revokeSession(id),
    onSuccess: () => {
      toast.success("Session revoked");
      void invalidate();
    },
    onError: (error: Error) =>
      toast.error("Session could not be revoked", { description: error.message }),
  });

  const revokeOthers = useMutation({
    mutationFn: () => api.security.revokeOtherSessions(),
    onSuccess: () => {
      toast.success("All other sessions revoked");
      void invalidate();
    },
    onError: (error: Error) =>
      toast.error("Other sessions could not be revoked", { description: error.message }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account security"
        description="Session control and authentication history for your platform identity."
        meta={data ? `Password last updated ${formatDateTime(data.passwordUpdatedAt)}` : undefined}
      />

      {isError ? <ErrorState onRetry={() => void refetch()} /> : null}
      {isPending ? <ListSkeleton rows={4} /> : null}

      {data ? (
        <>
          <TokenReuseAlert overview={data} />
          <SessionsPanel
            overview={data}
            busy={revoke.isPending || revokeOthers.isPending}
            revokingId={revoke.isPending ? revoke.variables : undefined}
            revokingOthers={revokeOthers.isPending}
            onRevoke={(id) => revoke.mutate(id)}
            onRevokeOthers={() => revokeOthers.mutate()}
          />
          <AuthEventsPanel overview={data} />
        </>
      ) : null}
    </div>
  );
}
