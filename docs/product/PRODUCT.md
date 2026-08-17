# AwardOS Product Documentary

**Document status:** Current production-state reference

**Product version:** Production-readiness release (`8ab9f98`)

**Last verified:** August 17, 2026

**Production:** https://awardos-alpha.vercel.app

**Repository:** https://github.com/ThatHorseRep/AwardOS

**Archived pre-release version:** Git tag `v1-before-production-readiness`

## 1. Product Overview

AwardOS is an end-to-end operating system for running private, link-shared award programs. It replaces the fragmented combination of forms, spreadsheets, messaging groups, manual nominee cleanup, and opaque vote counting with one event-scoped system.

The current product supports the complete organizer journey:

```text
Create account and workspace
-> invite and assign collaborators
-> create or duplicate an event
-> configure categories, timeline, branding, and privacy
-> collect or import nominations
-> review and clean nominees
-> audit the complete ballot
-> open voting
-> verify voters
-> collect immutable ballots
-> investigate integrity alerts
-> close voting and publish results
-> export operational data
-> issue certificates
-> archive the event
```

AwardOS is deliberately private by default. Events are not promoted in a public directory. Participants reach an event through the exact link shared by its organizer.

## 2. Product Positioning

### Primary market

- University and student organization awards
- Youth communities and campus associations
- NGOs, churches, clubs, and professional communities
- Internal company or departmental recognition programs

### Core value

- One system from nomination to archive
- Human-controlled AI nominee cleanup
- Event-scoped data and operations
- Auditable voting and result decisions
- Mobile-first participant flows
- Recoverable deletion and privacy controls
- Import/export compatibility with external databases

### Current product principles

- Organizers retain final authority over nominees, ballots, and official results.
- Public events are unlisted, not globally discoverable.
- A ballot is reviewable before voting opens.
- Submitted ballots are write-once.
- Destructive operations are recoverable where practical and audited.
- Visible controls must perform real operations; unsupported controls are not shown.
- No fabricated dashboard data is presented as real activity.

## 3. User Types

### Organizer or workspace owner

Creates workspaces and events, manages collaborators, configures the workflow, reviews nominations, opens voting, publishes results, exports data, and controls the archive.

### Event manager or committee member

Performs permitted operational work according to built-in or custom workspace roles.

### Nomination participant

Uses a shared event link to nominate people or organizations without creating an AwardOS account.

### Voter

Uses a shared ballot link, completes the configured verification method, reviews selections, and submits one immutable ballot.

### Nominee

Appears on an event ballot and may later be included in published results, certificates, embeds, and archives. Archived nominees can submit anonymization or removal requests.

### Platform operator

Maintains Vercel, Supabase, Resend, AI-provider credentials, backups, migrations, scheduled deletion jobs, security monitoring, and releases.

## 4. Implemented Product Capabilities

### 4.1 Authentication and accounts

- Email/password registration and sign-in through Supabase
- Google authentication support through the Supabase configuration
- Email verification callback handling
- Forgot-password and password-reset flows
- User profile and avatar management
- Account deletion preflight
- Thirty-day recoverable deletion window
- Cancellation of a pending account deletion
- Automated permanent account purge through an authenticated cron route
- Protection against deleting the development bypass account
- Prevention of unsafe deletion where workspace ownership obligations remain

### 4.2 Workspaces and team management

- Multiple workspaces per account
- Workspace switching
- Workspace member listing
- Email or link-based invitations
- Invitation acceptance and revocation
- Built-in role assignment
- Custom roles with permission sets
- Member removal
- Workspace-level audit log
- Server-side RBAC on protected actions

### 4.3 Event creation and lifecycle

- Event creation with name, slug, description, categories, and workflow stages
- Event detail and management dashboard
- Event duplication with a new name and slug
- Independent workflow-stage status and scheduling controls
- Event visibility controls
- `UNLISTED` shared-link access
- `PRIVATE` access denial on public routes
- Soft deletion with a recovery window
- Deleted-event management and restoration
- Protected permanent event purge
- Automated purge of expired deleted events
- Audit records for delete, restore, and purge operations

### 4.4 Categories and nominees

