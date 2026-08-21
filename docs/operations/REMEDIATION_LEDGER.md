# AwardOS remediation ledger

Last verified: 2026-08-18

This ledger distinguishes route-level runtime coverage from focused behavioral
coverage. A route smoke pass proves that the registered page returned a
non-error response, rendered without an application error, and had no
horizontal document overflow at 360px, 768px, and 1280px. It does not by
itself prove every loading, empty, error, success, permission, or mutation
state.

## Global verification evidence

- All 49 registered `page.tsx` routes: runtime smoke passed at 360px, 768px,
  and 1280px in `tests/e2e/page-registry.spec.ts`.
- Focused release flows: covered by `tests/e2e/release.spec.ts`.
- Browser synchronization regression coverage: the integrity, official-export,
  and workspace-invitation/settings flows passed in isolated
  desktop/tablet/mobile runs after heading-selector, destination-stream retry,
  and test-invitation fixture hardening. The complete 99-test release command
  now exits successfully with no failure artifacts. Next continues to emit
  intermittent `destination stream closed early` server logs during rapid
  navigation, but they no longer result in failed routes or assertions.
- Workspace operational roll-ups: populated navigation and horizontal-overflow
  checks passed at 360px, 768px, and 1280px. Relevant mutations are verified
  through their event-level or settings consumers. Rapid chained navigation
  emitted non-failing development-server `destination stream closed early`
  logs, but no route or assertion failed.
- Domain and accounting rules: 80 passing unit/integration tests across 22
  files.
- TypeScript and production build: passing.
- Real arbitrary-recipient email OTP: deployment-deferred until a verified
  sender domain exists. Resend's test sender remains usable for the account
  owner's email, and invitation-code voting remains production-capable.

## Page ledger

