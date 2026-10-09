# BGV Internal Flow — Implementation Plan (v2)

Approved by the product owner on 6 October 2026. Requirement sources:
`docs/bgv-e2e-process-reference.md` and `docs/agreed-internal-workflow.md`.
Work proceeds through the steps below without re-confirmation; progress is reported step by step.

## Ground rules

- Existing in-flight cases keep the current (v1) path. Only cases created after this change use the
  new flow (`VerificationCase.workflowVersion = 2`).
- Migrations are written and committed as files. They are applied only to a local/test database.
  The configured database in `backend/.env` is a remote shared server, so migrations are **not**
  applied from this machine; deployment applies them with `prisma migrate deploy` after approval.
- Field/vendor stays on hold: hidden from navigation behind a feature flag, code and data kept.
- Every assignment, reassignment, routing, readiness, insufficiency, approval and access change
  writes an `AuditEvent` and, where someone must act, a `Notification`.
- UI: simple, advanced and clear. Mockups are inspiration, not a specification. Status colours:
  green done, amber pending, red overdue/blocked, violet review.

## Data model (migration `20261007100000_internal_workflow_v2`)

| Change | Purpose |
|---|---|
| `Department` (tenant, code, name, kind `DATA_ENTRY`/`VERIFICATION`, default `checkTypesJson`, status) | Configurable departments. Seeded per tenant: Data Entry, Employment, Education, Address |
| `DepartmentMember` (department, user, role `LEAD`/`MEMBER`) | Team Leader and team members of each department |
| `VerificationCase.workflowVersion` (default 1) | 2 = new internal flow |
| `VerificationCase.intakeStage` | `INTAKE` → `DATA_ENTRY` → `CORRECTION` ↔ `DATA_ENTRY` → `READY` → `ROUTED` |
| `VerificationCase.dataEntryUserId`, `dataEntryAssignedAt`, `dataEntryReadyAt` | Data Entry owner and timings |
| `CaseCheck.departmentId`, `routedAt` | Which department owns each check |
| `Clarification.level` (`L1`/`L2`), `raisedById` | L1 = Data Entry insufficiency, L2 = verifier insufficiency |
| Role `DATA_ENTRY`; `SPOC_RM` gains read/act permissions | RM acts on its own cases; Data Entry users |

Package defines checks; department routing and employee assignment stay separate.

## Flow (v2 case)

1. Client creates case → candidate submits (unchanged). `intakeStage = INTAKE`.
2. Operations Manager assigns the RM (done in previous step, audited).
3. **RM assigns Data Entry** (a member of the Data Entry department). `intakeStage = DATA_ENTRY`.
4. **Data Entry** checks documents; may reject a document or raise **L1** insufficiency
   (`intakeStage = CORRECTION`). When all L1 items are resolved the case returns to `DATA_ENTRY`.
5. **Data Entry marks Ready** (no open L1, no rejected documents) → `intakeStage = READY`, RM notified.
6. **RM routes each check to a department** → unassigned tasks per check, case moves
   `DOCUMENT_PENDING → IN_PROGRESS` through the existing workflow policy, `intakeStage = ROUTED`,
   department Team Leaders notified.
7. **Team Leader assigns members**; members see only their tasks, TL sees the whole department.
8. **Verifier** completes checks; may raise **L2** insufficiency (existing clarification cycle).
9. **QC** approves or returns rework (existing; rework returns to the previous assignee, or the TL
   queue when unassigned).
10. **Current RM** performs final approval for v2 cases (Operations keeps it for v1 cases).
11. Report, payment and release rules unchanged.

## Steps and status

