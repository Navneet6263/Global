import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ClipboardCheck,
  CircleCheck,
  SearchX,
  TriangleAlert,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import {
  EmptyState,
  PagerFooter,
  Panel,
  SearchField,
  SegmentTabs,
  StatCard,
  StatGrid,
} from "@/components/workspace/kit";
import { ExportSheetButton, type SheetColumn } from "@/components/workspace/export-sheet";
import { collectNumberedPages, humanizeCode, istText } from "@/components/workspace/format";
import { cachedIdentity } from "@/lib/auth/platform-session";
import { getTeamQueue, type TeamTask } from "@/lib/backend-api/workflow";
import { AssignMemberDialog, ReviewDialog } from "./TeamQueueDialogs";
import { TeamQueueRow } from "./TeamQueueRow";
import { TeamQueueSidebar } from "./TeamQueueSidebar";
import { readableCheck } from "./flow-model";

export type TeamView = "unassigned" | "review" | "mine" | "team" | "all";

export interface TeamSearch {
  /** Show one team only, chosen from the role dropdown. */
  department?: string;
  view?: Exclude<TeamView, "unassigned">;
  q?: string;
  page?: number;
}

const PAGE_SIZE = 12;

const VIEW_TITLE: Record<TeamView, string> = {
  unassigned: "Waiting for a member",
  review: "To review",
  mine: "My picks",
  team: "With the team",
  all: "All team checks",
};

const EXPORT_COLUMNS: readonly SheetColumn<TeamTask>[] = [
  { key: "caseNumber", label: "Sapling ID", value: (t) => t.case.caseNumber },
  { key: "candidate", label: "Candidate", value: (t) => t.case.candidateName },
  { key: "company", label: "Company", value: (t) => t.case.clientName },
  { key: "check", label: "Check", value: (t) => readableCheck(t.check.type) },
  { key: "department", label: "Department", value: (t) => t.check.department?.name },
  { key: "assignee", label: "Assigned to", value: (t) => t.assignee?.name ?? "Unassigned" },
  { key: "status", label: "Status", value: (t) => humanizeCode(t.status) },
  { key: "routedAt", label: "Routed", value: (t) => istText(t.check.routedAt) },
  { key: "dueAt", label: "Due", value: (t) => istText(t.dueAt) },
  { key: "priority", label: "Priority", value: (t) => humanizeCode(t.case.priority) },
  { key: "rm", label: "RM", value: (t) => t.case.rmName },
  { key: "blocker", label: "Blocker", value: (t) => t.blockerReason },
];
const EXPORT_DEFAULTS = [
  "caseNumber",
  "candidate",
  "company",
  "check",
  "assignee",
  "status",
  "dueAt",
];

/**
 * Team Leader board: routed checks of the departments the user leads. The TL can take a
 * check to verify personally (it lands in their Active queue) or assign it to a member.
 */
