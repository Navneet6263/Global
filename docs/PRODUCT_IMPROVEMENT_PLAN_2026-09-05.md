# Sapling Global: product, performance and Learning Mode implementation plan

Date: 5 September 2026. Status: implementation authorised and in progress; phase results are tracked in IMPLEMENTATION_PROGRESS_2026-09-05.md.
Scope: carry forward every improvement in the preceding audit, with contextual learning and high-volume evidence handling.
Completion means implemented behaviour plus recorded verification; a checklist or a successful build alone is not completion.

## Working constraints

- Keep React/Vite/TanStack, NestJS/Fastify and SQL Server. Extend existing storage, audit, workers, tests and offline capabilities.
- Retain the established white/soft mint/orange visual identity. Improve layout, hierarchy and controls where useful.
- Keep Platform Admin oversight separate from employee execution workspaces; enforce permissions on the server.
- Use real APIs. Synthetic volume data belongs only in an isolated test environment, never in production UI fallbacks.
- Aim for new/changed modules under 250 lines, maximum 300. Do not split unrelated legacy modules just for line counts.
- Preserve existing changes and business rules. Apply additive migrations before dependent code; retain original evidence and history.
- Implementation and relevant verification are authorised. No commit, push, new paid infrastructure or deployment is requested.
- During later testing, track processes started by the task and stop those processes when finished; leave unrelated processes alone.

## Verified starting points

- Operations cases, assignments and field oversight still load all cases for some client-side filtering. CRM has similar all-opportunities paths.
- Sidebar badges can fetch full operations/executive/exception data under keys separate from the page queries.
- Operations trend and at-risk filters overwrite the branch-scope OR. Isolated checks reproduced loss of branch restriction; tenant scope remains.
- JWT actor caching can reuse permissions for five seconds after database state changes. Isolated checks reproduced cached acceptance.
- Stage ageing uses updatedAt; Operations progress uses fixed stage percentages, while candidate progress uses completed checks.
- SLA details derive from an executive register capped at 500 by default. Package breakdown and breach reasons have empty-array implementations.
- Candidate upload and OTP consent use separate pages. Case creation already returns before the optional candidate-link request finishes.
- CRM onboarding currently records a handoff timestamp/activity/audit; acceptance by a receiving owner needs a fuller workflow.
- QA, Field and Finance have core capabilities but fewer focused work views than Operations, CRM, Client and Verifier.
- Local/S3/Azure object drivers exist. Current object reads return complete Buffers; scan/PDF work and large transfers need bounded resource usage.
- Existing document inspection checks structure and dimensions; it does not establish readability or authenticity.
- Audit events, encrypted offline drafts, report/outbox workers, browser tests and CI already exist. Live provider configuration and current test results require verification.

## Delivery sequence and gates

| Phase | Deliverable | Exit gate |
| --- | --- | --- |
| 0 | Baseline and behaviour inventory | Routes, actions, permissions, metrics and repeatable timing scenarios recorded |
| 1 | Correctness and access boundaries | Branch isolation, immediate revocation and stale-session regression checks pass |
| 2 | Query and interaction performance | Bounded fetches, accurate totals, selective refresh and before/after timings |
| 3 | Evidence storage and processing | Mixed uploads remain bounded; quarantined files stay inaccessible; recovery works |
| 4 | Shared UI and Learning Mode | All roles have accessible contextual guidance with clean on/off behaviour |
| 5 | Candidate, Operations and Verifier journey | Intake through verification and correction loops work without lost context |
| 6 | QA, Field and Finance workspaces | Focused queues, histories, ownership and domain actions work end to end |
| 7 | CRM, Client and Admin depth | Handoffs, scoped drill-downs, bulk workflows and oversight are connected |
| 8 | Metrics, activity and operational recovery | Consistent figures and actionable failure states across all consumers |
| 9 | Integrated release verification | Role journeys, concurrent edits, accessibility, recovery and load evidence recorded |

Each phase includes its API contracts, migration needs, UI states and targeted tests. Integrate and verify as phases finish.
Deliver the whole agreed scope; report any dependency requiring actual infrastructure or a policy choice with its exact impact.

## Phase 0: establish the baseline