| ID | Route | Page | Route/viewport gate | Focused behavioral evidence | Status |
| --- | --- | --- | --- | --- | --- |
| PAGE-001 | `/` | Landing | PASS | Landing, keyboard, reduced motion, security headers | VERIFIED |
| PAGE-002 | `/privacy` | Privacy | PASS | Legal content hierarchy, home navigation, and responsive overflow at all required viewports | VERIFIED |
| PAGE-003 | `/terms` | Terms | PASS | Legal content hierarchy, home navigation, and responsive overflow at all required viewports | VERIFIED |
| PAGE-004 | `/sign-in` | Sign In | PASS | Labels, controls, redirect-intent unit coverage | VERIFIED |
| PAGE-005 | `/sign-up` | Sign Up | PASS | Labels, password visibility, 44px inputs, responsive auth layout | VERIFIED |
| PAGE-006 | `/forgot-password` | Forgot Password | PASS | Initial form, labeled 44px input, responsive auth layout | VERIFIED |
| PAGE-007 | `/reset-password` | Reset Password | PASS | Invalid/expired recovery state and recovery navigation | VERIFIED |
| PAGE-008 | `/verify-email` | Verify Email | PASS | Guidance state and sign-in navigation | VERIFIED |
| PAGE-009 | `/account/recover` | Account Recovery | PASS | Seeded deletion-grace state, restore action, dashboard redirect, and responsive runtime at all required viewports | VERIFIED |
| PAGE-010 | `/invite/[token]` | Workspace Invitation | PASS (valid and invalid states) | Invalid-token and valid invitation details runtime states, role display, accept control, and responsive overflow at all required viewports | VERIFIED |
| PAGE-011 | `/e/[slug]` | Public Event Landing | PASS | Valid/unknown event, privacy, mobile | VERIFIED |
| PAGE-012 | `/e/[slug]/nominate` | Public Nomination | PASS | Submission, mobile input/focus, workflow policy | VERIFIED |
| PAGE-013 | `/e/[slug]/nominate/confirmation` | Nomination Confirmation | PASS | Confirmation content, share dialog focus/Escape behavior, return navigation, mobile overflow | VERIFIED |
| PAGE-014 | `/e/[slug]/vote` | Public Ballot | PASS | Normal ballot, review, invitation gating, mobile | VERIFIED |
| PAGE-015 | `/e/[slug]/vote/thank-you` | Vote Receipt | PASS | Signed submission navigation and overflow | VERIFIED |
| PAGE-016 | `/e/[slug]/results` | Public Results | PASS | Hidden disclosure and unknown-event privacy verified at desktop/tablet/360px; disclosure and result-math unit coverage | VERIFIED |
| PAGE-017 | `/archive` | Public Archive | PASS | Populated archive fixture and archive-detail navigation | VERIFIED |
| PAGE-018 | `/archive/[slug]` | Archived Event | PASS | Populated event, nominee roster, privacy form labels/controls, and not-found runtime state | VERIFIED |
| PAGE-019 | `/embed/nominee/[id]` | Nominee Embed | PASS | Populated nominee fixture | VERIFIED |
| PAGE-020 | `/dashboard` | Dashboard | PASS | Authenticated shell desktop/mobile | VERIFIED |
| PAGE-021 | `/events` | Event List | PASS | Populated fixture and navigation to manage | VERIFIED |
| PAGE-022 | `/events/new` | Create Event | PASS | Labeled/mobile-safe wizard at all viewports; full template-based creation mutation on desktop | VERIFIED |
| PAGE-023 | `/events/deleted` | Deleted Events | PASS | Recoverable-event restore mutation plus empty state and responsive overflow checks | VERIFIED |
| PAGE-024 | `/events/[id]` | Event Overview | PASS | Workflow timeline tab, non-destructive timeline save, success feedback, and responsive runtime at all required viewports | VERIFIED |
| PAGE-025 | `/events/[id]/nominations` | Event Nominations | PASS | Populated nominees, raw/suggestion empty states, nominee creation, responsive runtime, and authoritative-count integration coverage | VERIFIED |
| PAGE-026 | `/events/[id]/suggested-categories` | Suggested Categories | PASS | Populated suggestion approval, canonical labeled input, resulting empty state, and responsive runtime | VERIFIED |
| PAGE-027 | `/events/[id]/ai-cleanup` | AI Cleanup | PASS | Safe pre-run UI state across all viewports plus cleanup merge and batching domain coverage | VERIFIED |
| PAGE-028 | `/events/[id]/ballot-preview` | Ballot Preview | PASS | Populated desktop/mobile preview | VERIFIED |
| PAGE-029 | `/events/[id]/results` | Event Results | PASS | Populated authoritative tallies, accessible special-award fields, responsive runtime, and disclosure/math coverage | VERIFIED |
| PAGE-030 | `/events/[id]/analytics` | Event Analytics | PASS | Populated submitted-ballot/category metrics and responsive runtime | VERIFIED |
| PAGE-031 | `/events/[id]/integrity` | Event Integrity | PASS | Submitted-session registry, read-only audit scan, responsive runtime, and accounting coverage | VERIFIED |
| PAGE-032 | `/events/[id]/exports` | Event Exports | PASS | Official-results JSON download at desktop/tablet/360px plus export redaction/serialization coverage | VERIFIED |
| PAGE-033 | `/events/[id]/invitations` | Invitations | PASS | Populated generator/listing, isolated code generation, labeled controls, and responsive runtime | VERIFIED |
| PAGE-034 | `/events/[id]/branding` | Event Branding | PASS | Portal preview, palette controls, accessible navigation, and responsive runtime | VERIFIED |
| PAGE-035 | `/events/[id]/archive` | Archive Event | PASS | Archive visibility/privacy-request states, responsive runtime, and archive action coverage | VERIFIED |
| PAGE-036 | `/nominations` | Nominations Roll-up | PASS | Populated workspace event listing, event-management navigation, and responsive overflow at all required viewports | VERIFIED |
| PAGE-037 | `/voting` | Voting Hub | PASS | Ballot settings modal labels, reversible visibility save/restore mutation, success feedback, and responsive runtime at all required viewports | VERIFIED |
| PAGE-038 | `/results` | Results Roll-up | PASS | Populated workspace event listing, event-results navigation, result-engine coverage, and responsive overflow at all required viewports | VERIFIED |
| PAGE-039 | `/analytics` | Analytics Roll-up | PASS | Populated workspace event listing, analytics navigation, analytics-metrics coverage, and responsive overflow at all required viewports | VERIFIED |
| PAGE-040 | `/exports` | Exports Roll-up | PASS | Populated workspace event listing, export navigation, export-engine coverage, and responsive overflow at all required viewports | VERIFIED |
| PAGE-041 | `/branding` | Workspace Branding | PASS | Populated event selector, child-branding navigation, preview link, and responsive overflow at all required viewports; mutation is covered by PAGE-034 | VERIFIED |
| PAGE-042 | `/cleanup` | Cleanup Roll-up | PASS | Populated workspace event listing, cleanup navigation, cleanup-merge coverage, and responsive overflow at all required viewports | VERIFIED |
| PAGE-043 | `/integrity` | Integrity Roll-up | PASS | Populated workspace event listing, integrity navigation, accounting coverage, and responsive overflow at all required viewports | VERIFIED |
| PAGE-044 | `/certificates` | Certificates | PASS | Top-level workspace certificate studio verified with published-winner empty state at 360px, 768px, and 1280px; isolated published-winner fixture verified recipient selection, enabled print, and SVG download | VERIFIED |
| PAGE-045 | `/team` | Team | PASS | Isolated invitation-link generation and revocation, responsive modal/list behavior at all required viewports | VERIFIED |
| PAGE-046 | `/settings` | Settings | PASS | Settings directory links and responsive navigation at all required viewports | VERIFIED |
| PAGE-047 | `/settings/profile` | Profile | PASS | Isolated display-name save, reload persistence, restore mutation, and responsive runtime at all required viewports | VERIFIED |
| PAGE-048 | `/settings/ai` | AI Settings | PASS | Deployment-secret privacy guidance, provider status/default display, and responsive runtime at all required viewports | VERIFIED |
| PAGE-049 | `/settings/account` | Account | PASS | Deletion impact/preflight UI, safe blocked-owner state, remediation link, and responsive runtime at all required viewports; no destructive submission performed | VERIFIED |

