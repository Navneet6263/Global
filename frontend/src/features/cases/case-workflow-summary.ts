import type { CaseDetail, CaseListItem } from "@/lib/backend-api/cases";

export interface PendingWork {
  role: string;
  owner: string;
  reason: string;
  since?: string;
  sinceLabel?: string;
}
export interface CaseWorkflowSummary {
  pending: PendingWork[];
  completedChecks: number;
  totalChecks: number;
  field: string;
  next: string;
  closed: boolean;
}
const readable = (value: string) => value.toLowerCase().replaceAll("_", " ");

/** Presentation only: never authorises a transition or assumes field work follows checks. */
export function caseWorkflowSummary(item: CaseListItem): CaseWorkflowSummary {
  const detail = item as Partial<CaseDetail>;
  const pending: PendingWork[] = [];
  const visits = item.fieldVisits ?? [];
  const activeVisits = visits.filter((visit) => !["COMPLETED", "CANCELLED"].includes(visit.status));
  const fieldRequired = item.checks.some((check) => check.type === "ADDRESS");
  const fieldApproved = visits.some((visit) => visit.status === "COMPLETED");
  const closed = ["COMPLETED", "CLOSED", "CANCELLED"].includes(item.status);
  const ops = item.assignedOpsUser?.displayName ?? "Operations team · owner not assigned";
  const add = (role: string, owner: string, reason: string) =>
    pending.push({ role, owner, reason });
  let next = "Open the case details to review its next action.";

  if (!closed && ["IN_PROGRESS", "CLARIFICATION_PENDING"].includes(item.status)) {
    for (const check of item.checks.filter((check) => check.status !== "COMPLETED")) {
      const tasks = (check.tasks ?? []).filter(
        (task) => !["COMPLETED", "CANCELLED"].includes(task.status),
      );
      if (!tasks.length) add("Operations", ops, `Assign ${readable(check.type)} check`);
      for (const task of tasks) {
        pending.push({
          role: task.assignee ? "Verifier" : "Operations",
          owner: task.assignee
            ? `${task.assignee.displayName}${task.assignee.email ? ` · ${task.assignee.email}` : ""}`
            : ops,
          reason: !task.assignee
            ? `Assign ${readable(check.type)} check`
            : `${readable(check.type)} · ${task.status === "BLOCKED" ? `blocked${task.blockerReason ? `: ${task.blockerReason}` : " — review task"}` : task.startedAt || task.status === "IN_PROGRESS" ? "in progress" : "not started"}`,
          since: task.startedAt ?? task.createdAt ?? undefined,
          sinceLabel: task.startedAt ? "Started" : "Task created",
        });
      }
    }
    if (fieldRequired && !fieldApproved && !activeVisits.length)
      add("Operations", ops, "Assign required physical field visit");
    for (const visit of activeVisits) {
      const review = ["REVIEW_PENDING", "EXCEPTION_REVIEW"].includes(visit.status);
      pending.push({
        role: review || !visit.assignee ? "Operations" : "Field executive",
        owner:
          review || !visit.assignee
            ? ops
            : `${visit.assignee.displayName} · ${visit.assignee.email}`,
        reason: review
          ? "Review field photos and approve, or request a fresh visit"
          : "Complete field visit and submit evidence",
        since: review ? (visit.capturedAt ?? undefined) : visit.createdAt,
        sinceLabel: review ? "Captured" : "Assigned",
      });
    }
    if (item.status === "CLARIFICATION_PENDING")
      add(
        "Clarification",
        "Requested recipient / Operations",
        "Review the Clarifications tab for the response or correction still required",
      );
    if (!pending.length)
      add(
        "Operations",
        ops,
        "Checks and field work are done; review remaining consent, documents and QA readiness",
      );
    next =
      "QA review follows only after all checks, required field work and evidence requirements are complete.";
  } else if (!closed) {
    switch (item.status) {
      case "DRAFT":
        add("Operations", ops, "Validate intake and initiate the case");
        next = "Candidate consent and document collection.";
        break;
      case "CONSENT_PENDING":
        add("Candidate", item.subject.fullName, "Complete the consent request");
        next = "Collect and review required documents.";
        break;
      case "DOCUMENT_PENDING": {
        const docs = detail.documents;
        if (
          docs?.some((doc) => ["REQUESTED", "REJECTED", "REUPLOAD_REQUIRED"].includes(doc.status))
        )
          add(
            "Candidate",
            item.subject.fullName,
            "Upload missing documents or replace rejected files",
          );
        add(
          "Operations",
          ops,
          docs?.some((doc) => doc.status === "AVAILABLE")
            ? "Review uploaded documents before starting verification"
            : "Check required documents and start verification when ready",
        );
        next = "Start verification and assign the required checks.";
        break;
      }
      case "QA_REVIEW":
        add(
          "QA reviewer",
          detail.qaReviewer
            ? `${detail.qaReviewer.displayName} · ${detail.qaReviewer.email}`
            : "QA queue · reviewer not assigned",
          "Review checks and evidence; approve or return corrections",
        );
        next = "Approved QA decision proceeds to manager review.";
        break;
      case "MANAGER_REVIEW":
        add(
          "Manager",
          "Eligible independent approving manager",
          "Review and approve the QA outcome",
        );
        next = "Report preparation after manager approval.";
        break;
      case "REPORT_PENDING":
        add(
          "Report processing",
          "Report service / authorised team",
          "Prepare the report; inspect report status if delayed",
        );
        next = "Billing and release controls must be satisfied before delivery.";
        break;
      case "PAYMENT_PENDING":
        add(
          "Finance / release",
          "Finance and authorised release team",
          "Check settlement and release conditions",
        );
        next = "Release the final report after the required controls pass.";
        break;
      default:
        add("Operations", ops, `Review case status: ${readable(item.status)}`);
    }
  } else
    next =
      item.status === "CANCELLED"
        ? "Case cancelled; no active work expected."
        : "Review the final outcome and report availability.";
  return {
    pending,
    next,
    closed,
    completedChecks: item.checks.filter((check) => check.status === "COMPLETED").length,
    totalChecks: item.checks.length,
    field: activeVisits.length
      ? `${activeVisits.length} field visit(s) pending`
      : fieldApproved
        ? "Field visit approved"
        : fieldRequired
          ? "Field visit not assigned"
          : "No field visit required",
  };
}
