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


---

## PHASE 1 REMEDIATION — CORE EVENT READINESS FIXES (2026-08-21)

Commit `275d3cc` (pushed; Vercel production deployment sha-verified). All five
confirmed Phase 1 defects fixed and regression-pinned. 17 tests added
(suite: 110 → 127 across 27 → 29 files).

| ID | Fix | Regression coverage |
|----|-----|---------------------|
| P1-F1 | Forward-only lifecycle in `updateWorkflowStageStatusAction`: only PENDING stages activate (completed/skipped are terminal), only the ACTIVE stage completes, unsupported statuses rejected; event page hides activation buttons the server would reject | stage-transition.test.ts: reactivation rejected, earlier-stage-while-later-active rejected, mark-completed only from ACTIVE, unsupported statuses, auth failure propagates, race test tightened to exactly-one-active + guard-aware |
| P1-F2 | Global unique index on `events.slug` (migration `0009_global_event_slug`, applied to production after verifying zero duplicate live slugs) + friendly collision errors on create and duplicate. Public `/e/{slug}` resolution is now deterministic by construction | event-creation.test.ts: cross-workspace slug rejected with readable error; DB-level uniqueness proven via constraint violation; original event untouched |
| P1-F3 | Ballot-settings modal prefills from stored `verification_config.method` (new `storedVerificationMethod()` helper) and sends the method only when explicitly changed — unrelated saves can no longer rewrite voter authentication or silently flip the level | ballot-settings.test.ts: NONE/EMAIL_OTP/INVITATION_CODE each preserved on unrelated saves, explicit change persists, post-ballot lock intact, helper maps every config shape truthfully |
| P1-F4 | Wizard's Advanced card now persists `verification_config.method = EMAIL_OTP` (STANDARD stays NONE); copy renamed "Advanced Email OTP Verification" and states exactly what is enforced | event-creation.test.ts: ADVANCED → `{method:"EMAIL_OTP"}` persisted; STANDARD → `{method:"NONE"}` preserved |
| P1-F5 | Explicit UTC contract: new `parseUtcDateTimeInput()` used by create/timeline actions (bare datetime-local strings = UTC instants; explicit offsets honored; unparseable input rejected instead of storing garbage); "(UTC)" labels on wizard step 2 and timeline editor | event-creation.test.ts: bare inputs store exact UTC instants; +05:30 / −04:00 offsets round-trip to correct instants; null clearing stores NULLs |

### Gates at close
Vitest 127/127 · tsc clean · ESLint 0 errors/0 warnings · production build
success · git diff --check clean · migration applied to production (DATABASE:
`unq_event_slug` present, no duplicates incl. soft-deleted rows) · deployed
sha equals HEAD.

### Intentionally deferred
MR-0-F1 (AI cleanup Google-key gap) untouched per scope; P1-U1–U6 UX items;
Playwright infrastructure; dependency majors.


---

## PHASE 2 — NOMINATIONS, VOTER INTAKE & EVENT-DATA INTEGRITY AUDIT (2026-08-21)

Scope: audit only. No code, schema, config, or test modifications. Baseline
HEAD `32bf815` (deployed code `275d3cc`), tree clean at start.

### Executive summary
The nomination intake path is well-defended at the boundary (64KB cap, zod
validation, sanitize-to-fixed-point, event-scoped category validation,
DB-backed atomic rate limiting, per-session advisory lock for resubmission
versioning) and the authoritative count layer (`authoritativeNominationCount`,
latest+resolved-only SQL) is consistently used by every read surface — review
roster, clean export, account-deletion impact. Three confirmed defects were
found, all in the **nominee lifecycle** rather than intake: sync resolves
superseded submission versions into phantom ballot nominees (P2-F1), single vs
bulk merge-approval apply different version filters to the same logical
operation (P2-F2), and the public endpoint can acknowledge a payload that
persists nothing (P2-F3). None corrupt counts; all pollute or misdescribe the
ballot roster.

