# Shipping verification log

> **Operational release evidence.** For current product behavior and roadmap,
> see `docs/product/PRODUCT.md`.

## Baseline

- Recorded: 2026-08-15 (Africa/Lagos)
- Branch: `shipping/production-readiness`
- Remote: `origin` -> `https://github.com/ThatHorseRep/AwardOS.git`
- Starting branch: `main`
- Existing dirty worktree preserved without resets or discarded files.
- Migration journal includes `0000_baseline` through `0004_shared_network_voters` in order.
- `0004_shared_network_voters.sql` SHA-256: `F53A1E13734D44A5C04FBC363D5274BE0CED5973BFE587EA13CA38A49255F729`
- Database backup: completed and restore-verified on 2026-08-15 before any new schema change. No credential value was written to this log.

### Database backup evidence

- Production server: PostgreSQL `17.6`.
- Backup tools: `pg_dump` and `pg_restore` `17.11`.
- Full Supabase cluster archive: `C:\Users\HP\Documents\AwardOS Backups\awardos-pre-shipping-2026-08-15T11-11-26-291Z.dump`.
- Full archive size: `336479` bytes; SHA-256 `FF166AD8B2DC0FDD1A3AD55E96CA25F6DE22D419B3B9CE7C5B70E69CA16EFB83`; 565 archive entries.
- AwardOS-owned `public` schema archive: `C:\Users\HP\Documents\AwardOS Backups\awardos-public-pre-shipping-2026-08-15T11-32-19-763Z.dump`.
- Application archive size: `121874` bytes; SHA-256 `ECE4503209B1955DD7E7BDD70187FAA95E134150078A932A001D26F6AE4BA3A4`; 201 archive entries.
- The full cluster archive passed `pg_restore --list`. A stock PostgreSQL restore correctly identified the Supabase-only `supabase_vault` extension as platform-specific.
- The application archive was restored into an isolated PostgreSQL 17 cluster and queried successfully. Restored counts exactly matched the production snapshot: users 4, workspaces 4, events 6, categories 32, nominees 42, nominations 47, vote sessions 1, votes 7, export jobs 0, and audit logs 0. The restored schema contained 28 public tables.
- The isolated restore server was stopped after verification.

## Verified runs

- `npx tsc --noEmit`: passed on 2026-08-15 after the import/export changes.
- `npm test`: 34 tests passed across 6 files on 2026-08-15.
- `npm run lint`: baseline recorded 297 warnings on 2026-08-15; the final release run is zero-warning.
- `npm run build`: passed on 2026-08-15 after the SEO, voting-window, import, and export changes.
- The build logs `DYNAMIC_SERVER_USAGE` warnings while probing authenticated pages that read Supabase cookies; the routes still compile as dynamic pages.
- `react-hooks/exhaustive-deps`: zero warnings across `src` after stabilizing all seven client data loaders with `useCallback`; `npx tsc --noEmit` passed afterward.
- Migration `0005_perfect_misty_knight.sql` was applied after the verified backup. Production inspection confirms `export_format` is exactly `XLSX`, `CSV`, and `JSON`; `export_jobs.payload_snapshot` and `include_sensitive_fields` exist; and `rate_limit_buckets` exists with its primary key and expiry index.
- Shared rate limiting uses one atomic PostgreSQL upsert and SHA-256 keys across public nominations, ballot sessions, ballot submission, OTP requests, AI chat, and AI cleanup. Ten concurrent increments and expired-window reset behavior pass in PGlite.
- Export serialization tests prove real JSON, CSV, and XLSX output, correct MIME types and filenames, readable XLSX content, and spreadsheet formula neutralization. New export jobs store payload snapshots; re-download reads only the snapshot. Jobs estimated above 10,000 rows run through `after()` and are polled from the export dashboard.
- Replaced vulnerable SheetJS `xlsx` with `exceljs`; the download route now awaits real XLSX generation and CSV uses a dedicated formula-safe serializer. Serializer tests, TypeScript, zero-warning lint, and the production build pass.
- Upgraded Next.js from 15.5.22 to 16.3.1, migrated `middleware.ts` to the Next.js 16 `proxy.ts` convention, and marked the authenticated dashboard layout dynamic. `npm audit --audit-level=high` now passes with no high or critical vulnerabilities; six moderate development/transitive advisories remain.
- Latest verification after migration: `npx tsc --noEmit` passed, 39 tests passed across 8 files, and `npm run build` passed on 2026-08-15.
- Final lint inventory: zero warnings and zero errors.

## Environment notes

- A new timestamped backup and restore verification must be repeated before each later production schema batch.
- Production Lighthouse should be repeated after attaching a custom domain and representative production data; the verified local production run is recorded below.