export function TeamQueue({
  search,
  onChange,
}: {
  search: TeamSearch;
  onChange: (patch: Partial<TeamSearch>) => void;
}) {
  const view: TeamView = search.view ?? "unassigned";
  const page = search.page ?? 1;
  const me = cachedIdentity()?.userId;
  const [input, setInput] = useState(search.q ?? "");
  const [assigning, setAssigning] = useState<TeamTask>();
  const [reviewing, setReviewing] = useState<TeamTask>();
  useEffect(() => setInput(search.q ?? ""), [search.q]);
  const queue = useQuery({
    queryKey: ["workflow", "team-queue", view, search.q ?? "", page, search.department ?? ""],
    queryFn: ({ signal }) =>
      getTeamQueue(
        { view, search: search.q, page, pageSize: PAGE_SIZE, departmentId: search.department },
        signal,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const data = queue.data;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const members = data?.members ?? [];
  const maxLoad = Math.max(1, ...members.map((member) => member.openWork));
  const setView = (next: TeamView) =>
    onChange({ view: next === "unassigned" ? undefined : next, page: undefined });

  return (
    <div className="grid gap-4">
      <StatGrid label="Team summary">
        <StatCard
          icon={UserPlus}
          tone={data?.counts.unassigned ? "action" : "good"}
          label="Waiting for a member"
          value={data?.counts.unassigned ?? "—"}
          hint="Assign these first"
          onClick={() => setView("unassigned")}
          active={view === "unassigned"}
        />
        <StatCard
          icon={UsersRound}
          tone="info"
          label="With the team"
          value={data ? data.counts.total - data.counts.unassigned : "—"}
          hint="Assigned and in progress"
          onClick={() => setView("team")}
          active={view === "team"}
        />
        <StatCard
          icon={ClipboardCheck}
          tone={data?.counts.review ? "violet" : "neutral"}
          label="To review"
          value={data?.counts.review ?? "—"}
          hint={data?.counts.blocked ? `${data.counts.blocked} blocked` : "Forward to QA"}
          onClick={() => setView("review")}
          active={view === "review"}
        />
        <StatCard
          icon={TriangleAlert}
          tone={data?.counts.overdue ? "bad" : "neutral"}
          label="Overdue cases"
          value={data?.counts.overdue ?? "—"}
          hint="Past the case due time"
        />
      </StatGrid>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          label="Team checks"
          title={VIEW_TITLE[view]}
          count={data?.total}
          description="Take a check to verify it yourself, or assign it to someone in your team."
          actions={
            <ExportSheetButton
              source="team-queue"
              title="Export team checks"
              filename="Sapling-Global-team-checks"
              columns={EXPORT_COLUMNS}
              defaults={EXPORT_DEFAULTS}
              scopeNote={`${VIEW_TITLE[view]}${search.q ? ` · search “${search.q}”` : ""}`}
              loadRows={() =>
                collectNumberedPages((n) =>
                  getTeamQueue({
                    view,
                    search: search.q,
                    page: n,
                    pageSize: 50,
                    departmentId: search.department,
                  }),
                )
              }
            />
          }
        >
          <div className="flex flex-wrap items-center gap-3 px-5 pb-3">
            <SegmentTabs
              label="Which checks"
              value={view}
              onChange={setView}
              options={[
                { id: "unassigned", label: "Waiting", count: data?.counts.unassigned },
                { id: "review", label: "To review", count: data?.counts.review },
                { id: "mine", label: "My picks" },
                { id: "team", label: "With the team" },
                { id: "all", label: "All" },
              ]}
            />
            <SearchField
              className="min-w-56 flex-1"
              value={input}
              onChange={setInput}
              onSubmit={() => onChange({ q: input.trim() || undefined, page: undefined })}
              placeholder="Search candidate, Sapling ID or company"
              label="Search team checks"
            />
          </div>
          <div
            className="min-h-5 px-5 text-[11.5px] text-slate-400"
            role="status"
            aria-live="polite"
          >
            {queue.isFetching ? "Updating…" : ""}
          </div>
          {queue.isError ? (
            <ErrorState
              description={queue.error.message}
              onRetry={() => void queue.refetch()}
              retrying={queue.isFetching}
            />
          ) : null}
          {queue.isPending ? <ListSkeleton rows={5} /> : null}
          {data ? (
            data.items.length ? (
              <ul
                aria-label="Checks"
                className="divide-y divide-slate-100 border-t border-slate-100"
              >
                {data.items.map((task) => (
                  <TeamQueueRow
                    key={task.id}
                    task={task}
                    me={me}
                    departmentId={search.department}
                    canTake={members.some(
                      (m) => m.id === me && m.department.id === task.check.department?.id,
                    )}
                    onAssign={() => setAssigning(task)}
                    onReview={() => setReviewing(task)}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={search.q ? SearchX : CircleCheck}
                tone={search.q ? "neutral" : "good"}
                title={
                  search.q
                    ? "No checks match your search"
                    : view === "unassigned"
                      ? "Every check has a member"
                      : view === "review"
                        ? "Nothing to review"
                        : view === "mine"
                          ? "You haven't taken any checks"
                          : "No checks with the team"
                }
                detail="New checks arrive when an RM routes a Ready case to your department."
              />
            )
          ) : null}
          <PagerFooter
            summary={data ? `${data.total} check${data.total === 1 ? "" : "s"}` : ""}
            page={page}
            pages={pages}
            hasPrevious={page > 1}
            hasNext={page < pages}
            onPrevious={() => onChange({ page: page - 1 })}
            onNext={() => onChange({ page: page + 1 })}
          />
        </Panel>
        <TeamQueueSidebar members={members} me={me} maxLoad={maxLoad} />
      </div>
      {reviewing ? <ReviewDialog task={reviewing} onClose={() => setReviewing(undefined)} /> : null}
      {assigning && data ? (
        <AssignMemberDialog
          task={assigning}
          members={data.members}
          me={me}
          onClose={() => setAssigning(undefined)}
        />
      ) : null}
    </div>
  );
}
