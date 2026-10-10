"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCheck,
  ClipboardList,
  IndianRupee,
  LoaderCircle,
  MailOpen,
  Mail,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { queryKeys } from "@/lib/api/query-keys";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  type NotificationCategory,
  type NotificationItem,
} from "@/lib/backend-api/notifications";
import { formatRelativeToNow } from "@/lib/formatting";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";
import type { NavWorkspace } from "@/config/navigation";
import { WORKSPACE_PRESENTATION } from "@/config/workspace-presentation";

const PAGE_SIZE = 20;

const CATEGORY: Record<NotificationCategory, { label: string; icon: LucideIcon; tone: string }> = {
  urgent: { label: "Urgent", icon: AlertTriangle, tone: "bg-red-50 text-red-600" },
  review: { label: "Reviews & reports", icon: ShieldCheck, tone: "bg-violet-50 text-violet-700" },
  work: { label: "Work", icon: ClipboardList, tone: "bg-blue-50 text-blue-700" },
  finance: { label: "Finance", icon: IndianRupee, tone: "bg-emerald-50 text-emerald-700" },
  other: { label: "Other", icon: Bell, tone: "bg-slate-100 text-slate-600" },
};
const CATEGORY_ORDER: NotificationCategory[] = ["urgent", "review", "work", "finance", "other"];

