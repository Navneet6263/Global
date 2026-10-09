# BGV E2E Process — Development Reference

Source: `BGV Portal - E2E Process Flow.docx` (business requirement document, read on 6 October 2026).
Is file ka purpose: har feature banane se pehle yahi checklist dekhni hai, taaki workflow, roles aur
screens business document ke hisaab se hi bane — aur jahan possible ho, usse better aur advanced.

**Precedence:** jahan routing ya RM ownership par conflict ho, `docs/agreed-internal-workflow.md`
(30 Sep 2026) final hai. Ye document requirement ka poora scope batata hai; current phase scope
agreed workflow decide karta hai (vendor/field abhi hold par).

**Status:** requirement reference, completion report nahi. "Built" column sirf wahi batata hai jo
code mein verify kiya gaya; baaki items gaps hain.

---

## 1. End-to-end flow (business document)

```text
CLIENT ── Create case ──► CASE CREATED ──► CANDIDATE LINK
CANDIDATE / COMPANY submits: Personal data, Education, Employment, Address, References, LOA, Documents
        │
AI / OCR (future): classification, OCR, extraction, validation, fraud/tampering indicators
        │
DATA ENTRY / INITIATION ── complete? ── NO ──► L1 INSUFFICIENCY ──► candidate/client ──► resubmission ─┐
        │ YES                                                                                         │
        ▼◄────────────────────────────────────────────────────────────────────────────────────────────┘
ASSIGN CHECKS (Company, Employment, Education, Address, Criminal, Database, Drug, Other)
        │
VERIFICATION ── Internal / API / Vendor
        │
L2 INSUFFICIENCY? ── YES ──► candidate/client ──► back to verification
        │ NO
ALL CHECKS DONE ──► QC ── Reject ──► Rework ──► QC
                        └─ Approve ──► FINAL REPORT ──► CLIENT
                                                  └──► BILLING ENGINE ──► ANNEXURE ──► INVOICE ──► PAYMENT
```

Agreed internal sequence (supersedes routing above where different):
Client → Candidate → **Operations Manager assigns RM** → RM assigns Data Entry → Data Entry
(correction loop; Ready returns to the **RM**) → RM assigns verification departments → Team Leader
assigns members → Verifier → QC (rework loop) → **current RM final approval** → report + finance
rules → authorised release to client.

## 2. Key business concepts

| Concept | Meaning | Notes for build |
|---|---|---|
| L1 insufficiency | Raised at Data Entry when a required document/detail is missing | Goes to client and/or candidate per client setup; resubmission returns case to processing |
| L2 insufficiency | Raised by verifier during verification (e.g. extra salary slip) | RM/client/candidate get the document back; returns to verification |
| UTV | Unable to Verify | Needs its own bucket: count, reason, re-open/re-initiate |
| STOP | Case stopped on client instruction | Status bucket on every dashboard |
| Re-open / Re-initiate | Closed or UTV work started again | Tracked separately on dashboards |
| Client Review | Finding waiting for client decision | Status option on checks |
| Interim report | Report while work in progress (WIP) | Separate from final report |
| Pre/Post verification | Two-stage model for some clients (pre: DB, CRC, Drug, ID, digital address, UAN; post: employment, education, address) | Client-agreement driven; status names not yet defined |
| Route A / Route B intake | A: client reviews candidate submission first; B: direct to internal | Per client setup |

### Colour code / disposition (used on dashboards, reports and annexures)

| Colour | Meaning |
|---|---|
| Green | Clear / Verified |
| Red | Discrepancy / Adverse (major) |
| Yellow | Minor discrepancy |
| Amber | Insufficient / UTV |
| Blue | Verbal verification |
| No colour | Client review |

Check result statuses mentioned: Verified, Minor Discrepancy, Major Discrepancy, UTV, Insufficiency,
Client Review, Insuff-UTV, Interim (PCC), Positive/Negative (Drug), No records found / Record found
(court, criminal, database, social media).

## 3. Roles (business document → current code)

| Business role | Code role | Sees / does |
|---|---|---|
| Admin | `PLATFORM_ADMIN` | Users, roles, clients, vendors, pricing, auto-assignment rules, password policy (90-day expiry), lock/unlock |
| Manager | `OPS_MANAGER` | Full access of verifiers, TLs and client account management **except admin**; see section 4 |
| SPOC / RM (Client Account Management) | `SPOC_RM` | Owns client cases, intake, insufficiency follow-up, report submission after QC, client MIS |
| Data Entry / Initiation | (department, not yet a separate role) | Completeness check, L1 insufficiency, check-wise initiation |
| Team Leader | (department lead, not yet a separate role) | All cases of own department; assigns team members; works cases too |
| Team Member / Verifier | `VERIFIER` | Only cases assigned by TL |
| QC | `QA_REVIEWER` | End-to-end check against client guidelines; reject → rework, approve → RM |
| Vendor / Field | `VENDOR`, `FIELD_EXECUTIVE` | **On hold** this phase; sees client unique code only, never client name |
| Client | `CLIENT_ADMIN` | Own cases, insufficiency response, released reports, billing, MIS, helpdesk |
| Candidate | link access | Personal/education/employment/address/reference/LOA + documents |
| Finance | `FINANCE_MANAGER` | Billing engine, annexure, invoice, payment, release eligibility |

