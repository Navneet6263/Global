# Commercial/source completion: tester guide

9 September 2026. Use synthetic data and separate authorised accounts. Keep the existing core QA -> independent manager -> prepared report -> invoice -> full payment -> release flow.

## Sales & CRM

1. Open an unassigned, open opportunity. **Assign least-loaded owner** picks an eligible active Sales Manager and records the assignment. An existing owner cannot be silently replaced by this action.
2. In the opportunity drawer, open **Proposals -> New proposal revision**. Choose actual catalogue packages, quantities, rates, tax, future validity and terms; create the draft.
3. The author cannot approve it. A different Sales Manager or Platform Admin reviews and approves with a rationale.
4. Download the proposal PDF. It contains the stored quote revision, not live mutable catalogue prices. Mark **Sent** only after actual delivery outside the app and record its reference; record actual acceptance/decline separately. These actions do not send an email, sign a contract, mark the opportunity won or issue an invoice.
5. Open **Follow-up sequence**. Assign an owner and finish any existing manual follow-up, then start. Due points are 24 hours, day 3 and day 7 from the start. Complete each in the existing Follow-ups page; late work stays overdue. Stop, manual rescheduling or closing the opportunity ends the sequence.

## Contract originals and new client onboarding

1. Open the client's **Commercial** panel, save billing details, package rates and agreement/DPA references with valid signing dates.
2. Under **Contract files & review**, select a saved reference and upload its readable PDF/JPEG/PNG original (maximum 10 MB). Confidentiality and proposal references can also hold originals.
3. A different authorised Sales Manager/Admin downloads/reviews the latest file, records a rationale and confirms the human signature review before approval. Uploader self-approval, old revisions and stale decisions must fail.
4. Both current agreement and DPA need approved latest files to activate an ONBOARDING client. Uploading a replacement resets that reference's latest-file approval. Existing ACTIVE clients are not retroactively suspended.

## Verification source contacts

1. Start verification only after accepted consent and reviewed required documents. Open a check's **Sources & methods**, track an actual manual/third-party source request.
2. Open **Contact tracker**. Request wording is copy-only; no message has been sent by copying it.
3. Record the actual contact channel, outcome and factual notes. Optional next-contact time must be in the future, within 90 days. The server rejects a future/backdated occurrence or a closed/stale request.
4. Inspect actor/time history and pagination. Contact attempts do not complete the check. Record the actual response with current reviewed evidence separately; that clears the pending follow-up.
5. **Digital source** and the document workspace show **Coming soon** for live provider lookup/OCR. A manually recorded, independently obtained provider response is not a connected provider API result.

## Finance

1. Open Finance -> **Client credit controls -> Manage credit**. Inspect current non-cancelled INR invoice balances.
2. Set a credit limit and record the decision rationale. Crossing a limit shows a warning; it does not itself stop intake.
3. Explicitly enable **new-case hold**, with a reason. Try creating a new verification for that client: the backend must reject it without inserting a subject/case. Existing cases stay accessible; no report payment gate is bypassed.
4. Finance can lift the hold with a fresh version and reason. All changes are audited. No automatic payment/debt collection is performed.
5. With the existing outbox worker enabled, overdue invoices generate in-app Finance reminders, follow-up escalation after 7 days and manager visibility after 30 days. Disabled workers mean no new scheduled notices; these controls never enable email/SMS automatically.

## Platform Admin -> Privacy desk

1. Open **Retention preview**, choose preview age/search/held status, inspect paginated case counts and record a hold/release rationale.
2. Preview age is not a deletion policy. Holds stop future field-retention scheduling only. Releasing a hold does not launch whole-case erasure; it allows existing approved field-retention behaviour to resume. Already queued deletions/backups are not reversed by this switch.
3. Open the **Vendor sharing** register, record a recipient, purpose, DPA/scope reference, data categories and future expiry. A different admin must authorise it. Test rejection, expiry display, revocation, history and pagination.
4. The register records approved human decisions; it does not create vendor accounts, transmit candidate documents, certify compliance or execute regulator notifications.

## Rollout boundary

- Frontend, backend and workers must be upgraded together. No Git push, PM2 restart or UAT deployment is performed by these code changes.
- Existing real clients/candidates must not be repurposed as test fixtures. Automated SQL integration uses a temporary synthetic tenant inside an always-rolled-back transaction.
- See [verification record](workflow-upgrade-verification.md) for executed checks and [full status register](workflow-upgrade-status.md) for capabilities that remain partial. This guide is not an all-complete production certification.
