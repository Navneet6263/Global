# Case 360: Start & assign

The existing single-case Start verification action and Assignment Workbench remain available.
The new workflow combines **starting a ready case and allocating its remaining unassigned checks**.
It does not approve documents, grant consent, choose verification methods or reassign existing owners.

## Operator steps

1. Open Operations → Case 360. Review candidate evidence as before.
2. Select cases using the checkboxes (maximum 25 across register pages).
3. Click **Start & assign**. This only reads readiness; nothing is started yet.
4. Inspect Ready / Needs attention. Consent, required reviewed documents, expiry and correction requests are checked against each case's stored requirements.
5. Choose **One verifier per case**, **Same verifier for all**, or **Split by check**.
6. Select verifiers explicitly. Options show name, email and active/overdue checks in your authorised workspace. The workload impact section shows projected totals, not a capacity reservation.
7. Confirm start & assignment. Blocked cases are clearly excluded. Each ready case is a separate all-or-nothing transaction.
8. Read per-case results. **Retry failed only** resends the exact failed plan; successful cases are never resubmitted. For stale data, use **Refresh readiness** and review the new allocation before confirming.
9. Assigned checks appear in the verifier queue. Use the existing Workbench for reassignment or later pending work.

## Controls

- Operations / Platform Admin roles plus case read, case transition and task write permissions are required.
- Tenant/client/branch visibility is enforced in preview and again when saving.
- Only DOCUMENT_PENDING and IN_PROGRESS cases can be committed; all others show a reason.
- Existing owners are not overwritten. All remaining available checks in each selected case need an explicit eligible owner (maximum 50 per case).
- Case/check/task versions and serializable transactions protect against concurrent updates.
- Consent and latest required-document readiness are re-evaluated inside the write transaction.
- Case transition, all task assignments, history, audit, notifications and durable operation receipt commit together.
- Idempotency keys and a transactionally saved receipt prevent duplicate work on replay.
- The browser sends at most two case commits concurrently. Failed cases do not undo already successful cases.
- Preview lists up to 250 eligible active verifiers; if truncated, an explicit notice directs the operator to the existing Workbench.
- No database migration, provider integration or changes to verification/QA/report rules are required for this feature.

## Verification

Isolated backend tests cover readiness, scope, optimistic versions, rollback, replay, role/permission metadata and existing bulk assignment behavior. Frontend tests cover request shape, concurrency and stable retry keys. Browser tests use intercepted API fixtures (no shared database writes) for explicit confirmation, blocked cases, retry, cancellation and mobile layout.

Before UAT sign-off, run the operator steps with an authorised test case and verify the actual verifier queue and case audit history. Automated fixture tests do not constitute a shared-database end-to-end verification.
