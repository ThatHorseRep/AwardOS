# Market-Readiness Program Ledger

Controlled audit trail for the AwardOS market-readiness program. One section
per phase; each finding carries an explicit evidence level
(STATIC / UNIT-INTEGRATION / HTTP-RUNTIME / DATABASE / BROWSER / PRODUCTION).

---

## PHASE 0 — BASELINE & RELEASE CONTROL (2026-08-21)

Scope: baseline establishment only. No domain sweeps, no speculative changes,
no schema/data/production modifications.

### Baseline
- Branch `main`, HEAD `8ce35321096c73a4c5735ed217a991e9f026a663`
  ("fix(workflow): serialise stage transitions per event"), synced with origin.
- Working tree clean before and after this phase (only this ledger was added).
- Deployed commit (Vercel project `awardos`, production): `8ce3532…` — exact
  match with local HEAD. [HTTP-RUNTIME, vercel deployments API]
- Production alias `https://awardos-alpha.vercel.app` → HTTP 200.
  [HTTP-RUNTIME]

### Quality gates (re-run during this phase, all passing)
- `tsc --noEmit`: pass · ESLint: 0 errors, 0 warnings · vitest **110/110**
  across 27 files · `next build`: success · git status/diff: clean.

### Configuration [STATIC code scan + PRODUCTION env listing]
- Contract documented in `.env.example`; matches every `process.env.*` read in
  source (Supabase ×3, DATABASE_URL, BALLOT_RECEIPT_SECRET, RESEND_API_KEY,
  RESEND_FROM_EMAIL, CRON_SECRET, NEXT_PUBLIC_APP_URL, AI provider keys,
  SLACK_WEBHOOK_URL optional, TEST_DATABASE_URL test-only).
- Production (Vercel, all Hidden/Sensitive): the 10 core variables above minus
  AI keys — i.e. SUPABASE×3, DATABASE_URL, BALLOT_RECEIPT_SECRET,
  RESEND_API_KEY, RESEND_FROM_EMAIL, CRON_SECRET, NEXT_PUBLIC_APP_URL,
  ANTHROPIC_API_KEY.
- Crons configured (`vercel.json`): `/api/admin/purge-accounts`,
  `/api/admin/purge-events`; both routes exist; CRON_SECRET set so the
  30-day deletion grace actually finalizes. [STATIC + PRODUCTION]
- Dev/E2E auth bypass (`src/lib/dev-mode.ts`) cannot activate in production:
  requires `NODE_ENV=development`, or `AWARDOS_E2E_BYPASS` + `TEST_DATABASE_URL`
  set AND equal to `DATABASE_URL`. TEST_DATABASE_URL absent from production
  env. Verified safe. [STATIC + PRODUCTION]

### Database / migrations
- `src/lib/db/migrations`: 9 journal entries, `0000_baseline` …
  `0008_archive_privacy_requests`; applied end-to-end by the integration
  harness on every test run. [UNIT-INTEGRATION]
- Deployed Supabase schema previously verified to contain the vote-integrity
  indexes/columns. [DATABASE — prior session, read-only]
- Migrations are forward-only (`drizzle-kit migrate`). Backup-before-change
  practice documented in SHIPPING_VERIFICATION.md (2026-08-15 restore-verified
  dumps). No migration executed in this phase.

### Security / repository hygiene
- Secrets: only tracked env file is `.env.example` (negated ignore rule);
  history contains no committed `.env` files; credential-pattern scan of HEAD
  (sk-ant-, sk-, re_, eyJhbGciOi, AIzaSy) found nothing. [STATIC, full-history
  filename filter + HEAD content grep]

### Findings

| ID | Severity | Evidence | Finding |
|----|----------|----------|---------|
| MR-0-F1 | Medium-High | STATIC + PRODUCTION | AI Nomination Cleanup cannot run in production: `src/lib/ai/cleanup.ts` imports the Google provider directly (bypassing the multi-provider resolver in `src/lib/ai/provider.ts`, which defaults to `"google"` when `NEXT_PUBLIC_DEFAULT_AI_PROVIDER` is unset), and production has no `GOOGLE_GENERATIVE_AI_API_KEY` — only `ANTHROPIC_API_KEY`. Every `triggerAICleanupAction` run resolves to an unauthenticated Google client and marks the task FAILED. Core nomination/voting flows are unaffected; the assisted-cleanup feature is unavailable until configured. Recommendation (Phase ≥1, config-only or small refactor): set `NEXT_PUBLIC_DEFAULT_AI_PROVIDER=anthropic` AND route cleanup through the resolver, or supply a Google key. Not changed in Phase 0. |
| MR-0-F2 | Low | PRODUCTION | `npm audit`: 6 moderate, 0 high/critical. Production-relevant: `exceljs→uuid` (missing buffer bounds check). Dev-only chain: `esbuild` dev-server advisory via `drizzle-kit/@esbuild-kit`. `fixAvailable` but behind breaking majors. Recommendation: scheduled dependency bump outside release windows. Not changed. |
| MR-0-F3 | Informational | STATIC | `SHIPPING_VERIFICATION.md` honestly dated 2026-08-15 but predates the eight remediation commits (then 34 tests/6 files → now 110/27). Refresh gate results at next release cut. Not changed. |
| MR-0-F4 | Informational | STATIC | `EXPERIENCE_REMEDIATION_LEDGER.md` and the UX ledgers are thin stubs compared to `REMEDIATION_LEDGER.md`'s standard. Consolidate when next touched. Not changed. |

