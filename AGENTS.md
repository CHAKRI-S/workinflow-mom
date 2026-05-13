# AGENTS.md - Codex Continuation Guide for WorkinFlow MOM

This file is the Codex-facing handoff guide for continuing the work that was
previously coordinated through `CLAUDE.md`. It preserves the project decisions,
safety rules, and delivery habits from Claude, while adapting them to Codex's
actual workflow.

## First Rule: This Is Not The Next.js You Know

This repository uses Next.js 16 with breaking changes. Before writing code that
depends on Next.js behavior, read the relevant guide under:

```text
node_modules/next/dist/docs/
```

Do not rely only on older Next.js knowledge. Heed deprecation notices and local
project patterns.

## Project Snapshot

- Product: WorkinFlow MOM, a Manufacturing Operations Management SaaS for a CNC
  automotive-parts machining factory.
- Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4,
  shadcn/ui v4, next-intl, Auth.js v5, Prisma 7, PostgreSQL 16.
- Payments and billing: Omise, PromptPay slip verification via SlipOK, Resend
  email, S3/R2-compatible storage.
- Infrastructure: Docker and Coolify on VPS `72.62.194.67`.
- Domains:
  - `workinflow.cloud` - landing
  - `mom.workinflow.cloud` - tenant app
  - `admin.workinflow.cloud` - super admin
- Current reference docs:
  - `CLAUDE.md` - previous agent-team operating framework and phase history
  - `DESIGN.md` - visual system
  - `memory/project_overview.md` - business workflow
  - `docs/DEPLOY-PHASE-6A.md` - billing go-live checklist and manual ops
  - `docs/VAT-PRICE-MODE-PLAN.md` - line-level VAT price mode rules
  - `docs/SALES-DOCUMENT-TAX-CURRENCY.md` - document tax type, currency snapshot,
    legal customer-name, and rollout checklist

## Business Domain Rules

The user's factory is an OEM goods manufacturer, not a contract service
provider.

- Default billing nature is `GOODS`.
- Default WHT behavior is `withholdsTax=false`.
- Customer logo engraving is treated as product specification, not service.
- WHT management is an optional exception layer.
- PND53 export remains deferred until an AP module exists with Supplier/Bill
  models.
- Document VAT mode is selected per document (`VAT_INCLUSIVE`,
  `VAT_EXCLUSIVE`, or `NO_VAT`) and should not be inferred only from customer
  VAT registration status.
- Document currency is a per-document snapshot; MVP stores/displays the selected
  currency code without automatic FX conversion.
- Customer `name` should stay as the base name. Legal document display names are
  formatted through the shared customer-name helper using juristic type or
  individual title fields.
- New legal/accounting document snapshots must store the formatted legal
  customer display name; downstream Tax Invoices should prefer source Invoice
  snapshot fields before current Customer fields.
- Only one active Tax Invoice may exist per source Invoice. Creating another is
  allowed only after the prior Tax Invoice is cancelled.

Manufacturing workflow to preserve in product design:

1. Inquiry to Quotation.
2. Approved Quotation to Sales Order.
3. Check quantity, color, and Fusion 360 design file name.
4. Check material dimensions, then order materials/components.
5. Production planning and CNC machine assignment.
6. CNC production timeline tracking.
7. QC after machining.
8. Outsourced painting if required.
9. Receive painted parts, then CNC logo engraving/two-tone work.
10. QC after engraving.
11. Count and pack.
12. Payment tracking before shipping.

## Codex Execution Flow

Use this flow for implementation work:

1. Analyze
   - Read relevant files before editing.
   - Identify affected frontend, backend, database, auth, billing, PDF, and
     infrastructure surfaces.
   - Check for schema, migration, env, Docker, or deployment impact.

2. Decide and communicate
   - For low-risk code changes, proceed after a short status update.
   - For migrations, production data changes, destructive operations, secrets,
     Docker/Coolify changes, or billing/payment behavior, explicitly flag the
     risk and wait for approval when needed.
   - If the user asks only to analyze or plan, stop after that scope.