- Create, edit, deactivate, delete, and reorder categories
- Create, edit, deactivate, delete, move, and reorder nominees
- Category deletion protection where active dependencies exist
- Event-scoped nominee management
- Nominee biographies, photos, and display ordering
- Final ballot roster editing before voting
- Ballot-review acknowledgement before voting opens

### 4.5 Public nominations

- Mobile nomination form reached through the event link
- Multiple category nominations in one submission
- Optional category suggestions
- Submission confirmation page
- Browser-side previous-submission indicator
- Server validation and sanitization
- Request-size limits
- Shared database-backed rate limiting
- Event status, visibility, and nomination-stage enforcement
- Event-scoped organizer nomination inbox
- Suggested-category review, rename, approval, and rejection
- Nomination-to-nominee synchronization

### 4.6 Imports

- CSV-style pasted-data import
- Spreadsheet-compatible category and nominee import
- PDF category/nominee extraction
- Preview before applying an import
- Validation of categories, nominees, biographies, and image URLs
- Formula-injection protection for spreadsheet content
- Transactional rollback on failure
- Idempotency keys for safe retries
- Compatibility with externally maintained nominee databases

### 4.7 AI nominee cleanup

- AI-assisted normalization and duplicate detection
- Provider support for Anthropic, Google, and OpenAI configurations
- Deterministic Levenshtein fallback
- Confidence tiers and match explanations
- Side-by-side merge review
- Individual approve/reject actions
- Bulk approve/reject actions
- Undo for approved merges
- Failed-task retry
- Event-scoped cleanup history and audit trail
- Human approval required before a merge is applied
- AI assistant drafts that can be inserted into an event description

### 4.8 Ballot preparation

- Complete ballot preview grouped by category
- Desktop preview surface for organizers
- Final nominee add, edit, move, reorder, deactivate, or delete operations
- Category add, edit, reorder, deactivate, or delete operations
- Explicit pre-opening ballot audit acknowledgement
- Voting-stage protection until required preparation is complete

### 4.9 Voting

- Mobile-first public ballot
- One nominee selection per category
- Category skipping
- Progress indicator
- Accessible radio groups and labels
- Bounded ballot-review dialog
- Final selection summary before submission
- Write-once submission behavior
- Thank-you and receipt page
- Cryptographically signed ballot receipts
- Receipt verification
- HTTP-only voted-state cookie
- Duplicate session, device, email, and invitation-code protections
- Transactional invitation-code claiming
- Concurrent duplicate-submission protection at the database level
- Voting-stage schedule enforcement with an in-progress grace rule
- Network rate limiting

### 4.10 Voter verification

- Open voting with no identity challenge
- Email OTP verification
- Cryptographically generated six-digit codes
- Hashed OTP storage
- Expiry and attempt limits
- Resend delivery with explicit delivery-error handling
- Invitation-code verification
- Bulk invitation-code generation
- Invitation-code labels, expiry, status, search, and revocation
- Domain and voter allowlists in ballot settings

### 4.11 Integrity operations

- Event integrity scans based on real vote-session data
- Duplicate and suspicious-session analysis
- Severity-based alerts
- Alert acknowledgement and resolution notes
- Session quarantine and restoration
- Workspace integrity summary
- Event-scoped vote-session inspection
- Slack webhook notifications when configured
- Notification delivery audit records
- No fabricated IP addresses, threats, or risk figures

### 4.12 Results

- Event-scoped vote tallying
- Ranked category results
- Tie handling
- Nominee disqualification and restoration
- Official rank overrides with mandatory explanations
- Special or organizer-selected awards
- Results publication and withdrawal
- Public result pages only after publication
- Live result listener support
- Raw-ballot and voter-log exports for authorized organizers

### 4.13 Analytics

- Event analytics based on persisted records
- Nomination and voting activity counts
- Category-level participation data
- Funnel and engagement information available from the event analytics surface
- Workspace navigation to event-specific analytics

### 4.14 Exports

- Nominee, voter, result, and operational export jobs
- CSV export
- Real XLSX export through ExcelJS
- JSON export
- PDF reports
- Safe filenames and MIME types
- Spreadsheet formula neutralization
- Immutable payload snapshots for reliable re-downloads
- Asynchronous processing path for large export jobs
- Export job history and re-download
- Print and download behavior without unsafe `document.write`

### 4.15 Branding and sharing

