# Sapling Global Verification Platform

## Developer handover

This is the primary repository guide: use it to locate screens, API logic, database definitions, tests and deployment configuration.

The frontend uses **React, TypeScript, TanStack Start/Router/Query, Vite and Tailwind CSS**. It is not a Next.js application. The backend uses **NestJS, Fastify, Prisma and Microsoft SQL Server**. The root npm workspace manages both applications.

## Repository layout

```text
TrustLink-Verifications/
├── frontend/                 Web application and browser tests
├── backend/                  API, database schema, migrations and backend tests
├── docs/                     Workflow references, troubleshooting and release procedures
├── scripts/                  Repository-level dependency audit and CI helpers
├── .github/workflows/ci.yml  Automated build, test and release checks
├── package.json              Workspace definitions and shared commands
├── package-lock.json         Locked dependency versions for both applications
├── compose.production.example.yml  Example API container configuration
└── README.md                 Main developer guide
```

## Frontend: where to find things

All application code is under `frontend/src/`.

| Location | Purpose |
| --- | --- |
| `routes/` | File-based page routes, URL parameters, page-level queries and workspace access checks. |
| `routes/__root.tsx` | Root document, global providers, metadata, favicon links and shared error screens. |
| `router.tsx` | Router creation and shared routing configuration. |
| `routeTree.gen.ts` | Router-generated route map; do not edit manually. |
| `server.ts`, `start.ts` | Server-rendering entry point, response handling and application startup configuration. |
| `features/` | Feature-specific screens, components, hooks, contracts and repositories. |
| `components/ui/` | Shared interface primitives: buttons, dialogs, inputs, tabs and other reusable controls. |
| `components/layout/`, `components/shell/`, `components/navigation/` | Page layout, application frame and navigation components. |
| `components/feedback/` | Loading states, empty/error views, status badges and interaction feedback. |
| `components/charts/`, `components/dashboards/` | Shared chart and dashboard components. |
| `components/candidate/`, `components/field/`, `components/ops/` | Reusable components for candidate, field and operations workflows. |
| `components/brand/` | Application logo and brand components. |
| `components/pwa/` | Service-worker registration and install/offline interface components. |
| `config/navigation*.ts` | Sidebar entries, groups and role-specific navigation. |
| `config/roles.ts`, `config/permissions.ts` | Frontend role and permission definitions. The API remains responsible for enforcing access. |
| `config/workspaces.ts`, `config/workspace-presentation.ts` | Workspace paths, labels and presentation settings. |
| `config/api.ts` | API base URL configuration. |
| `hooks/` | Shared React hooks. |
| `lib/backend-api/` | HTTP requests, endpoint types, file actions and backend-specific API helpers. |
| `lib/api/` | Repository interfaces, HTTP adapters and compatibility exports used by screens. |
| `lib/contracts/` | Shared frontend data contracts and display models. |
| `lib/data-source/` | API repository wiring for CRM and Operations; these files connect to backend repositories. |
| `lib/auth/`, `lib/permissions/` | Session state, route guards and frontend permission helpers. |
| `lib/offline/`, `lib/pwa/` | Offline storage, synchronization and application-shell support. |
| `lib/feedback/`, `lib/formatting/` | Shared interaction feedback and date, currency and number formatting. |
| `lib/indian-mobile.ts`, `lib/password-policy.ts` | Shared phone-number and password validation helpers. |
| `styles.css` | Global theme, design tokens and shared styling. |

### Feature folders and workspaces

| Folder under `frontend/src/features/` | Responsibility |
| --- | --- |
| `admin-dashboard/`, `analytics/` | Platform Admin dashboard and analytical components. |
| `operations/` | Operations workspace, case queues, assignment, SLA views and operations data mapping. |
| `cases/` | Case intake, Case 360, workflow summary, checks, documents, field evidence, reports and case activity. |
| `crm/` | Sales opportunities, activities, follow-ups, accounts and commercial onboarding. |
| `clients/` | Client management and related presentation. |
| `field/` | Field visit queue, GPS actions, evidence capture and offline visit work. |
| `stakeholders/client/` | Client-facing verification portfolio and related views. |
| `stakeholders/finance/` | Finance workspace components and financial views. |
| `stakeholders/settings/`, `settings/` | Organisation, branch, package and workflow settings. |
| `stakeholders/security/`, `security/` | Account security, sessions and related controls. |
| `auth/` | Sign-in and authentication interface. |
| `users/` | User creation, access and role-management interface. |
| `audit/` | Audit-trail interface. |
| `privacy/` | Privacy and retention-related interface. |
| `public/` | Public-facing workflow components. |
| `help/` | Page-specific prewritten help, learning mode and help topics. |
| `delivery/`, `shell/`, `workspaces/` | Shared workspace structure, delivery layout and reusable workspace states. |

