# AwardOS UX remediation ledger

Last updated: 2026-08-19

This ledger tracks the autonomous UX engineering pass. Domain, authorization,
voting-integrity, persistence, and route semantics remain unchanged unless a
finding explicitly states otherwise.

| ID | Batch | Area | Finding | Severity | Root cause | Implementation | Affected routes | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UX-B01-001 | UX-B01 | Event voting discoverability | The event overview exposed a "Votes cast" metric but routed its main voting CTA to the workspace-wide voting hub; event-specific activity was hidden behind generic analytics language | HIGH | A contextual event task used a global destination, and the event-specific destination did not match the organizer's mental model | Link the ballot count and workflow CTA to event analytics; label the destination "Voting activity & analytics" and describe submitted ballots and turnout explicitly | `/events/[id]`, `/events/[id]/analytics` | TypeScript, ESLint, Vitest (22 files / 80 tests), diff check passed; browser E2E remains blocked by test DB timeout | VERIFIED_STATIC |
