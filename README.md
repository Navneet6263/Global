# Sapling Global Verification Platform

Production-oriented, consent-first background-verification platform. Every business workspace reads and writes through the API; the repository contains no customer-facing placeholder datasets.

## Architecture

- Web: React 19, TanStack Start/Router/Query, TypeScript and Tailwind CSS.
- API: NestJS 11 on Fastify, cookie-based JWT sessions and permission guards.
- Data: Prisma 7 with SQL Server database `Sapling Global`.
- Files: private AWS S3, Azure Blob or development-only local storage.
- Security: tenant/client scope, optimistic concurrency, idempotent writes, AES-256-GCM subject PII, ClamAV integration, immutable audit events, rotating refresh-token families and self-service device revocation.
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

Default local endpoints are web `http://localhost:3000`, API `http://localhost:4000/api/v1`, readiness `http://localhost:4000/api/v1/health/ready`, and non-production Swagger `http://localhost:4000/api/docs`.

The first seed requires `SEED_ADMIN_EMAIL` and a private 14+ character `SEED_ADMIN_PASSWORD`; `SEED_ADMIN_NAME` is optional. Later seed runs synchronize system roles, permissions, field policy and the standard service package without changing the existing administrator password. A password reset occurs only when `SEED_RESET_ADMIN_PASSWORD=true` is explicitly supplied. If a database contains multiple legacy tenants, set `SEED_TENANT_CODE` to the one being rebranded. Never commit these values.

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

The write-path release check is `frontend/e2e/golden-flow.spec.ts`. It additionally requires `E2E_GOLDEN_FLOW=true`, a unique 6-20 character `E2E_GOLDEN_RUN_ID` and `E2E_API_URL`. Run it only outside production, then execute `prisma:golden-cleanup` with the same run ID before deleting the temporary administrator. Cleanup is restricted to the run-specific `GF...` client, cases, objects, outbox/idempotency records and refuses production mode.

`audit:production` checks the exact runtime dependency classes shipped by the container. The Prisma migration CLI is development/release tooling and is excluded from the runtime image. Run the full `npm audit` as a separate CI gate; any upstream development-tool advisory and its remediation status must remain visible in `IMPLEMENTATION_STATUS.md` until cleared.

## Production release

The backend production environment validator rejects insecure cookies, HTTP web origins, local object storage, unverified SQL certificates, optional malware scanning and missing notification delivery. Follow [docs/PRODUCTION_RUNBOOK.md](docs/PRODUCTION_RUNBOOK.md) for migration, container, backup, monitoring and rollback gates.

Current implementation evidence and remaining environment-dependent verification are recorded in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).