## Final local release gates

- Recorded: 2026-08-16 (Africa/Lagos).
- Removed the unused `date-fns` runtime dependency and declared the ESLint config's direct `@eslint/eslintrc` development dependency.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run lint -- --max-warnings=0`: passed with zero warnings after excluding generated Playwright reports and traces.
- `npm test`: 53 tests passed across 13 files.
- `npm run build`: passed under Next.js 16.3.1; all static and dynamic routes compiled and page generation completed.
- `npm audit --audit-level=high`: passed with no high or critical vulnerabilities. Six moderate transitive advisories remain in development/export dependency chains; the available forced resolutions are breaking downgrades.
- Clean migration harness: 4 tests passed and the complete 31-table schema was created from the migration journal.
- Recursive credential-pattern scan: no secrets found outside explicit template/documentation placeholders.
- Playwright release suite: 14 tests passed without retries across desktop Chromium and Pixel 7 emulation. Coverage includes landing-page privacy and overflow, visible keyboard focus, auth labels, unknown-event privacy, dashboard rendering, security headers, and reduced motion.
- A plaintext Anthropic credential discovered during the audit was removed from local documentation and configuration. It must still be revoked by the credential owner before production deployment because prior exposure cannot be undone by deleting the file contents.
- Resend delivery and the AwardOS email-OTP transition were verified on 2026-08-17.
- Vercel production deployment and both authenticated production cron routes were verified on 2026-08-17.

## Local workflow and performance verification

- Added real-migration integration coverage for import rollback/retry, immutable export re-download snapshots, and audited event soft-delete/recovery.
- A deliberately failed import transaction leaves no import claim, category, or nominee behind; retrying the identical idempotency key then succeeds.
- A completed export serializes identically on repeated downloads and retains its original nominee data after source records are edited.
- A soft-deleted event is excluded from active slug queries, restores inside the recovery window, and retains `event.deleted` and `event.restored` audit entries.
- Existing concurrency integration coverage proves only one invitation code claim succeeds and only one same-fingerprint ballot commits under simultaneous submissions.
- Final local verification after these additions: TypeScript passed, zero-warning lint passed, 56 tests passed across 14 files, and the production build passed.
- Mobile Lighthouse against the local production server: performance 82, accessibility 100, best practices 100, SEO 100; FCP 1.4 s, LCP 2.1 s, TBT 630 ms, CLS 0, Speed Index 2.7 s.
- Lighthouse initially identified dark-mode contrast defects. Dark muted/accent tokens and inverted homepage section colors were corrected; the final report contains zero contrast failures.

## Production release verification

- Recorded: 2026-08-17 (Africa/Lagos).
- Canonical production URL: `https://awardos-alpha.vercel.app`.
- Vercel production build completed successfully under Next.js 16.3.1.
- Production has database, Supabase, Resend, Anthropic, ballot-receipt signing, canonical URL, and cron-secret configuration.
- `/api/admin/purge-accounts` returned HTTP 200 with a successful no-op result.
- `/api/admin/purge-events` returned HTTP 200 with a successful no-op result.
- A real Resend delivery probe was accepted, and an AwardOS `EMAIL_OTP` ballot advanced from email entry to the six-digit verification screen through the real server action.
- Final local gates: TypeScript passed, zero-warning ESLint passed, 56 tests passed across 14 files, production build passed, and `npm audit --audit-level=high` passed.
- Final Playwright suite: 22 standard desktop/mobile checks passed; the explicit real-email test passed separately with a configured recipient and remains skipped by default to prevent unsolicited email during routine runs.

## Responsive voter flow and category import verification

- Recorded: 2026-08-17 (Africa/Lagos).
- Category imports now accept plain text with one category per line, one-column CSV with a `Category` header, and extended CSV rows with optional nominee, bio, and photo URL fields.
- Category-only rows create categories without invalid empty nominee records. Rows that provide nominee details without a nominee name are rejected with a specific validation error.
- Event creation and voting controls now default to link-only visibility. Public event discovery is not implied or required.
- Removed application-level text selection suppression from authenticated, dashboard, nomination, and voting form surfaces.
- The voter ballot review is constrained and centered, its actions stack on narrow screens, and the confirmation page uses the shared AwardOS design tokens without horizontal overflow.
- `npm test`: 60 tests passed across 14 files.
- `npm run lint`: passed with zero warnings and zero errors.
- `npm run build`: passed under Next.js 16.3.1.
- Playwright release suite: 22 checks passed across desktop Chromium and Pixel 7. The suite now types a multiword nominee name with sequential key events, verifies input focus remains active, checks the ballot review for overflow, submits the ballot, and checks the confirmation page for overflow.