Some workspaces have substantial page logic directly in `routes/`. Start with these route filename prefixes:

| Route files | Workspace |
| --- | --- |
| `admin*.tsx` | Platform Admin |
| `operations*.tsx` | Operations Manager |
| `sales-crm*.tsx` | Sales and CRM |
| `client-portal*.tsx` | Client Admin |
| `verifier*.tsx` | Verifier |
| `qa*.tsx` | Quality review |
| `field-executive*.tsx` | Field Executive |
| `finance*.tsx` | Finance |
| `candidate*.tsx`, `consent*.tsx` | Candidate access and consent |
| `cases.$caseId.tsx` | Full case workspace |

Routing conventions: dots in route filenames represent nesting, `$caseId` is a dynamic parameter, and `__root.tsx` is the root layout. Add pages using the existing TanStack file-routing pattern; do not add a Next.js `app/` or `pages/` tree.

### Other frontend files

| Location | Purpose |
| --- | --- |
| `frontend/public/brand/` | Public brand assets, including the logo used for the favicon. |
| `frontend/public/manifest.webmanifest`, `sw.js`, `offline.html` | Installable application metadata, service worker and offline shell. |
| `frontend/public/robots.txt` | Crawler directives. |
| `frontend/vite.config.ts` | Build plugins, aliases, development API proxy and Nitro server build configuration. |
| `frontend/tsconfig.json`, `eslint.config.js`, `.prettierrc` | TypeScript, lint and formatting configuration. |
| `frontend/components.json` | Shared UI component tooling configuration. |
| `frontend/.env.example` | Frontend environment-variable template; never put secrets in browser-visible variables. |
| `frontend/test/` | Frontend unit tests. |
| `frontend/e2e/`, `frontend/playwright.config.ts` | Browser tests, test fixtures and browser-test configuration. |

## Backend: where to find things

All API modules are under `backend/src/`.

| Location | Responsibility |
| --- | --- |
| `main.ts` | API bootstrap, HTTP server, validation, security headers and API documentation setup. |
| `app.module.ts` | Top-level NestJS module registration. |
| `auth/` | Login, password handling, tokens, sessions and authentication services. |
| `users/` | User accounts, roles and access management. |
| `clients/` | Client organisations and related controls. |
| `crm/` | Opportunity lifecycle, activities, commercial documents and onboarding. |
| `cases/` | Case creation, scopes, queries, workflow transitions, assignment and activity history. |
| `candidate-portal/` | Secure candidate access links and candidate-facing endpoints. |
| `consents/` | Consent requests, OTP validation and consent records. |
| `documents/` | Upload validation, private documents, document review and evidence readiness. |
| `verification/` | Verifier tasks, findings and verification readiness. |
| `field-visits/` | Field assignment, GPS/geofence checks, evidence, supervisor review and physical-verification policy. |
| `clarifications/` | Clarification requests, responses and resolution. |
| `qa/` | Quality-review queue, claim and review decisions. |
| `reports/` | Report preparation, PDF generation, versions, authenticity and release controls. |
| `finance/` | Invoices, payments, credit notes and financial queries. |
| `dashboards/` | Dashboard summaries, analytics and operational queues. |
| `settings/` | Organisation settings, branches, service packages and configurable policies. |
| `audit/` | Audit-event recording and queries. |
| `notifications/` | User notifications and related endpoints. |
| `outbox/` | Queued background work, retries, delivery and scheduled reminders. |
| `privacy/` | Privacy and retention controls. |
| `health/` | Liveness and readiness endpoints. |
| `database/` | Prisma/database connection services. |
| `config/` | Environment configuration and validation. |
| `common/auth/`, `common/security/` | Shared guards, scoping, encryption and security utilities. |
| `common/dto/`, `common/validation/`, `common/http/` | Shared request types, validation and HTTP handling. |
| `common/persistence/`, `common/pdf/` | Database projections/helpers and shared PDF utilities. |
| `assets/fonts/` | PDF fonts and their licence. Keep the licence with the font. |
| `generated/prisma/` | Prisma-generated database client; regenerate from the schema rather than editing manually. |

Within each module, `*.controller.ts` defines endpoints, `*.service.ts` implements application logic, `*.module.ts` registers dependencies, and `dto/` defines validated requests. Selectors, presenters and policy helpers separate database queries, API output and workflow rules.

### Database, infrastructure and backend tests

