# Upgrade verification record

9 September 2026. Results for this local working-tree implementation; not a claim that UAT has been redeployed or that all documented requirements are complete.

## Executed checks

| Check | Result and boundary |
| --- | --- |
| Backend full unit suite | 267 passed, 0 failed. Includes scoping, stale writes, independence, payments, document/method gates, statements, privacy and report pagination. |
| Frontend full unit suite | 22 passed, 0 failed. Includes session isolation, CSV validation, selected-client reset/TAT, services and truthful status mapping. |
| Browser regressions | 10 passed: page Help/learning mode, login keyboard/accessibility/mobile layout, QA view/reservation controls exact-version source response UI, Coming soon provider messaging and paginated source-contact recording. Workflow APIs use isolated test fixtures; these are not live all-role API E2E tests. |
| Backend TypeScript and Nest build | Passed, including test-source type checking. |
| Frontend TypeScript and production build | Passed. Final output preset is `node-server`, compatible with the existing Ubuntu/PM2 entry. |
| Backend and frontend lint | Passed with no errors or warnings. |
| Production frontend runtime smoke | Passed: actual built Node entry responds to `/auth` with HTTP 200, sign-in HTML, no-store and security headers. Runs on an ephemeral loopback port and stops its own child in `finally`. No backend or DB required. |
| Nest application dependency graph | Passed using compiled output with Prisma substituted. No application initialization, database connection, HTTP listener or workers. |
| Prisma schema validation | Passed. |
| Shared-DB preflight / migration status / deployment verification | Passed. All 21 migration directories applied; 22 table/field probes succeeded. |
| Authored-file whitespace and size checks | Passed. New authored code files are at most 300 lines; generated Prisma output is excluded from this coding limit. |

Unit runners needed child-process permission outside the restricted sandbox. Initial `spawn EPERM` was a runner restriction, not 68 independent application failures. Intentional negative worker/provider tests can print warning/error logs while the assertions pass.

## Real SQL rollback integration runs

Each test used a synthetic tenant inside a transaction that always rolls back, followed by verification that its tenant count is zero. No real candidate/client/invoice/payment records were edited. PDFs/object content stayed in memory; outbox/notification rows never committed and no worker/provider delivery was started.

- [Intake and source workflow](../backend/test/intake-source.rollback.integration.ts): actual two-service intake/service/check rows; encrypted OTP and consent confirmation/receipt queue; inspected PDF uploads and reviews; start prerequisites; bulk assignment; all three source methods; exact evidence version and ownership checks; corrected upload invalidation; public clarification response, resolution and re-verification; completion to QA and role-correct notifications.
- [Approval, billing and release](../backend/test/delivery-workflow.rollback.integration.ts): QA -> independent manager -> immutable preparation -> report-bound invoice -> partial/full payment -> client download -> controlled reopening/supersession. Covers tampered invoice rejection, scoping and case activity. Actual SQL cursor checks include different timestamp fractions within one millisecond and equal-timestamp UUID ties.
- [Privacy tracking](../backend/test/privacy-tracking.rollback.integration.ts): actual request/incident creation, controlled decisions, audit/history and tenant isolation. Does not execute erasure, containment or notifications.

- [Commercial/source controls](../backend/test/commercial-source.rollback.integration.ts): actual assisted allocation, independently approved proposal -> send/accept -> PDF, follow-up sequence completion, inspected private originals and independent latest-file review, activation policy, Finance intake hold, source-contact history, retention holds and vendor-authority lifecycle. It verifies stale/foreign/self-approval rejection and zero committed synthetic records. Nested service failures use SQL savepoints so negative paths roll back inside the outer rollback test.

## Database and data safety

The user approved the shared local/UAT database. Applied additive migrations:

1. `20260908180000_controlled_delivery_workflow`
2. `20260908190000_report_superseded_state`
3. `20260908203000_privacy_tracking`
4. `20260909120000_commercial_source_controls`

No reset/seed, live-account provisioning, manual existing-case workflow backfill, payment recording or data deletion was performed. Old published workflow-v1 reports remain readable. A pending legacy report is not silently reclassified as paid or repaired by the migration.

The new commercial migration initially failed during SQL Server batch binding of a constraint on a newly added column. A read-only system-catalog check confirmed that none of its columns/tables had applied (zero applied steps). The two new-column constraints were changed to compile through `sp_executesql`; only that failed migration was marked rolled back using the [Prisma failed-migration recovery procedure](https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing), then deployed and verified successfully. No historical successful migration was edited and no schema reset was used.

The SQL connection emitted the existing IP-address TLS ServerName deprecation warning. Successful checks do not establish production TLS configuration correctness; use a matching DNS/certificate configuration during infrastructure hardening.

## Runtime and performance findings

- Production smoke testing caught `TypeError: __exportAll is not a function` despite a successful bundle. Nitro's second pass had grouped Vite's prebundled runtime helper into application chunks that imported each other. The build now isolates that leaf helper and uses the public typed TanStack server handler, preserving error normalization and security headers. No generated bundle was manually patched.
- Final build uses Node-server by default; an explicit `NITRO_PRESET` can still select another supported target for a different deployment. Do not run a Cloudflare-module artifact with PM2.
- Source readiness batches Prisma delegate reads. A regression asserts the same maximum of three delegate calls for one versus 84 method checks. This is not a measured claim that every SQL query or API completes within a particular latency.
- Activity uses server-side cursor pagination and SQL resource links rather than collecting all photo/document IDs into browser memory. Exact SQL timestamp precision is preserved.
- Browser Help layout test now waits for the slide-in animation and rejects real overflow while allowing tiny floating-point coordinate noise. UI dimensions were not changed to conceal a test failure.

- New source history uses server pagination; proposals/originals use bounded revision histories; credit and privacy lists query paginated real data. These bounds are explicit, not a promise of unlimited volume.
- A public keyboard test initially raced the intentionally absent backend's anonymous-session request while Sign in was disabled. The test now provides a fixed anonymous-session response and waits for enabled controls before asserting Tab order; the complete 10-test browser run passed. No login form styling or permissions were weakened.

## Deployment and remaining validation

No Git push, UAT process restart or server deployment was performed. Local and UAT share a DB, so upgrade frontend, backend and all workers together before testing new cases; old workers do not understand the new release lifecycle. Do not enable real delivery until provider configuration and intended recipients have been verified.

Still required: representative human review of each service's report, full multi-role browser UAT, real SMTP/SMS/provider/scanner checks, realistic concurrent file/upload/export testing, and backup/restore/retention validation. Several business capabilities remain partial or absent, not merely unconfigured: see [the full status register](workflow-upgrade-status.md). Successful checks are not a security/compliance certification or an unlimited-scale guarantee.