- Inventory every visible route, sidebar item, primary action and mutation; record implemented, partial, broken or proposed status.
- Record who may act, prerequisites, resulting status, audit event, notification and next responsible person for every workflow action.
- Measure login, dashboard, case search/detail/create, assignment, QA submit, notifications, upload and report download independently.
- Separate connection/auth time, database time, processing, response size, browser rendering and refresh-triggered requests.
- Compare cold/warm sessions, normal/slow network, realistic data and a production frontend build. Do not infer production cost from Vite module counts.
- Record request counts, P50/P95 response times, failed requests, query counts, peak memory and worker queue age without logging PII or tokens.
- Capture reference screenshots and interaction states before layout changes, including narrow laptop and mobile widths.

## Phase 1: correctness and permissions

- Compose branch/client/tenant scope with feature filters using explicit AND conditions. Audit other scope spreads and role combinations.
- Rework auth lookup caching so suspension, password changes, role/branch changes and session revocation enforce the documented access boundary immediately.
- Keep any cached permission metadata separate from the active-session check; account for multiple API processes and concurrent in-flight lookups.
- Scope frontend request sharing by authenticated identity/session generation. Abort or discard old responses after sign-out, account change or permission change.
- Use canonical query contracts and keys. Investigate legacy notification shape conflicts and remove legacy code only after proving it unused.
- Map mutation effects to all consumers: case drawer/full page, client lists, Ops queues, Admin KPIs, badges, reports and relevant histories.
- Preserve conditional writes/version checks and independent QA. A stale browser must not approve, assign or change another user's scoped data.
- Gate: cross-branch/client/tenant reads and writes, immediate revoke, concurrent reassign/claim and account-switch race tests.

## Phase 2: faster APIs and visible responses

- Replace browser-side all-case/all-opportunity pagination with server filters, stable ordering and bounded pages; calculate totals over the same scope/filter.
- Add purpose-specific queries for assignment queues, field oversight, CRM accounts/follow-ups/forecast and complete SLA worklists.
- Return summary projections for registers and QA lists; fetch sensitive documents/findings only for an authorised selected case.
- Aggregate trends and workload in SQL where appropriate. Avoid collecting entire histories in memory or repeatedly scanning users x tasks.
- Add lightweight navigation counts or reuse canonical summary data instead of loading a full executive dashboard for a badge.
- Cache stable catalogues and short-lived summaries with identity/scope/filter-aware keys and explicit invalidation after relevant writes.
- Profile query plans and pool wait before adding indexes or increasing pool size. Preserve TAT, due-date fallback, timezone and count semantics.
- Cancel obsolete searches, preserve valid cached rows during refresh and prefetch only useful authorised routes/details.
- Refresh affected panels after saves. Distinguish initial loading, background refresh, no results, partial failure and unavailable data.
- Navigate immediately on notification open; process read acknowledgement independently with honest failure handling and correct server unread totals.
- Apply bounded timeouts and retries. Retry writes only with the same logical idempotency key; resolve uncertain outcomes before allowing duplicate submission.
- Keep durable case/consent/audit/outbox persistence in the correct transaction. External delivery and report processing must not hold up that transaction.
- Gate: equivalent results across pagination, no duplicate records, no false success and measured reductions on the same dataset/hardware.

## Phase 3: high-volume photos and documents

### Storage and transfer

- Keep binary evidence in the configured private object store; database rows hold scoped metadata, checksums, versions and processing status.
- Extend the existing local/S3/Azure abstraction with bounded streaming. Preserve local development support; do not buffer entire downloads unnecessarily.
- Use pagination for document/evidence lists and lazy-load small previews. Open the original only on demand; support ranged delivery where appropriate.
- Authorise every original and derivative. If short-lived signed access is introduced, issue it only after server permission checks and document its revocation window.
- Preserve original bytes/checksums. Generate previews and thumbnails as explicitly separate derivatives; never silently compress original evidence.
- Start with a configurable small upload concurrency, such as 2-3 files per browser, and bounded tenant/worker concurrency. Measure before increasing.
- Show per-file progress, retry/cancel state and completion receipt. Persist secure retry metadata and stable logical upload IDs across reconnects.
- Prevent duplicate attachment creation after retry and expire abandoned uploads safely. Implement resumable/chunked transfer only where size/network tests justify it.

### Processing and safety