/** "Today", "Yesterday", "This week" or "Earlier" for grouping the list. */
function dayGroup(value: string) {
  const date = new Date(value);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diff = (start.getTime() - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000;
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "This week";
  return "Earlier";
}

/**
 * Notification inbox: the bell opens a side panel with All / Unread, category filters
 * and search. The list loads 20 at a time and keeps loading as you scroll down.
 */
export function NotificationsMenu({ workspace }: { workspace: NavWorkspace }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [category, setCategory] = useState<NotificationCategory | undefined>();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), 250);
  // Badge: unread count, refreshed every minute while the app is open.
  const badge = useQuery({
    queryKey: [...queryKeys.notifications(), "badge"],
    queryFn: () => listNotifications({ limit: 1 }),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  const inbox = useInfiniteQuery({
    queryKey: [...queryKeys.notifications(), "inbox", { unreadOnly, category, search }],
    queryFn: ({ pageParam }) =>
      listNotifications({
        cursor: pageParam,
        limit: PAGE_SIZE,
        unread: unreadOnly,
        category,
        search,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: open,
  });
  const unread = badge.data?.unread ?? inbox.data?.pages[0]?.unread ?? 0;
  const counts = inbox.data?.pages[0]?.counts ?? badge.data?.counts;
  const items = inbox.data?.pages.flatMap((page) => page.items) ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
  const toggle = useMutation({
    mutationFn: (item: NotificationItem): Promise<{ read: boolean }> =>
      item.readAt ? markNotificationUnread(item.id) : markNotificationRead(item.id),
    onSettled: refresh,
    onError: (error: Error) =>
      toast.error("Could not update the notification", { description: error.message }),
  });
  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: (result) =>
      toast.success(result.read ? `${result.read} marked as read` : "Nothing left unread"),
    onSettled: refresh,
    onError: (error: Error) =>
      toast.error("Notifications could not be updated", { description: error.message }),
  });

  // Load the next page when the sentinel at the bottom of the list scrolls into view.
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = inbox;
  useEffect(() => {
    const target = sentinel.current;
    if (!open || !target || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage)
          void fetchNextPage();
      },
      { root: scroller.current, rootMargin: "200px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [open, hasNextPage, isFetchingNextPage, fetchNextPage, items.length]);

  const go = async (item: NotificationItem) => {
    if (!item.readAt) {
      void markNotificationRead(item.id)
        .then(refresh)
        .catch(() => undefined);
    }
    setOpen(false);
    const route = item.href ?? "";
    const caseId = route.match(/^\/cases\/([0-9a-f-]+)$/i)?.[1];
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
    if (caseId && workspace === "spoc-rm") {
      await navigate({ to: "/spoc-rm/records", search: { domain: "cases", caseId } });
      return;
    }
    if (caseId) {
      await navigate({ to: WORKSPACE_PRESENTATION[workspace].home as "/admin" });
      return;
    }
    if (workspace === "platform-admin" && route.startsWith("/sales-crm")) {
      await navigate({ to: "/admin/sales" });
      return;
    }
    if (workspace === "platform-admin" && route.startsWith("/finance")) {
      await navigate({ to: "/admin/finance" });
      return;
    }
    await navigate({ to: (route || WORKSPACE_PRESENTATION[workspace].home) as "/admin" });
  };

  let lastGroup = "";
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        onClick={() => setOpen(true)}
      >
        <Bell className="size-4" aria-hidden />
        {unread ? (
          <span className="num absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-[28rem]"
          aria-label="Notifications"
        >
          <SheetHeader className="space-y-0 border-b border-slate-200 px-5 pb-3 pt-5 text-left">
            <div className="flex items-center justify-between gap-3 pr-8">
              <div className="min-w-0">
                <SheetTitle className="text-[17px]">Notifications</SheetTitle>
                <SheetDescription className="text-[12.5px]">
                  {unread ? `${unread} unread` : "You're all caught up"}
                  {inbox.data?.pages[0]?.total ? ` · ${inbox.data.pages[0].total} in total` : ""}
                </SheetDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!unread || readAll.isPending}
                loading={readAll.isPending}
                onClick={() => readAll.mutate()}
                className="h-8 gap-1.5 px-2.5 text-[12px]"
              >
                <CheckCheck className="size-3.5" aria-hidden /> Mark all read
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div
                role="radiogroup"
                aria-label="Show"
                className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5"
              >
                {(
                  [
                    [false, "All"],
                    [true, "Unread"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={unreadOnly === value}
                    onClick={() => setUnreadOnly(value)}
                    className={cn(
                      "rounded-md px-3 py-1 text-[12.5px] font-semibold transition",
                      unreadOnly === value
                        ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                        : "text-slate-500 hover:text-slate-800",
                    )}
                  >
                    {label}
                    {value && unread ? (
                      <span className="ml-1 rounded-full bg-red-50 px-1.5 text-[11px] text-red-600">
                        {unread}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
              <label className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search notifications"
                  aria-label="Search notifications"
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-[12.5px] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Category" role="group">
              <CategoryChip
                label="All types"
                active={!category}
                onClick={() => setCategory(undefined)}
              />
              {CATEGORY_ORDER.map((name) => {
                const count = counts?.[name];
                const shown = unreadOnly ? count?.unread : count?.total;
                if (counts && !count?.total) return null;
                return (
                  <CategoryChip
                    key={name}
                    label={CATEGORY[name].label}
                    count={shown}
                    urgent={name === "urgent" && Boolean(count?.unread)}
                    active={category === name}
                    onClick={() => setCategory(category === name ? undefined : name)}
                  />
                );
              })}
            </div>
          </SheetHeader>
          <div
            ref={scroller}
            role="feed"
            aria-label="Notification list"
            aria-busy={inbox.isFetching}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {inbox.isPending ? (
              <div className="grid gap-1 p-3" aria-hidden>
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="flex gap-3 rounded-xl p-3">
                    <span className="size-9 animate-pulse rounded-lg bg-slate-100" />
                    <span className="grid flex-1 gap-2">
                      <span className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                      <span className="h-3 w-full animate-pulse rounded bg-slate-100" />
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {inbox.isError ? (
              <div className="grid justify-items-center gap-2 p-8 text-center" role="alert">
                <p className="text-[13px] text-slate-700">Notifications could not be loaded.</p>
                <Button variant="outline" size="sm" onClick={() => void inbox.refetch()}>
                  Try again
                </Button>
              </div>
            ) : null}
            {!inbox.isPending && !inbox.isError && !items.length ? (
              <div className="grid justify-items-center gap-2 px-6 py-16 text-center">
                <span className="grid size-11 place-items-center rounded-full bg-slate-100 text-slate-400">
                  <BellOff className="size-5" aria-hidden />
                </span>
                <p className="text-[13.5px] font-semibold text-slate-900">
                  {search || category || unreadOnly ? "Nothing matches" : "No notifications yet"}
                </p>
                <p className="text-[12.5px] text-slate-500">
                  {search || category || unreadOnly
                    ? "Try another filter or clear the search."
                    : "Assignments, reviews and alerts will show up here."}
                </p>
              </div>
            ) : null}
            <ul className="grid gap-0.5 p-2">
              {items.map((item) => {
                const group = dayGroup(item.createdAt);
                const heading = group !== lastGroup ? group : null;
                lastGroup = group;
                const meta = CATEGORY[item.category ?? "other"];
                const Icon = meta.icon;
                const isUnread = !item.readAt;
                return (
                  <li key={item.id}>
                    {heading ? (
                      <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {heading}
                      </p>
                    ) : null}
                    <div
                      className={cn(
                        "group relative flex gap-3 rounded-xl p-3 transition hover:bg-slate-50",
                        isUnread && "bg-blue-50/40",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-lg",
                          meta.tone,
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <button
                        type="button"
                        onClick={() => void go(item)}
                        className="min-w-0 flex-1 text-left focus-visible:outline-none"
                      >
                        <span className="flex items-start gap-2">
                          <span
                            className={cn(
                              "min-w-0 flex-1 text-[13px] leading-snug text-slate-900",
                              isUnread ? "font-semibold" : "font-medium text-slate-700",
                            )}
                          >
                            {item.title}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {formatRelativeToNow(item.createdAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-relaxed text-slate-500">
                          {item.body}
                        </span>
                        <span className="mt-1 block text-[11px] font-medium text-slate-400">
                          {meta.label}
                        </span>
                      </button>
                      <div className="flex shrink-0 flex-col items-center justify-between">
                        {isUnread ? (
                          <span className="mt-1.5 size-2 rounded-full bg-blue-600" aria-hidden />
                        ) : (
                          <span className="size-2" />
                        )}
                        <button
                          type="button"
                          onClick={() => toggle.mutate(item)}
                          aria-label={
                            isUnread
                              ? `Mark “${item.title}” as read`
                              : `Mark “${item.title}” as unread`
                          }
                          title={isUnread ? "Mark as read" : "Mark as unread"}
                          className="grid size-7 place-items-center rounded-md text-slate-400 opacity-0 transition hover:bg-white hover:text-slate-700 focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          {isUnread ? (
                            <MailOpen className="size-3.5" aria-hidden />
                          ) : (
                            <Mail className="size-3.5" aria-hidden />
                          )}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div ref={sentinel} className="h-px" aria-hidden />
            {isFetchingNextPage ? (
              <p
                role="status"
                className="flex items-center justify-center gap-2 pb-4 text-[12px] text-slate-500"
              >
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Loading more…
              </p>
            ) : hasNextPage ? (
              <div className="flex justify-center pb-4">
                <Button variant="ghost" size="sm" onClick={() => void fetchNextPage()}>
                  Load more
                </Button>
              </div>
            ) : items.length > PAGE_SIZE / 2 ? (
              <p className="pb-5 text-center text-[12px] text-slate-400">
                That&apos;s everything · {items.length} shown
              </p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function CategoryChip({
  label,
  count,
  active,
  urgent,
  onClick,
}: {
  label: string;
  count?: number | undefined;
  active: boolean;
  urgent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      {urgent ? <span className="size-1.5 rounded-full bg-red-500" aria-hidden /> : null}
      {label}
      {count !== undefined ? (
        <span className={cn("num text-[11px]", active ? "text-slate-300" : "text-slate-400")}>
          {count}
        </span>
      ) : null}
    </button>
  );
}
