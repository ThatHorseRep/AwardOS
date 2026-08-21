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