3. Implement narrowly
   - Follow existing patterns and local helpers.
   - Keep unrelated refactors out of the change.
   - Do not overwrite user changes.
   - Do not commit `.env`, credentials, or generated churn unless explicitly
     required.

4. Verify
   - Prefer targeted checks first, then broader checks when risk justifies it.
   - Typical commands:

```bash
npm run lint
npm test
npm run build
```

5. Report
   - Summarize changed files, verification results, and any deployment or
     migration follow-up.
   - If tests could not be run, say why.

## Migration And Production Safety

Always flag these before implementation or execution:

- Prisma schema changes.
- SQL migrations.
- Data migrations or backfills.
- Env var additions/renames.
- Dockerfile, compose, Coolify, webhook, or cron changes.
- Billing, tax invoice, receipt, Omise, SlipOK, Resend, R2/S3 changes.

Migration rules:

- Use Prisma migrations for schema changes.
- Never run destructive production migrations without explicit approval.
- Provide risk level, expected command, verification command, and rollback notes.
- Keep migration work conceptually separate from feature code.

Known production/manual ops notes from the docs:

- Phase 6A billing go-live had manual steps for production migration, Platform
  Issuer settings, Omise, SlipOK, smoke testing, and cron setup.
- Current pending/verification plan lives in `docs/CODEX-CURRENT-PLAN.md`.

## Code Standards

- TypeScript everywhere. Avoid `any`; prefer precise types or `unknown` with
  narrowing.
- Validate backend inputs with Zod or existing validators.
- Never expose sensitive fields.
- Never log secrets, tokens, payment credentials, or personally sensitive data.
- Use Prisma transactions for multi-step database writes.
- Avoid N+1 queries and paginate large lists.
- Keep API contracts explicit and ensure frontend consumers match backend
  response shapes.
- For PDFs and tax/billing logic, preserve Thai accounting/legal assumptions
  already encoded in tests and helpers.
- For generated Prisma files under `src/generated/prisma`, update them only via
  the project's established Prisma generation flow.

## Frontend And Design Rules

Follow `DESIGN.md` unless a screen already has a stronger local pattern.

- CheckinFlow-inspired, soft and friendly, with blue as the primary accent.
- Use Tailwind scale colors, not direct hex values in UI code.
- Use light and dark variants where the app already supports them.
- Thai text should fit cleanly and not overflow buttons, cards, tables, or PDF
  layouts.
- Prefer lucide-react icons for action buttons.
- Use the app's existing shadcn/ui v4 and Base UI patterns.
- Do not add marketing-style hero pages inside operational product surfaces.
- For operational screens, prioritize scanability, dense but clear tables,
  predictable navigation, and efficient workflows.

## Agent Delegation Notes For Codex

`CLAUDE.md` required spawning multiple agents for many tasks. Codex has a
different rule: spawn sub-agents only when the user explicitly asks for
delegation, parallel agents, or sub-agents.

When the user does ask for agents:

- Split work by ownership boundary: backend, frontend, migration, testing, or
  DevOps.
- Give each agent a clear file/module scope.
- Do not let agents overwrite unrelated user changes.
- Review and integrate their results before reporting.

When the user does not ask for agents, Codex should still follow the same spirit:
analyze first, keep scope tight, verify, and report clearly.

## Useful Commands

```bash
npm run dev
npm run lint
npm test
npm run build
npm run db:migrate
npm run db:seed
npm run db:studio
```

Production migration command, only with explicit approval and in the proper
Coolify/app container context:

```bash
npx prisma migrate deploy
```

## Communication With Chakri

- Reply in the same language Chakri uses.
- Keep updates short and concrete.
- Lead with risks, blockers, migration notes, and verification status.
- Ask when uncertain on domain/legal/accounting behavior, destructive data
  operations, payment behavior, or production infrastructure.
- Otherwise, be proactive and complete the task end to end.
