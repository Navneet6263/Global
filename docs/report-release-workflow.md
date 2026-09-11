# Controlled report release

New report records use workflow version 2:

`QA_REVIEW → MANAGER_REVIEW → REPORT_PENDING → PAYMENT_PENDING → COMPLETED → CLOSED`

1. QA approves only after the controlled checklist and evidence checks pass.
2. An independent Operations Manager or Platform Admin reviews the case, records a factual recommendation and explicitly acknowledges any high-risk findings.
3. Approval creates an immutable review snapshot and queues report preparation. A manager can also select **Prepare approved report now** when the outbox worker is disabled.
4. The prepared report is available for internal manager preview. It is not downloadable by the client yet.
5. Finance selects the report in **Ready for billing** and issues its invoice. New case service prices and tax are bound to the immutable intake snapshot; arbitrary price overrides or omitted services are rejected by the API.
6. Finance records actual payment. Partial payment and credit notes do not satisfy successful full-payment release. The final payment releases the report atomically when all readiness checks still pass.
7. The client receives a notification linking to their own Reports page and can download the released file.
8. Existing controlled case closure and retention apply after completion. A client download click is not treated as an additional mandatory closure condition.

## Independence and scope

- Manager approval is denied to the QA reviewer, a completed-check author or a person who recorded a source response for the same case.
- Source-response authors cannot QA that case either. Prior source-response cycles remain part of the independence check; simply requesting a source is routing work, not a factual verification decision.
- Client downloads remain tenant/client-scoped. Clients cannot access internal preview, expiry renewal or manager decisions.
- Preparation is authorized by the exact persisted manager approval for that tenant, case and report. Background generation does not impersonate the former QA claimant or bypass case authorization globally.
- Report preview, download, renewal, payment and workflow changes create audit records. The full case workspace Timeline has an Ops/Admin-only paginated Case activity panel showing action, actor name and time, with resource filters. It includes related report, document, assignment, consent, clarification, field and invoice events. Existing case status history remains below it.
- Activity reads authorize the exact tenant/case/branch first. Audit JSON, credentials, IP/location and object paths are not exposed. Global login/session history is not copied into a case timeline. Client timeline access is unchanged; clients cannot open this internal activity endpoint.

## History, expiry and recovery

- Report files and their approval snapshots are never overwritten. Generation is idempotent for a prepared version.
- A manager can reopen selected checks with a reason. This records an approval, increments their review cycles, starts fresh method requests and supersedes old report records without deleting their files.
- Superseded reports cannot be downloaded by clients or represented as currently valid by authenticity verification. Managers retain audited historical preview access.
- `REPORT_DOWNLOAD_TTL_DAYS` controls released report access and manager renewals: default 30 days, permitted range 1–3650. This access window is not the file-retention duration.
- Previously published workflow-v1 reports remain readable without automatic rebilling. Unpublished legacy reports require independent manager recovery or controlled reopening, not silent publication.
- A new report after reopening does not automatically reuse an old report's invoice. Finance explicitly decides what to bill; free correction/reissue and transfer of prior payment are not defined here.
- Zero-value report scopes are blocked with a commercial-terms message. No free-release, credit settlement or payment-waiver bypass is enabled.
- Authenticity uses the stored file hash, version and current release status. It is not a certificate-backed digital signature.

## Verification

Focused tests cover immutable prices/tax, zero-value invoices, partial/credited/full payment, cross-client links, source-author and QA independence, expiry, concurrent renewal, immutable method/evidence snapshots and PDF pagination.

`backend/test/delivery-workflow.rollback.integration.ts` exercises the real SQL services within one transaction that is always rolled back. Synthetic fixtures never commit, notifications/outbox events never leave that transaction, and generated PDFs exist only in memory. It verifies the end-to-end chain, a tampered invoice rejection, client scoping and report supersession after reopening.
