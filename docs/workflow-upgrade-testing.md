# Tester guide: controlled verification and release

For proposals, source contact history, private contract originals, credit holds and privacy/vendor controls added on 9 September, also use the [commercial/source tester guide](workflow-completion-testing.md).

8 September 2026. Test the existing role workspaces with the upgraded workflow, not a separate application. Use this alongside the [implementation status register](workflow-upgrade-status.md).

## Before testing

- Local and UAT share a database. Use a clearly identified test client and synthetic subjects; never record a test payment against a real client's invoice. Do not reset, seed or clean the shared database.
- Frontend, backend and every outbox worker connected to that database must run the same upgraded code before exercising new cases. Additive migrations alone do not update the running application. Older workers do not understand the new approval/report lifecycle.
- Use separate named accounts for Client Admin, Operations, Verifier, QA, Manager approver and Finance. Manager capability is provided to Operations Manager / Platform Admin, not a new login role. The manager must not have recorded source responses, completed checks or performed QA on this case.
- Use real test files you are authorised to upload. Never send links to an unrelated person. With delivery disabled, use the invitation controls; an acknowledged queue event does not mean an email or SMS arrived.
- Existing published legacy reports retain their prior access. Use a newly created case to test the new payment gate.

## Primary flow

| Step | Role and action | Expected result |
| --- | --- | --- |
| 1 | Admin: create/check the test client, commercial settings, permitted packages and required document types. For a new CRM onboarding client, record current agreement/DPA references and billing details before activation. | Active client and usable package configuration. Later package edits will not rewrite this case's settings. |
| 2 | Client Admin: create a verification. The organisation comes from the account. Select one to four permitted services and fill the required service details. | One case number, separate service/check scope, `CONSENT_PENDING`. VendorCheck requires the business name and registration. |
| 3 | Copy the candidate upload and consent links from the successful intake/invitation controls. Open them as the candidate. | Upload and consent are distinct controls. Development OTP is shown only where that environment explicitly permits it. |
| 4 | Candidate: read and acknowledge the privacy notice, upload each requested document, add its printed expiry if applicable, and complete the consent OTP. | Uploaded files are available but not yet reviewed. Accepted consent alone does not start checks. |
| 5 | Operations: open Case 360 -> Documents. Inspect each actual file and accept the exact current version, or request correction with a reason. Then use Start verification. | Missing, expired, rejected or unreviewed required evidence blocks the start. Ready cases enter `IN_PROGRESS`. |
| 6 | Operations: select named eligible verifier(s) in Assignment workbench and assign the selected checks. | Work appears only in the assigned verifier's scope and is recorded in activity history. |
| 7 | Verifier: open an assigned check. Use Sources & methods as applicable; record the authorised source/contact, response and selected reviewed evidence versions. | Manual, Digital and Third-party are alternatives/inputs, not three compulsory sequential stages. These controls record evidence; they do not automatically call an external provider. |
| 8 | Verifier: record the factual consolidated outcome and complete each check. If a discrepancy or inconclusive result needs correction, raise a linked clarification, review the response and re-verify. | Outstanding/conflicting source results or an old evidence version cannot be silently marked Clear. Unresolved clarifications and unfinished field work block final readiness. |
| 9 | If field work is required: Field Executive completes GPS/evidence/checklist submission; a separate authorised supervisor reviews it. | A normal submission enters `REVIEW_PENDING`, not immediately accepted completion. |
| 10 | QA: claim the ready case, inspect evidence and complete the controlled checklist/rationale. Approve or return selected checks. | Approval enters `MANAGER_REVIEW`; it does not publish a report. |
| 11 | Independent manager: full case workspace -> QA & reports -> Approval & release. Record review notes, factual recommendation and any required high-risk acknowledgement. | Approval queues an immutable report snapshot. Return to QA is available for rework. |
| 12 | Wait for report preparation. If the outbox worker is deliberately disabled, use Prepare approved report now. | `PREPARED` report and `PAYMENT_PENDING` case. Manager-only internal preview works; client download remains locked. |
| 13 | Finance: Reports ready for billing -> Prepare invoice. Review the client, all snapshotted service charges/tax and due date, then issue. | A report-linked invoice. Missing services, arbitrary price overrides and zero-value report scopes are rejected. |
| 14 | Finance: record a genuine approved test receipt against the test invoice. First test a partial amount, then the exact remaining amount. | Partial payment does not release. Full recorded payment releases the report only if the evidence/readiness checks still pass. Payment recording is not a bank transfer. |
| 15 | Client Admin: Reports and Invoices & payments. Open the released report and its authenticity reference. | The client's own released file is downloadable within its access window. The case is `COMPLETED`; invoice/payment summary is visible. |
| 16 | Operations/Admin: inspect the case Timeline and, when appropriate, close the completed/released case. | Actor/time activity is paginated. Controlled closure requires release; it does not require the client to click Download first. |

## Negative and recovery checks

1. Try Start verification with missing or merely uploaded required documents: it must fail with a useful reason.
2. Request a corrected document and upload a new version: prior acceptance resets; the exact new version must be reviewed.
3. Keep a source response form open, replace its selected document elsewhere, then submit: stale version must be rejected, not silently rebound.
4. Leave a source response, clarification or field supervisor review pending: final QA/manager readiness must fail.
5. Try QA/manager approval using the verifier/source author's identity: independence must be enforced on the server, including users with multiple permissions.
6. Try client report download while only prepared, partly paid, credited or expired: the relevant gate must remain closed. Credits are not cash-payment release.
7. After expiry, Operations/Admin may renew released access. A superseded report must not be revived by renewal.
8. Reopen selected completed checks as a manager with a reason: old report files remain retained but become superseded; selected checks receive fresh review cycles/method requests. Do not reuse old clarification cycles or invoice allocations.
9. Attempt another client/tenant's case, invoice, report or activity cursor using API calls: access must be denied without revealing protected data.
10. Refresh/retry after a failed save: stale versions should produce a conflict, not duplicate decisions or payments.

## Additional screens

- **Commercial onboarding:** a won opportunity creates/links a real onboarding client. Agreement references are not signature verification or contract-file upload.
- **Bulk intake:** Client Admin can import up to 50 CSV rows / 200 KB. Retry failed rows in the same open import; successful rows are not resubmitted. Native XLSX and resumable background imports are not implemented.
- **Branch analytics:** compare the client's assigned delivery branches, including unassigned cases. Branch assignment is not automatic city geocoding.
- **Monthly statement:** select an India calendar month; verify opening balance, movements and closing balance against recorded invoices/payments/credits/cancellations. Later backdated entries can change a subsequent export.
- **Privacy desk:** Admin can track requests/incidents and record controlled decisions with evidence references. Fulfilled/Closed records describe human actions, not automatic erasure or regulator notification.
- **Help / learning mode:** confirm the page-specific guide explains manager review, payment release and field review accurately. It is authored guidance, not an AI assistant.

## What these checks do not certify

Real notification delivery, external digital/OCR providers, malware scanner deployment, large concurrent uploads, restore/backup procedures, complete privacy erasure and every role's full browser journey require separate target-environment verification. See the status register for unimplemented features. Do not report “all production-ready” from successful builds or isolated tests.
