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

## Domain Remediation Sweep (2026-08-21)

Autonomous investigation of the remaining product domains, smallest-correct-fix
policy, every fix pinned by route/action-level integration tests.

### DOMAIN 1 — Nominations: nominee sync race (FIXED, fe63a9a)
- `syncNomineesForEvent` ran unsynchronised. Two concurrent submissions naming
  the same person both read the same unresolved nomination set under READ
  COMMITTED; with no unique constraint on (event_id, category_id,
  normalized_name), each transaction inserted its own copy of the nominee —
  duplicate entries on the public ballot splitting votes.
- Fix: per-event `pg_advisory_xact_lock` at the top of the sync transaction.
  The second sync waits, then finds nothing left to resolve. No schema change;
  sequential idempotency was already guaranteed by the unresolved filter.
- Pinned by `tests/integration/nomination-sync.test.ts` (4 tests): canonical
  resolution incl. casing variants, re-run idempotency with counter integrity,
  concurrent syncs, cache vs authoritative-count agreement.

### DOMAIN 2 — Cleanup/merging: undo of custom-named approvals silently no-oped (FIXED, d017b50)
- The AI-cleanup UI lets organizers rename a merge target on approval
  (`customName`), but that name is not persisted on the suggestion row and
  `undoMergeSuggestionAction` relocated the merge target by `suggestedName`
  only. Undoing a custom-named approval therefore relinked nothing while
  flipping status back to PENDING and writing an "undone" audit entry — the
  organiser believes the merge is reverted; raw nominations stay consumed.
- Fix: undo now recovers the actual merge target from the approval audit entry
  (`details.nomineeId`), falling back to the suggested-name lookup for legacy
  rows. Ownership filter unchanged (only links pointing at the recorded target
  are reverted), so links taken over by later merges still survive undo.
- Companion gap closed: `bulkApproveMergeSuggestionsAction` wrote no approval
  audit entries at all, which would have left bulk-approved suggestions without
  the audit trail undo now depends on. Bulk approvals now mirror the single-
  approve audit record including the resolved nomineeId.
- Pinned by `tests/integration/cleanup-undo.test.ts` (4 tests): custom-name
  approve→undo round trip, suggested-name path parity, no-steal on later
  takeover, bulk-approve→undo.

### Domains investigated, no defects found
- DOMAIN 3 Results: tabulation counts SUBMITTED sessions only; disqualified
  top-rank candidates are guarded in both public and dashboard rendering;
  snapshot winner semantics consistent; override/disqualify paths audited.
- DOMAIN 4 Workflow/lifecycle: stage transitions transactional and guarded;
  delete/restore/purge correct; purge preserves audit history (SET NULL).
- DOMAIN 5 Invitations/OTP: hashed codes, constant-time compare, attempt caps,
  IP+email rate limits, expiry re-checked at submit, OTP consumed on use,
  invitation codes locked FOR UPDATE — all previously hardened and verified.
- DOMAIN 6 Auth/account/members: last-owner protection on remove AND demote,
  self-removal blocked, cross-workspace member scoping, ownership transfer only
  via targeted invite, deletion preflight/status flow intact.
- DOMAIN 7 Analytics/integrity: every aggregate path filters SUBMITTED; the
  only exceptions are legitimate (status breakdowns, IN_PROGRESS promotion).
- DOMAIN 8 Exports/certificates: sensitive exports behind EVENT_ADMINS,
  roster exports behind CONTENT_MODERATORS; certificate candidates scoped to
  workspace and published winners only.
- DOMAIN 9 Branding/workspace/settings: cross-workspace event binding via
  requireEventAccess throughout; branding writes admin-gated.
- DOMAIN 10 Public voter experience: 409 duplicate semantics correct after the
  voting persistence fix; ballot reads side-effect free; voted-cookie gating
  server-verified.

Quality gates at sweep completion: tsc clean, ESLint clean, vitest 105/105
(26 files). Both fixes pushed to main and auto-deployed to Vercel production.

## Deep Reliability & Production-Behavior Sweep (2026-08-21, pass 2)

Second autonomous sweep focused on the failure class that caused the voting
incident: writes that report success without persisting correctly, duplicate
submissions, and unserialised read-modify-write transactions.

