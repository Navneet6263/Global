import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Ban, CheckCircle2, ClipboardCheck, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

import { WorkspaceIntro } from "@/features/delivery/shared/WorkspaceIntro";
import {
  VerifierQueue,
  type VerifierQueueFilter,
} from "@/features/delivery/verifier/VerifierQueue";
import { VerifierTaskDesk } from "@/features/delivery/verifier/VerifierTaskDesk";
import { ExportSheetButton } from "@/components/workspace/export-sheet";
import {
  TASK_EXPORT_COLUMNS,
  TASK_EXPORT_DEFAULTS,
  loadAllTasks,
} from "@/features/delivery/verifier/task-export";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceLoading,
} from "@/features/delivery/WorkspaceStates";
import { getMyTasks } from "@/lib/api/tasks";
import { isValidDepartmentId, useVerifierDepartment } from "@/lib/auth/verifier-department";

const filters: readonly VerifierQueueFilter[] = [
  "ACTIVE",
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
];

export const Route = createFileRoute("/verifier/queue")({
  head: () => ({ meta: [{ title: "Active Verification Queue — Sapling Global" }] }),
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    taskId?: string;
    status?: VerifierQueueFilter;
    department?: string;
    q?: string;
  } => ({
    taskId: typeof search["taskId"] === "string" ? search["taskId"] : undefined,
    status: filters.includes(search["status"] as VerifierQueueFilter)
      ? (search["status"] as VerifierQueueFilter)
      : undefined,
    department: isValidDepartmentId(search["department"]) ? search["department"] : undefined,
    q: typeof search["q"] === "string" ? search["q"].trim().slice(0, 120) || undefined : undefined,
  }),
  component: VerifierWorkbench,
});