- Event logo, banner, and Open Graph asset uploads
- Client-side image compression
- URL and color validation
- Primary and secondary event colors
- Branding applied to shared public event pages
- Share-kit modal and event links
- Nominee embed page
- Dynamic public metadata for event, nomination, voting, and result pages

### 4.16 Certificates

- Certificate candidate listing from published results
- Printable/downloadable certificate generation
- Event and recipient information in generated certificates
- Safe browser print/download path

### 4.17 Archive and privacy

- Event archive configuration
- Automatic archival after publication when configured
- Public archive index
- Public archived-event pages
- Optional winner and nominee visibility
- Nominee anonymization requests
- Nominee removal requests
- Organizer review and resolution of privacy requests
- Protected permanent deletion

### 4.18 SEO, accessibility, and web standards

- Root metadata and per-event dynamic metadata
- Open Graph and social-card metadata
- `robots.txt`
- `sitemap.xml`
- Semantic page landmarks
- Skip-to-content navigation
- Labeled form fields and icon controls
- Live regions for loading, verification, success, and error states
- Keyboard focus visibility
- Reduced-motion support
- Responsive desktop and mobile layouts
- Branded error, loading, not-found, and global-error states

## 5. System Architecture

### Frontend

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Lucide icons
- Server components where appropriate and client components for interactive workflows

### Backend

- Next.js server actions for authenticated domain operations
- Route handlers for public HTTP APIs, downloads, authentication callbacks, and cron jobs
- Zod validation at input boundaries
- Drizzle ORM
- PostgreSQL hosted by Supabase

### External services

- Supabase Auth and PostgreSQL
- Vercel hosting and scheduled cron execution
- Resend transactional email
- Anthropic, Google, or OpenAI for optional AI features
- Slack webhook for optional integrity notifications

### Data ownership model

```text
User
-> Workspace membership and role
-> Workspace
-> Event
-> Workflow stages
-> Categories
-> Nominations and nominees
-> Vote sessions and votes
-> Results, exports, alerts, archive, and audit records
```

All organizer operations are workspace- and event-scoped. Public operations resolve an event by its exact slug and enforce its visibility and active workflow stage.

## 6. Security Model

- Supabase session authentication
- Server-side workspace and event authorization
- Role and permission checks on mutations
- Zod validation and normalized inputs
- HTML/XML escaping where values enter generated documents or email
- PostgreSQL queries through Drizzle rather than concatenated SQL
- Request payload limits
- Shared atomic PostgreSQL rate limiter
- OTP hashing and expiration
- Receipt signing with `BALLOT_RECEIPT_SECRET`
- HTTP-only cookies for sensitive ballot state
- Unique database constraints as the final duplicate-ballot defense
- Transactional invitation-code locking
- Cron routes protected by `CRON_SECRET`
- Content Security Policy, MIME sniffing protection, referrer policy, and permissions policy
- Secrets excluded from Git
- Soft deletion and auditability for high-impact operations

## 7. Reliability and Error Handling

- Root and global error boundaries
- Route loading states
- Retryable load-error components
- User-facing API error messages
- Network timeouts for ballot initialization and submission
- Transactional imports and ballot submission
- Idempotent import retry
- Idempotent handling of already-submitted ballots
- Export snapshots that do not change when source data changes
- Recoverable event and account deletion windows
- Cron jobs that converge safely when a record cannot be purged on the first pass

## 8. Production and Release State

### Live infrastructure

- Production URL: `https://awardos-alpha.vercel.app`
- GitHub `main`: production-readiness commit `8ab9f98`
- Previous version: tag `v1-before-production-readiness`
- Production Vercel build: verified
- Account-purge cron: verified HTTP 200
- Event-purge cron: verified HTTP 200
- Resend API: verified to accept a real delivery
- AwardOS email-OTP transition: verified with a real recipient

### Automated verification

- TypeScript: pass
- ESLint: zero warnings
- Unit/integration tests: 56 passing across 14 files
- Browser release suite: 22 standard desktop/mobile checks passing
- Explicit real-email browser check: passing when a recipient is configured
- Production build: pass
- Clean migration harness: complete 31-table schema created successfully
- High/critical dependency audit gate: pass
- Secret scan: pass
- Lighthouse mobile: Performance 82, Accessibility 100, Best Practices 100, SEO 100

