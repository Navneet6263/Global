"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Download,
  FileCheck2,
  LogIn,
  ShieldCheck,
  Upload,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ErrorState } from "@/components/feedback/error-state";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { PlatformUser } from "@/lib/contracts/user";
import { getUserActivity, type UserActivityEvent } from "@/lib/backend-api/users";
import { formatDateTime, initialsOf } from "@/lib/formatting";

const PAGE_SIZE = 10;

export function UserActivityDrawer({
  user,
  onClose,
}: {
  user: PlatformUser | null;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [user?.id]);
  const query = useQuery({
    queryKey: ["users", user?.id, "activity", page],
    queryFn: () => getUserActivity(user!.id, { page, pageSize: PAGE_SIZE }),
    enabled: Boolean(user),
    placeholderData: keepPreviousData,
  });

  return (
    <Sheet open={Boolean(user)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent
        side="right"
        className="w-[min(96vw,760px)] max-w-none gap-0 overflow-y-auto p-0 sm:max-w-[700px]"
      >
        {user ? (
          <>
            <SheetHeader className="border-b border-border bg-muted/20 px-6 py-5 pr-16">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
                  {initialsOf(user.fullName)}
                </span>
                <div className="min-w-0">
                  <SheetTitle className="truncate text-lg">{user.fullName}</SheetTitle>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <HeaderMetric label="Recorded actions" value={String(query.data?.total ?? 0)} />
                <HeaderMetric label="Account status" value={user.status} />
                <HeaderMetric
                  label="Last login"
                  value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}
                  wide
                />
              </div>
            </SheetHeader>

            <div className="px-6 py-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Employee activity timeline
                </h3>
                <p className="text-xs text-muted-foreground">
                  Successful workflow and security actions, newest first.
                </p>
              </div>

              {query.isError ? (
                <ErrorState onRetry={() => void query.refetch()} retrying={query.isFetching} />
              ) : query.isPending ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }, (_, index) => (
                    <div key={index} className="h-20 animate-pulse rounded-2xl bg-muted" />
                  ))}
                </div>
              ) : query.data.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                  <Activity className="mx-auto size-5 text-muted-foreground" aria-hidden />
                  <p className="mt-2 text-sm font-medium">No recorded activity yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Login and workflow actions will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-3xl border border-border bg-card">
                  <ol className="divide-y divide-border">
                    {query.data.items.map((event) => (
                      <ActivityRow key={event.id} event={event} />
                    ))}
                  </ol>
                  <PaginationBar
                    page={query.data.page}
                    pageSize={query.data.pageSize}
                    total={query.data.total}
                    onPageChange={setPage}
                    label="actions"
                  />
                </div>
              )}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ActivityRow({ event }: { event: UserActivityEvent }) {
  const presentation = present(event);
  const Icon = presentation.icon;
  const actor = event.actor?.displayName ?? "System";
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-4">
      <span className={`grid size-10 place-items-center rounded-2xl ${presentation.tone}`}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">{presentation.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{presentation.detail}</p>
          </div>
          <time className="shrink-0 text-[11px] text-muted-foreground">
            {formatDateTime(event.createdAt)}
          </time>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          By <span className="font-medium text-foreground">{actor}</span>
          {event.locationLabel ? ` · ${event.locationLabel}` : ""}
        </p>
      </div>
    </li>
  );
}

function present(event: UserActivityEvent): {
  title: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
} {
  const before = json(event.beforeJson);
  const after = json(event.afterJson);
  const caseNumber = text(after["caseNumber"]);
  const resource = caseNumber || compactResource(event);
  if (event.action === "case.transitioned") {
    const status = text(after["status"]);
    return {
      title: status === "IN_PROGRESS" ? "Started verification" : `Moved case to ${human(status)}`,
      detail: `${resource} · ${human(text(before["status"]))} → ${human(status)}`,
      icon: CheckCircle2,
      tone: "bg-success/15 text-success-foreground",
    };
  }
  if (event.action === "document.downloaded") {
    return {
      title: "Opened verification document",
      detail: `${resource} · ${human(text(after["documentType"]))} · version ${text(after["version"]) || "latest"}`,
      icon: Download,
      tone: "bg-info/15 text-info-foreground",
    };
  }
  if (["task.assigned", "task.reassigned", "task.created"].includes(event.action)) {
    return {
      title:
        event.action === "task.reassigned"
          ? "Reassigned verification check"
          : "Assigned verification check",
      detail: `${resource} · ${text(after["assigneeName"]) || "Verifier selected"}`,
      icon: ArrowRightLeft,
      tone: "bg-accent/70 text-primary",
    };
  }
  if (event.action === "task.updated") {
    const status = text(after["status"]);
    return {
      title:
        status === "COMPLETED"
          ? "Completed verification check"
          : `${human(status)} verification check`,
      detail: compactResource(event),
      icon: FileCheck2,
      tone: "bg-success/15 text-success-foreground",
    };
  }
  if (event.action.startsWith("qa.")) {
    return {
      title:
        event.action === "qa.approved"
          ? "Approved case in QA"
          : human(event.action.replace("qa.", "QA ")),
      detail: compactResource(event),
      icon: ShieldCheck,
      tone: "bg-success/15 text-success-foreground",
    };
  }
  if (event.action === "case.escalated") {
    return {
      title: "Escalated case to client",
      detail: resource,
      icon: AlertTriangle,
      tone: "bg-critical/10 text-critical-foreground",
    };
  }
  if (event.action === "case.owner-assigned") {
    return {
      title: "Assigned operations owner",
      detail: `${resource} · ${text(after["ownerName"]) || "Owner updated"}`,
      icon: UserCog,
      tone: "bg-accent/70 text-primary",
    };
  }
  if (event.action === "auth.login.succeeded") {
    return {
      title: "Signed in",
      detail: "Successful account access",
      icon: LogIn,
      tone: "bg-info/15 text-info-foreground",
    };
  }
  if (event.action.includes("uploaded")) {
    return {
      title: human(event.action),
      detail: compactResource(event),
      icon: Upload,
      tone: "bg-info/15 text-info-foreground",
    };
  }
  return {
    title: human(event.action),
    detail: compactResource(event),
    icon: Activity,
    tone: "bg-muted text-muted-foreground",
  };
}

function HeaderMetric({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card px-3 py-2.5 ${wide ? "col-span-2 sm:col-span-1" : ""}`}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold capitalize text-foreground">{value}</p>
    </div>
  );
}

function json(value?: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function human(value: string): string {
  return value
    .replaceAll(/[._-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compactResource(event: UserActivityEvent): string {
  if (!event.resourcePublicId) return human(event.resourceType);
  return `${human(event.resourceType)} · ${event.resourcePublicId.slice(0, 8)}`;
}