### Evidence infrastructure inventory
- Production smoke: `scripts/production-smoke-vote.mjs` — disposable labeled
  fixture, self-cleaning cascade, 9 checks; last execution 9/9 PASS (voting
  route unchanged since). [HTTP-RUNTIME]
- Integration: route-level PGlite harness driving real Next.js handlers over
  the full migration chain (110 tests). [UNIT-INTEGRATION]
- Browser: Playwright suite present (`tests/e2e/release.spec.ts`,
  `page-registry.spec.ts`) with guardrails that refuse the main database URL;
  **blocked** pending a disposable `TEST_DATABASE_URL`. [BROWSER — unavailable]
- Database ops: read-only consistency diagnoser, count-cache repair tool,
  backup script, export verifier. [DATABASE-capable]
- Verification gaps: PGlite cannot interleave concurrent transactions (race
  windows provable by inspection only); no browser-level false-success
  verification; no automated production smoke for admin mutations.

### Phase 0 verdict
**PASS WITH DOCUMENTED LIMITATIONS** — trustworthy reproducible baseline;
one feature-level production configuration gap (MR-0-F1) recorded for a later
phase; no Phase 0 defects requiring code changes were found.

---

## PHASE 1 — CORE EVENT READINESS AUDIT (2026-08-21)

Audit-only. No code, config, schema, data, dependency, or deployment changes.

### Scope audited
Full lifecycle: creation wizard → configuration → nominations → voting prep →
workflow transitions → live operations → public voter experience → results →
failure paths → production configuration. Evidence: STATIC source inspection of
every lifecycle action/page plus prior-phase INTEGRATION/HTTP-RUNTIME/PRODUCTION
results reused where the same code paths were previously verified. No new
browser verification performed this phase.

### Lifecycle assessment
- Creation is transactional (event + branding + 6 default stages + categories
  in one transaction); initial state DRAFT; stage names communicate sequence.
  [STATIC]
- Deletion is soft with typed name confirmation, published/ballots guard,
  30-day recovery window, restore + purge actions, audit logs. [STATIC]
- Voting activation guards verified: ≥1 active category, every category has
  eligible nominees, valid window, whitelisted verification method, and
  ballot-review roster-hash acknowledgement (INTEGRATION tests from prior
  phases cover these).
- Verification method locks after first SUBMITTED ballot. [STATIC]

### Findings

