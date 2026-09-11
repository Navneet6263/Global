import { guide } from "../help-types";

const qualityRule =
  "Independent review, current reservation and version checks still apply. QA approval is not final report release.";
export const qaGuides = {
  "/qa-review/overview": guide(
    "QA overview",
    "Understand current review workload and choose the next action.",
    [
      "Check awaiting, overdue and high-risk counts.",
      "Open Review queue for unclaimed work or My reviews to resume your reservations.",
      "Follow Corrections for rework and Decision history for your saved decisions.",
    ],
    qualityRule,
  ),
  "/qa-review/mine": guide(
    "My reviews",
    "Continue cases currently reserved for you.",
    [
      "Select a case and inspect its evidence.",
      "Renew your reservation if needed and complete the quality checklist.",
      "Record a reason before approving or returning selected checks.",
    ],
    qualityRule,
  ),
  "/qa-review/corrections": guide(
    "Corrections",
    "Monitor cases returned to the verification team.",
    [
      "Search for a returned case.",
      "Read the recorded correction reason and current check progress.",
      "Wait for completed rework to return to the QA queue.",
    ],
    "This is a tracking view, not an approval queue. Do not approve unresolved verification work.",
  ),
  "/qa-review/history": guide(
    "Decision history",
    "Read your previously recorded decisions.",
    [
      "Search by candidate, case or client.",
      "Read the decision, rationale and time.",
      "Compare the recorded decision with the separately labelled current case and report status.",
    ],
    "A saved approval does not mean the report is already published.",
  ),
};
const paymentRule =
  "Only record real, reconciled receipts. Recording a payment does not move money. Full payment of the linked invoice is required for report release; credits do not replace payment.";
export const financeGuides = {
  "/finance/invoices": guide(
    "Invoices",
    "Review the ledger, issue invoices and record payments or credits.",
    [
      "Search or filter the invoice register.",
      "Open an invoice to inspect its balance and ledger.",
      "Use Record payment or the authorised credit-note action after checking the supporting evidence.",
    ],
    paymentRule,
  ),
  "/finance/billing": guide(
    "Ready for billing",
    "Prepare invoices for approved, prepared reports.",
    [
      "Find the report awaiting billing.",
      "Prepare its invoice and review the contracted price, tax and due date.",
      "Save the invoice, then track the receipt in Invoices or Collections.",
    ],
    "Prepared is not Published. Do not issue duplicate invoices or bypass missing commercial charges.",
  ),
  "/finance/collections": guide(
    "Collections",
    "Prioritise overdue balances and reconcile payments.",
    [
      "Overdue invoices are selected by default.",
      "Change the status filter if you need other invoices.",
      "Open an invoice and record a confirmed receipt against its current balance.",
    ],
    paymentRule,
  ),
  "/finance/credit": guide(
    "Credit control",
    "Review client credit limits and explicit case-intake holds.",
    [
      "Search for the client and review outstanding invoices.",
      "Open Review to adjust an authorised limit or hold.",
      "Record the reason and confirm the saved result.",
    ],
    "Exceeding a limit raises an alert; only an explicit hold blocks new case intake. Existing work and report payment rules are unchanged.",
  ),
  "/finance/statements": guide(
    "Client statements",
    "Download a monthly client ledger.",
    [
      "Open Monthly statement.",
      "Choose a client and Indian calendar month.",
      "Download and review the CSV ledger.",
    ],
    "The statement reflects current records, not a frozen month-end snapshot. Backdated entries can change earlier months.",
  ),
};
