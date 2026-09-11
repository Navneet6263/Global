# Loading feedback

Frontend behaviour, 9 September 2026. No API permissions, workflow transitions or database schema changes.

- Shared `Button` accepts `loading`. Pending buttons are disabled, retain an accessible label and show a spinner. Validation-only disabled controls do not look busy.
- Existing action controls use their actual mutation/form state across CRM, users, clients, settings, case delivery, verification, QA, finance, reports, candidate uploads and field work. Native custom controls expose `aria-busy` with the same spinner styling.
- The root activity indicator covers navigation, initially loading observed queries, mutations, uploads and downloads, including dialogs and public pages. It does not block the screen or invent a completion percentage.
- Routine notification reads, token refresh and navigation-badge requests do not trigger foreground request feedback. Offline-paused mutations are labelled as waiting for connection, not completed.
- Foreground request counters finish on success, rejection or abort. Session reset clears counters and old completions cannot affect a new user's activity. No filenames, URLs or sensitive payloads are stored in the tracker.
- CRM client handoff and win/loss confirmation expose pending states; assignment selectors and user/client action menus lock their affected action while its request runs.

For a single asynchronous action, pass `loading={mutation.isPending}` to `Button` (or `aria-busy` and `disabled` to a native button). When actions share a mutation, scope loading to its action **and** record identity, for example `loading={review.isPending && review.variables === "APPROVED"}`. Keep all conflicting controls disabled using the shared pending state, but do not give them a spinner. Scope loading icons and pending labels the same way. A query refresh or validation-only disabled state is not a button action. Preserve existing success/error handlers; a spinner is not a success acknowledgement.

## Verification

- Unit tests cover concurrent requests, session resets, failure cleanup, quiet polling/refresh, downloads and authenticated multipart uploads.
- Browser tests hold a CRM upload response to verify immediate busy feedback, disabled duplicate clicks, successful cleanup and retry after rejection. Network fixtures are test-only; they do not write to shared SQL or object storage.
- Delayed contract review tests cover both approve/replacement directions, blocked duplicate/competing clicks, failure cleanup and retry with the other decision. Report download tests verify per-row feedback; QA renewal verifies that release and submit stay disabled without spinning.
- Existing login/mobile/accessibility, help, QA and verification-source browser checks remain applicable.

This improves feedback while a request runs; it does not itself reduce database/API response times. UAT still requires deployment of the updated frontend.
