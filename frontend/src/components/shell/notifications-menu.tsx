"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/backend-api/notifications";
import { NOTIFICATION_TONE, type PlatformNotification } from "@/lib/contracts/notifications";
import { formatRelativeToNow } from "@/lib/formatting";
import { TONE_DOT } from "@/lib/formatting/tones";
import { cn } from "@/lib/utils";
import type { NavWorkspace } from "@/config/navigation";
import { WORKSPACE_PRESENTATION } from "@/config/workspace-presentation";

export function NotificationsMenu({ workspace }: { workspace: NavWorkspace }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: () => api.notifications.list(),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 20_000,
  });
  const unread = query.data?.filter((item) => !item.read).length ?? 0;
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
  const readOne = useMutation({ mutationFn: markNotificationRead, onSettled: refresh });
  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSettled: refresh,
    onError: (error: Error) =>
      toast.error("Notifications could not be updated", { description: error.message }),
  });

  const open = async (item: PlatformNotification) => {
    if (!item.read) {
      try {
        await readOne.mutateAsync(item.id);
      } catch (error) {
        toast.error("Notification could not be marked as read", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    }
    const caseId = item.route.match(/^\/cases\/([0-9a-f-]+)$/i)?.[1];
    if (caseId && workspace === "platform-admin") {
      await navigate({ to: "/admin/cases", search: { caseId } });
      return;
    }
    if (caseId && workspace === "operations") {
      await navigate({ to: "/operations/cases", search: { caseId } });
      return;
    }
    if (caseId && workspace === "client-admin") {
      await navigate({ to: "/client-portal", search: { caseId } });
      return;
    }
    if (caseId) {
      await navigate({ to: WORKSPACE_PRESENTATION[workspace].home as "/admin" });
      return;
    }
    await navigate({ to: item.route as "/admin" });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-4" aria-hidden />
          {unread ? (
            <span className="num absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {Math.min(unread, 9)}
              {unread > 9 ? "+" : ""}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] rounded-2xl p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">{unread} unread operational alerts</p>
          </div>
          {unread ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={readAll.isPending}
              onClick={() => readAll.mutate()}
              className="h-8 gap-1.5 rounded-full px-2.5 text-[11px]"
            >
              {readAll.isPending ? (
                <LoaderCircle className="size-3 animate-spin" />
              ) : (
                <CheckCheck className="size-3" />
              )}
              Mark all read
            </Button>
          ) : null}
        </div>
        <div className="max-h-80 divide-y divide-border overflow-y-auto">
          {query.isPending
            ? Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="space-y-2 px-4 py-3">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              ))
            : query.data?.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void open(item)}
                  disabled={readOne.isPending}
                  className="block w-full px-4 py-3 text-left transition-colors hover:bg-muted/60 disabled:opacity-60"
                >
                  <span className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        item.read ? "bg-border-strong" : TONE_DOT[NOTIFICATION_TONE[item.kind]],
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-foreground">
                        {item.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">{item.body}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground/80">
                        {formatRelativeToNow(item.at)}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
          {!query.isPending && !query.data?.length ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              You are all caught up.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
