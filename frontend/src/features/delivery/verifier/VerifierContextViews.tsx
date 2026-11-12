import { formatDateTime, humanize } from "@/features/cases/case-detail-formatting";
import type { VerifierTaskContext } from "@/lib/api/tasks";
import { VerifierL2Clarifications } from "./VerifierL2Clarifications";

type Context = VerifierTaskContext;

export function CaseContextView({ context }: { context: Context }) {
  const item = context.check.case;
  const consent = item.consents[0];
  const rows = [
    ["Candidate", item.subject.fullName],
    ["Email", item.subject.email ?? "Not provided"],
    ["Mobile", item.subject.phone ?? "Not provided"],
    ["Employee reference", item.subject.employeeCode ?? "Not provided"],
    ["Requesting client", item.client.displayName],
    ["Service package", item.servicePackage?.name ?? "Custom checks"],
    [
      "Branch",
      item.branch
        ? `${item.branch.name}${item.branch.city ? ` · ${item.branch.city}` : ""}`
        : "Tenant-wide",
    ],
    ["Consent", consent ? humanize(consent.status) : "Not recorded"],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 break-words text-[11.5px] font-medium">{value}</p>
        </div>
      ))}
    </div>
  );
}

export function ClarificationsView({ context }: { context: Context }) {
  return <VerifierL2Clarifications context={context} />;
}

export function ActivityView({ context }: { context: Context }) {
  const taskEvents = [
    { label: "Assignment created", at: context.createdAt },
    ...(context.startedAt ? [{ label: "Verification started", at: context.startedAt }] : []),
    ...(context.blockedAt ? [{ label: "Blocker recorded", at: context.blockedAt }] : []),
    ...(context.completedAt ? [{ label: "Check completed", at: context.completedAt }] : []),
  ];
  return (
    <div className="space-y-2">
      {[...taskEvents].reverse().map((event) => (
        <TimelineRow
          key={`${event.label}-${event.at}`}
          label={event.label}
          detail="Verifier task event"
          at={event.at}
        />
      ))}
      {context.check.case.statusHistory.map((event) => (
        <TimelineRow
          key={`${event.toStatus}-${event.createdAt}`}
          label={`Case moved to ${humanize(event.toStatus)}`}
          detail={event.reason ?? "Controlled workflow transition"}
          at={event.createdAt}
        />
      ))}
    </div>
  );
}

function TimelineRow({ label, detail, at }: { label: string; detail: string; at: string }) {
  return (
    <div className="relative ml-2 border-l border-blue-200 py-2 pl-5 before:absolute before:-left-1 before:top-4 before:size-2 before:rounded-full before:bg-blue-600">
      <p className="text-[12.5px] font-semibold">{label}</p>
      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
        {detail} · {formatDateTime(at)}
      </p>
    </div>
  );
}