- Define explicit states: receiving, quarantined/processing, ready for review, rejected and processing failed. Map these to the existing workflow contract.
- Only durably received files enter processing. Only validated files become available to reviewers or count toward required-document readiness.
- Run malware inspection, safe image decoding, PDF rendering and preview generation in resource-limited workers, using the existing worker architecture.
- Bound file bytes, decoded pixels, PDF pages, CPU time, memory and queue concurrency. Avoid worker starvation of OTP delivery or report generation.
- Inspect actual decoded/rendered content for blank/low-quality files. Treat OCR/type matching as review assistance, with clear uncertainty and correction guidance.
- Do not label a file authentic merely because its extension, embedded image, text or checksum passes validation.
- Maintain separate validation, malware and human document-review outcomes; retry infrastructure failures without blaming the candidate's file.
- Keep last-known valid document versions and original evidence auditable during replacement/rework. Apply retention to originals, previews and abandoned objects consistently.
- Provide job age, retry count, scanner failure and storage failure visibility; use authorised retry actions and verify backup restoration.
- Gate: simultaneous legitimate uploads, corrupt/encrypted/blank files, worker restart, scanner outage, low bandwidth, interrupted transfer and tenant isolation.

## Phase 4: shared UI and Learning Mode

### Common interaction rules

- Standardise header spacing, content width, typography, field labels, table density, status colours and primary/secondary actions.
- Keep logo/account controls fixed while sidebar navigation scrolls. Ensure the new learning control fits smaller headers without crowding search/actions.
- Use readable operational text; review 9-11px labels rather than enlarging every card indiscriminately.
- Keep selected row, filters, page and scroll when a drawer closes. Keep case title/status/owner and primary actions predictable.
- Put document viewer and related actions together, with enough width for evidence review and without clipped tabs or excessive nested scrolling.
- Provide actionable empty/error states, disabled-action reasons, keyboard focus, accessible icon labels, adequate touch targets and reduced-motion support.
- Protect drafts and warn before discarding unsynced work. Keep essential field instructions and validation visible even when Learning Mode is off.

### Learning Mode behaviour

- Add a labelled Learning Mode switch to the shared top toolbar. Add the equivalent compact control to the standalone Field and public candidate shells.
- Latest direction: provide a header Help entry opening a conversational page guide with suggested questions, explanations and steps. Keep Learning Mode available inside it and as a compact header control where space permits.
- Default off; a dismissible first-use invitation can explain it. Remember the authenticated user's choice per tenant/user/browser; handle unavailable storage gracefully.
- Public/candidate preference stays session-scoped and stores no candidate identity or access token. Public/login help must not fetch protected data.
- When on, show a compact page introduction: purpose, what to do first, prerequisites, expected result and who acts next.
- Sidebar hover or keyboard focus shows a short help card. Use a modest hover delay, one card at a time, viewport-aware positioning and Escape dismissal.
- On touch devices use an explicit help affordance; tapping a navigation item must still navigate normally. Hover help must not block the item below it.
- Explain major buttons, status badges, filters and metrics in context. Never cover the primary action or force users through a tour to work.
- Provide optional short step-by-step walkthroughs for complex tasks: creating a case, assigning checks, rework, QA approval and uploading evidence.
- Use prerequisites returned by the authoritative workflow to explain disabled actions; help content must not implement a second permission/state engine.
- Offer relevant next-step links only when authorised. Examples explain actions but never submit forms, assign users or change real records automatically.
- Turning off closes open learning cards/tours immediately and removes learning-only introductions/highlights. Normal accessibility labels/errors remain.
- Reset/dismiss/replay behaviour is explicit. Browser back, route changes, async-loaded controls and missing tour targets must not leave a blocking overlay.
- Use concise language consistent with actual UI labels; structure content for localisation without changing business terminology.

### Learning implementation structure and acceptance

- Use a typed local help catalogue keyed by workspace, route and stable action ID, with role-specific content modules.
- Suggested modules: learning-provider, learning-toggle, contextual-help, page-guide, walkthrough and content/{admin,operations,verifier,qa,field,client,crm,finance,candidate}.
- Lazy-load role content; ordinary hover/focus help performs no API or AI calls. Avoid eagerly mounting dozens of popovers or recalculating whole pages.
- Reuse accessible tooltip/popover/dialog primitives, stable anchors and existing design tokens; remove duplicated ad-hoc help as replacements become verified.
- Example: Assignment Workbench explains eligibility, workload and selecting a named verifier; it does not imply random automatic assignment.
- Example: Start verification explains current consent/document prerequisites and the resulting stage; Service Package explains selected checks and turnaround defaults.
- Gate: every sidebar route and primary workflow action has reviewed help; keyboard/touch work; switching off removes guidance; other roles' controls are never disclosed.
- Gate: compare on/off route rendering and request counts; guidance does not add business API calls or materially delay the ordinary workflow.

