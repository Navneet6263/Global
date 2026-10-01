# BGV Portal Agreed Internal Workflow

Agreed on 30 September 2026. Ye document internal workflow aur RM ownership ke latest agreed rules save karta hai. Implementation aur testing ke liye isi sequence ko follow karna hai.

**Status:** Approved target workflow, not a completion report. Is document ko save karne se application permissions, routing, existing cases ya database change nahi hue hain. Vendor aur internal field ko hold par rakhna current implementation scope ka decision hai; runtime mein disable ho chuke hain, aisa claim nahi hai.

Ye document purane handover ke conflicting routing, RM ownership aur current-phase scope ko supersede karta hai. Unrelated requirements cancel nahi hote.

## Current phase

- Pehle internal verification journey complete karni hai.
- Vendor module ka further workflow integration abhi hold par hai.
- Internal Field Executive aur internal field supervisor review active target process se bahar hain.
- Existing vendor/field code, files, evidence aur audit history delete nahi karni.
- Future mein physical/field verification vendor karega; abhi us integration ko completed nahi samajhna.
- Internal-only package/checks se end-to-end test karna hai. Field/vendor-required case ka required work skip karke QC, approval ya completion allow nahi karna.

## Main flow

```text
CLIENT ADMIN
Case create karega
        |
        v
CANDIDATE
Details + consent + required documents submit karega
        |
        v
OPERATIONS MANAGER
Submission queue se dedicated RM assign karega
        |
        v
ASSIGNED RM / SPOC
Data Entry user ko assign karega
        |
        v
DATA ENTRY
Details aur documents review karega
        |
        +-- Missing / wrong --> Correction request
        |                              |
        |                       Candidate/client response
        |                              |
        |                       Data Entry recheck
        |                              |
        +------------------------------+
        |
      Ready
        |
        v
ASSIGNED RM / SPOC
Required checks aur work samjhega
Internal Verifier ko checks assign karega
        |
        v
INTERNAL VERIFIER
Assigned checks, source verification, findings aur evidence complete karega
        |
        v
QC / QA
Required work aur evidence review karega
        |
        +-- Rework --> Concerned team --> QC recheck
        |
     Approved
        |
        v
CURRENT ASSIGNED RM
Final review aur approval
        |
        +-- Return with reason --> Concerned team --> QC recheck --> RM
        |
     Approved
        |
        v
REPORT PREPARATION + FINANCE / PAYMENT RULES
        |
        v
REPORT RELEASED TO CLIENT
```

## Routing rules that must not change

1. Candidate submission ke baad case **Operations Manager** ke paas jayega. Direct RM assignment assume nahi karna.
2. Operations dedicated RM choose karega. Existing client-to-RM mapping ho toh bhi initial Operations assignment step bypass nahi hoga.
3. RM Data Entry ko work assign karega.
4. Data Entry Ready karega toh work **assigned RM** ke paas return hoga, Operations ke paas nahi.
5. RM required verification work decide aur Verifier ko assign karega. Selected package ke mandatory checks remove/skip nahi kar sakta.
6. Operations overall monitoring aur RM reassignment karega; har routine stage par Operations approval required nahi hai.
7. QC approve karega toh final review **current assigned RM** karega, automatically Operations/Company Admin nahi.
8. Report release par existing applicable payment controls retain karne hain. Is agreement mein unpaid release ka naya exception approve nahi hua.
9. Required consent, evidence, corrections aur independent-review safeguards bypass nahi karne.

## Role responsibilities

| Role | Current agreed responsibility |
| --- | --- |
| Super Admin | SaaS verification companies aur initial company access create karega. |
| Company Admin | Apni company ka progress, reports aur delays dekhega; escalate kar sakega. Routine allocation/verification approval nahi. |
| Operations Manager | Candidate submissions dekhega, dedicated RM assign/change karega aur overall delivery monitor karega. |
| RM / SPOC | Assigned cases ka owner; Data Entry aur Verifier allocation, progress, corrections, QC tracking aur final approval handle karega. RM aur SPOC ek role hain. |
| Data Entry | Completeness, readability aur entered details/document consistency review; correction aur Ready handover. Actual source verification ka replacement nahi. |
| Internal Verifier | Assigned checks ka factual/source verification, findings, outcome aur evidence. |
| QC / QA | Independent review, selected work ka rework aur approved case current RM ko return. |
| Client Admin | Apne organisation ke cases initiate, requested corrections respond aur allowed status/released reports dekhega. |
| Candidate | Secure portal se details, consent, documents aur corrections submit karega. |
| Finance | Invoices, payments aur applicable report-release eligibility handle karega; verification result approve nahi karega. |
| CRM | Client onboarding/commercial handover; candidate verification ka execution owner nahi. |
| Support | Support requests aur authorised progress visibility; Data Entry/Verifier ka substitute nahi. |
| Vendor and Internal Field | Current internal implementation phase mein hold; historical records preserve. |

## RM change and complete handover

Operations Manager workflow ke beech mein assigned RM change kar sakta hai. **Naya case ya data copy nahi banega; existing case ki ownership transfer hogi.**

Naye RM ko authorised case context mein ye sab dikhna chahiye:

- Case number, client, candidate details, selected package/checks aur current stage.
- Uploaded documents, versions, review notes aur correction history.
- Completed work: kisne kya kiya, kab kiya, findings aur decisions.
- Pending work: kya bacha hai, kis employee ke paas hai, kab se pending hai aur next action.
- Existing Data Entry, Verifier aur QC assignments/status.
- Full timeline aur previous RM ke notes/actions.
- Available approvals, report/payment status aur existing access rules ke andar historical field/vendor evidence.

Transfer ke rules:

