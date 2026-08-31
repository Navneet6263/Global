# Sapling Global implementation status

_Evidence snapshot: 27 August 2026. "Verified" below means this repository and the currently configured SQL Server, not an internet production deployment._

## Implemented in code

- API-backed, permission-scoped workspaces for Platform Admin, Operations, Client Admin, Candidate, Verifier, QA, Field Executive, Sales CRM and Finance; business screens do not depend on bundled mock repositories.
- Persisted case intake and Case 360 covering consent, candidate access, documents, verification tasks, clarifications, field visits, QA history, reports and audit history.
- Persisted CRM, invoices/payments/credit notes, settings, users/roles, notifications and executive analytics with audited exports and scheduled delivery.
- HttpOnly rotating sessions, immediate revocation, refresh-token reuse detection, lockout, forced first-login password change, role/client/branch scope enforcement and idempotent writes.
- AES-256-GCM protection for subject contact/employee data, idempotency responses and sensitive queued payloads, including a compare-and-swap legacy plaintext backfill/key-rotation utility.
- AES-GCM encrypted, account-isolated Field and Verifier IndexedDB drafts with expiry; the offline navigation shell exposes only draft counts and no candidate data.
- Private S3/Azure adapters, development-only local storage, malware scanning integration, immutable object keys, retrying outbox delivery and versioned report/invoice PDFs.
- Field-evidence retention with transactional database cleanup, retryable object deletion, worker health reporting and Platform Admin failure review/requeue.
- SQL runtime-role bootstrap with schema data access but no schema control and explicit `AuditEvent` update/delete denial.
- Production environment validation, container definition and SQL-backed CI release workflow are present in the repository.

## Verified in the current environment

- Prisma client generation and schema validation passed.
- All 14 repository migrations are applied to the configured `Sapling Global` SQL Server.
- Deployment verification passed for tenant `SAPLING`, eight required roles, 15 users, two active platform administrators and access to nine persisted feature checks.
- Data-key rotation/backfill completed with zero legacy plaintext subjects, zero outdated subject ciphertext, zero outdated idempotency responses and zero pending outbox secrets requiring rotation in that run.
- Backend build and ESLint passed; backend unit/security suite passed 114/114.
- Rollback-based SQL integration suite passed 1/1 after the current role and clarification-readiness changes.
- Frontend TypeScript and production build passed. Encrypted offline-draft browser tests passed 2/2 and offline relaunch-shell coverage passed 1/1.
- Current full dependency audit and production-runtime audit report zero known vulnerabilities.

The final full frontend formatting/lint gate and the freshly added seven-role authenticated browser rerun were still in progress at this snapshot. Earlier workspace counts and timing results are intentionally not carried forward as release evidence.

## Not yet an internet production release

- No public HTTPS deployment has been completed or verified from this workstation.
- Real S3/Azure credentials, ClamAV, notification delivery, DNS-based SQL certificate identity, secret-manager injection, centralized monitoring and alert routing still require target-environment configuration and provider tests.
- Backup/restore, object recovery, load, real-device GPS/camera, accessibility assistive-technology and independent security exercises must run against the exact release artifact and infrastructure.
- The application currently automates the configured field-evidence/location retention window. Broader candidate, document, report, finance and audit schedules - and every legal-hold exception - require approved business/legal policy before additional deletion automation is enabled.
- Cloud object versioning does not itself prove erasure: lifecycle rules must explicitly address noncurrent versions and delete markers while preserving any approved legal hold.
- A successful GitHub CI run, container scan, staging role flows and controlled production change/rollback approval remain release gates.

Follow [docs/PRODUCTION_RUNBOOK.md](docs/PRODUCTION_RUNBOOK.md); code completion or local SQL validation must not be presented as a live production deployment.
