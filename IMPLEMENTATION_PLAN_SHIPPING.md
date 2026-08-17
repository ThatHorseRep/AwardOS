# AwardOS Shipping Implementation Plan

Status: Ready for implementation  
Scope: Complete the existing product, remove only proven obsolete code, and ship a production-ready AwardOS release.

## Release Rule

No route, button, label, export format, integration, metric, or database field may imply functionality that does not work end to end.

Every implemented capability must have:

- a usable UI entry point;
- a validated server action or route;
- authentication and event/workspace authorization;
- loading, empty, pending, success, and error states;
- auditability where data changes;
- focused automated tests;
- documentation and environment requirements.

Do not remove a module because it is currently disconnected. First classify it as `connect`, `complete`, `supersede`, or `remove`.

## Design Contract

All UI work follows:

- `awardos/.agents/skills/redesign-existing-projects/SKILL.md`;
- `design-spec/00-index.md` through `design-spec/09-motion.md`;
- accessibility and existing application constraints.

Project decisions where guidance conflicts:

- Keep the existing Lucide icon dependency until a deliberate icon migration is approved.
- Use zero letter spacing for UI text.
- Keep the Next.js, React, Tailwind, Drizzle, and Supabase stack.
- Use semantic tokens instead of page-specific hardcoded palette utilities.
- Use Tailwind type, spacing, and radius scales only.
- Use `min-h-dvh`, not `100vh`.
- Use the documented motion curve and `IntersectionObserver` for reveals.
- Never use gradients as page backgrounds.
- Every interactive state needs visible focus, pressed, pending, disabled, empty, and error treatment.

## Phase 0: Baseline and Safety

### Tasks

- [x] Preserve the existing dirty working tree; do not discard user changes.
- [x] Create a dedicated shipping branch.
- [x] Record `git diff`, current branch, remote, and migration state.
- [x] Back up the database before schema changes.
- [x] Confirm migration `0004_shared_network_voters.sql` and Drizzle journal consistency.
- [x] Run and record:
  - [x] `npx tsc --noEmit`
  - [x] `npm run lint`
  - [x] `npm test`
  - [x] `npm run build`
- [x] Document required and optional environment variables in `.env.example`.

### Exit Criteria

- A recoverable branch and database backup exist.
- The baseline failure list is recorded.
- No existing user changes are reverted.

## Phase 1: Production Foundations

### Build and type safety

- [x] Fix `src/app/(dashboard)/integrity/page.tsx:100`: change `Badge variant="destructive"` to `variant="danger"`.
- [x] Resolve all TypeScript build failures.
- [x] Reduce lint warnings to zero for release code.
- [x] Eliminate new `any` usage and type action return values.
- [x] Fix all `react-hooks/exhaustive-deps` warnings.

### Runtime boundaries

- [x] Add `src/app/error.tsx`.
- [x] Add `src/app/global-error.tsx`.
- [x] Add root `loading.tsx` (route-group loading states remain open).
- [x] Add branded `not-found.tsx`.
- [x] Add actionable retry states to client data loaders.

### Network resilience

- [x] Create a shared timeout/cancellation wrapper for client fetches.
- [x] Apply it to public voting, nominations, results, and AI requests.
- [x] Ensure every request has loading and failure handling.
- [x] Never expose raw provider/database exception text to end users.

### Security headers

- [x] Add `poweredByHeader: false`.
- [x] Add `X-Content-Type-Options`.
- [x] Add `Referrer-Policy`.
- [x] Add `Permissions-Policy`.
- [x] Add HSTS in production.
- [x] Add and test a CSP compatible with Supabase Realtime, image uploads, and AI streaming.

### Rate limiting and input boundaries

- [x] Use a shared production rate limiter for public nominations, votes, OTP, AI chat, and AI cleanup.
- [x] Reject oversized request bodies before parsing.
- [x] Add item and field limits to every public and AI payload.
- [x] Replace public `Math.random()` session generation with `crypto.randomUUID()`.
- [x] Use the bounded `getClientIp()` helper everywhere.
- [x] Keep formula-injection protection for spreadsheet exports.