## Phases 5-7: role delivery packages

| Workspace | Planned changes | Practical acceptance scenario |
| --- | --- | --- |
| Candidate | Guided consent/upload/correction journey; required-document checklist; previews and receipts; expiry/resend guidance; clear requester and next step | A first-time candidate follows one guided entry, completes OTP consent and required uploads, handles a correction, and knows what remains |
| Operations | Today/overdue/unassigned saved views; current owner/waiting-on/next action; complete SLA drill-down; workload/eligibility-aware bulk assignment; acknowledged handoffs and reassignment reasons | Intake becomes eligible, named checks are assigned, receiving staff see them, and exceptions return to a visible responsible person |
| Verifier | Evidence alongside findings; required-source checklist; visible saved drafts; next-task navigation; prioritised QA returns; old/new evidence comparison; blockers and history integration | A verifier resumes a draft, completes a check, receives specific QA feedback and resubmits without losing prior work |
| QA | Awaiting/My claims/Corrections/Decision history views; explicit claim expiry/release; checklist and evidence comparison; selected-check rework reasons | Concurrent reviewers cannot overwrite ownership; returned work re-enters the right queue; approval and report state are visible |
| Field | Today/upcoming, Exceptions, Sync queue and paginated History; appointment/reschedule/unreachable reasons; per-photo transfer state; accessible mobile actions | A field employee captures evidence offline, reconnects, retries an interrupted photo once and completes the visit with correct policy enforcement |
| Finance | Overview, Invoices, Collections, Payments and Client ledger; partial payment history; promised dates/disputes; duplicate-reference safeguards; unbilled work visibility | A billable case is identified, invoiced once, partially paid and reconciled; remaining balance/credits/audit stay consistent |
| CRM | Daily follow-up priorities, stale-deal flags, duplicate warnings, persisted targets and scoped forecast; receiving-owner onboarding queue and acceptance | Won opportunity moves to a named receiver, missing information is returned, acceptance and client activation are traceable |
| Client | Action required from you vs waiting on Sapling; analytics-to-candidate drill-down; validated bulk intake preview; batch tracking/reminders; report filtering | Client corrects only its own records, sees accurate stage/rejection reasons and follows a batch through final reports |
| Admin | Actionable oversight of unassigned/overdue work, branch/team comparisons, employee activity drill-down, report/upload/delivery recovery | Admin identifies a bottleneck, opens its underlying scoped work, sees actor/reason/history and takes only authorised management actions |

- Extend existing client correction hotspots, verifier history, Field navigation/offline drafts and Finance payment actions; do not duplicate them under new names.
- Distinguish case owner, check assignee, field assignee, QA claimant and escalation recipient. Assignment is an explicit authorised selection; escalation does not silently redistribute work.
- Model handoff acknowledgement and outstanding responsibility durably, including coverage/reassignment when staff are unavailable.
- Candidate entry can coordinate consent and upload while preserving separate token permissions and proof of consent. Do not derive consent authority from upload possession alone.
- Bulk intake uses preview, validation, duplicate warnings, per-row results and idempotent retry; it does not partially fail without telling the client which rows were saved.
- Add persisted contracts for appointment/collection/onboarding/target features where missing. Define edit rights, version handling and audit events before adding controls.
- Keep financial calculations and existing billing policy authoritative; linking billable work must prevent duplicate charges and preserve adjustments/history.
- QA claim expiry, release and renewal must have consistent server rules. Preserve the prohibition on reviewing one's own verification work.
- Service packages show checks/TAT/price/status and impact on future cases. Branch help explains assignment scope; field-policy help explains actual completion enforcement.
- Every new view has loading, empty, error, restricted, stale and success states plus contextual learning content.

## Phase 8: trustworthy metrics, events and recovery

