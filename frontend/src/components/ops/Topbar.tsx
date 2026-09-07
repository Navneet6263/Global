import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck, Plus, RefreshCw, Search } from "lucide-react";
import { useState } from "react";

import { MobileWorkspaceNav } from "@/components/navigation/MobileWorkspaceNav";
import { getSession } from "@/lib/api/auth";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/api/notifications";

import { NewCaseDialog } from "./NewCaseDialog";

interface TopbarProps {
  search?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  showCreateCase?: boolean;
}

export function Topbar({
  search = "",
  searchPlaceholder = "Search cases, candidates and clients…",
  onSearchChange,
  onRefresh,
  isRefreshing = false,
  showCreateCase = true,
}: TopbarProps) {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const canReadNotifications =
    session.data?.permissions.includes("*") ||
    session.data?.permissions.includes("notification:read");
  const canCreateCase =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("case:create");
  const initials = (session.data?.displayName ?? "SG")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-[var(--hairline)] bg-background/85 px-3 backdrop-blur-xl sm:gap-3 sm:px-4">
      <MobileWorkspaceNav />

      {onSearchChange ? (
        <label className="relative min-w-0 flex-1 sm:max-w-md">
          <span className="sr-only">Search cases, candidates and clients</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="surface h-10 w-full rounded-full pl-10 pr-4 text-base outline-none transition-shadow placeholder:text-muted-foreground focus:shadow-[var(--shadow-float)] focus:ring-2 focus:ring-ring/25 sm:text-sm"
          />
        </label>
      ) : (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{session.data?.tenantName}</p>
          <p className="truncate text-xs text-muted-foreground">Secure verification workspace</p>
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => (onRefresh ? onRefresh() : window.location.reload())}
          disabled={isRefreshing}
          aria-label="Refresh current workspace"
          className="surface grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition-all hover:text-foreground disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>

        {canCreateCase && showCreateCase ? (
          <NewCaseDialog
            trigger={
              <button className="ink-panel flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold shadow-[var(--shadow-float)] transition-transform hover:scale-[1.03] sm:px-4">
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline">New case</span>
              </button>
            }
          />
        ) : null}

        {canReadNotifications ? <NotificationInbox /> : null}

        <Link
          to="/change-password"
          aria-label="Open account security"
          title={session.data?.displayName}
          className="accent-panel grid h-10 w-10 place-items-center rounded-full text-xs font-bold shadow-[var(--shadow-glow-accent)]"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}

function NotificationInbox() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  const read = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  const openNotification = (item: NotificationItem) => {
    if (!item.readAt) read.mutate(item.id);
    if (item.href) window.location.assign(item.href);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${query.data?.unread ? `, ${query.data.unread} unread` : ""}`}
        aria-expanded={open}
        className="surface relative grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {query.data?.unread ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[9px] font-bold leading-4 text-destructive-foreground">
            {Math.min(query.data.unread, 99)}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="surface-float absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-[var(--hairline)] shadow-[var(--shadow-float)]">
          <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-[11px] text-muted-foreground">{query.data?.unread ?? 0} unread</p>
            </div>
            {query.data?.unread ? (
              <button
                type="button"
                onClick={() => readAll.mutate()}
                disabled={readAll.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[10px] font-semibold"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-[28rem] overflow-y-auto p-2">
            {query.isLoading ? (
              <div className="h-36 animate-pulse rounded-2xl bg-secondary" />
            ) : null}
            {query.data?.items.length ? (
              query.data.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className={`w-full rounded-2xl p-3 text-left transition-colors hover:bg-secondary ${item.readAt ? "opacity-65" : "bg-accent/10"}`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? "bg-muted" : "bg-accent"}`}
                    />
                    <div>
                      <p className="text-xs font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.body}</p>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        {formatNotificationTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            ) : query.isLoading ? null : (
              <p className="py-10 text-center text-xs text-muted-foreground">
                You are all caught up.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
