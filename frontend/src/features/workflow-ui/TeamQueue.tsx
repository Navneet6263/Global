import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  CircleCheck,
  Hand,
  ListChecks,
  SearchX,
  TriangleAlert,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import {
  Avatar,
  EmptyState,
  PagerFooter,
  Panel,
  Pill,
  SearchField,
  SegmentTabs,
  StatCard,
  StatGrid,
  Tag,
} from "@/components/workspace/kit";
import { ExportSheetButton, type SheetColumn } from "@/components/workspace/export-sheet";
import { collectNumberedPages, humanizeCode, istText } from "@/components/workspace/format";
import { cachedIdentity } from "@/lib/auth/platform-session";
import { cn } from "@/lib/utils";
import { forwardTask, sendBackTask } from "@/lib/api/tasks";
import {
  assignTeamTask,
  getTeamQueue,
  type TeamQueue as TeamQueueData,
  type TeamTask,
} from "@/lib/backend-api/workflow";
import { dueLabel, readableCheck, sinceLabel } from "./flow-model";

export type TeamView = "unassigned" | "review" | "mine" | "team" | "all";

export interface TeamSearch {
  view?: Exclude<TeamView, "unassigned">;
  q?: string;
  page?: number;
}

const PAGE_SIZE = 12;
const REASSIGNABLE = ["UNASSIGNED", "OPEN", "BLOCKED"];

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
    queryKey: ["workflow", "team-queue", view, search.q ?? "", page],
    queryFn: ({ signal }) =>
      getTeamQueue({ view, search: search.q, page, pageSize: PAGE_SIZE }, signal),
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
                  getTeamQueue({ view, search: search.q, page: n, pageSize: 50 }),
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
                  <TaskRow
                    key={task.id}
                    task={task}
                    me={me}
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
        <aside className="grid gap-4">
          <Panel title="Team load" label="Team members" count={members.length}>
            {members.length ? (
              <ul className="grid gap-3 px-5 pb-5">
                {members.map((member) => (
                  <li
                    key={`${member.department.id}:${member.id}`}
                    className="flex items-center gap-3"
                  >
                    <Avatar name={member.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="truncate font-semibold text-slate-800">
                          {member.name}
                          {member.id === me ? " (you)" : ""}
                        </span>
                        <span className="tabular-nums font-bold text-slate-900">
                          {member.openWork}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            member.openWork / maxLoad > 0.75 ? "bg-amber-500" : "bg-blue-500",
                          )}
                          style={{ width: `${(member.openWork / maxLoad) * 100}%` }}
                        />
                      </div>
                      <small className="text-[11px] text-slate-400">
                        {member.department.name}
                        {member.role === "LEAD" ? " · Team Leader" : ""} · open checks
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-5 text-[13px] text-slate-500">
                No members yet. Operations adds them in Departments &amp; teams.
              </p>
            )}
          </Panel>
          <Panel title="How it works" label="How the team queue works">
            <ol className="grid gap-2 px-5 pb-5 text-[12.5px] text-slate-600">
              {[
                ["Take it", "Verify a check yourself. It moves to your Active queue."],
                ["Assign", "Give it to a member. The least-loaded person is shown first."],
                ["Reassign", "Move work that is waiting or blocked to someone else."],
              ].map(([title, detail], index) => (
                <li key={title} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-blue-700 ring-1 ring-blue-100">
                    {index + 1}
                  </span>
                  <span>
                    <strong className="block text-slate-800">{title}</strong>
                    {detail}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
      {reviewing ? <ReviewDialog task={reviewing} onClose={() => setReviewing(undefined)} /> : null}
      {assigning && data ? (
        <AssignMemberDialog
          task={assigning}
          data={data}
          me={me}
          onClose={() => setAssigning(undefined)}
        />
      ) : null}
    </div>
  );
}

function TaskRow({
  task,
  me,
  canTake,
  onAssign,
  onReview,
}: {
  task: TeamTask;
  me?: string;
  canTake: boolean;
  onAssign: () => void;
  onReview: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const due = dueLabel(task.dueAt);
  const mine = Boolean(me && task.assignee?.id === me);
  const movable = REASSIGNABLE.includes(task.status);
  const take = useMutation({
    mutationFn: () => assignTeamTask(task.id, { assigneeId: me!, version: task.version }),
    onSuccess: async () => {
      toast.success(`${readableCheck(task.check.type)} check is yours`, {
        description: "It is now in your Active queue.",
        action: {
          label: "Open",
          onClick: () =>
            void navigate({
              to: "/verifier/queue",
              search: { taskId: task.id, status: undefined },
            }),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["workflow"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks", "mine"] });
    },
    onError: (error: Error) => toast.error("Not taken", { description: error.message }),
  });
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition hover:bg-slate-50 xl:grid-cols-[minmax(0,1fr)_170px_110px_200px]">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar name={task.case.candidateName} tone={task.status === "BLOCKED" ? "warn" : "info"} />
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-[13.5px] font-semibold text-slate-900">
            {task.case.candidateName}
          </strong>
          <small className="block truncate text-[11.5px] text-slate-500">
            {task.case.clientName} ·{" "}
            <span className="font-mono text-slate-600">{task.case.caseNumber}</span>
          </small>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
            <Pill tone="info">{readableCheck(task.check.type)}</Pill>
            {task.check.department ? (
              <Tag icon={ListChecks}>{task.check.department.name}</Tag>
            ) : null}
            {task.status === "BLOCKED" ? <Pill tone="warn">Blocked</Pill> : null}
          </div>
          {task.blockerReason ? (
            <p className="mt-1 truncate text-[11.5px] text-amber-700">{task.blockerReason}</p>
          ) : null}
        </div>
      </div>
      <div className="hidden min-w-0 items-center gap-2 xl:flex">
        {task.assignee ? (
          <>
            <Avatar name={task.assignee.name} size="sm" tone="neutral" />
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-medium text-slate-700">
                {mine ? "You" : task.assignee.name}
              </span>
              <small className="block truncate text-[11px] text-slate-400">
                routed {sinceLabel(task.check.routedAt)} ago
              </small>
            </span>
          </>
        ) : (
          <span className="min-w-0">
            <span className="block text-[12.5px] font-medium text-slate-400">Unassigned</span>
            <small className="block truncate text-[11px] text-slate-400">
              routed {sinceLabel(task.check.routedAt)} ago
            </small>
          </span>
        )}
      </div>
      <Pill
        tone={due.tone}
        className="col-start-2 row-start-1 self-start justify-self-end xl:col-start-auto xl:row-start-auto xl:self-center xl:justify-self-start"
      >
        {due.text}
      </Pill>
      <div className="col-span-2 flex flex-wrap justify-end gap-2 xl:col-span-1">
        {task.review ? (
          <Button size="sm" onClick={onReview}>
            <ClipboardCheck aria-hidden /> Review
          </Button>
        ) : null}
        {task.review ? null : mine ? (
          <Button size="sm" asChild>
            <Link to="/verifier/queue" search={{ taskId: task.id, status: undefined }}>
              Open
            </Link>
          </Button>
        ) : null}
        {!task.review && movable && canTake && !mine ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => take.mutate()}
            loading={take.isPending}
            aria-label={`Take ${readableCheck(task.check.type)} check for ${task.case.candidateName}`}
          >
            <Hand aria-hidden /> Take it
          </Button>
        ) : null}
        {task.review ? null : movable ? (
          <Button size="sm" variant={task.assignee ? "outline" : "default"} onClick={onAssign}>
            {task.assignee ? "Reassign" : "Assign"}
          </Button>
        ) : !mine ? (
          <Pill tone="good">In progress</Pill>
        ) : null}
      </div>
    </li>
  );
}

function AssignMemberDialog({
  task,
  data,
  me,
  onClose,
}: {
  task: TeamTask;
  data: TeamQueueData;
  me?: string;
  onClose: () => void;
}) {
  const [assigneeId, setAssigneeId] = useState("");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const options = data.members
    .filter((member) => member.department.id === task.check.department?.id)
    .sort((a, b) => a.openWork - b.openWork);
  const lightest = options.find((member) => member.id !== task.assignee?.id)?.id;
  const mutation = useMutation({
    mutationFn: () =>
      assignTeamTask(task.id, {
        assigneeId,
        version: task.version,
        note: note.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success(`${readableCheck(task.check.type)} check assigned`);
      await queryClient.invalidateQueries({ queryKey: ["workflow"] });
      onClose();
    },
    onError: (error: Error) => toast.error("Not assigned", { description: error.message }),
  });
  const noteProblem = note.trim() && note.trim().length < 3;
  return (
    <Dialog open onOpenChange={(open) => (!open && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{task.assignee ? "Reassign check" : "Assign check"}</DialogTitle>
          <DialogDescription>
            {readableCheck(task.check.type)} · {task.case.candidateName} · {task.case.caseNumber}
          </DialogDescription>
        </DialogHeader>
        <div
          role="radiogroup"
          aria-label="Team members"
          className="grid max-h-80 gap-2 overflow-y-auto"
        >
          {options.map((member) => {
            const current = member.id === task.assignee?.id;
            const picked = assigneeId === member.id;
            return (
              <label
                key={member.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition",
                  picked
                    ? "border-blue-400 bg-blue-50 ring-2 ring-blue-500/20"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                  current && "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  type="radio"
                  name="member"
                  className="sr-only"
                  value={member.id}
                  checked={picked}
                  disabled={current || mutation.isPending}
                  onChange={() => setAssigneeId(member.id)}
                />
                <Avatar name={member.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[13.5px] text-slate-900">
                    {member.name}
                    {member.id === me ? " (you)" : ""}
                    {member.role === "LEAD" ? " · TL" : ""}
                  </strong>
                  <small className="text-[12px] text-slate-500">
                    {member.openWork} open check{member.openWork === 1 ? "" : "s"}
                  </small>
                </span>
                {current ? (
                  <Pill tone="neutral" dot={false}>
                    Current
                  </Pill>
                ) : member.id === lightest ? (
                  <Pill tone="good" dot={false}>
                    Least busy
                  </Pill>
                ) : null}
              </label>
            );
          })}
          {!options.length ? (
            <p className="text-[13px] text-slate-500">This department has no members yet.</p>
          ) : null}
        </div>
        <label className="grid gap-1 text-[13px]">
          <span className="font-medium text-slate-700">Instructions (optional)</span>
          <textarea
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={Boolean(noteProblem)}
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
          {noteProblem ? (
            <small className="text-red-600">Write at least 3 characters.</small>
          ) : null}
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!assigneeId || Boolean(noteProblem)}
            loading={mutation.isPending}
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const RESULT_TONE: Record<string, "good" | "warn" | "bad"> = {
  CLEAR: "good",
  DISCREPANCY: "warn",
  UNABLE_TO_VERIFY: "bad",
};

/** Team Leader reviews a member's finished check: forward to QA or send back. */
function ReviewDialog({ task, onClose }: { task: TeamTask; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const review = task.review!;
  const done = async (message: string) => {
    toast.success(message);
    await queryClient.invalidateQueries({ queryKey: ["workflow"] });
    onClose();
  };
  const forward = useMutation({
    mutationFn: () => forwardTask(task.id, note.trim() || undefined),
    onSuccess: (result) =>
      done(
        result.caseToQa
          ? "Forwarded — the case is now with QA"
          : "Forwarded — the case goes to QA when its other checks are forwarded",
      ),
    onError: (error: Error) => toast.error("Not forwarded", { description: error.message }),
  });
  const sendBack = useMutation({
    mutationFn: () => sendBackTask(task.id, note.trim()),
    onSuccess: () => done(`Sent back to ${task.assignee?.name ?? "the verifier"}`),
    onError: (error: Error) => toast.error("Not sent back", { description: error.message }),
  });
  const busy = forward.isPending || sendBack.isPending;
  return (
    <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Review {readableCheck(task.check.type)} check</DialogTitle>
          <DialogDescription>
            {task.case.candidateName} · {task.case.caseNumber} · done by{" "}
            {task.assignee?.name ?? "—"}
            {review.completedAt ? ` · ${istText(review.completedAt)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={RESULT_TONE[review.result ?? ""] ?? "neutral"}>
              {humanizeCode(review.result) || "No result"}
            </Pill>
            {review.disposition ? <Tag>{humanizeCode(review.disposition)}</Tag> : null}
            {review.riskLevel ? (
              <Tag>Risk {humanizeCode(review.riskLevel).toLowerCase()}</Tag>
            ) : null}
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
              Source summary
            </p>
            <p className="mt-1 whitespace-pre-wrap text-slate-800">{review.sourceSummary || "—"}</p>
          </div>
          {review.findings.length ? (
            <ul className="grid gap-1.5">
              {review.findings.map((finding, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <Pill
                    tone={
                      finding.severity === "HIGH" || finding.severity === "CRITICAL"
                        ? "bad"
                        : "warn"
                    }
                    dot={false}
                  >
                    {humanizeCode(finding.severity)}
                  </Pill>
                  <span className="text-slate-800">{finding.title}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <label className="grid gap-1">
            <span className="font-medium text-slate-700">Note (required to send back)</span>
            <textarea
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-label="Review note"
              placeholder="e.g. Add the HR email as the source before forwarding"
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </label>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            disabled={busy || note.trim().length < 10}
            loading={sendBack.isPending}
            onClick={() => sendBack.mutate()}
          >
            Send back
          </Button>
          <Button disabled={busy} loading={forward.isPending} onClick={() => forward.mutate()}>
            Forward to QA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