### Residual dependency risk

Six moderate transitive advisories remain in development/export dependency chains. The automated npm resolutions require breaking downgrades. They are not high or critical production blockers, but dependencies should be reviewed during routine maintenance.

## 9. Known Limitations and Configuration Gaps

These are not hidden defects. They are current operational constraints that must be understood before broad public launch.

### Email domain

Production currently uses Resend's test sender. It can validate delivery to the Resend account owner, but arbitrary voter OTP delivery requires a verified sender domain.

Required work:

1. Purchase or obtain a domain.
2. Add a mail subdomain such as `mail.example.com` to Resend.
3. Add Resend's DNS records.
4. Wait for verification.
5. Set `RESEND_FROM_EMAIL` to the verified address in Production and Preview.
6. Test OTP delivery to Gmail, Outlook, Yahoo, and institutional addresses.

### Custom web domain

AwardOS currently uses the Vercel URL. A branded domain is recommended for credibility, email alignment, SEO consistency, and stable public links.

### Production performance measurement

The verified Lighthouse run used a local production server. Repeat Lighthouse and Core Web Vitals testing on the final custom domain with representative production data and third-party services enabled.

### Monitoring

Vercel logs and database records exist, but the product does not yet have a complete external observability stack with error aggregation, uptime alerts, tracing, and business-metric dashboards.

### Backup automation

A production database backup and restore were manually verified. Scheduled backups, retention policy, encrypted off-site copies, and recurring restore drills should be formalized.

## 10. PRD Capabilities Not Yet Built

The original PRD contains broader product ambitions than the current shipping release. The following areas should not be advertised as available.

### 10.1 Dedicated judging workflow

The schema and results model contain judge-score fields and Judge roles, but there is no complete external judge experience with:

- judge-specific invitation links;
- criteria and weighted scorecards;
- per-nominee judging forms;
- judge comments;
- submission locking;
- judge completion tracking;
- vote-plus-judge composite calculation controls.

### 10.2 Workspace ownership transfer

Account-deletion checks protect ownership, but a complete two-party ownership-transfer workflow with acceptance, cancellation, notifications, and audit UI is not implemented.

### 10.3 Unified activity feed and notification center

Audit logs and notification delivery records exist, but there is no user-facing cross-event activity feed, inbox, read/unread notification system, or notification-preference center.

### 10.4 Event templates library

An existing event can be duplicated, but there is no reusable template catalog, template marketplace, versioned template editor, or template onboarding wizard.

### 10.5 Billing and commercial plans

There is no payment processor, subscription model, usage quota, invoice system, entitlement layer, or pricing enforcement. The business model remains a product decision.

### 10.6 Public API and integrations

AwardOS does not provide a documented external REST/GraphQL API, OAuth application model, Zapier integration, Google Sheets sync, CRM connector, or outgoing event webhooks.

### 10.7 Advanced communications

There is no campaign composer for bulk nominee notifications, voter reminders, result announcements, scheduled emails, SMS, WhatsApp messaging, or delivery preference management.

### 10.8 Advanced analytics

Current analytics are operational. The following are not complete:

- cohort and retention analytics;
- acquisition attribution;
- funnel segmentation by campaign;
- configurable dashboards;
- scheduled analytics reports;
- organization-wide multi-event comparisons;
- benchmark data across organizations.

### 10.9 Enterprise identity and administration

The product does not currently include SAML SSO, SCIM provisioning, enforced MFA, IP allowlists for organizers, enterprise audit export, legal-hold controls, or regional data residency.

### 10.10 Native applications and offline mode

There are no native iOS/Android applications, installable offline-first PWA workflows, or offline ballot collection and synchronization.

### 10.11 Localization

The UI is English-only. There is no translation framework, locale-aware content management, right-to-left layout support, or organizer-defined participant language.

### 10.12 Full public discovery

There is intentionally no global public event directory. If discovery is ever added, it must be explicit opt-in and must not change the default private/link-only model.

## 11. Recommended Roadmap

### Priority 0: remove launch constraints

- Acquire and connect a branded domain.
- Verify a Resend sender domain.
- Test OTP deliverability across major providers.
- Add external error monitoring and uptime checks.
- Formalize automated database backups and restore drills.
- Repeat production Lighthouse and responsive QA on the custom domain.