Departments (suppliers) in the document: Data Entry Supplier, Employment Supplier, Education Supplier,
Digital Address (DAV) Supplier, Field Supplier/Vendor. Each has TL → TM1/TM2. Packages define checks;
department routing and employee assignment stay separate (no hard-coded employee in a package).

## 4. Manager role — required scope

Document section "Manager-Role". Manager = Operations Manager in this product.

| Requirement | Built (verified in code, 6 Oct 2026) | Gap / next |
|---|---|---|
| Dashboard: total cases In progress / Completed / UTV / STOP / Insufficiency, **client-wise** | Active, overdue, completed today, queries, needs-RM on `/operations`; client filter on queue | STOP and Re-open statuses do not exist in backend; UTV only as check outcome |
| Colour-code status summary, client-wise | Check outcomes CLEAR / DISCREPANCY / UNABLE_TO_VERIFY available in `outcomeMix` | No minor/major split, no Blue-verbal, no Client-review outcome yet |
| TAT tracker with ageing (check and case wise), MIS | Due/overdue per case; `stageAgeing`, `performanceTrend` (SLA %, avg TAT) in `/dashboards/executive` | Working-hours based ageing (6h red to SPOC/Manager, 8h to HOD) not implemented |
| Client performance (client-wise) | `clientPerformance` in executive dashboard | — |
| SLA monitoring | `/operations/sla` | — |
| Escalation handling | Escalate case (urgent + client notification + audit) | Escalation matrix by delay not implemented |
| Client communication logs | Clarifications/support exist | No unified communication log screen |
| Performance of internal SPOCs, TLs, team members | `teamCapacity` (by responsible owner), `/dashboards/verifier-capacity` | TL / department dimension missing |
| Report management: interim / final, colour code | Final report release flow exists | Interim report not modelled |
| Billing & invoice: case/check-wise billing, monthly annexure, pricing mapping, invoicing, payment tracking | Finance workspace | Manager reads; Finance owns changes |
| Case management panel: list with Date / Status / Name / Case ID filters; detailed check status and verifier remarks; download report | `/operations` queue, Case 360, full case workspace | Date-range filter on queue |
| Insufficiency management: track pending, SLA for resolution | Clarifications page, document rejection | Explicit L1 / L2 labels not in data model |
| MIS & analytics: downloadable daily/weekly/monthly, custom filters (client, department, check type), graphs (closure rate, TAT performance) | Executive export CSV/PDF + schedule; custom export to be added | Department filter needs department model |
| Assign / change RM | `PATCH /cases/:id/owner` (RM must be mapped to client), audited | — |

Manager must **not**: approve QC, record verification outcomes, release reports, or act as admin.

## 5. Other role highlights to remember

- **Client portal:** totals by status incl. UTV/STOP/insufficiency/re-open/reject; colour summary;
  TAT tracker; bulk upload with template; case search by name/ID/status/date; resend candidate link;
  24-hour re-alert on insufficiency; UTV bucket; downloadable Case Status / TAT / UTV / Discrepancy
  reports; scheduled MIS; bill validation annexure; helpdesk tickets.
- **Data Entry:** new cases, L1 alerts, SLA breach; client-wise case number; auto case and check IDs;
  check-wise initiation forms (address, employment, education, court 7/10 years, API ID checks);
  assign to Employment / Education / DAV / Field supplier; timeline red alert after 6 working hours
  (SPOC, Data Entry, client SPOC, Manager) and 8 hours (HOD).
- **Employment / Education suppliers:** methods Email (auto follow-ups: employment 7, education 3,
  stop on response), portal, site visit, UAN/tax/verbal/bank statement; LHS vs RHS comparison;
  extra-cost approval attachment; team sees only own department cases.
- **DAV:** digital address link with GPS tagging and IVR; fallback to physical visit.
- **Field/vendor (hold):** check-wise WIP assignment internal vs vendor, re-assign to different vendor,
  vendor sees client code not client name.
- **Team Leader dashboard:** totals, assign member dropdown, client-wise volume, weekly/monthly/yearly
  annexure, reject, re-open. **Team member:** only own assigned cases.
- **Notifications (all roles):** new case / assigned, insufficiency raised, document resubmitted,
  report ready / final submitted, QC rejection, UTV, re-open, STOP. Exact matrix is an open gap.
- **AI/OCR:** document classification, extraction, tampering detection with log — future phase.

## 6. Build rules (apply to every change)

1. Read the route, controller/service, guards, DTOs and Prisma model before changing anything.
2. Never invent data the API does not return (no fake names, no fake document-view activity).
3. Client Admin never sees internal audit, verifier tasks, internal notes or private source details.
4. Every assignment, reassignment, approval, correction and access change must be audited in backend.
5. Vendor/field code and records stay intact while on hold.
6. No migrations, deploys, pushes or shared-database changes without explicit approval.
7. UI: almost-white canvas, blue primary, green success, amber pending, red overdue; useful queues
   before decorative cards; no page-level horizontal scroll; clear loading / empty / error states;
   IST timestamps.
8. Add focused unit and browser tests for every workflow change.