## Phase 2: SEO and Public Web Standards

- [x] Add `src/app/robots.ts`.
- [x] Add `src/app/sitemap.ts`.
- [x] Add dynamic metadata for public event, results, nomination, and voting routes.
- [x] Set transactional pages to `noindex` where appropriate.
- [x] Add canonical URLs and event-specific Open Graph/Twitter metadata.
- [x] Replace the root redirect with a real indexed landing page.
- [x] Add privacy policy and terms links.
- [x] Add a branded 404.
- [x] Ensure every meaningful image has descriptive alt text.
- [x] Ensure every icon-only control has an accessible label.
- [x] Replace raw `<img>` with `next/image`, except explicitly justified data/blob previews.

## Phase 3: Event and Category Management

### Event creation

- [x] Ensure the event builder starts without fictional categories.
- [x] Add explicit template selection.
- [x] Validate event name, slug, timeline, visibility, access, and results settings.
- [x] Validate stage ordering and date relationships.
- [x] Render the actual public URL using `getAppOrigin()`.

### Category CRUD

Add event-scoped actions and UI for:

- [x] create category;
- [x] edit name, description, eligibility, and voter limits;
- [x] reorder categories;
- [x] deactivate category;
- [x] delete category when safe;
- [x] preserve categories referenced by historical ballots.

Required action names:

- `createCategoryAction`
- `updateCategoryAction`
- `deleteCategoryAction`
- `reorderCategoriesAction`
- `deactivateCategoryAction`

All actions must call `requireEventAccess()`.

### Event deletion

- [x] Add a visible event danger zone.
- [x] Require confirmation using the event name.
- [x] Soft-delete through the existing `deleteEventAction`.
- [x] Remove deleted events from lists, counts, public routes, exports, and sitemap.
- [x] Add 30-day recovery UI/action.
- [x] Complete permanent purge after the grace window.
- [x] Prevent unsafe deletion of published or voted events without explicit confirmation.
- [x] Write audit records.

## Phase 4: Event-Scoped Nominations and Nominees

Primary route:

```text
/events/[eventId]/nominations
```

The existing workspace nominations page may remain as an overview, but it must not be the primary operational surface.

### Event-scoped views

- [x] Raw submissions for one event.
- [x] Nominees grouped by category for one event.
- [x] Suggested categories for one event.
- [x] Cleanup review for one event.
- [x] Submission history for one event.

### Nominee actions

Implement and test:

- [x] `getEventNominationsAction(eventId)`
- [x] `getEventNomineesByCategoryAction(eventId)`
- [x] `createNomineeAction(eventId, categoryId, input)`
- [x] `updateNomineeAction(eventId, nomineeId, input)`
- [x] `deleteNomineeAction(eventId, nomineeId)`
- [x] `moveNomineeToCategoryAction(eventId, nomineeId, categoryId)`
- [x] `reorderNomineesAction(eventId, categoryId, nomineeIds)`
- [x] `deactivateNomineeAction(eventId, nomineeId)`

### Public nomination route

- [x] Enforce public visibility.
- [x] Enforce active event status.
- [x] Enforce nomination workflow stage and schedule.
- [x] Validate every category belongs to the event.
- [x] Bound nomination count and body size.
- [x] Sanitize nominee and suggestion text at the boundary.
- [x] Use event-scoped secure sessions.
- [x] Preserve resubmission history.
- [x] Return clear validation and lifecycle errors.

## Phase 5: AI Nominee Cleanup