## Current totals

- Registered pages: 49
- Audited: 49
- Route/runtime viewport gate passed: 49
- Focused page verification currently evidenced as complete: 49
- Specification decision required: 0
- Pages requiring additional state or mutation evidence: 0

All registered pages have passed the route/viewport gate and focused page
verification requirements recorded by this remediation program.

## Voting persistence incident — 2026-08-21

A real-world failure report ("votes submit successfully but are not recorded;
the same voter can vote repeatedly") was reproduced, root-caused, fixed, and
regression-pinned.

- Root cause: the NONE-mode guard in
  `src/app/api/public/events/[slug]/votes/route.ts` rejected any submission
  whose session token already existed in `vote_sessions` regardless of status.
  The ballot-session initialization route creates an `IN_PROGRESS` row with
  that same token on every ballot page load, so every first submission from a
  normal browser session was rejected as "already cast" (HTTP 409). The client
  treats 409 "already cast" as a duplicate-vote redirect to the thank-you page,
  producing a false success with nothing persisted and unlimited retries.
  Verified-mode (EMAIL_OTP / INVITATION_CODE) events were unaffected because
  their guards match on verified email or code status.
- Fix: the guard now matches only `status = 'SUBMITTED'` sessions; the
  pre-existing `IN_PROGRESS` promotion path handles initialization rows as
  designed. Duplicate protection (token replay 409, device-fingerprint partial
  unique index, email/code constraints, concurrent-submission safety) is
  unchanged and re-proven.
- Regression coverage: `tests/integration/vote-persistence.test.ts` drives the
  real route handlers against a real Postgres (PGlite) through the full
  production sequence — ballot-session init → submit → database inspection →
  receipt verification → Voting Activity accounting → results tabulation — for
  NONE, EMAIL_OTP, and INVITATION_CODE modes, plus failure/retry/window
  behaviour. 17 tests. The prior dedup suite inserted sessions via raw SQL and
  could not see route-level defects; that gap is now closed.
- OTP edge case reviewed and pinned as intended: the pre-submit email match
  intentionally ignores session status so FLAGGED/INVALIDATED ballots block the
  same email from immediately recasting. `IN_PROGRESS` rows never carry a
  verified email, so first-time voters cannot false-positive.
- Deployed-database check (read-only): all three `vote_sessions` unique
  indexes, both `votes` indexes, and all vote columns present in the configured
  Supabase project; row distribution (5 IN_PROGRESS vs 1 SUBMITTED sessions)
  corroborates the reported non-persistence before the fix.
- Deployment and production verification: committed as 997b9da, pushed to
  main, auto-deployed to Vercel production (Ready). A controlled smoke vote
  against a disposable labeled event (`scripts/production-smoke-vote.mjs`,
  self-cleaning cascade) passed all 9 checks against the live production API:
  init 200, submission 200 with receipt, one SUBMITTED session, correct vote
  row, duplicate 409, no extra rows, cleared-storage retry 409. Production
  voting persistence is verified.
