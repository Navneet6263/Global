import { guide, type GuideCatalogue } from "../help-types";

export default {
  "/client-portal": guide(
    "Client portfolio",
    "Monitor your organisation's candidate verifications, outstanding corrections and published results.",
    [
      "Check the portfolio and Action required counts.",
      "Open a candidate to inspect the current stage and pending requests.",
      "Correct requested information or download the report once it is published.",
    ],
    "Only your authorised organisation's cases should appear. The verification team's internal workspaces are separate.",
  ),
  "/client-portal/verifications": guide(
    "Your verifications",
    "Create and monitor verification requests for your organisation.",
    [
      "Search for an existing candidate case to avoid duplicates.",
      "For a new request, enter candidate details, choose checks and review consent/invitation options.",
      "Submit once, note the case number, then track status in the saved case.",
    ],
    "Your requesting organisation comes from your account scope. Never choose another employer merely to make submission succeed.",
    [
      {
        question: "Who uploads the candidate's documents?",
        answer:
          "The candidate uses their secure upload link. Authorised staff may use the case document controls where their permissions allow it. Corrected versions should be uploaded against the appropriate document type.",
      },
    ],
  ),
  "/client-portal/actions": guide(
    "Action required",
    "Respond to missing information and document corrections that are delaying a case.",
    [
      "Open the affected candidate.",
      "Read the exact reason or clarification message.",
      "Provide the corrected evidence and check that the response was saved.",
    ],
    "A rejected document is not necessarily a rejected candidate. Review the check outcome separately from document acceptance.",
  ),
  "/client-portal/analytics": guide(
    "Portfolio analytics",
    "Understand volume, turnaround and where your organisation's cases need attention.",
    [
      "Review the selected period and scope.",
      "Compare stage delays and correction hotspots.",
      "Inspect the underlying cases before deciding what to change.",
    ],
    "No completed cases means there may be no measured turnaround yet. Missing data should not be interpreted as zero time or perfect performance.",
  ),
  "/client-portal/reports": guide(
    "Published reports",
    "Access the verification outcomes released for your organisation.",
    [
      "Find the candidate and report version.",
      "Confirm the report is Published.",
      "Download it and use its authenticity reference when verification is needed.",
    ],
    "Only share reports with authorised recipients. A file still being generated is not yet a published result.",
  ),
  "/sales-crm": guide(
    "Revenue command",
    "Manage commercial opportunities and follow-ups before operational verification begins.",
    [
      "Review pipeline and overdue follow-ups.",
      "Open the opportunity and record the next action with its owner.",
      "When the commercial outcome is confirmed, record Won or Lost with the required details.",
    ],
    "A CRM opportunity is not a candidate verification case. Winning a sale does not verify a candidate or publish a report.",
  ),
  "/sales-crm/opportunities": guide(
    "Opportunities",
    "Record a potential customer's requirement, stage, value and next action.",
    [
      "Search the company/contact before adding a duplicate.",
      "Enter accurate commercial details and select the responsible owner.",
      "Save the next follow-up and keep activities current as the deal progresses.",
    ],
    "Forecast values are estimates, not collected money. Candidate links belong to verification cases, not arbitrary sales leads.",
  ),
  "/sales-crm/forecast": guide(
    "Revenue forecast",
    "Compare open pipeline with probability-adjusted expected revenue.",
    [
      "Check the period and opportunity scope.",
      "Compare total value against weighted forecast and actual wins.",
      "Review the underlying opportunities before changing their stage or probability.",
    ],
    "A target or gap cannot be calculated until a genuine target is configured. Weighted forecast is not a guaranteed collection.",
  ),
  "/finance": guide(
    "Finance workspace",
    "Maintain invoices, collections, credits and payment records.",
    [
      "Find the correct client and invoice.",
      "Review amount, due date, balance and current status.",
      "Record only confirmed payments or authorised credits with the required reference.",
    ],
    "Recording a payment here does not move money through a bank. Reconcile real receipt evidence and never double-record a payment.",
  ),
} satisfies GuideCatalogue;