| # | Step | Status |
|---|---|---|
| 0 | Plan + data model (this document) | Done |
| 1 | Schema + migration `20261007100000_internal_workflow_v2`, `/workflow` departments API, Operations "Departments & teams" page, `DATA_ENTRY` role, field/vendor hidden (`frontend/src/config/features.ts`) | Done |
| 2 | RM → Data Entry assignment; Data Entry workspace `/data-entry` (accept/reject documents, L1 correction, resolve, Ready) | Done |
| 3 | RM routing dialog; Team Leader queue `/verifier/team`; member scope; L1/L2 levels on clarifications | Done |
| 4 | QC approval notifies the RM; RM final review `/workflow/cases/:id/final-review` (v2 cases only) | Done |
| 5 | RM work queue `/spoc-rm/work`; Operations stages and owners are v2-aware; "Needs attention" flow pipeline | Done |
| 6 | Company-level RM, colour codes, STOP / resume, re-open counts, 6h/8h working-hour alerts, notification matrix, colour-coded report PDF and MIS (migration `20261008100000_client_rm_dispositions_stop`) | Done |

## Step 6 details

**Company-level RM** — Operations → Companies & RMs. One RM per company (`Client.primaryRmUserId`); every new
case of that company is assigned to that RM automatically. On assign/change, Operations chooses: new cases only,
also open cases without an RM (default), or every open case. The RM gets the company in its workspace scope
automatically. Every move writes `case.owner-assigned`; the company change writes `client.primary-rm-assigned`.

**Colour codes** (`CaseCheck.disposition`) — the verifier picks the colour when closing a check; it must match the
result: Clear → Green or Blue (verbal); Discrepancy → Red (major), Yellow (minor) or Client review; Unable to verify →
Amber or Client review. A case takes its most serious check's colour. Shown on Operations queues, case page,
Performance & MIS, Excel exports and the final report PDF (overall banner + per check).

**STOP / resume** — status `STOPPED`, only through `/workflow/cases/:id/stop|resume` with a reason, by Operations or
the case's RM. Stopped cases leave active/overdue counts and resume to the exact step they were stopped at.
**Re-opened** = live cases with a controlled reopening (existing Operations reopen action).

**Working-hour alerts** — every 15 minutes; calendar `WORKING_DAYS` (default `1-6`, Mon–Sat) and
`WORKING_HOURS` (default `09:30-18:30`) IST. Internal waits only (corrections wait on the client):

| Waiting step | 6 working hours (red) | 8 working hours |
|---|---|---|
| Needs RM | Operations Managers | Platform administrators (HOD) |
| RM to assign Data Entry / route a Ready case | RM, Operations Managers | HOD |
| With Data Entry | Data Entry user, Data Entry Team Leaders, RM, Operations Managers | HOD |
| Routed, no member assigned | Department Team Leaders, RM, Operations Managers | HOD |

Each alert is sent once per step and level and recorded as `case.stage-alert`. The document also lists the client
SPOC for 6-hour alerts; internal delays are not sent to clients — decide before enabling.

### Notification matrix

| Event | Recipients |
|---|---|
| Company RM assigned / new case of that company | RM |
| Case RM assigned / changed | RM |
| Data Entry assigned / RM returns a Ready case | Data Entry user |
| Data Entry marks Ready | RM |
| Document resubmitted during intake | Data Entry user |
| All corrections resolved | Data Entry user |
| Checks routed | Department Team Leaders |
| Check assigned / reassigned | Team member |
| Check closed as UTV or Client review | RM |
| QC rework | Previous verifier (existing) and RM |
| QC approved | RM (final review) |
| Escalated | Client admins (existing) |
| Stopped / resumed | Client admins, RM |
| 6h / 8h stage alerts | See table above |
| Report released | Client (existing release flow) |

## Release notes for UAT

1. Apply both migrations before restarting the API (with approval):
   `npm run --workspace backend prisma:deploy`
   (`20261007100000_internal_workflow_v2`, `20261008100000_client_rm_dispositions_stop`).
   Without them the API fails on the new columns.
2. New cases join the v2 flow by default. Before go-live, Operations must:
   set a company RM for each client (**Operations → Companies & RMs**), add Team Leaders and members in
   **Operations → Departments & teams**, and give Data Entry users the `DATA_ENTRY` role.
   To delay, set `INTERNAL_WORKFLOW_V2=false` in the backend environment; existing cases are unaffected either way.
3. Operations field screens are hidden by `FIELD_WORK_ENABLED = false` (set `true` to restore). The RM vendor page stays visible.
