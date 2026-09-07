# Implementation progress

Scope: PRODUCT_IMPROVEMENT_PLAN_2026-09-05.md, including the requested conversational page-help panel.
Existing dirty-worktree changes are preserved. No commit/push or paid infrastructure is part of this work.

## Implemented and verified in this batch

### Access and request correctness

- Operations trend/risk queries compose feature filters with branch scope instead of replacing it.
- JWT requests recheck live session/account state using the existing lean parameterised query. Removed stale actor caching/in-flight sharing.
- Frontend request generations cancel/discard old-session results, including late error/body reads. GET sharing respects headers and request options; writes retire pending read reuse.
- Private reads have bounded deadlines, with longer deadlines for file transfers. Public-link rejection no longer refreshes or signs out an unrelated staff session.
- Offline ownership preparation/cleanup is serialised; late expiry cleanup cannot clear a newer in-memory identity or redirect its user.
- Unchanged case-intake retries reuse an idempotency key until confirmed success; timeout messaging does not falsely claim no case was saved.

### Performance and feedback

- Operations register filters and pagination run on the server, with exact totals and stable ordering. Owner IDs, risk, date windows, assignment and field filters remain branch-scoped.
- Priority/workflow-stage ranking fetches aggregate counts plus the requested page, not all case payloads. This preserves the existing stage-based progression sort; it is not a new check-completion metric.
- Search is debounced; abandoned query requests are cancellable.
- `/dashboards/navigation` returns counts only. CRM/Verifier badges reuse canonical overview/insight keys instead of duplicate cache entries.
- Mutations invalidate related inactive views and refetch active consumers. Notifications use one raw cache contract, actual unread totals and visible retry errors; navigation does not wait for mark-read persistence.
- Toolbar refresh distinguishes errors and always releases its loading state.
- Login now renders its non-sensitive form on the server; the existing hydration gate still protects submission. Help also guards its initial click until hydrated.
- Case rows use the real service package name and more accurate next-step labels.

### Evidence transfer and QA

- Authenticated document, field-evidence and report downloads stream from local/S3/Azure storage with backpressure. Access checks and audit writes remain required; an audit failure closes the stream.
- Upload admission bounds the complete read/inspect/store operation: defaults are four uploads per API process and two per actor/public IP. Excess work gets an explicit busy response rather than an unbounded in-memory queue.
- Original file data, checksums, current size limits and existing inspection rules are preserved. Upload parsing/inspection still buffers an admitted file; this is not resumable upload or background quarantine processing.
- QA decisions enforce an unexpired owned reservation both before and inside the conditional database write. Renew/release endpoints are version-, actor-, tenant- and scope-checked and audited.
- QA UI shows remaining reservation time, Renew/Release, and allows expired claims to be reclaimed. Rationale is retained across refresh; changed versions require the checklist to be reviewed again.
- QA and Admin oversight now use bounded summary pages, with findings/documents/field evidence loaded only for a selected QA case. The legacy queue API remains for compatibility but these screens no longer use it.
- QA has Awaiting review, Available to claim, My claims, Corrections and My decisions views. Counts/search/ownership filters run on the server; current case/report status is distinct from the historical decision.
- My decisions is reviewer-, tenant-, branch- and client-scoped, with real rationale and pagination. Corrections tracks returned IN_PROGRESS cases; it is not another approval queue.
- Claim/renew/release/decision controls share a pending state until refresh completes. Native disabled fieldsets protect keyboard and mouse controls. Open-panel rationale survives renewal; checklist acknowledgement resets for the new version.
- Unknown risk is neutral rather than green. Expired claims show available, not an active review owner. Unpublished report versions are not presented as v0.
- Case-query and QA reader/decision logic were split into focused modules rather than growing one large service.

### Help and Learning Mode

- Header Help opens a responsive conversational page guide in all shared role shells, standalone Field and public candidate/consent/clarification/report pages.
- Purpose, first steps, prerequisites and role-specific questions come from typed, lazy-loaded local catalogues. Other navigation pages use their authorised title/description and safe workflow guidance.
- Search finds authored help topics; this is explicitly not an AI/live-support chatbot. No candidate data, tokens or questions are sent to an external service.
- Learning Mode is opt-in. It adds page introductions and delayed hover/keyboard sidebar hints; switching it off removes those additions.
- Staff preferences are tenant/user/workspace-scoped; public preferences are session-scoped. No private link tokens are used in preference keys.
- Public Help does not import staff navigation/offline-store dependencies. Controls support keyboard focus, Escape and mobile layouts.