1. Case status, progress, completed checks aur existing deadlines reset nahi honge.
2. Existing Data Entry, Verifier aur QC assignments automatic change nahi hongi. Kisi worker ko reassign karna alag action hoga.
3. Pending RM actions, including final review, naye RM ki queue mein aayenge. Purane RM ki active ownership queue se case hatega.
4. Previous actions ka actor-name old RM hi rahega; history new RM ke naam par rewrite nahi hogi.
5. Transfer audit mein old RM, new RM, Operations actor, timestamp aur reason record honge.
6. Naye RM ko handover notification milega.
7. Sirf old ownership ke basis par purana RM aage action nahi kar sakega. Agar kisi separate authorised role/scope se access hai, woh separately evaluate hoga.
8. Naye RM ki case visibility transfer ke saath milegi; unrelated clients/cases ka access nahi milega.
9. Pehle se open old-RM browser tab se stale approval/assignment bhi backend par reject hona chahiye.
10. Ownership change aur audit consistent hone chahiye; partial transfer ya duplicate pending work nahi banna chahiye.

Client-wide automatic transfer ya sabhi clients ke cases ek saath move karna is agreement ka part nahi hai. Current agreed rule case ownership transfer hai; bulk transfer add ho toh explicitly selected authorised cases par hi ho.

## Simple dashboard presentation

Har active case par ek clear summary rahe:

```text
Current stage | Assigned RM | Work with whom | Pending reason | Pending since | Next action
```

- Operations: Unassigned submissions, RM-wise pending work, delays aur Change RM.
- RM: New assigned cases, Data Entry pending/ready, verification pending, corrections, QC status aur final approvals.
- Data Entry: Assigned work, corrections awaiting response aur Ready/completed work.
- Verifier: Assigned checks, in progress, blocked aur completed work.
- QC: Ready for review, my reviews, rework aur completed reviews.
- Client: Case status, action required aur released reports; unnecessary internal controls nahi.

Latest approved design v1.1 use karna: almost-white canvas (#F8FAFC), white surfaces, blue primary (#1D4ED8), green success (#15803D), bold headings and compact grouped sidebar. Earlier warm-white/mint/orange direction is superseded. Compact clickable counts aur work queue first; daily work ko giant summary cards ke neeche hide nahi karna. Count click relevant filtered queue khole. Pending work aur negative verification outcome ko ek hi Rejected status mein mix nahi karna.

## Implementation acceptance checks

- Candidate submits: case Operations unassigned queue mein dikhta hai.
- Operations assigns RM: case selected RM ko milta hai; unrelated RM ko nahi.
- RM assigns Data Entry: selected user ko submission milti hai.
- Data Entry requests correction: corrected document re-review ke bina Ready nahi hota.
- Data Entry marks Ready: RM queue update hoti hai; extra Operations handoff nahi banta.
- RM assigns checks: Verifier sirf assigned/authorised work kar sakta hai.
- Required check, evidence ya correction pending: QC readiness blocked rahe.
- QC approved: current RM final-review queue update ho.
- RM final approval: applicable report/payment gates ke baad hi client release ho.
- RM change Data Entry, verification aur final-review stage par test ho: pending aur completed context preserved rahe.
- Old RM stale tab se action try kare: backend ownership/permission check apply ho.
- RM transfer existing worker assignment, deadlines aur historical attribution ko na badle.
- Field/vendor-required test case internal-only shortcut se complete na ho.
- Wrong-company, wrong-client aur unassigned-user access denied ho.

## Working order

Implementation checkpoint, 1 October 2026: Client Admin now follows the approved browser prototype's structure: full wordmark and organisation sidebar, nested navigation, one metrics strip, grouped stage bar, six/twelve-row verification table and aligned attention/contact/results panels. The earlier large-card layout was superseded. Search, stage filters, pagination, export, case opening, Back navigation, creation permissions, page help and learning controls are covered by isolated browser tests. Typecheck, changed-source lint, production build, 74 frontend unit tests and all 28 production-build UI regression tests passed. The UI suite uses intercepted responses and is not a real-database end-to-end test. Three superseded client list components were removed; Git history retains their previous versions.

The current APIs do not supply the client's RM contact, a published-report total or an on-time-delivery percentage. The interface does not invent these values: it shows available case metrics, clearly labels check outcomes rather than final report outcomes, and offers support while RM contact details are unavailable. Multi-status stage groups open their supported substage filters; filtering remains server-side.

Client navigation refinement, 1 October 2026: Help, Learning mode, profile, account security and sign out are in the header rather than the sidebar footer. The sidebar contains navigation only; Verifications and Reports use a single expanded group, while Insights and Billing are direct links. Browser checks cover no sidebar scrolling at 1280x600 and 1366x768, mobile navigation, learning preference persistence, keyboard account-menu use and sign out. The expanded 35-test isolated browser suite passed; no shared-database changes were made.

This is not completion of the target workflow. Case-level RM allocation/transfer, the Data Entry role and Ready handoff, RM verifier assignment and current-RM approval after QC still require backend implementation and end-to-end verification. No migration or shared-database write has been performed as part of this UI checkpoint. Changes have not been committed, pushed or deployed.

1. Role permissions, case-level RM ownership aur reassignment foundation.
2. Candidate submission to Operations, then RM allocation.
3. RM to Data Entry, correction loop, Ready back to RM.
4. RM to Internal Verifier, evidence completion and QC readiness.
5. QC to current RM final review, existing finance/report-release integration.
6. Internal-only full journey, negative tests aur RM transfer tests.
7. Internal flow stable hone ke baad vendor/physical workflow integration alag phase mein.

Implementation ka main location full company repository hai. Frontend-only handover mein UI changes review karke sync karne honge; permissions aur workflow backend mein enforce honge. Documentation save karna deployment, database migration, code commit ya Git push ki authorisation nahi hai.
