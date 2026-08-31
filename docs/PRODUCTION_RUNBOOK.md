# Sapling Global production runbook

This runbook is the release gate for the verification platform. Production is the HTTPS web application, the Node API, SQL Server, private object storage, ClamAV and a notification-provider webhook.

## Required managed services

- SQL Server with encrypted transport, a private endpoint and automated point-in-time backups.
- Private AWS S3 or Azure Blob container. Public access must be disabled; the API identity receives object read/write only for its bucket/container.
- ClamAV reachable only from the API network.
- Email/SMS provider exposed through `NOTIFICATION_WEBHOOK_URL` and honoring the `Idempotency-Key` header.
- Central log collection for stdout/stderr with alerts on HTTP 5xx, failed health checks and `OutboxWorkerService` errors.

## Trust boundaries and identities

- Prefer a same-origin `/api/v1` reverse proxy. Session cookies are `SameSite=Strict`; if the browser calls a separate API origin, it must be HTTPS and same-site with the web application. Cross-site frontend/API hosting is unsupported.
- Set `WEB_ORIGIN` to the exact browser origin. Leave `PUBLIC_API_ORIGIN` blank for same-origin hosting; otherwise set it to the API's canonical public HTTPS origin, without credentials, a path, query or fragment. Trust only the known ingress hops/CIDRs through `TRUST_PROXY`.
- Use one short-lived, controlled migration/fixture SQL identity for deploy, seed, verification, encryption backfill and disposable-fixture cleanup. Use a different runtime identity for the API. `backend/infra/sql/bootstrap.sql` denies the runtime identity schema control and `AuditEvent` update/delete; never add it to `db_owner` or `db_datawriter`, and never expose the release identity to the running API.

## Release sequence

1. Create independent 32+ character values for access JWT, refresh JWT and `DATA_ENCRYPTION_KEY` in the deployment secret manager.
2. Configure `backend/.env.production` from `.env.example`. Set `NODE_ENV=production`, HTTPS origins, `COOKIE_SECURE=true`, verified SQL certificates, private cloud storage and mandatory malware scanning. Use same-origin `/api/v1` unless an explicitly tested same-site API origin is required.
3. Back up SQL Server and verify the backup can be restored to an isolated database.
4. Run `npm run audit:production`, `npm run --workspace backend prisma:preflight`, the unit suite and `npm run --workspace backend test:integration` against the isolated release database.
5. Execute `npm run --workspace backend prisma:deploy` once from the controlled migration identity in a separately controlled job containing the Prisma CLI. The runtime image intentionally excludes development and optional CLI dependencies.
6. Seed the first installation, or run the idempotent seed after role/reference-data changes. Never place seed administrator credentials in an image or source control; remove them from the job environment immediately afterward.
7. Run `npm run --workspace backend prisma:verify`. Migration and verification jobs should set `OUTBOX_WORKER_ENABLED=false` and `RETENTION_WORKER_ENABLED=false` if they share the API image.
8. Start the API and wait for `GET /api/v1/health/ready` to return HTTP 200.
9. Deploy the frontend with `VITE_API_URL=/api/v1` behind the preferred reverse proxy. If an absolute API URL is used, verify HTTPS, same-site cookie behavior, exact CORS origin and `PUBLIC_API_ORIGIN` before continuing.
10. Run the authenticated Playwright suite against the deployed environment; it verifies every operational workspace, serious/critical WCAG rules, session refresh and logout revocation.
11. Do not run the write-path golden flow against staging or production. Restore the release backup into a disposable E2E database, start the API on loopback with `NODE_ENV=development`, local disposable object storage and delivery workers enabled, then run `golden-flow.spec.ts` with `E2E_GOLDEN_FLOW=true`, `E2E_GOLDEN_ISOLATED=true` and a fresh `E2E_GOLDEN_RUN_ID`. This isolation is mandatory because the flow consumes the development-only consent OTP returned by the API. After the test, run `prisma:golden-cleanup` with the same run ID and then delete the reserved `@e2e.invalid` administrator. Cleanup must use the migration/fixture database identity: the runtime identity keeps `AuditEvent` append-only and cannot perform fixture deletion. The cleanup script verifies `AuditEvent` delete permission, commits database cleanup before best-effort object deletion and reports any object keys that still require removal. Destroy the disposable database and object store after verification.

## Container build

```powershell
docker build -f backend/Dockerfile -t sapling-global-verification-api:release .
docker run --rm --env-file backend/.env.production -p 4000:4000 sapling-global-verification-api:release
```

The example Compose file applies a read-only filesystem, drops Linux capabilities and runs as the unprivileged Node user. Local object storage is intentionally rejected by production environment validation.

## Backup and recovery gate

- SQL: daily full backup, frequent differential/log backups, encrypted cross-region copy and quarterly restore drill.
- Objects: enable versioning, server-side encryption and replication appropriate to the contract. Configure lifecycle rules for noncurrent versions, incomplete uploads and delete markers; an application delete may otherwise leave recoverable versions. Reconcile failed `object.delete.requested` work through the Platform Admin recovery queue and provider inventory.
- Retention/legal hold: obtain an approved schedule by record type and jurisdiction before configuring destructive lifecycle rules. Current application automation covers the configured field evidence/location window only. Do not infer deletion rules for candidate, document, report, finance or audit data, and do not purge any object or row subject to a legal hold.
- Keys: introduce the new `DATA_ENCRYPTION_KEY_VERSION` while retaining the old version/key in `DATA_ENCRYPTION_PREVIOUS_KEYS`, then deploy all instances with both. Run `npm run --workspace backend prisma:rotate-data-key` under the controlled release identity; it seals legacy plaintext and rotates subject/idempotency/pending-secret data. Do not remove a previous key until the command succeeds, pending/retry outbox secrets are drained or confirmed re-encrypted, all instances use the new active version and the rollback window has closed.
- Recovery drill: restore SQL and objects into an isolated network, deploy the same application release, verify a report hash and document download, then destroy the drill environment.

## Monitoring and alerts

- Alert when readiness fails twice, 5xx rate exceeds the agreed threshold, login lockouts spike, or outbox events reach `FAILED`.
- Scrub cookies, authorization headers, OTPs, document bodies and candidate contact values at the collector.
- Keep audit events according to the approved compliance schedule and restrict the Audit UI to authorized roles. Any approved audit retention/redaction job must use a controlled identity; the API runtime identity is deliberately append-only.

## Rollback

Application releases may roll back only when their database migration is backward compatible. Never automatically reverse a migration containing customer data. If a migration fails, stop the release, restore the verified backup when required and document the incident before retrying.
