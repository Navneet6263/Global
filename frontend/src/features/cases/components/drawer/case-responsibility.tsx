import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ClipboardCheck,
  FileInput,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { getCase, type CaseDetail } from "@/lib/backend-api/cases";
import { readableCheck } from "@/features/workflow-ui/flow-model";
import { workingWith } from "@/features/operations/workspace/ops-queue-model";

const INTAKE: Record<string, string> = {
  INTAKE: "Waiting for the RM to assign Data Entry",
  DATA_ENTRY: "Reviewing candidate details and documents",
  CORRECTION: "Correction requested from the candidate / client",
  READY: "Done — ready for the RM to route",
  ROUTED: "Done — checks routed to teams",
};

/**
 * Case 360 for internal users: who owns the case at every step. The company RM is set once
 * per company; new cases are assigned to that RM automatically unless Operations changes it.
 */
export function CaseResponsibility({ caseId }: { caseId: string }) {
  const item = useQuery({ queryKey: ["case", caseId], queryFn: () => getCase(caseId) });
  const data = item.data;
  if (!data?.workflow) return null;
  return <ResponsibilityChain data={data} />;
}

function ResponsibilityChain({ data }: { data: CaseDetail }) {
  const workflow = data.workflow!;
  const companyRm = workflow.companyRm ?? null;
  const caseRm = data.assignedOpsUser ?? null;
  const fromCompany = Boolean(companyRm && caseRm && companyRm.publicId === caseRm.publicId);
  const now = workingWith(data);
  const v2 = workflow.version === 2;
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white"
      aria-label="Who is handling this case"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-[13px] font-semibold text-slate-900">Who is handling this case</h3>
          <p className="text-[12px] text-slate-500">Owner at every step, from company RM to QC.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[12px] text-blue-900">
          <span className="size-1.5 rounded-full bg-blue-600" aria-hidden />
          Now with <strong className="font-semibold">{now.name}</strong>
          <span className="text-blue-700/70">· {now.role}</span>
        </span>
      </header>
      <ol className="grid gap-0 px-4 py-2">
        <Step
          icon={<Building2 />}
          title="Company"
          who={data.client.displayName}
          note={
            companyRm
              ? `Company RM: ${companyRm.displayName} — new cases go to this RM automatically`
              : "No company RM yet — set one in Companies & RMs so cases are assigned automatically"
          }
          tone={companyRm ? "done" : "warn"}
        />
        <Step
          icon={<UserRound />}
          title="Case RM"
          who={caseRm?.displayName ?? "Not assigned"}
          note={
            !caseRm
              ? "Operations must assign an RM"
              : fromCompany
                ? "Assigned automatically from the company RM"
                : companyRm
                  ? `Changed by Operations (company RM is ${companyRm.displayName})`
                  : "Assigned by Operations"
          }
          tone={caseRm ? "done" : "warn"}
          badge={caseRm ? (fromCompany ? "From company" : "Manual") : undefined}
        />
        {v2 ? (
          <Step
            icon={<FileInput />}
            title="Data Entry"
            who={workflow.dataEntryUser?.displayName ?? "Not assigned"}
            note={workflow.intakeStage ? INTAKE[workflow.intakeStage] : "Not started"}
            tone={
              workflow.intakeStage === "READY" || workflow.intakeStage === "ROUTED"
                ? "done"
                : workflow.dataEntryUser
                  ? "now"
                  : "wait"
            }
          />
        ) : null}
        <Step
          icon={<UsersRound />}
          title="Verification teams"
          who={
            data.checks.length
              ? `${data.checks.filter((check) => check.status === "COMPLETED").length}/${data.checks.length} checks done`
              : "No checks yet"
          }
          tone={
            data.checks.length && data.checks.every((check) => check.status === "COMPLETED")
              ? "done"
              : data.status === "IN_PROGRESS"
                ? "now"
                : "wait"
          }
        >
          {data.checks.length ? (
            <ul className="mt-1.5 grid gap-1">
              {data.checks.map((check) => {
                const task = (check.tasks ?? []).find((row) => !["CANCELLED"].includes(row.status));
                return (
                  <li
                    key={check.publicId}
                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-slate-600"
                  >
                    <span className="font-medium text-slate-800">{readableCheck(check.type)}</span>
                    <span className="text-slate-400">·</span>
                    <span>{check.department?.name ?? "Not routed"}</span>
                    <span className="text-slate-400">·</span>
                    <span>
                      {task?.assignee?.displayName ??
                        (check.department ? "Waiting for Team Leader" : "—")}
                    </span>
                    {check.status === "COMPLETED" ? (
                      <span className="rounded-full bg-emerald-50 px-1.5 text-[11px] text-emerald-700">
                        Done
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Step>
        <Step
          icon={<ShieldCheck />}
          title="QC"
          who={data.qaReviewer?.displayName ?? "Not claimed yet"}
          note="Independent review before the RM's final approval"
          tone={data.status === "QA_REVIEW" ? "now" : data.qaReviewer ? "done" : "wait"}
        />
        <Step
          icon={<ClipboardCheck />}
          title="Final approval"
          who={caseRm?.displayName ?? "Case RM"}
          note="RM approves before the report is released"
          tone={
            data.status === "MANAGER_REVIEW"
              ? "now"
              : ["REPORT_PENDING", "PAYMENT_PENDING", "COMPLETED", "CLOSED"].includes(data.status)
                ? "done"
                : "wait"
          }
          last
        />
      </ol>
    </section>
  );
}

const TONE = {
  done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  now: "bg-blue-600 text-white ring-blue-600",
  warn: "bg-amber-50 text-amber-700 ring-amber-200",
  wait: "bg-slate-50 text-slate-400 ring-slate-200",
} as const;

function Step({
  icon,
  title,
  who,
  note,
  tone,
  badge,
  last = false,
  children,
}: {
  icon: ReactNode;
  title: string;
  who: string;
  note?: string;
  tone: keyof typeof TONE;
  badge?: string;
  last?: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="relative grid grid-cols-[32px_1fr] gap-3 py-2.5">
      {last ? null : (
        <span className="absolute top-10 bottom-0 left-[15px] w-px bg-slate-200" aria-hidden />
      )}
      <span
        className={`relative grid size-8 place-items-center rounded-full ring-1 [&>svg]:size-4 ${TONE[tone]}`}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{title}</p>
        <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-slate-900">
          {who}
          {badge ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                badge === "From company"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {badge}
            </span>
          ) : null}
          {tone === "now" ? (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              Current step
            </span>
          ) : null}
        </p>
        {note ? <p className="mt-0.5 text-[12.5px] text-slate-500">{note}</p> : null}
        {children}
      </div>
    </li>
  );
}
