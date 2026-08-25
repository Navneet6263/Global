import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Fingerprint, KeyRound, Laptop, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { SecurityProfile } from "@/features/stakeholders/security/SecurityProfile";
import { SecuritySessions } from "@/features/stakeholders/security/SecuritySessions";
import { SecurityTimeline } from "@/features/stakeholders/security/SecurityTimeline";
import {
  StakeholderHeader,
  StakeholderKpis,
  StakeholderShell,
} from "@/features/stakeholders/StakeholderShell";
import {
  getSession,
  listActiveSessions,
  listSecurityEvents,
  revokeActiveSession,
  revokeOtherSessions,
} from "@/lib/api/auth";

export const Route = createFileRoute("/security")({
  head: () => ({ meta: [{ title: "Account Security — Sapling Global" }] }),
  component: SecurityPage,
});

function SecurityPage() {
  const queryClient = useQueryClient();
  const [eventCursor, setEventCursor] = useState<string>();
  const [eventHistory, setEventHistory] = useState<Array<string | undefined>>([]);
  const profile = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const sessions = useQuery({ queryKey: ["auth", "sessions"], queryFn: listActiveSessions });
  const events = useQuery({
    queryKey: ["auth", "security-events", eventCursor],
    queryFn: () =>
      listSecurityEvents({ limit: 8, ...(eventCursor ? { cursor: eventCursor } : {}) }),
  });
  const revoke = useMutation({
    mutationFn: revokeActiveSession,
    onSuccess: async (result) => {
      if (result.current) {
        queryClient.clear();
        window.location.assign("/login");
        return;
      }
      toast.success("Session revoked");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["auth", "security-events"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const revokeOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: async ({ revoked }) => {
      toast.success(revoked ? `${revoked} other session(s) revoked` : "No other active sessions");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["auth", "security-events"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const items = sessions.data?.items ?? [];
  const others = items.filter((item) => !item.current).length;
  return (
    <StakeholderShell
      onRefresh={() => {
        void profile.refetch();
        void sessions.refetch();
        void events.refetch();
      }}
      refreshing={profile.isFetching || sessions.isFetching || events.isFetching}
    >
      <StakeholderHeader
        eyebrow="Stakeholders / Security"
        title="Account protection"
        description="Control your credentials and every device currently authorised to access the platform."
      />
      {profile.isError || sessions.isError || events.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {profile.error?.message ?? sessions.error?.message ?? events.error?.message}
        </div>
      ) : null}
      <StakeholderKpis
        items={[
          {
            label: "Active sessions",
            value: items.length,
            detail: "Authenticated devices",
            icon: Laptop,
            tone: "blue",
            progress: items.length ? 100 : 0,
          },
          {
            label: "Other devices",
            value: others,
            detail: others ? "Review if all are recognised" : "Only this device is active",
            icon: Fingerprint,
            tone: others ? "orange" : "emerald",
            progress: ratio(others, items.length),
          },
          {
            label: "Assigned roles",
            value: profile.data?.roles.length ?? 0,
            detail: "Role-based access boundaries",
            icon: ShieldCheck,
            tone: "violet",
            progress: profile.data?.roles.length ? 100 : 0,
          },
          {
            label: "Credential control",
            value: events.data?.summary.attention ?? 0,
            detail: "Authentication events needing attention",
            icon: KeyRound,
            tone: events.data?.summary.attention ? "orange" : "emerald",
            progress: events.data?.summary.attention ? 75 : 100,
          },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-[0.65fr_1.35fr]">
        <SecurityProfile profile={profile.data} />
        <SecuritySessions
          items={items}
          loading={sessions.isLoading}
          revokingId={revoke.isPending ? revoke.variables : undefined}
          revokingOthers={revokeOthers.isPending}
          onRevoke={(id) => revoke.mutate(id)}
          onRevokeOthers={() => revokeOthers.mutate()}
        />
      </div>
      <SecurityTimeline
        items={events.data?.items ?? []}
        total={events.data?.summary.total ?? 0}
        page={eventHistory.length + 1}
        loading={events.isLoading}
        hasPrevious={eventHistory.length > 0}
        hasNext={Boolean(events.data?.nextCursor)}
        onPrevious={() => {
          const history = [...eventHistory];
          setEventCursor(history.pop());
          setEventHistory(history);
        }}
        onNext={() => {
          const next = events.data?.nextCursor;
          if (!next) return;
          setEventHistory((current) => [...current, eventCursor]);
          setEventCursor(next);
        }}
      />
    </StakeholderShell>
  );
}
function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}
