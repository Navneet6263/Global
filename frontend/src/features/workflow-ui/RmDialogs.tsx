import { useState } from "react";
import { ReportHeaderDetails, ReportPreviewButton } from "./ReportPreview";
import { CaseReportView } from "./ReportView";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck } from "lucide-react";
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
import { ListSkeleton } from "@/components/feedback/skeletons";
import { getCase } from "@/lib/api/cases";
import {
  assignDataEntry,
  decideFinalReview,
  getFinalReview,
  getRoutingPlan,
  listDepartments,
  routeChecks,
  sendBackToDataEntry,
  type QueueCase,
} from "@/lib/backend-api/workflow";
import { defaultRoutes, readableCheck } from "./flow-model";
import { cachedIdentity } from "@/lib/auth/platform-session";
import { istDateTime } from "@/features/operations/workspace/ops-queue-model";

function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["workflow"] }),
      queryClient.invalidateQueries({ queryKey: ["case"] }),
      queryClient.invalidateQueries({ queryKey: ["navigation-counts"] }),
    ]);
}

const noteProblem = (note: string, min = 3) =>
  note.trim() && note.trim().length < min ? `Write at least ${min} characters.` : "";

function Frame({
  title,
  item,
  busy,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  item: QueueCase;
  busy: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent className={`ops-dialog ${wide ? "sm:max-w-[640px]" : "sm:max-w-[500px]"}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {item.candidateName} · {item.caseNumber} · {item.client.name}
          </DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssignDataEntryDialog({ item, onClose }: { item: QueueCase; onClose: () => void }) {
  const departments = useQuery({ queryKey: ["workflow", "departments"], queryFn: listDepartments });
  const [assigneeId, setAssigneeId] = useState("");
  const [note, setNote] = useState("");
  const refresh = useRefresh();
  const people = (departments.data?.items ?? [])
    .filter((department) => department.kind === "DATA_ENTRY" && department.status === "ACTIVE")
    .flatMap((department) => department.members.filter((member) => member.status === "ACTIVE"))
    .sort((a, b) => a.openWork - b.openWork);
  // An RM who also holds Data Entry can do the data entry itself (no team needed).
  const me = cachedIdentity();
  const canDoMyself = Boolean(me?.roles.includes("DATA_ENTRY") && me.roles.includes("SPOC_RM"));
  const others = people.filter((person) => person.id !== me?.userId);
  const mutation = useMutation({
    mutationFn: () =>
      assignDataEntry(item.id, {
        assigneeId,
        version: item.version,
        note: note.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success(
        assigneeId === me?.userId
          ? `${item.caseNumber} is in your Data Entry queue`
          : `${item.caseNumber} sent to Data Entry`,
        assigneeId === me?.userId
          ? { description: "Switch to “Working as: Data Entry” at the top to do it." }
          : undefined,
      );
      await refresh();
      onClose();
    },
    onError: (error: Error) =>
      toast.error("Data Entry not assigned", { description: error.message }),
  });
  const problem = noteProblem(note);
  return (
    <Frame
      title={item.dataEntry ? "Change Data Entry" : "Assign Data Entry"}
      item={item}
      busy={mutation.isPending}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!assigneeId || Boolean(problem)}
            loading={mutation.isPending}
          >
            Assign
          </Button>
        </>
      }
    >
      <div className="ops-rm-list" role="radiogroup" aria-label="Data Entry team">
        {departments.isPending ? <p className="ops-dialog-note">Loading Data Entry team…</p> : null}
        {departments.isError ? (
          <p className="ops-dialog-note is-error">{departments.error.message}</p>
        ) : null}
        {canDoMyself && me ? (
          <label className={assigneeId === me.userId ? "is-selected" : undefined}>
            <input
              type="radio"
              name="data-entry"
              value={me.userId}
              checked={assigneeId === me.userId}
              disabled={me.userId === item.dataEntry?.id || mutation.isPending}
              onChange={() => setAssigneeId(me.userId)}
            />
            <span className="min-w-0 flex-1">
              <strong>Me ({me.fullName}) · I’ll do the data entry</strong>
              <small>Then switch to “Working as: Data Entry” at the top.</small>
            </span>
            {me.userId === item.dataEntry?.id ? <em>Current</em> : null}
          </label>
        ) : null}
        {departments.data && !others.length && !canDoMyself ? (
          <p className="ops-dialog-note">
            The Data Entry team has no members yet. Ask Operations to add them in Departments &
            teams.
          </p>
        ) : null}
        {others.map((person) => (
          <label key={person.id} className={assigneeId === person.id ? "is-selected" : undefined}>
            <input
              type="radio"
              name="data-entry"
              value={person.id}
              checked={assigneeId === person.id}
              disabled={person.id === item.dataEntry?.id || mutation.isPending}
              onChange={() => setAssigneeId(person.id)}
            />
            <span className="min-w-0 flex-1">
              <strong>
                {person.displayName}
                {person.role === "LEAD" ? " · TL" : ""}
              </strong>
              <small>
                {person.openWork} open intake · {person.email}
              </small>
            </span>
            {person.id === item.dataEntry?.id ? <em>Current</em> : null}
          </label>
        ))}
      </div>
      <label className="ops-field">
        <span>Note for Data Entry (optional)</span>
        <textarea
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={Boolean(problem)}
        />
        {problem ? <small className="is-error">{problem}</small> : null}
      </label>
    </Frame>
  );
}

export function SendBackDialog({ item, onClose }: { item: QueueCase; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const refresh = useRefresh();
  const mutation = useMutation({
    mutationFn: () =>
      sendBackToDataEntry(item.id, { version: item.version, reason: reason.trim() }),
    onSuccess: async () => {
      toast.success(`${item.caseNumber} returned to Data Entry`);
      await refresh();
      onClose();
    },
    onError: (error: Error) => toast.error("Not returned", { description: error.message }),
  });
  return (
    <Frame
      title="Return to Data Entry"
      item={item}
      busy={mutation.isPending}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={reason.trim().length < 3}
            loading={mutation.isPending}
          >
            Return
          </Button>
        </>
      }
    >
      <label className="ops-field">
        <span>What needs to be checked again?</span>
        <textarea
          rows={3}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
    </Frame>
  );
}

export function RouteChecksDialog({ item, onClose }: { item: QueueCase; onClose: () => void }) {
  const plan = useQuery({
    queryKey: ["workflow", "routing", item.id],
    queryFn: () => getRoutingPlan(item.id),
  });
  const [routes, setRoutes] = useState<Record<string, string>>();
  const [note, setNote] = useState("");
  const refresh = useRefresh();
  const current = routes ?? (plan.data ? defaultRoutes(plan.data.checks) : {});
  const open = plan.data?.checks.filter((check) => check.status !== "COMPLETED") ?? [];
  const missing = open.filter((check) => !current[check.id]);
  const noLead = new Set(
    (plan.data?.departments ?? [])
      .filter((department) => !department.leads.length)
      .map((d) => d.id),
  );
  const blocked = open.some((check) => noLead.has(current[check.id] ?? ""));
  const mutation = useMutation({
    mutationFn: () =>
      routeChecks(item.id, {
        version: plan.data!.version,
        routes: open.map((check) => ({ checkId: check.id, departmentId: current[check.id]! })),
        note: note.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success(`${item.caseNumber} routed — verification started`);
      await refresh();
      onClose();
    },
    onError: (error: Error) => toast.error("Checks not routed", { description: error.message }),
  });
  const problem = noteProblem(note);
  return (
    <Frame
      title="Route checks to departments"
      item={item}
      busy={mutation.isPending}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={
              !plan.data?.canRoute ||
              !open.length ||
              missing.length > 0 ||
              blocked ||
              Boolean(problem)
            }
            loading={mutation.isPending}
          >
            Route & start verification
          </Button>
        </>
      }
    >
      {plan.isPending ? <ListSkeleton rows={3} /> : null}
      {plan.isError ? <p className="ops-dialog-note is-error">{plan.error.message}</p> : null}
      {plan.data ? (
        <>
          <div className="flow-callout is-info">
            <CircleCheck aria-hidden />
            <span>
              Data Entry marked this case Ready. Each check goes to its department&apos;s Team
              Leader, who assigns a team member.
            </span>
          </div>
          <div aria-label="Check routing">
            {open.map((check) => {
              const selected = current[check.id] ?? "";
              return (
                <div key={check.id} className="flow-route-row">
                  <span>
                    <strong>{readableCheck(check.type)}</strong>
                    {check.suggestedDepartmentId && selected === check.suggestedDepartmentId ? (
                      <small className="ops-subtle"> · suggested</small>
                    ) : null}
                  </span>
                  <select
                    aria-label={`Department for ${readableCheck(check.type)}`}
                    value={selected}
                    onChange={(event) => setRoutes({ ...current, [check.id]: event.target.value })}
                  >
                    <option value="">Choose department</option>
                    {plan.data.departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                        {department.leads.length
                          ? ` — TL ${department.leads[0]}`
                          : " — no Team Leader"}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          {blocked ? (
            <div className="flow-callout is-bad">
              <CircleAlert aria-hidden />
              <span>
                A chosen department has no Team Leader. Choose another or ask Operations to set one.
              </span>
            </div>
          ) : null}
          {!plan.data.canRoute ? (
            <div className="flow-callout is-warn">
              <CircleAlert aria-hidden />
              <span>
                Only this case&apos;s RM can route it once Data Entry has marked it Ready.
              </span>
            </div>
          ) : null}
          <label className="ops-field">
            <span>Note for the teams (optional)</span>
            <textarea
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={Boolean(problem)}
            />
            {problem ? <small className="is-error">{problem}</small> : null}
          </label>
        </>
      ) : null}
    </Frame>
  );
}

export function FinalReviewDialog({ item, onClose }: { item: QueueCase; onClose: () => void }) {
  const overview = useQuery({
    queryKey: ["workflow", "final-review", item.id],
    queryFn: () => getFinalReview(item.id),
  });
  const detail = useQuery({ queryKey: ["case", item.id], queryFn: () => getCase(item.id) });
  const [reviewed, setReviewed] = useState(false);
  const [decision, setDecision] = useState<"APPROVED" | "REWORK">("APPROVED");
  const [notes, setNotes] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const refresh = useRefresh();
  const results = detail.data?.checks ?? [];
  const highRisk = results.some((check) => ["HIGH", "CRITICAL"].includes(check.riskLevel ?? ""));
  const mutation = useMutation({
    mutationFn: () =>
      decideFinalReview(item.id, {
        caseVersion: overview.data!.caseVersion,
        decision,
        notes: notes.trim(),
        ...(decision === "APPROVED"
          ? {
              recommendation: recommendation.trim(),
              highRiskAcknowledged: highRisk ? acknowledged : undefined,
            }
          : {}),
      }),
    onSuccess: async () => {
      if (decision === "APPROVED")
        toast.success(`${item.caseNumber} approved — report on its way to the client`, {
          description: `The final report is prepared and released to ${item.client.name} automatically, usually within a minute.`,
        });
      else toast.success(`${item.caseNumber} returned to QC`);
      await refresh();
      onClose();
    },
    onError: (error: Error) => toast.error("Decision not saved", { description: error.message }),
  });
  const ready =
    reviewed &&
    notes.trim().length >= 10 &&
    (decision === "REWORK" || (recommendation.trim().length >= 10 && (!highRisk || acknowledged)));
  const box =
    "rounded-xl border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100";
  return (
    <Dialog open onOpenChange={(open) => (!open && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent
        className="flex h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[88rem] flex-col gap-0 overflow-hidden rounded-2xl p-0"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-slate-100 px-6 py-4 pr-12">
          <div className="min-w-0">
            <DialogTitle>Final review</DialogTitle>
            <DialogDescription className="truncate">
              {item.candidateName} · {item.caseNumber} · {item.client.name}
            </DialogDescription>
          </div>
          <ol className="flex items-center gap-2 text-[12px] font-medium" aria-label="Steps">
            <li
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${reviewed ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}
            >
              {reviewed ? <CircleCheck className="size-3.5" aria-hidden /> : <span>1</span>}
              Read the client report
            </li>
            <li
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${reviewed ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}
            >
              <span>2</span> Decide &amp; send
            </li>
          </ol>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_23rem] lg:overflow-hidden">
          <section
            aria-label="Client report"
            className="min-w-0 bg-slate-50 p-4 sm:p-5 lg:min-h-0 lg:overflow-y-auto"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="min-w-0 text-[12.5px] text-slate-700">
                <strong className="block text-[13px] text-slate-900">
                  The report the client will receive
                </strong>
                Read every check. On approval this report is released to {item.client.name}.
              </p>
              <ReportPreviewButton
                caseId={item.id}
                caseNumber={item.caseNumber}
                candidateName={item.candidateName}
                audiences={["client"]}
                label="Open client report"
              />
            </div>
            <CaseReportView caseId={item.id} audience="client" />
          </section>
          <aside
            aria-label="Decision"
            className="grid content-start gap-4 border-t border-slate-100 bg-white p-5 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0"
          >
            {overview.isPending || detail.isPending ? <ListSkeleton rows={2} /> : null}
            {overview.isError ? (
              <p role="alert" className="text-[13px] text-red-600">
                {overview.error.message}
              </p>
            ) : null}
            {overview.data?.latestQa ? (
              <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-[13px] text-emerald-900">
                <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  QC {overview.data.latestQa.decision.toLowerCase()} by{" "}
                  {overview.data.latestQa.reviewerName}
                  {overview.data.latestQa.notes ? ` — ${overview.data.latestQa.notes}` : ""}
                </span>
              </div>
            ) : null}
            <ReportHeaderDetails caseId={item.id} />
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-[13px] ${reviewed ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50"}`}
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-blue-600"
                checked={reviewed}
                disabled={!results.length}
                onChange={(event) => setReviewed(event.target.checked)}
              />
              <span>
                <strong className="block text-slate-900">
                  I have read the client report and checked every check
                </strong>
                <span className="text-slate-500">The decision opens after you tick this.</span>
              </span>
            </label>
            {reviewed ? (
              <section aria-label="Your decision" className="grid gap-3">
                <div
                  role="radiogroup"
                  aria-label="Decision"
                  className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
                >
                  {(
                    [
                      ["APPROVED", "Approve"],
                      ["REWORK", "Return to QC"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={decision === value}
                      aria-pressed={decision === value}
                      onClick={() => setDecision(value)}
                      className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${decision === value ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="grid gap-1 text-[13px]">
                  <span className="font-medium text-slate-700">
                    Review notes (at least 10 characters)
                  </span>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={box}
                  />
                </label>
                {decision === "APPROVED" ? (
                  <>
                    <label className="grid gap-1 text-[13px]">
                      <span className="font-medium text-slate-700">
                        Final recommendation for the report (at least 10 characters)
                      </span>
                      <textarea
                        rows={3}
                        maxLength={2000}
                        value={recommendation}
                        onChange={(e) => setRecommendation(e.target.value)}
                        className={box}
                      />
                    </label>
                    {highRisk ? (
                      <label className="flex items-center gap-2 text-[13px] text-slate-700">
                        <input
                          type="checkbox"
                          className="size-4 accent-blue-600"
                          checked={acknowledged}
                          onChange={(e) => setAcknowledged(e.target.checked)}
                        />
                        I have reviewed the high-risk findings
                      </label>
                    ) : null}
                    <p className="flex items-start gap-2 rounded-xl bg-slate-100/70 p-3 text-[12px] leading-relaxed text-slate-600">
                      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      Approving releases this report to the client admin of {item.client.name}. It
                      can only be changed afterwards by reopening the case.
                    </p>
                  </>
                ) : null}
              </section>
            ) : null}
          </aside>
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!overview.data || !ready}
            loading={mutation.isPending}
          >
            {decision === "APPROVED" ? "Approve & send to client" : "Return to QC"}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