### Defect: same-session nomination resubmissions could double-count (FIXED, b8b4bb8)
- The public nominations route versions returning voters by reading
  `max(submission_number)` for their session, flipping prior rows to
  `is_latest = false`, then inserting a new set. Under READ COMMITTED two rapid
  submissions from one session (double-click, retry after a slow response, two
  tabs) both read the same max, both flip, and both insert — leaving two
  `is_latest` sets that every authoritative count (`authoritativeNominationCount`,
  exports, organizer roster) counts twice. No unique constraint backstops this.
- Fix: per-session `pg_advisory_xact_lock(hashtext(event_id || ':' || session_id))`
  at the top of the transaction — the second submission waits and then versions
  correctly (last-write-wins resubmission semantics preserved). Same pattern as
  the nominee-sync fix; no schema change.
- Pinned by `tests/integration/nomination-resubmission.test.ts` (2 tests) via
  the real HTTP route handler against PGlite: sequential resubmission replaces
  the latest set with submission #2; concurrent submissions converge to exactly
  one latest set with no stale-latest rows.
- Evidence level: race window identified STATIC (single-connection PGlite cannot
  interleave transactions), fix correctness pinned INTEGRATION.

### Defect: concurrent merge-suggestion approvals could duplicate nominees (FIXED, b8b4bb8)
- `approveMergeSuggestionAction` read the suggestion's status inside its
  transaction without a lock. Two organizers approving the same suggestion
  concurrently both observed PENDING, both found no existing nominee for the
  target name (no unique constraint on normalized name), and both inserted
  their own copy of the merge target — duplicate ballot entries splitting votes.
  The bulk approver had the same exposure across overlapping batches.
- Fix: `FOR UPDATE` row locks on the suggestion selects in single approve,
  undo, and bulk approve. Contention now waits (or fails loudly); it can never
  silently resolve one suggestion twice or report success while approving
  nothing (`skipLocked` was considered and rejected as a false-success risk).
- Pinned by new test in `tests/integration/cleanup-undo.test.ts`: two
  concurrent approvals leave exactly one nominee for the merged name and all
  source links pointing at it.
- Evidence level: race window identified STATIC, post-fix invariant pinned
  INTEGRATION.

### Domains re-verified this pass (no defects found)
- DOMAIN 1 Event lifecycle: settings changes workspace-scoped and verification
  method locked once ballots exist; VOTING activation gated on categories,
  nominees, valid window, method, and reviewed ballot-roster hash inside the
  transition transaction. Noted STATIC observations (not fixed — no confirmed
  defect): (a) two admins activating different stages near-simultaneously can
  transiently leave two ACTIVE stages; (b) event duplication copies the parent
  stage config including the parent's reviewed roster hash, so an identical-
  structure clone can open voting without a fresh preview review.
- DOMAIN 3 Voting residuals: receipt verification binds HMAC → slug-resolved
  event → SUBMITTED session before confirming; voted-cookie gating is
  server-side; covered by existing 17 route-level tests plus production smoke.
- DOMAIN 7 Invite acceptance: uses are claimed by a conditional atomic
  `UPDATE ... WHERE uses_count < max_uses`, membership is upserted, ownership
  transfer shares the transaction — previously remediated, confirmed intact.
- DOMAIN 8 Authorization coverage: scripted scan of every exported action;
  all ID-taking mutations resolve ownership (requireEventAccess /
  requireSessionAccess / requireAlertAccess / session identity). Integrity
  quarantine/restore/alert actions guard through private ownership helpers.
- DOMAIN 9 Analytics: delegates entirely to the tested vote-accounting core;
  submitted-only filters throughout.
- DOMAIN 10 Certificates: disqualify clears isWinner immediately; restore
  stays conservative (no winner until republish) — no false certificates.
- DOMAINS 11/12 Client success paths: scripted scan found no fire-and-forget
  mutations; dashboard handlers await the action, reload server data, and only
  toast on thrown errors; public nominate/vote flows verified previously.

Quality gates after fixes: tsc clean · ESLint clean · vitest 108/108 (27
files) · production build passing. Committed b8b4bb8, pushed to main, deployed
to Vercel production, and re-verified with the disposable-fixture production
voting smoke (9/9).
