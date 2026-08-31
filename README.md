# Sapling Global Verification Platform

Production-oriented, consent-first background-verification platform. Every business workspace reads and writes through the API; the repository contains no customer-facing placeholder datasets.

## Architecture

- Web: React 19, TanStack Start/Router/Query, TypeScript and Tailwind CSS.
- API: NestJS 11 on Fastify, cookie-based JWT sessions and permission guards.
- Data: Prisma 7 with SQL Server database `Sapling Global`.
- Files: private AWS S3, Azure Blob or development-only local storage.
- Security: tenant/client scope, optimistic concurrency, idempotent writes, AES-256-GCM subject PII, ClamAV integration, append-only audit events enforced for the runtime SQL identity, rotating refresh-token families and self-service device revocation.
- Reliability: transactional outbox, automatic report generation, notification webhook delivery, retention worker and readiness checks.

## Workspaces

Operations Control Tower, Case 360, Exceptions, Verifier, QA, Field Executive, Client Portal, Candidate Portal, Executive, Sales CRM, Finance, Platform Settings and Account Security are connected to persisted APIs. Settings includes branches, service packages, clients, users, roles, field policy and audit history; Finance includes audited invoice PDF downloads.

## Local setup

```powershell
npm install
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
npm run --workspace backend prisma:generate
npm run --workspace backend prisma:deploy
npm run --workspace backend prisma:seed
npm run dev:backend
npm run dev:frontend
```

Default local endpoints are web `http://localhost:8080`, API `http://localhost:4000/api/v1`, readiness `http://localhost:4000/api/v1/health/ready`, and non-production Swagger `http://localhost:4000/api/docs`.

The browser defaults to `VITE_API_URL=/api/v1`; the Vite development server proxies that path to `VITE_DEV_API_TARGET`. Use the same reverse-proxy pattern in production where possible. Authentication cookies are `SameSite=Strict`, so an absolute API URL must be HTTPS and same-site with the web application; a cross-site frontend/API deployment is unsupported. Keep `PUBLIC_API_ORIGIN` blank for the same-origin pattern. If the API has a separate public origin, set it to that canonical HTTPS origin (scheme, host and optional port only) so server-generated links and exports do not use an internal address. Configure `TRUST_PROXY` only for the exact trusted ingress hops or CIDRs.

The first seed requires `SEED_ADMIN_EMAIL` and a private `SEED_ADMIN_PASSWORD` with at least 7 characters, including uppercase, lowercase, number and special character; `SEED_ADMIN_NAME` is optional. Later seed runs synchronize system roles, permissions, field policy and the standard service package without changing the existing administrator password. A password reset occurs only when `SEED_RESET_ADMIN_PASSWORD=true` is explicitly supplied. If a database contains multiple legacy tenants, set `SEED_TENANT_CODE` to the one being rebranded. Never commit these values.

Use separate SQL identities for release work and application traffic. The controlled migration/fixture identity performs migrations, seeding, verification, encryption backfill and disposable-test cleanup. The runtime identity receives schema data access but no schema control; `backend/infra/sql/bootstrap.sql` also denies it `UPDATE` and `DELETE` on `AuditEvent`, preserving append-only audit history. Never give migration or fixture credentials to the running API.

## Quality gates

```powershell
npm run --workspace frontend typecheck
npm run --workspace frontend lint
npm run --workspace frontend build
npm run --workspace backend prisma:validate
npm run --workspace backend prisma:preflight
npm run --workspace backend lint
npm run --workspace backend build
npm run --workspace backend test
npm run --workspace backend test:integration
npm run --workspace backend prisma:verify
npm run test:e2e
npm run audit:production
```

Authenticated browser tests require `E2E_BASE_URL`, `E2E_TENANT_CODE`, `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`. For isolated non-production release checks, `prisma:e2e-fixture` can create/delete a reserved `@e2e.invalid` administrator; set `E2E_ADMIN_MUST_CHANGE_PASSWORD=true` for the forced-password flow. The utility refuses production mode and any non-reserved email domain.

The write-path release check is `frontend/e2e/golden-flow.spec.ts`. It requires `E2E_GOLDEN_FLOW=true`, `E2E_GOLDEN_ISOLATED=true`, a unique 6-20 character `E2E_GOLDEN_RUN_ID` and a loopback `E2E_API_URL`. Run it only against a disposable database and local object store with `NODE_ENV=development`; it intentionally consumes the development-only consent OTP and is not a staging or production smoke test. The spec suspends its random-password Verifier and QA accounts in `finally`. Then execute `prisma:golden-cleanup` with the same run ID using the migration/fixture database identity, not the append-only runtime identity. Cleanup verifies `AuditEvent` delete permission and removes the run-specific `GF...` client, cases, users, audit/outbox/idempotency records and objects before the fixture administrator is deleted. Destroy the disposable environment afterward.

`audit:production` checks the exact runtime dependency classes shipped by the container. The Prisma migration CLI is development/release tooling and is excluded from the runtime image. Run the full `npm audit` as a separate CI gate.

## Production release

The backend production environment validator rejects insecure cookies, HTTP web origins, local object storage, unverified SQL certificates, optional malware scanning and missing notification delivery. Passing that validator does not prove an internet deployment. Follow [docs/PRODUCTION_RUNBOOK.md](docs/PRODUCTION_RUNBOOK.md) for migration, key rotation, provider, backup, retention-policy, monitoring and rollback gates.

Current implementation evidence and remaining environment-dependent verification are recorded in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).