function VerifierWorkbench() {
  const deepLink = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const { departmentId: activeDepartmentId } = useVerifierDepartment();
  const departmentId = deepLink.department ?? activeDepartmentId;
  const [filter, setFilter] = useState<VerifierQueueFilter>(deepLink.status ?? "ACTIVE");
  const [selectedId, setSelectedId] = useState<string | undefined>(deepLink.taskId);
  const [searchInput, setSearchInput] = useState(deepLink.q ?? "");
  const [search, setSearch] = useState(deepLink.q ?? "");
  const [cursor, setCursor] = useState<string>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);
  useEffect(() => {
    setSelectedId(deepLink.taskId);
    if (deepLink.status) setFilter(deepLink.status);
  }, [deepLink.status, deepLink.taskId]);
  useEffect(() => {
    if (deepLink.q !== undefined) setSearchInput(deepLink.q);
  }, [deepLink.q]);
  useEffect(() => {
    setCursor(undefined);
    setCursorHistory([]);
  }, [departmentId]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setCursor(undefined);
      setCursorHistory([]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const queryStatus = filter === "ACTIVE" ? undefined : filter;
  const tasks = useQuery({
    queryKey: [
      "tasks",
      "mine",
      departmentId ?? "all",
      queryStatus,
      search,
      cursor,
      deepLink.taskId,
    ],
    placeholderData: keepPreviousData,
    queryFn: () =>
      getMyTasks({
        search,
        limit: 25,
        ...(departmentId ? { departmentId } : {}),
        ...(deepLink.taskId ? { taskId: deepLink.taskId } : {}),
        ...(queryStatus ? { status: queryStatus } : {}),
        ...(filter === "ACTIVE" ? { view: "ACTIVE" as const } : {}),
        ...(cursor ? { cursor } : {}),
      }),
  });
  const changingView = tasks.isPlaceholderData || tasks.isLoading || searchInput.trim() !== search;
  const items = tasks.data?.items ?? [];
  const selected = items.find((task) => task.id === selectedId) ?? items[0];
  useEffect(() => {
    if (!changingView && selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [changingView, selected, selectedId]);
  const summary = tasks.data?.summary ?? { active: 0, overdue: 0, blocked: 0, completedToday: 0 };
  const clearDeepLink = () =>
    void navigate({
      search: {
        taskId: undefined,
        status: undefined,
        department: departmentId,
        q: undefined,
      },
      replace: true,
    });
  return (
    <div className="space-y-6">
      <WorkspaceIntro
        eyebrow="Work · Assigned checks"
        title="Active verification queue"
        description="Review protected evidence, record defensible findings and move each assigned check through a controlled hand-off."
        signal={`${summary.active} active checks`}
        actions={
          <ExportSheetButton
            source="verifier-tasks"
            title="Export my checks"
            filename="Sapling-Global-my-checks"
            columns={TASK_EXPORT_COLUMNS}
            defaults={TASK_EXPORT_DEFAULTS}
            scopeNote={`${filter === "ACTIVE" ? "Active" : filter.toLowerCase().replace("_", " ")}${search ? ` · search “${search}”` : ""}`}
            loadRows={() =>
              loadAllTasks({
                search,
                ...(departmentId ? { departmentId } : {}),
                ...(queryStatus ? { status: queryStatus } : {}),
                ...(filter === "ACTIVE" ? { view: "ACTIVE" as const } : {}),
              })
            }
          />
        }
      />
      <section
        aria-label="Queue summary"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-[0_1px_2px_rgb(15_23_42/0.04)] lg:grid-cols-4"
      >
        {[
          {
            label: "Active workload",
            value: summary.active,
            detail: "Open, assigned and in progress",
            icon: ClipboardCheck,
            tone: "bg-blue-50 text-blue-700",
          },
          {
            label: "SLA overdue",
            value: summary.overdue,
            detail: "Past the task due time",
            icon: Clock3,
            tone: summary.overdue ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500",
            alert: summary.overdue > 0,
          },
          {
            label: "Blocked",
            value: summary.blocked,
            detail: "Waiting on a source",
            icon: Ban,
            tone: summary.blocked ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500",
          },
          {
            label: "Completed today",
            value: summary.completedToday,
            detail: "Sent forward",
            icon: CheckCircle2,
            tone: "bg-emerald-50 text-emerald-700",
          },
        ].map(({ label, value, detail, icon: Icon, tone, alert }) => (
          <div key={label} className="flex items-center gap-3 bg-white px-4 py-3.5">
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}>
              <Icon className="size-[18px]" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-medium text-slate-500">{label}</p>
              <p
                className={`num text-[22px] leading-7 font-semibold ${alert ? "text-red-600" : "text-slate-900"}`}
              >
                {value}
              </p>
            </div>
            <p className="ml-auto hidden max-w-[9rem] text-right text-[11.5px] leading-4 text-slate-400 2xl:block">
              {detail}
            </p>
          </div>
        ))}
      </section>
      {deepLink.taskId ? (
        <button
          type="button"
          onClick={clearDeepLink}
          className="w-fit rounded-lg px-1 text-[12.5px] font-semibold text-blue-700 hover:underline"
        >
          ← Return to full queue
        </button>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(22rem,0.7fr)_minmax(0,1.3fr)]">
        <VerifierQueue
          items={items}
          pending={changingView}
          selectedId={selected?.id}
          search={searchInput}
          filters={filters}
          activeFilter={filter}
          hasPrevious={!changingView && cursorHistory.length > 0}
          hasNext={!changingView && Boolean(tasks.data?.nextCursor)}
          onSearch={setSearchInput}
          onFilter={(value) => {
            if (value === filter) return;
            setFilter(value);
            setCursor(undefined);
            setCursorHistory([]);
            if (deepLink.taskId || deepLink.status) clearDeepLink();
          }}
          onPrevious={() => {
            if (changingView || !cursorHistory.length) return;
            const history = [...cursorHistory];
            setCursor(history.pop());
            setCursorHistory(history);
          }}
          onNext={() => {
            const nextCursor = tasks.data?.nextCursor;
            if (changingView || !nextCursor) return;
            setCursorHistory((current) => [...current, cursor]);
            setCursor(nextCursor);
          }}
          onSelect={setSelectedId}
        />
        <div className="min-w-0 min-h-[28rem]" aria-busy={changingView}>
          {tasks.isError ? (
            <WorkspaceError message={tasks.error.message} onRetry={() => void tasks.refetch()} />
          ) : selected ? (
            <div inert={changingView} className={changingView ? "opacity-60" : undefined}>
              <VerifierTaskDesk
                task={selected}
                departmentId={departmentId}
                onUpdated={async () => {
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["tasks", "mine"] }),
                    queryClient.invalidateQueries({ queryKey: ["verifier", "insights"] }),
                    queryClient.invalidateQueries({ queryKey: ["tasks", selected.id, "context"] }),
                    queryClient.invalidateQueries({
                      queryKey: ["workflow"],
                      predicate: (query) => query.queryKey[1] !== "initiation-forms",
                    }),
                  ]);
                }}
              />
            </div>
          ) : changingView ? (
            <WorkspaceLoading label="Loading assigned checks" />
          ) : (
            <WorkspaceEmpty
              title="Queue is clear"
              detail="No tasks match the selected delivery view."
            />
          )}
        </div>
      </div>
    </div>
  );
}
