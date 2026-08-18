# AwardOS experience remediation ledger

Last updated: 2026-08-18

This ledger tracks the post-remediation experience engineering pass. Product,
security, voting, result, and persistence semantics remain governed by the
current product documentary and the completed remediation ledger.

| ID | Area | Finding | Severity | Root cause | Change made | Pages affected | Tests | Measurement | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EXP-NAV-001 | Workspace navigation | Workspace switching performed a full document reload | HIGH | Cookie-backed workspace context was refreshed with `window.location.reload()` | Use the authenticated action, replace to the workspace dashboard, and refresh the App Router tree | Dashboard workspace shell and all organizer routes | Targeted shell and release navigation tests | Full document reload removed; workspace context still re-resolves server-side | `workspace operational roll-ups` Playwright test passed on desktop; TypeScript/lint/tests passed | VERIFIED |
| EXP-NAV-002 | Event administration | Category, workflow, and import mutations reloaded the whole event page | HIGH | Mutation handlers used `window.location.reload()` to reacquire event state | Trigger the existing scoped event-detail read while retaining the mounted page, URL tab, and scroll context | PAGE-024 and its category/workflow/import states | Event overview mutation tests | Six full document reloads removed | `event overview exposes workflow timeline save` Playwright test passed on desktop; TypeScript/lint/tests passed | VERIFIED |
| EXP-SPEC-001 | Design documentation | Referenced `design-spec/*` files are absent | INFO | The repository currently exposes product docs and established semantic tokens, but no active design-spec directory | Use current product documentation and implemented semantic tokens as the compatibility baseline; do not invent missing requirements | Global | Repository inspection | Not applicable | Confirmed statically | DEFERRED |
| EXP-UI-001 | Shared primitives | Button, Input, Modal, Toast, and LoadError already provide the required baseline semantics, focus treatment, loading announcement, and reduced-motion handling | INFO | Shared primitives were substantially normalized during B07/B08 | No change required in this pass; retain contextual variants where they serve distinct workflows | Global | Existing unit and release coverage | No measurable regression or missing baseline contract found | Static inspection plus existing test suite | PASS_NO_CHANGE |

Statuses are updated to `VERIFIED` only after targeted and regression evidence
passes.
