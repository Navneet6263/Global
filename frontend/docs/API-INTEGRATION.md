# API Integration Guide

This guide is retained from the frontend-only handover. File paths below are
relative to `frontend/` in the main `TrustLink-Verifications` repository.
The backend now lives alongside it in `backend/`; credentials remain private.

## Connection: configure once

```text
Page / component
  -> feature hook or repository
  -> shared apiRequest / apiDownload
  -> VITE_API_URL (/api/v1)
  -> Vite development proxy OR production reverse proxy
  -> separately hosted application API
```

The frontend `.env` file is the only normal place to change the API server connection:

```dotenv
VITE_API_URL=/api/v1
VITE_TENANT_CODE=SAPLING
VITE_DEV_API_TARGET=http://127.0.0.1:4000
```

For a remote *approved development API*, replace the target with the origin the
owner supplies, for example `https://dev-api.example.com`. This is a placeholder,
not a live endpoint. Do not append `/api/v1` to the target: the proxy preserves it.
`VITE_API_URL` already includes that prefix, so request functions use paths such
as `/cases`, not `/api/v1/cases`.

`src/config/api.ts` reads the base URL. `vite.config.ts` reads the dev target.
Both exist already; do not hardcode hostnames in individual role pages.

## Remote UAT and authentication: important

The existing API rejects state-changing requests with an unexpected Origin and
uses HttpOnly, SameSite=Strict session cookies. A local page calling a remote UAT
URL directly may therefore fail with 403 or repeated 401 even if the URL is right.
Changing only the Vite proxy target does not change the browser Origin.

Choose one owner-managed setup:

1. A dedicated development API that permits the exact development frontend origin
   (normally `http://localhost:8080`), with cookies appropriate for that isolated
   environment. Requests go through the local `/api/v1` proxy.
2. An HTTPS preview deployment with same-origin `/api/v1` reverse-proxied to a
   dedicated matching API instance. Its configured web origin must match the preview.

The frontend developer does not need backend source or database credentials for
either setup. The owner must provide the working API, tenant code, scoped test
account and synthetic test records. Do not relax shared UAT security, strip origin
headers or disable TLS/cookie checks to make localhost work.

Use a full HTTPS `VITE_API_URL` only when the backend owner has deliberately arranged
compatible CORS, origin and cookie configuration. The default is same-origin.
Environment configuration alone is not proof of a working login session.

## Where to add or change an endpoint

Most domain clients are under `src/lib/backend-api/`:

| Area | API client file(s) |
| --- | --- |
| Login, session, password, account security | `auth.ts` |
| Cases, checks, service selections, approvals | `cases.ts`, `case-services.ts`, `case-approvals.ts` |
| Document upload, preview, download | `documents.ts`, `document-preview.ts`, `file-digest.ts` |
| Candidate access and consent | `candidate-portal.ts`, `consents.ts` |
| Client rates, agreements and finance | `client-commercial.ts`, `agreement-files.ts`, `client-finance.ts` |
| CRM opportunities and proposals | `crm.ts`, `crm-proposals.ts` |
| Verifier tasks and verification methods | `tasks.ts`, `verification-methods.ts`, `source-outreach.ts` |
| Field visits | `field-visits.ts` |
| QC queue and register | `qa.ts`, `qa-register.ts` |
| Reports and billing | `reports.ts`, `finance.ts`, `billing-ready.ts` |
| Users, settings and dashboards | `users.ts`, `settings.ts`, `dashboards.ts` |
| Timeline, audit, notifications | `case-activity.ts`, `audit.ts`, `notifications.ts` |
| Corrections and privacy | `clarifications.ts`, `privacy.ts`, `object-deletions.ts` |

Some newer domain clients live alongside their feature:

| Area | File relative to repository root |
| --- | --- |
| Operations bulk dispatch | `src/features/operations/dispatch/dispatch-api.ts` |
| RM/SPOC dashboards | `src/features/spoc-rm/api/spoc-api.ts` |
| RM vendor assignment/reports | `src/features/spoc-rm/vendors/spoc-vendor-api.ts` |
| Vendor requests, decisions, report upload | `src/features/vendor/vendor-api.ts` |
| Vendor team accounts/delegation support | `src/features/vendor/team/vendor-team-api.ts` |
| Vendor activity logs | `src/features/vendor/activity/vendor-logs-api.ts` |
| Support workspace | `src/features/support/api/support-api.ts` |
| Privacy sharing controls | `src/features/privacy/vendor-sharing-api.ts` |

Existing repository adapters are in `src/lib/api/http/`, with their facade in
`src/lib/api/client.ts`. Retain this layer where the page already uses it. Check
feature hooks and contracts before changing payload shapes. The functions in these
files are the current request definitions; confirm any new endpoint with the backend
developer rather than inventing an endpoint or assuming a planned feature exists.

## Shared transport rules

`src/lib/backend-api/client.ts` provides:

- `apiRequest<T>(path, options)` for JSON and multipart requests.
- `apiDownload(path)` for authorized file requests.
- `saveBlob(blob, filename)` for explicit downloads.
- Cookie credentials, coordinated session refresh, cancellation/timeouts, request
  deduplication, write activity and idempotency headers.

Example using an existing read endpoint:

```ts
import { apiRequest } from "@/lib/backend-api/client";

export function getCase(caseId: string, signal?: AbortSignal) {
  return apiRequest<CaseDetail>(`/cases/${encodeURIComponent(caseId)}`, { signal });
}
```

Use the actual response contract imported by the surrounding feature for
`CaseDetail`. Avoid raw `fetch` inside components; reuse existing wrappers/hooks.
For mutations, pass JSON.stringify(body), show pending feedback on the clicked
action, handle errors, and invalidate the relevant React Query keys on success.
Pass record versions where the endpoint requires optimistic concurrency.

## Uploads and previews

- Reuse the domain upload function. Requirements vary by endpoint; do not assume
  every upload accepts the same file size or file types.
- Send `FormData` without manually setting Content-Type; the browser adds the boundary.
- Preserve SHA-256 headers where required (see `file-digest.ts` and vendor uploads).
- Use the existing authenticated preview helpers; do not expose storage paths or
  convert private files into public URLs.
- Keep Preview and Download separate. Do not log file contents or access-link tokens.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `ECONNREFUSED 127.0.0.1:4000` | No API is listening at the default target; ask for a running development API |
| 502 | API process/reverse-proxy target is unavailable; report to deployment owner |
| 401 or login loop | Credentials, tenant, session cookies, HTTPS and origin configuration |
| 403 | Role/client/branch/assignment scope or origin check; do not bypass it |
| 404 | URL prefix, endpoint path and deployed backend version |
| 409 | Record changed; refetch before retrying the action |
| 400 / 422 | Read the response detail and check the request contract |
| Upload rejected | Check this endpoint's type/size/hash and backend validation |

For debugging, capture endpoint path, HTTP status and request ID without credentials,
cookies, candidate information or document bytes. Frontend-only work does not need
database credentials. For local full-stack work, run `npm run dev:backend` from
the main repository separately; follow its README for backend setup.
