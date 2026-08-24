# Sapling Global implementation status

## Implemented in code

- Live role-filtered workspaces for Operations, Exceptions, Client, Candidate, Verifier, QA, Field, Executive, Sales, Finance, Settings and Account Security.
- Case 360 with consent, candidate access, documents, verification assignment, findings, clarifications, field visits, QA history and versioned reports.
- SQL Server persistence for clients, cases, users/roles, settings, CRM opportunities, invoices/payments, notifications and audit events.
- Secure public flows using expiring hashed tokens or OTPs for candidate access, clarifications, consent and report authenticity.
- Field workflow with IndexedDB queue, installable offline app shell, fresh GPS policy, geofence decisions, evidence hashing, exception approval/retry and retention enforcement.
- Fastify API hardening: Helmet, strict CORS/origin checks, request IDs, allow-list DTO validation, throttling, problem details and redacted production request logs.
- Warm configurable SQL connection pooling, bounded connection/request/interactive-transaction timeouts, transient read retry and explicit service-unavailable responses prevent slow or unavailable database connections from surfacing as unexplained internal errors.
- HttpOnly sessions with rotation, database-backed immediate revocation, refresh-token reuse detection, account lockout and forced first-login password change.
- Self-service active-device visibility, current/other-session revocation and audited password controls.
- AES-256-GCM encryption for new candidate email/phone/employee-code data with a legacy-row compatibility path.
- Canonical Base64URL enforcement prevents alternate encodings of authenticated encrypted payloads from being accepted.
- Private S3/Azure storage adapters, ClamAV scanning, transactional outbox retry/recovery, notification webhooks and automatic signed report generation.
- Idempotency enforcement for authenticated writes and optimistic concurrency on mutable business records.
- Idempotency keys are bound to the concrete resource path, actor and canonical payload, preventing cross-resource or cross-user replay.
- Immutable document, evidence and report object keys across local, S3 and Azure adapters, with compare-and-swap document versioning and unreferenced-object cleanup on failed persistence.
- Retention removes database evidence transactionally and dispatches retryable object-deletion work through the outbox instead of creating a file/database split-brain window.
- User administration preserves suspended accounts for reactivation, rejects client-administrator assignments without a client and prevents removal of the tenant's last active platform administrator.
- Server-rendered, audited invoice PDFs plus versioned verification report PDFs.
- Container definition, production environment gates and release/backup/rollback runbook.

## Verified on this workstation

- Frontend TypeScript: zero errors.
- Frontend ESLint: zero errors and zero warnings.
- Frontend production client/SSR/worker build: passed.
- Backend Nest build and ESLint: passed.
- Compiled NestJS/Fastify API boot: passed against the configured Sapling Global SQL Server with background workers disabled for the release check; `/api/v1/health/ready` returned HTTP 200 with `database: up`.
- Prisma schema validation and client generation: passed.
- Backend unit/security tests: 22/22 passing, including production environment gates, bounded database transaction settings, retry policy, forced-password authorization, immutable local object storage and cryptographic encoding checks.
- Rollback-based live SQL integration: passed for tenant isolation, client-bound access, candidate-link token binding and clarification-link token binding; no fixture rows remained.
- Production-runtime dependency audit: zero known vulnerabilities. The full development-tool audit currently reports three high findings from one upstream `deepmerge-ts` advisory pinned by the latest Prisma 7.9.1 CLI; the affected Prisma CLI/config packages are excluded from the runtime image. The audit-recommended forced downgrade to Prisma 6.12 is incompatible and was not applied.
- Playwright Chromium coverage passed for all 11 authenticated workspaces against real APIs with zero 5xx responses and zero serious/critical WCAG violations; session refresh/logout revocation, forced first-login password replacement, public-page security headers, keyboard order and 360px mobile overflow also passed.
- Managed live write-path verification passed in 3.6 minutes from user create/suspend/list/reactivate and invalid client-admin rejection through client/case creation, consent OTP acceptance, document inspection/immutable storage, clarification response, verifier block/resume/completion, automatic QA transition, QA approval, versioned PDF generation/download and public SHA-256 authenticity verification. Idempotent replay was asserted, and all uniquely scoped database rows, two stored objects and the temporary administrator were deleted afterward.
- SQL Server migration `20260820160000_business_modules`: applied successfully to `Sapling Global`; migration status is current and schema diff reports no difference.
- Reference data: synchronized without resetting the existing administrator password. Post-cleanup deployment verification passed for tenant `SAPLING`, eight system roles, six baseline users, one platform administrator and persisted-table access.

## Environment-dependent release gates

The code and configured SQL Server are synchronized. Before live traffic:

1. Take and restore-verify a SQL Server backup for the target environment, then run the documented preflight/deploy/verify release sequence.
2. Configure real S3/Azure, ClamAV, HTTPS certificates, notification webhook, DNS-based SQL certificate identity and independent secrets through the deployment secret manager.
3. Repeat the proven authenticated Playwright and rollback-based database integration suites against the exact migrated staging release using private credentials.
4. Perform keyboard/screen-reader, mobile-device GPS/camera, load, backup/restore and independent security review in the target infrastructure.
5. Build and scan the container in CI (Docker is not installed on this workstation), enable centralized logs/alerts, then complete the controlled production release from the same tested artifact.
6. Keep the full development-tool audit gated in CI and upgrade Prisma as soon as its config package adopts patched `deepmerge-ts`; continue requiring a zero-vulnerability production-runtime audit for every artifact.

Code completion does not substitute for these infrastructure checks; the release runbook treats them as mandatory gates.
