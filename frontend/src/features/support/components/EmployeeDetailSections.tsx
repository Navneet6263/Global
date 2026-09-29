import { StatusBadge } from "@/components/feedback/status-badge";
import { statusTone } from "@/features/spoc-rm/config/spoc-meta";
import { dateTime, label } from "@/features/spoc-rm/utils/spoc-format";
import { VENDOR_STATUS_META } from "@/features/spoc-rm/vendors/spoc-vendor-model";
import { Section } from "@/features/spoc-rm/vendors/VendorDrawerParts";
import type { SupportEmployeeDetail } from "../api/support-contracts";
import { REQUEST_STATUS_META } from "../support-model";

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

/** What is still open for this employee, in the existing readiness wording. */
export function PendingSection({ item }: { item: SupportEmployeeDetail }) {
  const items = [...item.exceptionReasons, ...item.pendingItems];
  return (
    <Section title="Pending items">
      {items.length ? (
        <ul className="list-disc space-y-1 pl-4 text-xs">
          {[...new Set(items)].map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      ) : (
        <Empty text="Nothing pending." />
      )}
    </Section>
  );
}

export function DocumentsSection({ item }: { item: SupportEmployeeDetail }) {
  return (
    <Section title="Uploaded documents">
      {item.documentList.length ? (
        <ul className="space-y-2">
          {item.documentList.map((document) => (
            <li key={document.id} className="rounded-2xl border border-border px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  {label(document.type)}
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    v{document.currentVersion} · {dateTime(document.uploadedAt)}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1">
                  <StatusBadge label={label(document.status)} tone={statusTone(document.status)} />
                  {document.vendorStatus !== "NOT_ASSIGNED" ? (
                    <StatusBadge
                      label={`Vendor: ${VENDOR_STATUS_META[document.vendorStatus].label}`}
                      tone={VENDOR_STATUS_META[document.vendorStatus].tone}
                    />
                  ) : null}
                </span>
              </div>
              {document.reviewNote ? (
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {document.reviewNote}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <Empty text="No documents uploaded yet." />
      )}
    </Section>
  );
}

export function ChecksSection({ item }: { item: SupportEmployeeDetail }) {
  return (
    <Section title="Checks and blockers">
      {item.checkList.length ? (
        <ul className="space-y-2 text-xs">
          {item.checkList.map((check, index) => {
            const blocked = check.tasks.filter((task) => task.status === "BLOCKED");
            return (
              <li
                key={`${check.type}-${index}`}
                className="rounded-2xl border border-border px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{label(check.type)}</span>
                  <StatusBadge label={label(check.status)} tone={statusTone(check.status)} />
                </div>
                {blocked.map((task, taskIndex) => (
                  <p key={taskIndex} className="mt-1 text-critical-foreground">
                    Blocked{task.assignee ? ` (${task.assignee})` : ""}: {task.blockerReason ?? "—"}
                  </p>
                ))}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty text="No checks set up yet." />
      )}
    </Section>
  );
}

export function ClarificationsSection({ item }: { item: SupportEmployeeDetail }) {
  if (!item.clarifications.length) return null;
  return (
    <Section title="Clarifications">
      <ul className="space-y-1 text-xs">
        {item.clarifications.map((entry, index) => (
          <li key={index} className="flex justify-between gap-2">
            <span>{entry.subject}</span>
            <StatusBadge label={label(entry.status)} tone={statusTone(entry.status)} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function HistorySection({ item }: { item: SupportEmployeeDetail }) {
  return (
    <Section title="Stage history">
      {item.history.length ? (
        <ol className="space-y-1.5 text-xs">
          {item.history.map((entry, index) => (
            <li key={index}>
              <span className="font-medium">
                {entry.fromStatus ? `${label(entry.fromStatus)} → ` : ""}
                {label(entry.toStatus)}
              </span>
              <span className="ml-2 text-[10px] text-muted-foreground">
                {dateTime(entry.createdAt)}
              </span>
              {entry.reason ? <p className="text-muted-foreground">{entry.reason}</p> : null}
            </li>
          ))}
        </ol>
      ) : (
        <Empty text="No stage changes recorded yet." />
      )}
    </Section>
  );
}

export function EmployeeRequestsSection({ item }: { item: SupportEmployeeDetail }) {
  if (!item.supportRequests.length) return null;
  return (
    <Section title="Support requests">
      <ul className="space-y-1 text-xs">
        {item.supportRequests.map((request) => (
          <li key={request.id} className="flex justify-between gap-2">
            <span>
              {request.requestNumber} · {request.subject}
            </span>
            <StatusBadge
              label={REQUEST_STATUS_META[request.status].label}
              tone={REQUEST_STATUS_META[request.status].tone}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}