### Coverage matrix
| Area | Result |
|------|--------|
| 2A Public nomination route (auth, window, rate, lock, tx) | PASS — controls verified in code; rate limiter is DB-backed atomic upsert (correct cross-instance) |
| 2B Nominee sync | DEFECT P2-F1 (processes superseded versions); concurrency + idempotency + count-parity otherwise tested and passing |
| 2C Nomination versioning / resubmission | PASS — per-session advisory lock, latest-flag flip, submission numbers regression-pinned |
| 2D Nomination counting | PASS — every reader uses authoritative latest+resolved SQL; denormalized `nominees.nomination_count` maintained by writers but never trusted by reads |
| 2E AI cleanup suggestions (single approve/reject/undo/bulk) | DEFECT P2-F2 (version-filter asymmetry); FOR UPDATE locking, workspace scoping, custom-name undo via audit-derived nomineeId, bulk audit trail all verified intact |
| 2F Ballot roster consumption | PASS mechanics — ACTIVE-only roster, no write in read path, verification config exposure limited to method, roster hash covers effective set, empty-category publish guard present; but roster inherits P2-F1 phantoms |
| 2G Manual nominee CRUD / reorder / move | PASS with observations — RBAC + ballot guards correct; no duplicate-name dedupe on manual create/update (O2) |
| 2H Category deletion guard | PASS — counts all versions, conservative direction |
| 2I Exports & analytics sources | PASS — RAW includes all versions w/ Latest flag, CLEAN uses authoritative count, VOTES_RAW gates sensitive fields, spreadsheet formula neutralization present |
| 2J Bulk import | PASS — idempotency-key claim row, transactional, normalized-name dedupe consistent with sync keys post-trim |
| 2K Receipt verify | PASS — scoped to event + SUBMITTED status |

### Confirmed defects
| ID | Sev | Evidence | Location | Root cause → impact → smallest safe fix |
|----|-----|----------|----------|------------------------------------------|
| P2-F1 | MEDIUM | STATIC code-path trace (runtime repro not performed this phase) | `src/lib/nominations/sync.ts:34-37`; route post-commit sync; `getPublicBallotDetailsAction` ACTIVE-only roster; `deleteNomineeAction` link release | Sync's unresolved query omits `is_latest`, so superseded versions resolve into nominees no latest submission supports → zero-nomination ACTIVE "phantom" nominees appear on the public ballot after an ordinary edit-resubmit, and organizer-deleted nominees can resurrect via the next submission's sync. Fix: filter sync candidates to `is_latest = true`. Regression: resubmission-sequence integration pin asserting nominee set equals latest-supported names and no resurrection post-delete |
| P2-F2 | LOW-MED | STATIC code comparison of both writers | `cleanup.ts:385-397` (single approve, no isLatest filter) vs `cleanup.ts:764-781` (bulk, isLatest=true) | Same logical op consumes different row sets; single-approve silently absorbs superseded rows while bulk leaves them dangling for P2-F1's sync to revive later as phantoms. Fix: add `isLatest=true` to the single-approve link loop and its contextual count query. Regression: single vs bulk resolve identical nomination sets on one fixture |
| P2-F3 | LOW | STATIC boundary analysis | nominations route ~L150-160 (`if (!nomineeText) continue`) + unconditional success response | Zod validates pre-sanitize text (`"<b></b>"` passes `trim().min(1)`), `sanitizePlainText` then empties it; if ALL entries strip empty, endpoint returns success with zero rows persisted and burns rate-limit budget — misleading acknowledgment on a public endpoint. Fix: track inserted count, reject with 422 when zero survive. Regression: tag-only payload expects non-2xx and zero rows |

### Observations / design opportunities (not defects)
- O1 `nominees.nomination_count` is written by four writers but no reader trusts it (all reads use authoritative SQL); candidate for deprecation.
- O2 Manual create/update nominee lacks within-category duplicate-normalized-name guard (organizer-controlled; ballot review hash forces re-review).
- O5 `bulkRejectMergeSuggestionsAction` rejects + audits outside a transaction (partial-failure window).
- O6 Concurrent AI-cleanup triggers can emit duplicate PENDING suggestions (benign: approve dedupes by normalized name).
- O8 `NOMINATIONS_RAW` export always includes sessionId (internal identifier, low sensitivity).

### Verification gaps
- Runtime reproduction of P2-F1/F2/F3 deferred to remediation phase (feasible in existing PGlite harness as RED pins). PGlite's single connection means concurrency interleavings cannot be proven locally — say-so rule applied to all lock claims above.
- Browser-level nomination flow untested (no disposable TEST_DATABASE_URL).
- MR-0-F1 still open: production cannot generate real AI merge suggestions (Google key gap), so suggestion-generation paths remain unit-level evidence only.

### Previously fixed controls revalidated through the writer graph
Voting persistence SUBMITTED guard · nomination resubmission per-session advisory lock · merge-suggestion FOR UPDATE locks (single + bulk) · custom-name undo recovering target from approval-audit `details.nomineeId` (incl. bulk-approved entries) · stage-transition per-event advisory lock · global slug uniqueness (unq_event_slug) · ballot receipt scoped to event + SUBMITTED · public verificationConfig exposure limited to `method`.

### Risk ranking & recommended remediation order
P2-F1 (MEDIUM) → P2-F2 (LOW-MED) → P2-F3 (LOW). F2's fix is one predicate and removes a feeding vector for F1.

