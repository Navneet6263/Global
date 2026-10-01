# BGV Portal — Developer Workflow Handover

24 September 2026. This document describes the earlier target workflow and development scope. It does not mean the new roles and routing are already implemented. See [README](../README.md) for project structure and setup.

**Superseded for current internal routing and ownership:** Follow [BGV Portal Agreed Internal Workflow](agreed-internal-workflow.md), agreed on 30 September 2026. Candidate submissions first go to Operations for RM assignment; Data Entry Ready returns to RM; RM assigns Verifiers and performs final review after QC. It also defines complete RM transfer handover, the Super Admin/Company Admin separation and the current vendor/internal-field hold. The older flow and estimates below are historical context, not the current implementation plan.

## Oversight and administration

```text
SUPER ADMIN — OVERSIGHT ONLY
  View progress, reports and bottlenecks
  Escalate issues with name, role, time and reason
  No routine case editing, allocation or approval

OPERATIONS MANAGER / ADMIN
  Monitor delivery and manage allocation
  Map clients to their RM
  Create vendor organisations
  Authorised internal staff manage user IDs and access
```

CRM and Finance remain. Proposed setup: CRM hands over the onboarded client; Operations assigns the client's RM. RM/SPOC is one role, not two separate approval steps. Unmapped cases must appear in an Operations exception queue.

## Main workflow

```text
                  CLIENT ADMIN
                 Create new case
            Case visible to mapped RM
                        |
                        v
                    CANDIDATE
                 Open secure link
       Submit details, documents and consent
                        |
                        v
                    RM / SPOC
              Assign Data Entry user
                        |
                        v
                   DATA ENTRY
       Check completeness and document match
                        |
            +-----------+-----------+
            |                       |
       Missing / wrong              Ready
            |                       |
   Candidate/client correction      v
            |              ALLOCATE REQUIRED CHECKS
   Data Entry recheck               |
                        +-----------+-----------+
                        |                       |
                        v                       v
                INTERNAL VERIFIER          VENDOR USER
                 / INTERNAL FIELD       Assigned outsourced
                 Assigned internal      checks and evidence
                 checks and evidence           |
                        |                       |
                        +-----------+-----------+
                                    |
                        All required work and
                        evidence approvals done
                                    |
                                    v
                              QC / QA REVIEW
                        Approve or return for rework
                                    |
                               QC approved
                                    |
                                    v
                         RM / SPOC — FINAL REVIEW
                        Approve or return with reason
                                    |
                               RM approved
                                    |
                                    v
                              FINAL REPORT
                       Prepare and release according
                       to the agreed payment policy
```

- Internal and vendor routes may run in parallel. A case does not require vendor work unless the selected checks require it.
- Required vendor/field work must not be skipped before QC. Retain applicable field supervisor review.
- Proposed rework path: responsible team corrects selected work → QC recheck → RM final review.
- RM sees all stages for mapped clients; Operations sees its authorised scope; Super Admin has platform oversight.
- Each case shows stage, owner, pending reason, time pending and next action. Record actor/time for every assignment, submission, return, approval and escalation.
- Escalation notifies the responsible staff and RM. It does not approve or complete a case.

## Vendor structure

```text
OPERATIONS / AUTHORISED INTERNAL ADMIN
                  |
                  v
           VENDOR ORGANISATION
                  |
        +---------+---------+
        |         |         |
        v         v         v
    Agra user  Noida user  Lucknow user
        |         |         |
        +---------+---------+
                  |
                  v
        SAME VENDOR DASHBOARD
```

- Internal staff create vendor IDs. Vendors cannot create their own IDs.
- Each user sees only assigned checks and the documents needed for those checks.
- District scope does not automatically expose every case in that district.
- Internal notes and unrelated candidate documents remain inaccessible to vendors.
- Record internal/vendor delivery route separately from online/offline verification method, with source, findings, evidence, actor and time.

## Current functionality and development scope

Source baseline reviewed: `8befe56`. These are source-level findings, not a new live deployment test.

- **Existing foundation:** case creation, secure upload links, consent, document review, verifier allocation, internal field evidence, QC/rework, PDF reports, billing and payments. Reuse these modules.
- **Super Admin / Admin separation and RM mapping:** existing access system needs changes — **3–4 working days**. Platform Admin currently has broad permissions; renaming it is insufficient.
- **RM and Data Entry:** new roles, queues, assignment and correction/acceptance workflow — **4–6 days**.
- **Vendor setup and dashboard:** new organisation/user scopes, check routing and restricted evidence access; reuse field foundations — **5–7 days**.
- **QC → RM final approval:** approval foundation exists; change ownership, permissions and routing — **3–4 days**. Current manager review is performed by Operations Manager or Platform Admin.
- **Status, timeline and escalation:** extend existing presentation and audit mechanisms — **2–3 days**.
- **Testing, migration rehearsal and fixes:** verify new roles, document access, old cases and complete workflow — **5–7 days**.

**Total rough estimate: 22–31 working days**, approximately 5–7 working weeks for one experienced full-stack developer. Assumes UI reuse, a test environment and timely business/QA feedback. Confirm delivery dates with the assigned developer.

## Decisions and separate scope

- **Report release:** current new-flow reports require full payment. Confirm whether the target workflow releases before or after payment; do not remove that gate implicitly.
- **Freeze / fraud flag:** clarify the requested action before implementing it.
- **Separate estimate:** full candidate/company form and LOA, optional pre-verification, check/location pricing and monthly annexure. These earlier requirements are not cancelled.
- **Ownership changes:** define RM reassignment for existing cases, absent RMs and client remapping. Do not silently change historical ownership.
- Retain consent, private document access, independent review, audit history and duplicate-billing protection.

## Implementation locations

- Roles and scope: `frontend/src/config/`, `frontend/src/lib/auth/`, `backend/src/common/auth/`, `backend/src/users/`.
- Client/RM mapping: `backend/src/clients/`, `backend/src/cases/`, client and operations screens.
- Intake and Data Entry: `backend/src/candidate-portal/`, `backend/src/documents/`, `backend/src/clarifications/`, candidate/case screens.
- Verification/vendor routing: `backend/src/verification/`, `backend/src/field-visits/`, new vendor module and workspace.
- Final review/release: `backend/src/qa/`, `backend/src/reports/`, corresponding case/review screens.
- Status and escalation: `backend/src/dashboards/`, `backend/src/cases/`, `backend/src/notifications/`, `backend/src/audit/`.
- Schema and deployment: `backend/prisma/schema.prisma`, new reviewed migrations and existing deployment procedures.

Use a dedicated development database and separate file storage. Transfer credentials privately, never in Git. Do not run seed, cleanup or migrations against the shared UAT database without approval. Do not grant a vendor an existing broad internal role as a shortcut.