### Priority 1: complete the awards operating model

- Build the dedicated judging workflow.
- Build ownership transfer.
- Add a user notification center and preferences.
- Add scheduled participant communications.
- Add organization-wide event comparison analytics.
- Add reusable event templates.

### Priority 2: commercial readiness

- Decide pricing and packaging.
- Add billing, plans, entitlements, and usage limits.
- Add an operator/admin console.
- Add support tooling and customer-facing status information.
- Define service-level objectives and incident response.
- Complete privacy policy, terms, data-processing terms, and retention policy with legal review.

### Priority 3: ecosystem expansion

- External API and webhooks
- Zapier/Make integration
- Google Sheets synchronization
- CRM and HR-system connectors
- Localization
- Enterprise SSO and SCIM
- Native or installable mobile experience

## 12. Operational Runbook

### Before every production release

1. Create a timestamped database backup.
2. Verify the backup can be listed or restored.
3. Apply migrations to the disposable staging database.
4. Run TypeScript, zero-warning lint, tests, and production build.
5. Run the Playwright desktop/mobile suite.
6. Run `npm audit --audit-level=high`.
7. Scan staged files for secrets.
8. Deploy a preview and smoke-test critical flows.
9. Review migration and environment-variable changes.
10. Deploy Production and verify the canonical URL.

### After deployment

1. Check homepage, sign-in, `robots.txt`, and `sitemap.xml`.
2. Check security headers.
3. Test one private shared-event link.
4. Test one nomination submission.
5. Test one configured verification flow.
6. Test ballot review and submission.
7. Verify cron endpoints through Vercel.
8. Review application and database logs.
9. Confirm no secrets were committed.

### Required environment classes

- Supabase URL, anonymous key, service-role key, and database URL
- Application URL
- Ballot receipt secret
- Resend key and verified sender
- At least one configured AI provider for AI features
- Cron secret
- Optional Slack webhook
- Disposable test database URL for release integration tests
- Vercel token for controlled CLI operations

Never commit real environment values. `.env.example` is the environment contract.

## 13. Product Metrics to Add

The PRD proposes growth targets, but the product needs a formal analytics taxonomy before those targets are reliable.

Recommended event metrics:

- Workspace created
- Event created and activated
- Categories configured
- Nomination link opened
- Nomination submitted
- Import previewed/applied/failed
- Cleanup started/completed
- Merge approved/rejected/undone
- Ballot preview acknowledged
- Voting opened
- Verification requested/succeeded/failed
- Ballot started/reviewed/submitted/rejected
- Results published
- Export generated/downloaded
- Certificate issued
- Event archived

Recommended business metrics:

- Time to first active event
- Organizer activation rate
- Nomination completion rate
- Ballot completion rate
- OTP delivery and verification rate
- Events completed per workspace
- Returning organizer rate
- Support incidents per active event
- Export usage
- AI suggestion acceptance rate

## 14. Documentation Ownership

Use these documents for different purposes:

- `docs/product/PRODUCT.md`: authoritative product and roadmap documentary
- `README.md`: developer setup and daily engineering reference
- `docs/product/PRD-v1.md`: original product requirements and broader vision
- `docs/archive/IMPLEMENTATION_PLAN_SHIPPING.md`: completed production-readiness checklist
- `docs/operations/SHIPPING_VERIFICATION.md`: evidence and release-verification history
- `.env.example`: environment-variable contract

When product behavior changes, update this documentary in the same pull request. A feature is not complete until its user path, authorization, error states, tests, operational requirements, and documentation agree.

## 15. Current Definition of Done

The production-readiness release is complete because:

- the visible implemented features have functional end-to-end paths;
- event operations are event-scoped;
- unsupported public discovery is absent;
- ballots can be audited before voting;
- nominations and events can be edited or deleted under explicit rules;
- imports and exports operate on real data;
- verification, voting, results, archive, and deletion paths are tested;
- production build, deployment, cron execution, and smoke tests pass;
- the previous repository version remains recoverable through Git history and an archive tag.

AwardOS should be described as a working production application with known launch-configuration tasks and a defined expansion roadmap, not as a product with every ambition in the original PRD already implemented.
