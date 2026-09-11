# Remaining workflow work — 9 September 2026

Continue in the existing design and API; preserve the controlled approval/payment flow. This checklist is not a claim of completed deployment.

- [x] Source outreach attempts, source-specific request copy, paginated history and due follow-ups.
- [x] CRM proposal creation, independent approval, factual send/accept records and downloadable PDF.
- [x] Opt-in 24h / 3d / 7d follow-up scheduling and scoped reminders; explicit ownership controls.
- [x] Reviewed commercial attachments and onboarding evidence, preserving legacy clients.
- [x] Report source-detail coverage and differentiated service sections.
- [x] Collections controls and privacy/vendor register, without automatic payment bypass or destructive deletion.
- [x] Regression, negative authorization/concurrency tests, builds and migration verification.

External verification/OCR providers, actual SMTP/SMS delivery and permanent-retention execution need credentials or an approved policy. Never simulate provider success, signatures, delivery, payments or erasure. No Git push or UAT deployment is part of this request.

Verified: 267 backend unit tests, 22 frontend unit tests, 10 browser checks, four real-SQL rollback suites, both builds/type checks/lints and the built Node frontend smoke test. Migration 21 applied and 22 schema/data probes passed. No test tenant persisted and no server was left listening on 4000/4100/8080/8093.

This checklist covers the bounded commercial/source completion batch, not all 51 original audit IDs. Wider partial requirements remain explicit in the [full status register](workflow-upgrade-status.md); use the [tester guide](workflow-completion-testing.md) and [verification record](workflow-upgrade-verification.md). Digital lookup/OCR is Coming soon per user direction; permanent whole-case deletion remains off pending an approved policy.
