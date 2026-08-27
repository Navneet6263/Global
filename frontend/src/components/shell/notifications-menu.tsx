"use client";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { NOTIFICATION_TONE } from "@/lib/contracts/notifications";
import { formatRelativeToNow } from "@/lib/formatting";
import { TONE_DOT } from "@/lib/formatting/tones";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function NotificationsMenu() {
  const { data, isPending } = useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: () => api.notifications.list(),
  });
  const unread = data?.filter((item) => !item.read).length ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-4" aria-hidden />
          {unread > 0 ? (
            <span className="num absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] rounded-2xl p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-muted-foreground">{unread} unread operational alerts</p>
        </div>
        <div className="max-h-80 divide-y divide-border overflow-y-auto">
          {isPending
            ? Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="space-y-2 px-4 py-3">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              ))
            : data?.map((item) => (
                <Link
                  key={item.id}
                  to={item.route as "/admin"}
                  className="block px-4 py-3 transition-colors hover:bg-muted/60"
                >
                  <span className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        TONE_DOT[NOTIFICATION_TONE[item.kind]],
                      )}
                      aria-hidden
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
                </Link>
              ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
