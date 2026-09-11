# Mandatory physical address verification

The intake label `Address (physical)` maps to the persisted `CaseCheck.type = ADDRESS`. That saved check is the physical-visit requirement for both new and existing cases. Today's editable package configuration and browser flags cannot remove the requirement. No new column or schema migration is needed.

## Required sequence

1. Client selects a package including Address (physical).
2. Operations reviews intake and starts verification. Verifier tasks and field visits are separate assignments.
3. Operations opens the full case workspace, Field visits, supplies the actual target address/coordinates and chooses an eligible Field Executive.
4. Field Executive captures the required GPS, checklist and evidence. Submission is `REVIEW_PENDING` or `EXCEPTION_REVIEW`, not a completed approved visit.
5. Another authorised supervisor approves field evidence. Only `COMPLETED` satisfies physical verification; cancellation does not waive it.
6. All checks, documents, methods, clarifications and field work must be ready before QA. The existing supervisor-review handler retries QA readiness after approval.

The rule is case-level: a physical visit verifies the candidate address within this case. Multiple package Address checks do not create arbitrary duplicate visits. Every outstanding linked visit still blocks QA, even when one visit was already completed.

## Enforcement and recovery

- The common evidence gate is used for QA promotion, explicit QA transitions, QA approval, manager approval and controlled report release.
- QA list/count queries, detail access, claims and renewals reject missing/incomplete physical work. Other roles' scope restrictions are retained.
- Assigning a field visit locks/increments the case version, preventing a racing QA transition from silently ignoring new field work.
- Operations sees a physical requirement notice in Case 360 and the full workspace.
- Existing affected cases already at QA are not silently rewritten. An authorised Operations/Platform Admin can click **Return for field work** in the full workspace, using the existing versioned transition API. The reason is audited, the QA reservation is cleared, and completed verifier results remain intact.
- Completed/released reports are not automatically withdrawn or rewritten by this change. Review historical issued reports separately if needed.

Verification uses isolated unit tests and browser transport fixtures; no real candidate evidence, field captures, approvals or database migrations are manufactured by the tests. Shared UAT is unchanged until the application changes are deployed.