- Define one contract for checks completed, case stage, final completion, report publication, due date and next responsible party across all workspaces.
- Replace arbitrary overall percentages or label them explicitly; all completed checks do not imply published report or finished QA.
- Derive stage duration from actual transitions. Backfill from valid history and mark unknown historical values rather than guessing.
- Separate document rejection, verification discrepancy, unable-to-verify and QA rework; distinguish event counts from distinct-case counts.
- Implement package SLA breakdown and reason taxonomy from actual records. Show not-recorded where reasons are missing.
- Apply consistent tenant timezone/date boundaries and agreed SLA rules. Do not silently change working-hours, holiday or pause policies.
- Keep task due-date fallback and capacity metrics consistent across queues and dashboard summaries. Do not treat every unknown check type as identity.
- Match every clickable metric to the same filters/date range/permissions as its destination; totals and paginated rows must reconcile.
- Present audit events with actor, action, time, affected entity, before/after and reason. Preserve meaningful role/context snapshots where needed.
- Separate access/download events from business decisions and processing events. A download request does not prove the person read a document.
- Keep employee activity useful for accountability; clicks, open tabs and session duration are not proof of productive working time.
- Show notification queued/sent/failed states with the provider's actual acknowledgement; show delivered only when supported by receipt data.
- Show report/upload job progress, failures and authorised retry. Keep failure records visible when a worker is healthy but individual jobs are failing.
- Gate: reconcile metrics with source records, verify timelines/rework cycles, exercise provider/worker failures and recover without duplicate actions.

## Phase 9: capacity and integrated verification

- Initial synthetic test tiers: 10,000 then 100,000 cases; metadata representing up to 1,000,000 evidence objects. These are test goals, not certified capacity.
- Start mixed workloads at 25 then 100 concurrent active users; calibrate against expected usage and measured infrastructure limits.
- Use bounded representative files up to existing supported limits, with mixed photos/PDFs. Do not upload a million real files or create paid infrastructure for a benchmark implicitly.
- Test list/search/detail activity while uploads, scans and reports run. Measure p95, errors, memory, pool waits, queue lag and storage throughput throughout.
- Initial performance budgets on declared test hardware/network: immediate control feedback around 100 ms; common warm read p95 under 1 s; dashboard p95 under 2 s; normal metadata writes p95 under 2 s.
- These are targets to validate and revise transparently, not promises. File transfer duration depends on bytes/bandwidth; scanning has a separately measured queue/processing budget.
- Check request/memory costs stay bounded by page size and worker concurrency as stored history grows; define the supported capacity envelope from results.
- Test cold login, slow network, browser back/refresh, multi-tab login, session expiry, duplicate clicks, stale versions and API restarts.
- Cover tenant/branch/client isolation, inaccessible originals/previews, token expiry, suspended users, role changes and independent QA.
- Run golden verification, corrections, field exceptions, CRM onboarding and Finance partial-payment journeys against an isolated database.
- Run responsive/visual and accessibility checks with Learning Mode on/off, mouse/keyboard/touch and reduced motion.
- Record provider-specific tests not run because configuration is unavailable. Verify backups/restores and scanner/delivery integrations in the actual target environment before readiness claims.
- Final handoff: changed modules/migrations, measured before/after results, screenshots, role-by-role test guide, environment requirements and known limits.

## Implementation decisions and evidence

- Reuse the configured storage provider; no new paid provider/account is selected in this plan. Signed/resumable transfer implementation depends on that provider.
- Keep current retention and SLA policies unless an authorised setting explicitly changes them. Every policy UI must explain its real effect.
- Do not promise unlimited load or a fixed completion date without capacity measurements and integration results.
- Foundational fixes go first; role features build on the same safe queries, media contract, metric definitions and learning components.
- Record progress against each deliverable during implementation; do not label an unconnected UI or an unrun integration test as complete.

Source anchors: [auth cache](../backend/src/auth/jwt.strategy.ts), [scope composition](../backend/src/dashboards/dashboards.service.ts), [Operations reads](../frontend/src/features/operations/repositories/api-operations.repository.ts), [CRM reads](../frontend/src/features/crm/repositories/api-crm-insights.ts), [object storage](../backend/src/documents/local-object-storage.service.ts), [inspection](../backend/src/documents/document-structure-inspection.ts), [shared toolbar](../frontend/src/components/shell/top-toolbar.tsx), [CI](../.github/workflows/ci.yml).
