# AwardOS UX refinement ledger

Last updated: 2026-08-19

This pass refines discoverability, task continuity, state guidance, and
accessibility without changing voting, authorization, persistence, or route
semantics.

| ID | Area | User problem | Evidence | Severity | Action taken | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UXR-001 | Dashboard | The workspace headline implied every program was active and recent events were ordered oldest-first | Static source inspection | MEDIUM | Use neutral workspace count and newest-first event ordering | TypeScript, ESLint, Vitest, production build passed | VERIFIED |
| UXR-002 | Event directory | Event cards used the same "Manage" action regardless of lifecycle state | Static source inspection | MEDIUM | Use state-aware actions: Continue setup, Manage live event, Review event | TypeScript, ESLint, Vitest, production build passed | VERIFIED |
| UXR-003 | Workspace activity | Analytics directory used telemetry-heavy language instead of organizer task language | Static source inspection | MEDIUM | Rename to Voting activity and describe submitted ballots, turnout, and pace | TypeScript, ESLint, Vitest, production build passed | VERIFIED |
| UXR-004 | Empty operational states | Analytics, integrity, and results empty states lacked direct recovery guidance | Static source inspection | MEDIUM | Explain prerequisites and add Create event actions | TypeScript, ESLint, Vitest, production build passed | VERIFIED |
| UXR-005 | Public voter flow | Nominee biography overlay bypassed shared accessible dialog behavior | Static source inspection | HIGH | Use canonical Modal with focus trap, Escape, focus restoration, and portal rendering | TypeScript, ESLint, Vitest, production build passed; browser E2E deferred by DB availability | VERIFIED_STATIC |
| UXR-006 | Results terminology | Workspace results directory used a tally-center label that obscured the organizer task | Static source inspection | LOW | Rename to Vote totals & results and use View vote totals action | TypeScript, ESLint, Vitest, production build passed | VERIFIED |