### Verdicts
- **Small-event readiness:** CONDITIONAL PASS — intake, versioning, and counting are sound and regression-pinned; phantom-nominee pollution (P2-F1) is organizer-cleanable before publish but degrades trust in self-serve rosters.
- **Market readiness implication:** fix P2-F1…F3 before opening nominations to third-party events at scale; none block internal pilots.

### Phase 2 verdict
**PASS WITH DOCUMENTED LIMITATIONS** — three confirmed defects, zero data-corruption paths found in intake/counting; ledger updated only.


---

## PHASE 2 REMEDIATION — NOMINATIONS INTEGRITY FIXES (2026-08-21)

Commit `05fe202` (code+tests) and `<<P2DOCS>>` (this entry). All three
confirmed Phase 2 defects fixed and regression-pinned. 8 tests added
(suite: 127 → 135 across 29 → 30 files).

### Reproduction evidence (RED, all observed before any fix)
- P2-F1 `does not create ballot nominees from superseded versions`: got
  `['Alice', 'Alicia']` on the ballot roster after an edit-resubmission;
  expected `['Alicia']`. [UNIT-INTEGRATION]
- P2-F1 `cannot resurrect deleted nominees from superseded versions`: got
  `['Alice', 'Alicia', 'Bob']` after organizer-delete + fresh submission;
  superseded "Alice" returned from released links. [UNIT-INTEGRATION]
- P2-F2 `single approval links only the authoritative latest version`: got
  `links.n === 2` — single approval consumed both versions while bulk
  consumed one. [UNIT-INTEGRATION]
- P2-F3 tag-only payload (`"<b></b>"`): route answered HTTP 200 success with
  zero rows persisted; resubmission variant additionally wiped the voter's
  previous latest set. [UNIT-INTEGRATION]

### Root causes & exact remediation
| ID | Root cause | Fix | Files |
|----|-----------|-----|-------|
| P2-F1 | Sync's unresolved query omitted `is_latest`, so superseded versions resolved into phantom nominees; sync also never retired nominees whose latest support vanished | Candidate query filtered to `is_latest = true`; reconciliation step inside the same locked transaction sets `status='REMOVED'` for ACTIVE nominees with `source='NOMINATION'` and zero latest-version links (MANUAL/AI_SUGGESTED untouched; advisory lock, grouping, counting unchanged) | `src/lib/nominations/sync.ts` |
| P2-F2 | Single approve linked/matched all nomination versions; bulk filtered `isLatest=true` | Both predicates added to single approve's matching query and link loop — now byte-for-byte the bulk semantics. FOR UPDATE locking, scoping, audit, custom names, undo untouched | `src/actions/cleanup.ts` |
| P2-F3 | Sanitize ran inside the tx with silent skip; empty-payload success possible | Sanitize moved BEFORE the transaction (entries that strip empty can no longer burn submission numbers or flip the prior latest set); payload where ALL entries strip empty rejected with HTTP 422 pre-tx. Rate limit, window checks, session lock, suggestion flow unchanged | `public/.../nominations/route.ts` |

### Tests added / updated
- `tests/integration/nomination-resubmission.test.ts`: +2 P2-F1 pins (phantom
  prevention incl. REMOVED-retirement assertion + authoritative-count check;
  superseded-vector resurrection prevention). [UNIT-INTEGRATION]
- `tests/integration/cleanup-undo.test.ts`: +2 P2-F2 pins (single approve
  latest-only incl. cached-counter parity; single/bulk equivalence). Existing
  undo/no-steal/concurrency pins pass unmodified. [UNIT-INTEGRATION]
- `tests/integration/nomination-route-sanitization.test.ts`: new file, 4 P2-F3
  pins (tag-only → non-2xx with zero rows; valid nomination persists; mixed
  payload keeps sanitized-but-real entries; rejected resubmission cannot wipe
  the prior valid set). [UNIT-INTEGRATION]

### Verification at close
RED phase reproduced all four defect behaviors first; GREEN after fix.
Vitest **135/135** across 30 files · tsc clean · ESLint 0 errors/0 warnings ·
production build success · `git diff --check` clean · diff inspection
confirms no changes outside the three fix targets and their tests (no schema,
dependency, or unrelated-route changes).

### Post-deploy
Deployed commit sha-verified against Vercel production; existing
`scripts/production-smoke-vote.mjs` executed against the live alias (PASS).
No browser-based nomination-flow verification performed (no disposable
TEST_DATABASE_URL) — stated explicitly.

### Known limitation (documented, not silently expanded)
Deleting a nominee whose LATEST source nomination is still unresolved lets the
next sync re-resolve it — identical semantics to a fresh nomination of that
name arriving, since the voter's current intent is on record. Preventing that
would need a nominations exclusion marker (schema change), out of scope per
change-control rules. The SUPERSEDED-version revival vector is closed and
pinned; MANUAL/AI_SUGGESTED nominees are never auto-retired.
