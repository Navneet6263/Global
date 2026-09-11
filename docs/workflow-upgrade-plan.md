# Document-aligned workflow upgrade

Source: consolidated gap register, 8 September 2026. Preserve the existing colourful UI and working role workspaces. New components/services target 250 lines, maximum 300; split responsibilities instead of replacing dashboards.

## Decisions

- Revised document takes precedence for no operational consent-withdrawal action.
- Manager approval is a separate capability for existing Ops Manager/Platform Admin, with independent reviewer rules.
- Newly approved reports must not be downloadable before successful report-specific payment. Already published legacy reports retain their existing access.
- User authorised using the shared database. No reset or unrelated record changes; migrations reviewed before applying. Testing must not contact real candidates or alter existing cases.
- No automatic Git push, server deployment, provider purchase or external integration activation.

## Implementation checkpoints

- [x] Add compatible service/method, document-review, manager-review and report-billing schema.
- [x] Connect multi-service intake and package document requirements/rates.
- [x] Add audited source-method records and result reconciliation.
- [x] Enforce document readiness, correction/reverification and QA evidence gates.
- [x] Add manager review, prepared-vs-released reports, payment gate and controlled reopening.
- [x] Extend reports with approved snapshots, service sections and safe pagination.
- [x] Add client commercial configuration, bulk intake and scoped billing visibility.
- [x] Connect matching UI controls without changing the existing design language.
- [x] Fix misleading dashboard periods/shortcuts and report wording.
- [x] Run schema validation, type checks, builds, targeted/full unit tests and database-backed rollback tests where feasible.
- [x] Record remaining provider-dependent or unimplemented items honestly in handoff.

These checkpoints describe the implemented bounded upgrade, not completion of all 51 audit IDs. See the [item-by-item status](workflow-upgrade-status.md), [verification record](workflow-upgrade-verification.md) and [tester workflow](workflow-upgrade-testing.md).

Additional completed checks: scoped case activity pagination, client-specific catalogue/TAT selection, human-operated privacy request/incident tracking, monthly statements and page-help updates. Production smoke testing exposed a server-bundle runtime cycle; the Node/PM2 preset and isolated runtime-helper chunk now pass an actual sign-in HTML request without flattening browser lazy chunks.

## External/special scope

OCR/provider verification, marketing website delivery, provider-backed electronic signatures, full privacy request/deletion execution and AI must not be simulated as completed integrations. Original contract files and independent human signature review are now implemented. The user explicitly deferred provider lookup/OCR as Coming soon and approved retention preview/hold without activating whole-case deletion. See the [9 September completion guide](workflow-completion-testing.md) for the added commercial/source controls.