| Location | Purpose |
| --- | --- |
| `backend/prisma/schema.prisma` | Database models and relations. |
| `backend/prisma/migrations/` | Ordered SQL migrations; preserve applied migration history. |
| `backend/prisma/seed.ts` | Initial roles, permissions, configuration and administrator provisioning. |
| `backend/prisma/preflight.ts`, `verify-deployment.ts` | Checks before migration and after deployment. |
| `backend/prisma/rotate-data-key.ts`, `subject-pii-rotation.ts` | Controlled encryption-key rotation and subject-data migration helpers. |
| `backend/prisma/e2e-fixture.ts`, `golden-flow-cleanup.ts` | Isolated test-data provisioning and cleanup; not normal application startup. |
| `backend/prisma/provision-dashboard-users.ts` | Development role-account provisioning. |
| `backend/prisma.config.ts` | Prisma CLI configuration. |
| `backend/infra/sql/bootstrap.sql` | SQL runtime-role permissions, including audit-record protections. |
| `backend/scripts/` | Build-output cleanup and maintenance/diagnostic scripts. |
| `backend/test/` | Unit, authorization, workflow and database integration tests. |
| `backend/Dockerfile`, `compose.production.example.yml` | API container build and example runtime configuration. |
| `backend/.env.example` | Backend environment-variable template. |
| `backend/nest-cli.json`, `tsconfig*.json`, `eslint.config.mjs` | Backend build, TypeScript and lint configuration. |

## Local development

Use Node.js 24, npm and an authorised SQL Server development database. Run commands from the repository root.

1. Install locked dependencies with `npm ci --include=dev`.
2. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`.
3. Configure the development database, independent secrets and file storage. Do not overwrite an existing environment file.
4. Generate the database client with `npm run --workspace backend prisma:generate`.
5. For database setup or schema updates, follow the controlled migration steps in the production runbook. Do not run seed, migrations or cleanup against a shared database without approval.
6. Start the applications in separate terminals:

```sh
# Terminal 1: backend
npm run dev:backend

# Terminal 2: frontend
npm run dev:frontend
```

Default frontend: `http://localhost:8080`. API: `http://localhost:4000/api/v1`. Readiness: `/api/v1/health/ready`. Non-production API documentation: `http://localhost:4000/api/docs`.

Frontend requests normally use `VITE_API_URL=/api/v1`. Vite proxies that path to `VITE_DEV_API_TARGET` during development. Production needs an equivalent reverse proxy; Vite's development proxy is not part of the built server. Keep `PUBLIC_API_ORIGIN` blank for a same-origin deployment. Cross-site frontend/API cookies are not supported; trust only the configured ingress proxies.

Initial administrator provisioning uses private `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` values. Re-seeding does not normally reset the administrator password; `SEED_RESET_ADMIN_PASSWORD=true` explicitly requests that reset. Use a separate migration identity and a least-privileged runtime identity.

## Build and checks

```sh
npm run build
npm run --workspace frontend typecheck
npm run --workspace frontend lint
npm run --workspace frontend test:unit
npm run --workspace backend lint
npm run test:backend
```

`npm run build` builds both applications; it does not deploy migrations or restart server processes. Backend output is `backend/dist/`; frontend Node-server output is `frontend/.output/`.

Browser tests live in `frontend/e2e/`. Review each test's fixture and environment requirements before execution. Database integration tests, fixture provisioning and the golden-flow cleanup require a disposable test environment, not the shared local/UAT database. Keep test fixtures: they are test inputs, not production business data.

## Workflow and deployment references

- [Production runbook](docs/PRODUCTION_RUNBOOK.md): migration, storage, notification providers, secrets, backups, monitoring and rollback.
- [Backend startup troubleshooting](docs/BACKEND_STARTUP.md): build and startup issues.
- [Case dispatch](docs/case-dispatch-workflow.md), [Operations action inbox](docs/operations-action-inbox.md), [Physical address verification](docs/physical-address-verification.md).
- [Commercial onboarding](docs/commercial-client-delivery.md), [QA and Finance](docs/qa-finance-workspaces.md), [Report release](docs/report-release-workflow.md).
- [Workflow test guide](docs/workflow-completion-testing.md), [Verification evidence](docs/workflow-upgrade-verification.md), [Loading feedback](docs/loading-feedback.md).

Dated implementation notes, plans and status files are historical references, not certification of the current deployment. Recheck behaviour and environment-dependent integrations before a release. Production validation requires secure configuration and providers; a successful build alone does not establish production readiness.

## Handover safety

- Share source code, `package-lock.json`, environment examples, migrations, tests and operational documentation.
- Transfer credentials separately through an approved secure channel. Do not include real `.env` files, secrets, database dumps or candidate documents in a source-code ZIP.
- `backend/.data/` may contain uploaded documents: it is application data, not disposable build output.
- Installed dependencies, `backend/dist/`, `frontend/.output/`, tool caches, logs and browser-test results are local/generated artifacts, not source code. Exclude them from a clean source handover; do not remove active deployment files blindly.
- Preserve licences, generated-code notices, the production logo and database migration history.
