# Sapling Global Verification API

NestJS, Fastify, Prisma and SQL Server backend for the Sapling Global verification platform.

## Local start

Requirements: Node.js 24 and SQL Server 2017 or newer. The application database is `Sapling Global`.

1. Create separate SQL logins for migrations and runtime; never commit their passwords.
2. Run `infra/sql/bootstrap.sql` as a SQL administrator after the runtime login exists.
3. Copy `.env.example` to `.env`, set `DB_*`, and create independent JWT, data-encryption and webhook secrets.
4. With the migration identity configured, run:

```powershell
npm install
npm run prisma:generate
npm run prisma:preflight
npm run prisma:deploy
npm run prisma:seed
npm run prisma:verify
```

On a fresh database, preflight reports that there is no application schema yet. For normal runtime, switch `DB_USER` and `DB_PASSWORD` to the least-privileged `sapling_global_app` login, then run `npm run start:dev`.

Swagger is available at `http://localhost:4000/api/docs` outside production. Health checks are `/api/v1/health/live` and `/api/v1/health/ready`.

## Security and production adapters

- Auth uses rotating HttpOnly refresh cookies, forced first-password change, lockout and scoped role permissions.
- Subject PII, outbox secrets and idempotent responses use versioned AES-GCM encryption.
- Production requires private S3/Azure storage, mandatory malware scanning and a signed HTTPS notification webhook.
- OTP/report/background work uses the transactional outbox with retry and recovery visibility.
- Local object storage and development OTP visibility are development-only.

Provision development role accounts with `npm run prisma:dashboard-users` only outside production. Passwords and live credentials are never documented in source control.
