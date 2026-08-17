# AwardOS

AwardOS is a private, link-shared nomination and voting platform for managing
award programs from event setup through nominations, ballot review, voting,
results, exports, certificates, and archive.

Production: https://awardos-alpha.vercel.app

## Documentation

Start with the [documentation index](./docs/README.md).

- [Current product documentary](./docs/product/PRODUCT.md)
- [Original product requirements](./docs/product/PRD-v1.md)
- [Release verification](./docs/operations/SHIPPING_VERIFICATION.md)
- [Completed shipping plan](./docs/archive/IMPLEMENTATION_PLAN_SHIPPING.md)

Historical plans and handovers are retained under `docs/archive/` for context,
but they are not current implementation instructions.

## Technology

- Next.js 16 and React 19
- TypeScript and Tailwind CSS 4
- PostgreSQL and Drizzle ORM
- Supabase authentication
- Vercel hosting and cron jobs
- Resend email delivery
- Optional Anthropic, Google, or OpenAI integration

## Local Development

Requirements: Node.js 20+ and a PostgreSQL database.

```bash
npm install
npm run db:migrate
npm run dev
```

Create `.env.local` from `.env.example` and provide the required values before
running migrations or the application. Never commit `.env.local`.

## Quality Gates

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
npm run test:e2e
npm audit --audit-level=high
```

Browser release tests require a disposable `TEST_DATABASE_URL` that is not the
production database.

## Database Changes

Edit schema modules under `src/lib/db/schema/`, then generate and apply a new
migration:

```bash
npm run db:generate
npm run db:migrate
```

Never rewrite a migration that has already been applied. Back up and
restore-verify production before every schema release.

## Deployment

GitHub `main` is the production source of truth. Vercel builds the application
from this repository. Required environment variables must be configured in the
appropriate Vercel environments before deployment.

The pre-production-readiness repository state is preserved by the Git tag
`v1-before-production-readiness`.