- [x] Ensure cleanup is triggered from the event-scoped nominations surface.
- [x] Remove blank and invalid records.
- [x] Detect duplicates with deterministic similarity logic.
- [x] Preserve contextual nomination counts.
- [x] Present side-by-side review.
- [x] Support edit, approve, reject, bulk approve, bulk reject, and undo.
- [x] Persist merge relationships correctly.
- [x] Never auto-merge without organizer approval.
- [x] Process large datasets in batches.
- [x] Show progress, partial failures, retry, and completion state.
- [x] Write an audit record for every suggestion and decision.

## Phase 6: Final Ballot Curation and Release

Add:

```text
/events/[eventId]/ballot-preview
```

### Preview requirements

- [x] Render the same category/nominee data as the public ballot.
- [x] Show event branding, instructions, verification method, skip rules, and disclosure mode.
- [x] Support desktop and mobile preview.
- [x] Highlight empty categories and invalid configurations.
- [x] Allow final nominee edits before voting opens.
- [x] Refresh preview after every category or nominee change.

### Activation gate

Voting cannot open unless:

- [x] all required categories are valid;
- [x] categories have eligible nominees or an explicit skip policy;
- [x] timeline is valid;
- [x] verification configuration is valid;
- [x] the organizer has reviewed the complete ballot;
- [x] the activation transaction revalidates the same data.

## Phase 7: Voting and Verification

- [x] Render native accessible radio groups.
- [x] Hide categories with no active nominees or clearly block activation.
- [x] Add complete review modal with skipped-category distinction.
- [x] Keep the review modal open when submission fails.
- [x] Enforce event status and voting stage.
- [x] Enforce start/end timestamps.
- [x] Implement the documented 15-minute started-before-deadline grace window.
- [x] Lock verification method after the first ballot.
- [x] Add OTP resend and verification cooldowns.
- [x] Add invitation-code expiry and race-safe consumption.
- [x] Keep ballots immutable and transactionally recorded.
- [x] Issue and verify per-event cryptographic receipts.
- [x] Test concurrent duplicate submissions for all verification methods.

## Phase 8: Results and Integrity

### Results

- [x] Fix event slug propagation to public results links.
- [x] Compute totals from submitted sessions only.
- [x] Preserve raw results.
- [x] Maintain an editable official-results layer.
- [x] Support disqualification, overrides, special awards, publish, unpublish, and republish.
- [x] Preserve all disclosure modes exactly.
- [x] Audit every official-results change.

### Integrity

- [x] Remove invented IP values and scores.
- [x] Record and display only real signals.
- [x] Support vote spikes, fingerprint duplication, IP clustering, and bot-pattern alerts where data exists.
- [x] Keep organizer approval as the only destructive decision.
- [x] Support quarantine, restore, acknowledge, resolve, and dismiss.
- [x] Add per-category scoring only when backed by real data.
- [x] Connect Slack/email notification delivery or remove unsupported UI claims.

## Phase 9: Import and Export

### Import

- [x] Keep CSV, JSON, and pasted input.
- [x] Support machine-readable PDF category imports with extraction preview; reject image-only PDFs unless OCR is configured.
- [x] Add file-size, row-count, and field validation.
- [x] Add duplicate detection and mapping preview.
- [x] Add dry-run mode.
- [x] Add create/update/skip behavior.
- [x] Add transaction rollback.
- [x] Add idempotency protection.
- [x] Show created, updated, skipped, and failed totals.
- [x] Support downloadable error reports.
- [x] Verify imported rows remain scoped to the selected event.

### Export

- [x] Export raw nominations.
- [x] Export cleaned nominees by category.
- [x] Export raw votes.
- [x] Export official results.
- [x] Export voter/session verification logs with sensitive fields controlled.
- [x] Export analytics summary.
- [x] Export audit logs.
- [x] Export categories and nominee rosters as genuine branded PDF reports.
- [x] Import categories from machine-readable PDF tables through the same preview, validation, idempotency, and rollback path.
- [x] Produce real CSV.
- [x] Produce real XLSX.
- [x] Produce JSON for machine integrations.
- [x] Implement real PDF or remove PDF from all UI and enums until implemented.
- [x] Preserve exact job payloads for re-download.
- [x] Add background processing above the large-dataset threshold.
- [x] Test event isolation and spreadsheet formula safety.