## Recorded verification

- Baseline backend suite: 132 tests passed before this batch.
- Backend suite: 149/149 passed after the QA register/history work; Nest build and backend lint passed.
- Frontend: TypeScript, lint (zero errors/warnings), production build and 7/7 unit tests passed.
- Browser: 6/6 Help/Learning Mode/login tests and 2/2 QA UI contract tests passed in their final runs. Help includes mobile width, keyboard focus, reload preference and axe checks for serious/critical violations. QA verifies selected-evidence reads, each focused view, staff Help, keyboard-disabled controls, pending-action locks and rationale/checklist handling across renewal/release.
- SQL Server integration passed, including ranked pagination, navigation counts and new QA register/detail/claim-filter/correction/history tenant/client/branch checks. One initial connection timeout was followed by a successful bounded retry; all temporary fixtures rolled back.
- Public browser checks ran with the backend intentionally absent on the isolated test port. QA UI checks use intercepted responses defined only in `frontend/e2e/fixtures/`; the application imports no test data. SQL integration separately checks the real read paths. These checks do not certify a full authenticated golden journey or external delivery.
- Cold Vite bootstrap needed an explicit 30-second navigation wait in QA tests. Development remounts can abort/retry the selected-case read; the contract test confirms no other case evidence is prefetched. These are not production latency measurements.
- Screenshots inspected: `frontend/test-results/page-help-mobile.png` and the QA layout (local ignored test artifacts; QA screenshot uses test-only records).
- `git diff --check` passed. No new migration is required by the changes in this batch; pre-existing schema/migration changes were preserved.

## Still open in the accepted roadmap (not marked complete)

- End-to-end timing baseline/P50/P95 and mixed high-volume load tests; no unlimited-capacity or universal latency claim.
- Remaining all-case/all-opportunity read paths, full SLA/assignment/field worklists and SQL trend aggregates. QA summary/detail separation is now implemented.
- Thumbnail derivatives, genuine image decoding/OCR-quality signals, resumable transfers, per-file recovery UI, asynchronous quarantine/scan jobs and provider-specific load/recovery verification.
- Unified candidate consent/upload journey and remaining correction/ownership guidance beyond the new Help panel.
- Field appointment/history/sync workspaces, Finance ledgers/disputes/unbilled work and additional role-specific views. Focused QA views/history are implemented; evidence version comparison and broader draft-protection remain open.
- CRM receiving-owner/acceptance workflow, client bulk intake/reminders and further admin oversight/recovery surfaces.
- Actual stage-entry ageing, unified progression semantics, unknown-outcome treatment and all cross-dashboard metric reconciliation.
- Full authenticated golden flows/concurrency tests and actual SMTP/SMS/malware/cloud-storage integration checks. Browser E2E credentials were not configured for those flows.

The implementation plan remains active work, not a finished-product certificate. Keep these remaining deliverables intact when continuing.

## Quick manual checks for this batch

1. Open any role workspace, click Help, choose a question, search a topic and close with Escape.
2. Turn Learning Mode on; navigate between pages and hover/focus a sidebar item. Turn it off and confirm extra hints disappear.
3. Open Operations cases: test search, owner/stage/risk filters, next/previous pages and sorting; compare totals with the records in scope.
4. Create a case once. If the result is uncertain, retry the unchanged form instead of opening another intake form.
5. Claim a QA case; renew or release it. Expired or stale reservations must reject decisions; successful approval still queues the existing report workflow.
   Check Available/My claims filters, Corrections reasons and My decisions history. Renew/Release must disable conflicting decisions until the updated version loads.
6. Open/download an authorised document, report or field photo. Verify content and its audit event; test an unauthorised account separately.

## Process ownership

- No ordinary application backend/dev server was left running. Playwright owned its isolated frontend on port 4183 and shut it down after each run.
- Final port check found a listener on 8080 owned by a different project (`CIPET Connect`, PID 31220 at inspection). Its command and parent were inspected read-only; it was deliberately left running. Ports 4000, 4100 and 4183 had no listener. Resolve this unrelated 8080 conflict before expecting Sapling at its default development address.
- No commit, push, Docker operation, deployment, password reset or paid infrastructure change was performed.
