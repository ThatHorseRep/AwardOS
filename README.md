# AwardOS

Nomination and voting platform. Admins create nomination forms, review and
merge similar nominee names with a human in the loop, then open voting with a
configurable verification mode (none, email OTP, or invitation code). Supports
organization workspaces, collaborator roles, per-event branding, and CSV / XLSX
/ PDF exports.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Drizzle ORM ·
Postgres (Supabase) · Tailwind CSS 4 · Vercel

## Running locally

Requires **Node.js 20+** and a Postgres database (Supabase or local).

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run db:migrate           # apply migrations
npm run dev                  # http://localhost:3000
```

### Required environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Use the **transaction pooler** URI on Supabase (port 6543), not the direct connection. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL — used by the auth client. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key. Safe to expose; it is scoped by row-level security. |

The app will not boot without `DATABASE_URL` — `src/lib/db/index.ts` throws at
module scope by design, so a missing value fails fast instead of surfacing as a
confusing runtime error.

### Optional environment variables

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Sends email OTP codes. Without it, OTP voting modes cannot deliver codes. |
| `RESEND_FROM_EMAIL` | Verified sender address. Defaults to `onboarding@resend.dev`. |
| `OPENAI_API_KEY` | Powers AI-assisted nominee deduplication. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini alternative for the same feature. Note the name: `@ai-sdk/google` reads only this variable. |
| `NEXT_PUBLIC_DEFAULT_AI_PROVIDER` | `openai` or `google`. Defaults to `openai`. |
| `SLACK_WEBHOOK_URL` | Integrity alert notifications. Server-side only — never prefix this with `NEXT_PUBLIC_`, which would inline the secret into the client bundle. |
| `CRON_SECRET` | Bearer token guarding `/api/admin/purge-accounts` and `/api/admin/cleanup`. |
| `NEXT_PUBLIC_APP_URL` | Absolute origin used to build invite links. Falls back to `VERCEL_URL`, then `localhost:3000`. |

`.env.example` is tracked and lists every variable the code actually reads. If
you add a new one, add it there in the same commit.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3000. |
| `npm run build` | Production build. Lint and typecheck both gate it. |
| `npm run lint` | ESLint. |
| `npm run verify:exports` | Asserts no ballots are linked to non-submitted vote sessions. Needs `DATABASE_URL`. |
| `npm run db:generate` | Generate a migration from schema changes. |
| `npm run db:migrate` | Apply pending migrations. |
| `npm run db:studio` | Drizzle Studio. |

### Making a schema change

Edit the relevant file under `src/lib/db/schema/`, then:

```bash
npm run db:generate   # writes a new SQL file + updates the journal
npm run db:migrate    # applies it
```

Never hand-edit a migration that has already been applied, and never edit
`meta/_journal.json` by hand — drizzle tracks applied migrations by the sha256
of each file, so a mismatch is painful to unwind.

Migrations are applied by `drizzle-kit`, which records every applied file in
`drizzle.__drizzle_migrations`. If you are pointing at a database that already
has the schema but an empty ledger, adopt the baseline once rather than
re-running it:

```bash
node scripts/adopt-baseline.js          # dry run
node scripts/adopt-baseline.js --apply  # record it
```

To snapshot data before a risky change:

```bash
node scripts/backup-data.js ./some-backup-dir
```

## Deploying

Vercel builds from GitHub on push. Production tracks `main`; every pull request
gets a preview deployment.

- **Root Directory** in Vercel project settings: `.` (this repo *is* the app).
- Set every required variable above in Vercel for both Production and Preview.
  A variable present locally but missing in Vercel is the most common cause of a
  build that passes locally and fails on deploy.
- Do not deploy with the `vercel` CLI. It bypasses git, so what is live stops
  matching what is on `main` — which is exactly how this project ended up with
  no preview deploys and no PR checks.

CI (`.github/workflows/ci.yml`) runs typecheck, lint, test, and build on every
push and pull request. It uses dummy database credentials: the build imports the
db module but never connects, so CI never touches a real database.

### A trap worth knowing about: request header size

`npm run dev` and `npm start` pass `--max-http-header-size=65536`, raising Node's
16 KB default. **Vercel does not run either script** — it runs routes in its own
runtime, where the edge's header limit cannot be raised at all.

So oversized request headers fail *only in production*, as
`494 REQUEST_HEADER_TOO_LARGE`, while local development is masked by that flag.
If you hit it, clear cookies for the domain to recover, then look at what is
accumulating: Supabase chunks large sessions across several `sb-*-auth-token.N`
cookies, and anything the app sets at `path: "/"` is attached to every request
to the domain forever. That is why the per-event voted cookies are scoped to
`/e/<slug>` rather than the root.

Never add a root-scoped, long-lived cookie without accounting for this.

## Layout

```text
src/
  actions/     server actions, one file per domain; _rbac.ts holds the guards
  app/
    (auth)/    sign-in, sign-up, password reset
    (dashboard)/ admin UI
    (public)/  voter-facing nomination and ballot pages
    api/       route handlers — public voting endpoints and exports
  lib/
    db/        drizzle schema and migrations
    ai/        deduplication provider abstraction
    sanitize.ts, hash.ts, voting-cookie.ts
  components/  ui/ primitives and feature components
```

Server actions are the default data path; route handlers exist where a real HTTP
endpoint is needed (public voting, file downloads, cron).
