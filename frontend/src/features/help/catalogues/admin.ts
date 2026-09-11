import { guide, type GuideCatalogue } from "../help-types";

const overview =
  "Platform Admin sees oversight across the authorised tenant. Employee execution stays in the employee's own role workspace.";
export default {
  "/admin": guide(
    "Control Tower",
    "See where verification work is moving, delayed or waiting for another person.",
    [
      "Check active volume and SLA risk.",
      "Compare stage counts to identify waiting work.",
      "Open the relevant register or exception to inspect the actual case.",
    ],
    overview,
    [
      {
        question: "Are these numbers individual employee dashboards?",
        answer:
          "No. These are oversight totals. Assignment, source verification and independent QA remain separate role workflows.",
      },
      {
        question: "Why can a number change after refresh?",
        answer:
          "Counts reflect authorised saved records. Another employee may move a case while you are viewing it. Refresh retrieves the current state; an error is not a zero count.",
      },
    ],
  ),
  "/admin/users": guide(
    "User IDs & access",
    "Create employee or client sign-ins and give each person only the access they need.",
    [
      "Enter the person's name and work email.",
      "Choose their role; supply client or branch scope when required.",
      "Create the account, then securely share the one-time temporary credentials.",
    ],
    "Roles grant permissions; they are not cosmetic labels. A client account must be tied to the correct client organisation.",
    [
      {
        question: "What does Operating branch mean?",
        answer:
          "A branch represents an operating office, such as Agra or Noida. It limits authorised work according to role. Operations may also see unassigned-branch cases for allocation. It does not automatically route every new case to a city.",
      },
      {
        question: "Does choosing multiple roles grant all their access?",
        answer:
          "Yes, allowed role combinations combine permissions. Use one role unless the person genuinely needs more; restricted combinations are rejected by the server.",
      },
    ],
  ),
  "/admin/settings": guide(
    "Platform settings",
    "Maintain field-verification policy and the organisation's reusable configuration.",
    [
      "Open the configuration you want to maintain.",
      "Review existing values and explain changes to the affected team.",
      "Save and check the success or validation message.",
    ],
    "Changing defaults does not mean existing visits or cases were rewritten. Check the actual assigned record before assuming a new policy applies.",
    [
      {
        question: "What is a service package?",
        answer:
          "A reusable service-family bundle of checks, required reviewed documents, charges and turnaround defaults. Case intake can select multiple permitted packages and preserves their settings as a snapshot. Later edits apply to new cases, not existing work. A package is not a public website publication.",
      },
      {
        question: "What do geofence and check-out switches do?",
        answer:
          "Field policy controls accepted GPS accuracy, permitted distance, required photos and whether a second GPS fix is needed to close a visit. The server enforces the policy recorded for the visit.",
      },
    ],
  ),
  "/admin/audit": guide(
    "Audit trail",
    "Trace recorded security and business actions to the actor, time and affected record.",
    [
      "Filter by action, actor or resource.",
      "Open the event you want to investigate.",
      "Compare the event with the case timeline and current record.",
    ],
    "An audit event proves a recorded action, not continuous employee activity. Location labels may be unavailable or approximate; an IP address alone does not prove a person's location.",
  ),
  "/admin/clients": guide(
    "Client organisations",
    "Manage organisations requesting verification and their commercial scope.",
    [
      "Search before adding an organisation.",
      "Check its identity, SLA, billing terms, package rates and agreement/DPA references.",
      "Assign Client Admin IDs to the correct organisation.",
    ],
    "The requesting organisation is the customer, not automatically Sapling Global. New onboarding clients must satisfy the commercial checklist before activation. Agreement references are not uploaded or independently verified signatures. Suspending a client can affect its users and new work.",
  ),
  "/admin/privacy": guide(
    "Privacy desk",
    "Record and trace human handling of data-subject requests and privacy incidents.",
    [
      "Create a request or incident with a short reference, scope and target date.",
      "Open the record and record each permitted review or investigation decision with a reason.",
      "Add a supporting evidence reference before fulfilment or closure and review the actor timeline.",
    ],
    "This is controlled tracking, not automatic data export, deletion, identity verification or regulator notification. Do not paste passwords, document images or unnecessary sensitive data here. Operational consent withdrawal is not an action in this flow.",
  ),
} satisfies GuideCatalogue;