| ID | Class | Severity | Evidence | Finding |
|----|-------|----------|----------|---------|
| P1-F1 | CONFIRMED DEFECT | High | STATIC | Stage re-activation unguarded: `updateWorkflowStageStatusAction` (src/actions/events.ts:819) accepts activation of ANY non-active stage; activating an earlier COMPLETED/PENDING stage does not complete or block a later ACTIVE stage (the completion sweep only touches lower displayOrder), and event.status flips back to ACTIVE (line 950). UI exposes "Activate stage now" on every non-active stage incl. COMPLETED (events/[id]/page.tsx:784). Consequences: two mutually exclusive stages ACTIVE at once, or public nominations reopening on a finished event after one misclick. Smallest fix: reject activation unless all higher-order stages are PENDING/SKIPPED + confirmation for re-opening. Regression test required (INTEGRATION). |
| P1-F2 | CONFIRMED DEFECT | High | STATIC | Public slug resolution is cross-workspace ambiguous: slug uniqueness is per-workspace (`unq_workspace_slug`) but `getPublicEventDetailsAction` (events.ts:524), `getPublicBallotDetailsAction` (voting.ts:358), results.ts:218 and integrity.ts:391 filter only `slug = ? AND deletedAt IS NULL LIMIT 1` with no workspace scoping or deterministic ordering. Two workspaces choosing "awards-2026" serve nondeterministically to the public URL. Smallest fix: global unique slug (or scoped resolution key) + collision error at creation. Regression test required. |
| P1-F3 | CONFIRMED DEFECT | High | STATIC | Ballot-settings modal fabricates current verification method from `verificationLevel` (STANDARD→EMAIL_OTP, ADVANCED→INVITATION_CODE) instead of reading stored `verificationConfig.method ?? "NONE"` (voting/page.tsx:55), then submits the fabricated value on every save (line 70). Saving visibility/results mode silently switches voter authentication (e.g., to EMAIL_OTP requiring Resend delivery), or displays a method that was never configured. Smallest fix: prefill from stored config; send method only when explicitly changed. Regression test required. |
| P1-F4 | CONFIRMED DEFECT | Medium-High | STATIC | Create-wizard false-success configuration: step 4's "Advanced OTP Verification" card promises OTP/invitation enforcement but `createEventAction` writes only `verificationLevel`; `verificationConfig.method` stays NONE, so voting opens with NO verification while the landing badge advertises "Advanced voter verification". Inconsistent with settings-modal mapping in P1-F3. Smallest fix: derive method from chosen level at creation (or reword copy). Regression test required. |
| P1-F5 | CONFIRMED DEFECT | Medium-High | STATIC | Timezone-silent scheduling: both create wizard and timeline editor use bare `datetime-local` strings; server parses with `new Date(string)` (server-local = UTC on Vercel), editor redisplays via `toISOString().slice(0,16)` (UTC wall-clock), and no surface discloses UTC. Organizers will set windows believing local time; windows drive public write gating. Local dev parses as browser-local, hiding the bug. Smallest fix: convert to ISO-with-offset client-side and label times with timezone. Regression test required (route-level date normalization). |
| P1-U1 | UX/PRODUCT ISSUE | Low-Med | STATIC | Analytics page shows pulsing "Live Telemetry Connected" badge but loads once on mount with no polling/refresh (analytics/page.tsx:36,82). During live voting the organizer sees a stale snapshot labelled live. Fix: honest wording + manual/auto refresh control. |
| P1-U2 | UX/PRODUCT ISSUE | Low | STATIC | `/e/{slug}/vote/thank-you` reachable directly and headlines "Vote cast and verified … included in the event tally" regardless of whether the visitor voted (receipt card itself only renders from localStorage, so no persistence falsehood). Fix: gate headline on receipt presence. |
| P1-U3 | UX/PRODUCT ISSUE | Low | STATIC | Public landing hardcodes a green "Live" badge and falls back to stageName "Event live" even when nothing is open / event not active (e/[slug]/page.tsx:87,112). CTAs themselves are correctly window-gated. |
| P1-U4 | UX/PRODUCT ISSUE | Low | STATIC | `approveSuggestionAction` creates a category without duplicate-name validation (unlike event creation) and neither approve nor reject suggestion writes an audit log (nominations.ts:118-163). |
| P1-U5 | UX/PRODUCT ISSUE | Info | STATIC | Wizard audience select omits ALUMNI/MEMBERS options that the schema/actions support; terminology ("Link only" vs UNLISTED) consistent enough. |
| P1-U6 | UX/PRODUCT ISSUE | Info | STATIC | Stage activate/complete buttons lack loading/disabled guards; advisory lock makes double-fires safe but produces duplicate audit rows. |
| MR-0-F1 | INTENTIONAL/DEFERRED (PRODUCTION CONFIGURATION GAP) | Med-High | STATIC + PRODUCTION | Confirmed STILL PRESENT: AI cleanup imports Google provider directly; production lacks GOOGLE_GENERATIVE_AI_API_KEY. AI Nomination Cleanup fails in prod; SCREENING stage AI step unavailable; manual cleanup unaffected. Deferred per Phase 0; must be resolved before any event relying on AI screening. |

### Failure & recovery assessment [STATIC + prior INTEGRATION]
Truthful failure feedback and safe retries confirmed across audited surfaces
(toast + reload pattern; submit-time disabled states on vote/nominate/settings;
idempotent-safe transitions under advisory lock; verification-method lock;
typed confirmations for destructive ops). Residual gaps: none blocking at
small scale beyond findings above.

### Production configuration assessment [STATIC + PRODUCTION]
Core env contract satisfied (Phase 0). Feature-affecting gap remains MR-0-F1
(AI cleanup). Email OTP depends on Resend being configured — present in prod.
No dev/E2E bypass reachable in production.

### Small-event readiness verdict
**CONDITIONAL YES** — a single organizer CAN run a 10–50 voter event today IF
they: avoid the ballot-settings modal after initial correct configuration,
treat all times as UTC, do not click "Activate stage now" on completed stages,
and do not depend on AI cleanup. For 50–500 voters the same holds; monitoring
staleness (P1-U1) becomes more painful but is not blocking. Multi-workspace
slug collisions (P1-F2) and multi-admin workflow misuse (P1-F1) are the main
structural risks. P1-F1…F5 should be fixed before commercially operating
events for third parties.

### Phase 1 verdict
**PASS WITH DOCUMENTED LIMITATIONS** — core lifecycle is completable
end-to-end with no data-integrity defect found in voting/nomination
persistence (prior INTEGRATION/PRODUCTION evidence stands), but five confirmed
defects (P1-F1…F5) affect operator trust and configuration correctness and are
queued for remediation phases. No fixes applied in this phase.

