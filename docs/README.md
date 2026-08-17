# AwardOS Documentation

This directory is the documentation source of truth for AwardOS. Documents are
grouped by purpose so current product facts cannot be confused with historical
plans or implementation handovers.

## Current Product Reference

| Document | Purpose | Authority |
| --- | --- | --- |
| [Product documentary](./product/PRODUCT.md) | Current features, architecture, limitations, operations, and roadmap | Primary product reference |
| [Root README](../README.md) | Developer entry point and common commands | Primary engineering entry point |
| [Environment template](../.env.example) | Variables read by the application | Environment contract |

## Product History and Requirements

| Document | Purpose | Status |
| --- | --- | --- |
| [PRD v1](./product/PRD-v1.md) | Original broad product vision and requirements | Historical; not all requirements are implemented |
| [Roadmap v1](./product/ROADMAP-v1.md) | Original implementation proposal | Superseded by the shipped product and current roadmap |

The product documentary explicitly identifies which original PRD ambitions are
implemented and which remain future work.

## Operations and Verification

| Document | Purpose |
| --- | --- |
| [Shipping verification](./operations/SHIPPING_VERIFICATION.md) | Evidence from backups, migrations, tests, deployment, OTP, cron, and production smoke checks |
| [Audit verification](./operations/AUDIT_VERIFICATION.md) | Focused integrity and export verification instructions |

## Historical Archive

Files under [`archive/`](./archive/) are preserved for traceability. They are
not active plans and should not be used as current implementation instructions.

| Document | Historical context |
| --- | --- |
| [Completed shipping plan](./archive/IMPLEMENTATION_PLAN_SHIPPING.md) | Phase-by-phase production-readiness checklist completed in August 2026 |
| [Development handover, July 31](./archive/HANDOVER_CHECKPOINT-2026-07-31.md) | Early Claude/Gemini development checkpoint |
| [Completion bookmark, July 31](./archive/PROJECT_COMPLETION_BOOKMARK-2026-07-31.md) | Early build snapshot from a previous project location |

## Documentation Rules

1. Update `product/PRODUCT.md` whenever user-visible behavior or roadmap status changes.
2. Update `.env.example` whenever code starts reading a new environment variable.
3. Append release evidence to `operations/SHIPPING_VERIFICATION.md`.
4. Put completed plans and one-time handovers in `archive/`; do not leave them at repository root.
5. Do not create another general `implementation_plan*.md`. Update the current product roadmap or create a narrowly named proposal under `docs/proposals/`.
6. Mark proposals with an owner, date, status, scope, and acceptance criteria.
7. Never store credentials, database URLs, tokens, personal test data, or private operational notes in documentation.

## Status Labels

- **Current:** describes the running product.
- **Operational:** instructions or evidence used to run and release the product.
- **Proposal:** approved or unapproved future change that has not shipped.
- **Historical:** retained only for context and auditability.
