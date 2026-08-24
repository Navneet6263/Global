# Sapling Global production runbook

This runbook is the release gate for the verification platform. Production is the HTTPS web application, the Node API, SQL Server, private object storage, ClamAV and a notification-provider webhook.

## Required managed services

- SQL Server with encrypted transport, a private endpoint and automated point-in-time backups.
- Private AWS S3 or Azure Blob container. Public access must be disabled; the API identity receives object read/write only for its bucket/container.
- ClamAV reachable only from the API network.
- Email/SMS provider exposed through `NOTIFICATION_WEBHOOK_URL` and honoring the `Idempotency-Key` header.
- Central log collection for stdout/stderr with alerts on HTTP 5xx, failed health checks and `OutboxWorkerService` errors.

## Release sequence

1. Create independent 32+ character values for access JWT, refresh JWT and `DATA_ENCRYPTION_KEY` in the deployment secret manager.
2. Configure `backend/.env.production` from `.env.example`. Set `NODE_ENV=production`, HTTPS `WEB_ORIGIN`, `COOKIE_SECURE=true`, verified SQL certificates, private cloud storage and mandatory malware scanning.
3. Back up SQL Server and verify the backup can be restored to an isolated database.
4. Run `npm run audit:production`, `npm run --workspace backend prisma:preflight`, the unit suite and `npm run --workspace backend test:integration` against the isolated release database.
5. Execute `npm run --workspace backend prisma:deploy` once from a separately controlled migration job containing the Prisma CLI. The runtime image intentionally excludes development and optional CLI dependencies.
6. Seed the first installation, or run the idempotent seed after role/reference-data changes. Never place seed administrator credentials in an image or source control; remove them from the job environment immediately afterward.
7. Run `npm run --workspace backend prisma:verify`. Migration and verification jobs should set `OUTBOX_WORKER_ENABLED=false` and `RETENTION_WORKER_ENABLED=false` if they share the API image.
8. Start the API and wait for `GET /api/v1/health/ready` to return HTTP 200.
9. Deploy the frontend build with `VITE_API_URL` pointing to the public HTTPS API, or reverse-proxy `/api/v1` to the API.
10. Run the authenticated Playwright suite against the deployed environment; it verifies every operational workspace, serious/critical WCAG rules, session refresh and logout revocation.
11. In staging only, run `golden-flow.spec.ts` with a fresh `E2E_GOLDEN_RUN_ID` to verify the full persisted case-to-report mutation path. In a finally/cleanup step, run `prisma:golden-cleanup` with that same ID and then delete the reserved `@e2e.invalid` administrator. Both fixture utilities refuse production mode.

## Container build

```powershell
docker build -f backend/Dockerfile -t sapling-global-verification-api:release .
docker run --rm --env-file backend/.env.production -p 4000:4000 sapling-global-verification-api:release
```

The example Compose file applies a read-only filesystem, drops Linux capabilities and runs as the unprivileged Node user. Local object storage is intentionally rejected by production environment validation.

## Backup and recovery gate

- SQL: daily full backup, frequent differential/log backups, encrypted cross-region copy and quarterly restore drill.
- Objects: enable versioning, server-side encryption, retention/lifecycle rules and cross-region replication appropriate to the contract.
- Keys: keep previous data-encryption key material during any rotation until all encrypted rows/outbox messages are re-encrypted.
- Recovery drill: restore SQL and objects into an isolated network, deploy the same application release, verify a report hash and document download, then destroy the drill environment.

## Monitoring and alerts

- Alert when readiness fails twice, 5xx rate exceeds the agreed threshold, login lockouts spike, or outbox events reach `FAILED`.
- Scrub cookies, authorization headers, OTPs, document bodies and candidate contact values at the collector.
- Keep audit events according to the compliance retention schedule and restrict the Audit UI to authorized roles.

## Rollback

Application releases may roll back only when their database migration is backward compatible. Never automatically reverse a migration containing customer data. If a migration fails, stop the release, restore the verified backup when required and document the incident before retrying.
