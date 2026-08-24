# EthicsTrack API

NestJS + Prisma + SQL Server backend for the EthicsTrack verification platform.

## Local setup

Requirements: Node.js 24 and a directly installed or managed SQL Server 2017 or newer. Docker is not used by this repository.

The prepared local `.env` uses database name `ethicstrack`, SQL host `localhost`, port `1433` and user `sa`. Replace `CHANGE_ME_SQL_PASSWORD` in both `DATABASE_URL` and `DB_PASSWORD` before running a migration. The file is intentionally excluded from source archives.

1. Start SQL Server and confirm TCP access on the configured host and port.
2. Execute `infra/sql/bootstrap.sql` as a SQL administrator. Change every example password first.
3. Copy `.env.example` to `.env` and set two independent 32+ character JWT secrets.
4. Use a migration identity with schema privileges for deployment:

```powershell
npm install
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

5. Switch `DATABASE_URL` and `DB_*` to the least-privileged `ethicstrack_app` login for normal runtime. Redis is not required by the current application.

Swagger is available at `http://localhost:4000/api/docs` outside production. Readiness and liveness are at `/api/v1/health/ready` and `/api/v1/health/live`.

## Development seed

Workspace code: `ETHICS`. Default password: `EthicsTrack@2026` unless `SEED_ADMIN_PASSWORD` is set.

- `admin@ethicstrack.local` — platform admin
- `ops@ethicstrack.local` — operations manager
- `verifier@ethicstrack.local` — verifier
- `qa@ethicstrack.local` — QA reviewer
- `field@ethicstrack.local` — field executive
- `client@acme.local` — client-scoped admin

These accounts are for local development only. Change or remove them before any shared environment.

## Implemented API surface

- `/auth` — login, refresh rotation, logout and session profile
- `/clients` — tenant/client-scoped list and create
- `/cases` — cursor list, Case 360, create and guarded state transitions
- `/public/consents` — consent notice and throttled OTP confirmation
- `/documents` — versioned PDF/image upload, type/signature inspection and safe download
- `/tasks` — verifier queue, assignment, optimistic update, findings and outcomes
- `/clarifications` — internal thread plus hashed one-time candidate response token
- `/qa` — QA queue, rework or approval; approval queues report generation
- `/reports` — PDF generation, versions, SHA-256, download and public authenticity check
- `/field-visits` — assignments, evidence, fresh GPS, accuracy rules and server geofence decision
- `/dashboards` — operations and executive aggregates
- `/audit-events` — cursor-paginated audit history

## Production adapters still required

The interfaces and workflow are present, but production deployment must configure:

- S3/Azure private object storage instead of the development local-disk adapter
- a full malware scanner (development performs MIME/magic checks and EICAR rejection)
- SMS/email workers consuming the transactional outbox
- Unicode report fonts or an HTML-to-PDF worker for non-Latin names
- centralized logs, metrics, traces, backups and secret manager

Do not mark a deployment production-ready until SQL Server integration tests, object storage, messaging and disaster recovery have been verified in its target environment.