## Phase 10: Workspace Governance

- [x] Mount the command palette.
- [x] Add workspace switcher with deterministic workspace selection.
- [x] Complete member role editing.
- [x] Enforce custom-role permissions, not just labels.
- [x] Implement ownership transfer with two-party confirmation.
- [x] Send invitation emails or clearly remove email-delivery claims.
- [x] Protect the last workspace owner.
- [x] Add audit log UI for owners/admins.
- [x] Enforce workspace and event ownership on every object-ID action.

## Phase 11: AI Assistant, Certificates, Branding, Archive

### AI assistant

- [x] Mount the assistant panel.
- [x] Scope context to the selected event/workspace server-side.
- [x] Support documented generation and summarization workflows.
- [x] Add copy, insert, and export actions.
- [x] Bound models, messages, tokens, and daily interactions.

### Certificates

- [x] Generate from published official winners.
- [x] Apply event branding.
- [x] Escape all SVG values.
- [x] Support print and download without unsafe `document.write` paths.

### Branding

- [x] Fix secondary color persistence.
- [x] Apply branding to public event pages.
- [x] Validate image URLs and color values.
- [x] Support optimized uploads and OG assets.

### Archive

- [x] Add archive configuration UI.
- [x] Auto-archive after publication.
- [x] Add public archive index and event pages.
- [x] Add privacy controls.
- [x] Support nominee anonymization/removal requests.
- [x] Protect permanent deletion.

## Phase 12: Cleanup

Only after all phases above:

- [x] Remove unused stock assets after reference checks.
- [x] Remove unused imports and helpers.
- [x] Remove stale comments and debug artifacts.
- [x] Remove superseded loading components.
- [x] Remove obsolete aliases only after redirect tests.
- [x] Remove unsupported UI claims and placeholder copy.
- [x] Remove unused dependencies only after source and build verification.

## Phase 13: Verification

### Automated gates

- [x] `npx tsc --noEmit`
- [x] `npm run lint -- --max-warnings=0`
- [x] `npm test`
- [x] `npm run build`
- [x] `npm audit --audit-level=high`
- [x] secret scanning
- [x] migration test against a clean database
- [x] end-to-end browser tests

### Required end-to-end scenario

```text
Sign up
→ create workspace
→ invite member
→ assign role
→ create event
→ edit categories
→ import nominees
→ receive public nominations
→ review event-scoped nominations
→ clean and edit nominees
→ preview complete ballot
→ open voting
→ verify voter
→ cast ballot
→ inspect integrity
→ close voting
→ review official results
→ publish results
→ export nominees, voters, and results
→ issue certificate
→ archive event
```

### Manual release checks

- [x] Keyboard-only navigation.
- [x] Screen-reader labels and announcements.
- [x] Mobile nomination and ballot flow.
- [x] Desktop ballot preview.
- [x] Reduced-motion behavior.
- [x] Real OTP delivery.
- [x] Real invitation-code flow.
- [x] Concurrent duplicate ballot submission.
- [x] Import rollback and retry.
- [x] Export re-download.
- [x] Soft-delete and recovery.
- [x] Preview deployment smoke test.
- [x] Production cron execution.
- [x] Response security headers.
- [x] Lighthouse and Core Web Vitals.

## Definition of Done

AwardOS is ready to ship only when:

- every visible feature has a working end-to-end path;
- no UI advertises unsupported behavior;
- no fabricated or placeholder data is presented as real;
- every event operation is event-scoped;
- destructive actions are recoverable or explicitly audited;
- imports and exports are tested with external-style data;
- the complete ballot can be reviewed before voting opens;
- all required quality gates pass;
- production environment and deployment checks pass.
