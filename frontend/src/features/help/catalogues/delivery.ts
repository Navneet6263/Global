import { guide, type GuideCatalogue } from "../help-types";

const evidence =
  "Review actual supporting evidence. An uploaded file is not proof of authenticity, and a completed check is not the same as final QA approval.";
export default {
  "/operations": guide(
    "Delivery overview",
    "Prioritise the team's active cases and identify the next person or action needed.",
    [
      "Review overdue and unassigned work first.",
      "Open the case and inspect consent, documents and blockers.",
      "Assign a named owner or verifier and follow the timeline.",
    ],
    "Escalating flags work for attention. It does not mean the system randomly assigned an employee.",
  ),
  "/operations/cases": guide(
    "Case 360",
    "Inspect one candidate's full verification context without losing the delivery register.",
    [
      "Search by candidate or case number and open the case.",
      "Check consent and document readiness before starting verification.",
      "Review checks, assignments, clarifications and the activity timeline.",
    ],
    evidence,
    [
      {
        question: "When do I press Start verification?",
        answer:
          "After reviewing candidate consent and the required document readiness. The server checks the prerequisites. Uploading a file alone does not start a source check.",
      },
      {
        question: "Where does the candidate upload documents?",
        answer:
          "Use the candidate invitation controls in Case 360 to issue or renew the secure upload link. Share only with that candidate. Consent and upload controls are distinct; check the invitation details for the consent step.",
      },
    ],
  ),
  "/operations/assignments": guide(
    "Assignment workbench",
    "Give selected verification checks to a specific eligible verifier.",
    [
      "Find the case and select the checks that need an assignee.",
      "Review the named verifier's scope and workload.",
      "Confirm the assignment and check the saved result.",
    ],
    "A selected employee receives the checks; creating multiple user IDs does not cause random assignment. Reassigning must preserve the prior activity history.",
  ),
  "/operations/sla": guide(
    "SLA monitor",
    "Find approaching deadlines and overdue work before opening the affected case.",
    [
      "Check overdue and due-soon volume.",
      "Filter to the client or stage that needs attention.",
      "Open the affected case, review its blocker and take the permitted action.",
    ],
    "An escalation does not reset the committed deadline or guarantee completion. Record the actual reason and next owner.",
  ),
  "/verifier": guide(
    "Verifier workspace",
    "Work on checks assigned to you and hand evidence-backed outcomes to QA.",
    [
      "Review your active queue and deadlines.",
      "Open a check and review the source documents.",
      "Start the check, record the factual outcome and complete it when evidence is sufficient.",
    ],
    evidence,
  ),
  "/verifier/queue": guide(
    "Active check queue",
    "Focus on one assigned source check at a time.",
    [
      "Select a check and confirm candidate identity and check type.",
      "Start verification and review authorised sources.",
      "Record outcome and source summary, then complete the check.",
    ],
    "Do not mark Clear just to progress a case. Use a blocker or clarification when evidence is missing.",
    [
      {
        question: "What happens after the last check?",
        answer:
          "Once required checks are complete and the case is ready, it moves to independent QA review. QA may approve or return specific checks for rework.",
      },
    ],
  ),
  "/verifier/blockers": guide(
    "Blockers & clarifications",
    "Explain what prevents completion and track the response needed.",
    [
      "Open the blocked check.",
      "Read the missing-information request and latest response.",
      "Resume only when the dependency is resolved and complete the factual verification.",
    ],
    "A reply is not automatically an accepted correction. Inspect the new evidence before continuing.",
  ),
  "/qa-review": guide(
    "Independent QA review",
    "Review completed verification evidence and approve or return checks with a reason.",
    [
      "Select a queued case and claim it.",
      "Review findings, documents, field evidence and every checklist item.",
      "Write a factual rationale, then approve or choose the checks needing rework.",
    ],
    "You cannot independently QA your own completed source work. If another reviewer owns the case or it changed, refresh and claim it before deciding.",
    [
      {
        question: "Which QA view should I use?",
        answer:
          "Available to claim excludes current reservations. My claims shows only your unexpired reservations. Corrections tracks cases returned to verification; it is not an approval queue. My decisions is your saved approval/rework history with current case and report status shown separately.",
      },
      {
        question: "Can I renew or release my reservation?",
        answer:
          "A claim lasts 30 minutes. Renew it before expiry when you need more review time, or Release it for another reviewer. Renew changes the case version, so recheck the quality checklist; your written rationale stays in the open panel. An expired claim cannot submit a decision.",
      },
      {
        question: "Does approval instantly produce a PDF?",
        answer:
          "Approval queues report generation. Wait for Published status before downloading or telling the client it is available. Failed generation needs investigation, not repeated QA approval.",
      },
    ],
  ),
  "/field-executive": guide(
    "Field visits",
    "Capture event-based GPS and evidence for the visits assigned to you.",
    [
      "Open the assigned visit and read its address and checklist.",
      "At the location, capture accurate GPS and the required evidence.",
      "Complete the visit; if offline, check that pending items sync successfully when online.",
    ],
    "Pending sync is not server confirmation. Keep the device data until upload is confirmed. Geofence exceptions require the configured review path; do not fabricate GPS.",
  ),
} satisfies GuideCatalogue;
