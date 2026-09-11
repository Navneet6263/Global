# QA and Finance navigation

The existing role workspaces now have focused, bookmarkable pages. The shared mint-white shell, fixed account footer, permissions and backend workflow rules are retained.

## QA Reviewer

| Page | Use |
| --- | --- |
| `/qa-review/overview` | Scoped awaiting, overdue, high-risk and claimed counts; links to the next action. |
| `/qa-review` | Review queue. Use **Available to claim only** to exclude current reservations. |
| `/qa-review/mine` | Cases currently reserved for the signed-in reviewer. |
| `/qa-review/corrections` | Track returned cases; this is not an approval queue. |
| `/qa-review/history` | The reviewer's recorded decisions, separately labelled from current case/report status. |

Claim, renew, release, evidence review and approval/rework use the existing APIs. QA approval does not bypass independent manager review, report preparation or the existing invoice/payment release gates. Overview and history do not load individual case evidence.

Review queue and My reviews start directly with case work; KPI cards stay on Overview. The selected case uses compact, coloured sections: Checks & findings, Documents, optional Field evidence, and Quality & decision. Only one section is rendered at a time, with bounded evidence scrolling and a separate navigation/decision footer. Field evidence appears only when the case has linked visits; required field verification precedes QA in the current backend workflow.

Notes, selected rework checks and checklist selections survive section changes in the current case. No section visit automatically ticks a checklist item. Claim/version/expiry/pending gates are retained; a refreshed case version clears checklist and rework selections while retaining rationale for re-review. Changing the selected case resets its local draft as before.

## Finance Manager

| Page | Use |
| --- | --- |
| `/finance` | Billing totals, receivables ageing and action links. |
| `/finance/invoices` | Search/filter invoices, issue an invoice and open its ledger. Payment, credit and cancellation actions remain in the invoice detail. |
| `/finance/billing` | Prepare invoices from approved reports and contracted charges; requires write access for preparation. |
| `/finance/collections` | Invoice register initially filtered to **Overdue**; other statuses remain available. |
| `/finance/credit` | Credit controls open directly, without an extra expand step. |
| `/finance/statements` | Select a client/month and download the existing CSV statement. |

Recording a payment records a receipt; it does not transfer money. Existing version, amount, permission and report-release checks remain unchanged.

## Loading and checks

- Queue/register filters stay mounted during reads. Previous rows remain visually available while stale record actions and pagination are blocked.
- Read errors are distinguished from a successfully empty queue.
- Finance overview does not request invoice pages, credit-control data or billing-ready reports; those load on their respective pages.
- Private routes use the same client-side session guard pattern as Admin/Verifier; backend authorization is unchanged.
- Contextual Help and the mobile navigation cover the new pages.
- Browser tests intercept APIs; their fixtures are test-only and do not write to the shared database. Real UAT approval/payment execution still needs a separate authorised test.
