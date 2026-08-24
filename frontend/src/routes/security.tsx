import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock3, KeyRound, Laptop, MapPin, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, Panel } from "@/components/dashboards/ui";
import { Sidebar } from "@/components/ops/Sidebar";
import { Topbar } from "@/components/ops/Topbar";
import {
  getSession,
  listActiveSessions,
  revokeActiveSession,
  revokeOtherSessions,
  type ActiveSession,
} from "@/lib/api/auth";

export const Route = createFileRoute("/security")({
  head: () => ({ meta: [{ title: "Account Security — Sapling Global" }] }),
  component: SecurityPage,
});

function SecurityPage() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const sessions = useQuery({ queryKey: ["auth", "sessions"], queryFn: listActiveSessions });
  const revoke = useMutation({
    mutationFn: revokeActiveSession,
    onSuccess: async (result) => {
      if (result.current) {
        queryClient.clear();
        window.location.assign("/login");
        return;
      }
      toast.success("Session revoked");
      await queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const revokeOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: async ({ revoked }) => {
      toast.success(revoked ? `${revoked} other session(s) revoked` : "No other active sessions");
      await queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="canvas-mesh min-h-screen bg-background text-foreground lg:pl-64">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onRefresh={() => {
            void profile.refetch();
            void sessions.refetch();
          }}
          isRefreshing={profile.isFetching || sessions.isFetching}
        />
        <main className="flex-1 space-y-4 px-4 pb-10 sm:px-6">
          <PageHeader
            title="Account security"
            subtitle="Password controls and signed-in device management"
            chip="Protected session"
          />
          {profile.isError || sessions.isError ? (
            <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
              {profile.error?.message ?? sessions.error?.message}
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
            <Panel title="Security profile" subtitle="Your authenticated account boundary">
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-2xl bg-accent/15 p-4">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{profile.data?.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{profile.data?.email}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border p-4 text-xs">
                  <p className="text-muted-foreground">Workspace</p>
                  <p className="mt-1 font-semibold">{profile.data?.tenantName}</p>
                  <p className="mt-3 text-muted-foreground">Roles</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {profile.data?.roles.map((role) => (
                      <span
                        key={role}
                        className="rounded-full bg-secondary px-2.5 py-1 font-semibold"
                      >
                        {humanize(role)}
                      </span>
                    ))}
                  </div>
                </div>
                <Link
                  to="/change-password"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  <KeyRound className="h-4 w-4" /> Change password
                </Link>
              </div>
            </Panel>

            <Panel
              title="Active sessions"
              subtitle="Devices currently allowed to access your account"
              action={
                (sessions.data?.items.length ?? 0) > 1 ? (
                  <button
                    type="button"
                    onClick={() => revokeOthers.mutate()}
                    disabled={revokeOthers.isPending}
                    className="rounded-full bg-secondary px-3 py-2 text-[11px] font-semibold disabled:opacity-50"
                  >
                    Revoke all others
                  </button>
                ) : undefined
              }
            >
              {sessions.isLoading ? (
                <div className="h-48 animate-pulse rounded-2xl bg-secondary" />
              ) : sessions.data?.items.length ? (
                <div className="space-y-2">
                  {sessions.data.items.map((item) => (
                    <SessionRow
                      key={item.id}
                      item={item}
                      revoking={revoke.isPending && revoke.variables === item.id}
                      onRevoke={() => revoke.mutate(item.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="py-10 text-center text-xs text-muted-foreground">
                  No active sessions were returned.
                </p>
              )}
            </Panel>
          </div>
        </main>
      </div>
    </div>
  );
}

function SessionRow({
  item,
  revoking,
  onRevoke,
}: {
  item: ActiveSession;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const device = describeDevice(item.userAgent);
  const Icon = device.mobile ? Smartphone : Laptop;
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/70 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{device.label}</p>
          {item.current ? (
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
              Current
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {item.ipAddress ?? "IP unavailable"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3 w-3" /> Signed in {formatDate(item.createdAt)}
          </span>
        </div>
        <p
          className="mt-1 truncate text-[10px] text-muted-foreground/75"
          title={item.userAgent ?? undefined}
        >
          Expires {formatDate(item.expiresAt)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRevoke}
        disabled={revoking}
        aria-label={`${item.current ? "Sign out current" : "Revoke"} session on ${device.label}`}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-destructive disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function describeDevice(userAgent?: string | null) {
  const value = userAgent ?? "";
  const mobile = /Android|iPhone|iPad/i.test(value);
  const platform = /iPhone|iPad/i.test(value)
    ? "iOS"
    : /Android/i.test(value)
      ? "Android"
      : /Windows/i.test(value)
        ? "Windows"
        : /Mac OS/i.test(value)
          ? "macOS"
          : /Linux/i.test(value)
            ? "Linux"
            : "Unknown device";
  const browser = /Edg\//i.test(value)
    ? "Edge"
    : /Firefox\//i.test(value)
      ? "Firefox"
      : /Chrome\//i.test(value)
        ? "Chrome"
        : /Safari\//i.test(value)
          ? "Safari"
          : "Browser";
  return { mobile, label: `${browser} on ${platform}` };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
