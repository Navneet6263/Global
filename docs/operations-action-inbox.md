# Operations action inbox

The Operations dashboard keeps Live workload and the existing summary first. Below it, a compact action queue has six colour-accented category rows on the left, a vertical divider, and a server-paginated case list on the right. On smaller screens the categories stack above the list. Selecting a category filters the queue; candidate/case/client search and pagination stay in the URL. Compact Open links lead to the relevant workspace tab and provide a return link to the same inbox category. Start & assign retains its explicit confirmation dialog. Existing Case 360, manual controls and workflow guards remain available.

## Queue rules

| Queue | Included work | Next step |
| --- | --- | --- |
| Documents to review | Latest document of each type is AVAILABLE, has a current CLEAN file version, and belongs to a mutable case | Documents tab; preview/review using existing controls |
| Ready to start | DOCUMENT_PENDING, accepted consent, valid saved service requirements, required documents verified and unexpired, no pending uploads awaiting review or rejected/reupload-required latest documents | Existing Start & assign confirmation dialog; no automatic mutation |
| Checks to assign | IN_PROGRESS/CLARIFICATION_PENDING with pending checks lacking an active task, or exactly one unassigned movable task | That case's Checks tab |
| Field assignment pending | Physical ADDRESS required, active/clarification/legacy QA case, no non-cancelled visit | Field visits tab; legacy QA cases must explicitly return for field work |
| Field evidence to review | REVIEW_PENDING/EXCEPTION_REVIEW visits in active verification cases | Field visits tab; existing independent supervisor review |
| Replies awaiting action | RESPONDED clarification in a non-final case | Clarifications tab |

Physical assignment does not require waiting for verifier completion; field work can run alongside checks. A marker identifies cases whose verifier work has already finished. No field account is automatically selected. Supervisory approval, final QA readiness and all write permissions remain unchanged.

## Counts, freshness and access

- Big numbers count cases, not files. Supporting quantities show documents/checks/visits/replies separately. One case may belong to multiple categories; do not sum cards as a unique portfolio count.
- Case scope matches Operations/Admin access: tenant restriction always; a branch-scoped Ops user can see their branch and unbranched cases; client scope remains restricted. Only Ops/Admin with dashboard and case read permissions can call the endpoint.
- Filters and aggregates execute in SQL Server. The browser fetches eight rows at a time, not all documents/cases. No binary evidence is fetched for cards. Search is parameterized literal substring search.
- Inbox refreshes every 30 seconds while visible, on focus when stale, and manually. Workflow mutations invalidate related operations queries. This is polling, not push/live streaming; cross-device changes appear on the next refresh.
- Sort: overdue first, then oldest relevant activity, with a stable case-ID tie-breaker. Displayed time is relevant activity, not a fabricated exact time the case entered the queue.
- Search narrows the list, not workspace-wide card counts. Page resets on category/search changes; stale page numbers are clamped by the server. Failed loads show an error, not fabricated zeros.
- Ready-to-start is deliberately conservative: optional fresh uploads also require review before appearing here. Existing manual transition guards remain authoritative and unchanged.

## Verification

Backend isolated tests: `node --import tsx --test --test-isolation=none test/operations-action-inbox.test.ts`.

SQL Server virtual fixture test: `node --import tsx test/operations-action-inbox.readonly.ts`. This needs configured DB access but uses SELECT-only CTE fixtures, not inserts, migrations, temporary tables or shared-row edits.

Browser suite: `e2e/operations-action-inbox.spec.ts` uses intercepted APIs for cards, pagination, search, direct tabs, return navigation, refresh, read-only controls, failure/retry and mobile layout. Existing physical-flow regression is retained.

Deploy both backend and frontend together; the frontend depends on `GET /api/v1/dashboards/operations/actions`. No database migration is required.
