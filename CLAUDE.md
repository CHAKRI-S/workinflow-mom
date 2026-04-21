@AGENTS.md

# CLAUDE.md — Dev Team Execution Framework

> This file defines how Claude Code Agent Teams operate when Chakri gives a task.
> All agents MUST follow this framework. No exceptions.

---

## Task Execution Flow

When Chakri gives a task (e.g. "fix 1.2.3", "add feature X", "refactor Y"),
ALWAYS follow this 7-step flow in order:

### Step 1: ANALYZE
- Read all relevant code files before doing anything
- Identify affected files, dependencies, and potential risks
- Map out which parts of the system are touched (frontend / backend / DB / infra)
- **MIGRATION CHECK**: Determine if this task requires any of:
  - Database schema changes (add/remove/rename columns, tables)
  - ORM/Prisma schema updates
  - Data migration (transform existing data)
  - Environment variable changes
  - Config file changes that affect deployment
  - Docker/container configuration changes
- If migration is needed: FLAG IT IMMEDIATELY to Chakri with:
  - What needs to migrate
  - Why it's needed
  - Risk level (safe / needs backup / destructive)
  - Suggested migration strategy
- Summarize your understanding back to Chakri
- Ask: "Is this correct?" before proceeding

### Step 2: PLAN
- Break the task into subtasks with clear scope
- Define execution order (what depends on what)
- **MUST assign each subtask to a specific agent role** (see Agent Spawning Rules)
- Estimate complexity: small (1 file) / medium (2-5 files) / large (5+ files)
- If migration is involved, include migration steps explicitly in the plan
- If infrastructure changes needed, include DevOps steps in the plan

### Step 3: CONFIRM
- Present the plan as a short bullet list
- Show: what will change, which files, **which agents will be spawned**
- **If migration is involved, highlight it with MIGRATION prefix**
- **If infra/Docker changes, highlight with INFRA prefix**
- WAIT for Chakri's "go" / approval before implementing
- NEVER start coding without confirmation

### Step 4: IMPLEMENT
- **Lead MUST spawn separate agents — DO NOT do all the work alone**
- Each agent works in their own context window on their assigned scope
- Execute subtasks in dependency order
- Use clear commit messages with prefixes:
  - `feat:` — new feature
  - `fix:` — bug fix
  - `refactor:` — code improvement
  - `chore:` — maintenance
  - `migrate:` — database migration
  - `infra:` — Docker/deploy/config changes
  - `test:` — test additions
- If blocked or uncertain, ASK instead of guessing
- Keep changes minimal — don't refactor unrelated code
- Migration files must be separate commits, never mixed with feature code

### Step 5: TEST
- Tester Agent MUST be spawned for any task touching more than 1 file
- Run linter and type checks
- Run existing tests to ensure nothing breaks
- Add new tests if the change adds new logic
- Verify the build compiles successfully
- **If migration: test on a copy/dev DB first, never run untested migrations**
- **If frontend: verify UI renders correctly, no console errors**
- **If Docker: verify container builds and starts without errors**

### Step 6: REVIEW
- Lead agent reviews all changes holistically
- Check: no console.log leaks, no TODO/hack leftovers
- Check: consistent code style, correct logic
- Check: no unintended side effects
- Check: frontend/backend contract matches (API types, request/response shapes)
- Check: full-stack standards are followed (see Full-Stack Dev Standards)
- **If migration: verify rollback plan exists**
- **If Docker: verify no secrets leaked in Dockerfile or docker-compose**

### Step 7: REPORT
- Summary: what was done (bullet list)
- Files changed: list with brief description
- **Agents used**: list which agents were spawned and what each did
- Test results: pass/fail
- **Migration status**: include migration commands to run if applicable
- **Infra status**: any Docker/deploy changes needed
- Risks/notes: anything Chakri should know
- Status: ready to deploy / needs attention
- **Deploy instructions**: step-by-step order if applicable

---

## Agent Spawning Rules (MANDATORY)

### Spawning Decision Matrix

| Task Type | Agents Lead Must Spawn |
|---|---|
| Bug fix in 1 file | Lead handles alone (only exception) |
| Backend-only change (2+ files) | Backend Agent + Tester Agent |
| Frontend-only change (2+ files) | Frontend Agent + Tester Agent |
| Full-stack feature | Backend Agent + Frontend Agent + Tester Agent |
| DB schema change | + Migration Agent (always) |
| Docker/deploy change | + DevOps Agent (always) |
| Large refactor (5+ files) | Multiple Coder Agents in parallel + Tester |

### Forbidden Patterns
- Lead writes all the code itself for a multi-file task
- One agent writes both frontend AND backend in the same context
- Migration code mixed into a feature agent's work
- Skipping Tester Agent because "it's a small change"
- Spawning agents without giving them a clear, scoped brief
- Agents touching files outside their assigned scope

---

## Agent Roles

| Role | Skills | Scope |
|---|---|---|
| Lead Agent | Analysis, planning, coordination, review, reporting | Steps 1,2,3,6,7 |
| Backend Agent | Node.js, API, Prisma, validation, auth | Server code only |
| Frontend Agent | React, Next.js, Tailwind, shadcn/ui | UI code only |
| Migration Agent | Prisma migrate, SQL, rollback plans | Schema changes only |
| Tester Agent | ESLint, TypeScript, Jest, build verify | Step 5 |
| DevOps Agent | Docker, Nginx, Coolify, env vars | Infrastructure only |

---

## Full-Stack Dev Standards

1. **Type Safety** — TypeScript everywhere, never use `any`
2. **API Contracts** — Backend defines contract first, frontend consumes
3. **Error Handling** — Never swallow errors, always log/surface
4. **Input Validation** — Zod on backend, form validation on frontend
5. **Auth & Security** — bcrypt passwords, never expose sensitive fields
6. **Database** — Prisma migrations only, index frequently queried columns, use transactions
7. **Environment** — All secrets in `.env`, provide `.env.example`
8. **Logging** — Log important events, never log sensitive data
9. **Code Organization** — Small functions, one responsibility per file
10. **Git Hygiene** — Atomic commits, clear prefixes, never commit `.env`
11. **Performance** — No N+1 queries, paginate large results, lazy-load
12. **Documentation** — JSDoc for non-trivial functions, README with setup

---

## Shortcut Commands

| Command | Meaning |
|---|---|
| `fix X` | Full 7-step flow, focus on bug fix |
| `add X` | Full 7-step flow, focus on new feature |
| `refactor X` | Full 7-step flow, focus on code improvement |
| `urgent X` | Skip Step 3, go fast but STILL test |
| `analyze X` | Only run Step 1, report findings, stop |
| `plan X` | Run Step 1-2, show plan, stop |
| `test X` | Only run Step 5 on specified area |
| `deploy X` | Run DevOps Agent to prepare deployment |
| `status` | Report current state of in-progress work |

---

## Non-Negotiable Rules

1. NEVER skip Step 1 (Analyze) — understand before acting
2. NEVER skip Step 5 (Test) — always verify
3. When in doubt, ASK Chakri — never guess
4. Lead MUST spawn separate agents for multi-file tasks
5. ALWAYS alert Chakri when ANY task involves migration
6. NEVER run destructive migrations without EXPLICIT approval
7. NEVER hardcode secrets in code or Docker files
8. NEVER use `any` in TypeScript
9. NEVER skip input validation on backend
10. Migration commits must be SEPARATE from feature commits

---

## Communication Style

- Use Thai or English based on Chakri's message language
- Keep summaries short — bullet points, not paragraphs
- Always lead with the most important info first

## Project Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Next.js 16, Tailwind CSS, shadcn/ui v4, next-intl |
| Backend | Next.js API Routes, Auth.js v5 |
| Database | PostgreSQL 16, Prisma 7 |
| Infrastructure | Docker, Coolify (auto-deploy via GitHub webhook) |
| Email | Resend (domain `workinflow.cloud` verified) |
| Design | CheckinFlow-inspired, blue accent (#3b82f6) |

---

## SaaS Conversion Status (Reference: `C:/Users/tikch/.claude/plans/humble-spinning-volcano.md`)

MOM is being converted to a multi-tenant SaaS with 3-domain split:
- `workinflow.cloud` — Landing
- `mom.workinflow.cloud` — tenant app (live, auto-deploy)
- `admin.workinflow.cloud` — Super Admin

### Phase Progress

| Phase | Scope | Status |
|---|---|---|
| 1 | Schema + middleware + SaaS models | ✅ Done |
| 2 | Signup + onboarding | ✅ Done |
| 3 | Landing page | ✅ Done |
| 4 | Super admin panel | ✅ Done |
| 5 | Plan enforcement | ✅ Done |
| 6 | Omise + SlipOK billing | ⏳ Pending |
| 7 | Password reset + email + audit UI | ✅ Done |
| **8A** | Billing Nature + WHT schema + Customer tax policy UI | ✅ **Done 2026-04-20** |
| **8B** | Quotation/SO/Invoice: drawing source + billing nature chain + auto-suggest | ✅ **Done 2026-04-20** |
| **8C** | WHT workflow on Receipt + cert tracking dashboard + R2 storage | ✅ **Done 2026-04-21** |
| **8D** | 3 PDF template variants (goods/service/mixed) + Receipt + Tax Invoice | ✅ **Done 2026-04-21** |
| **8E** | Reports (Revenue by Nature, WHT Ledger, Drawing Source Mix) + CANCELLED watermark + list PDF buttons | ✅ **Done 2026-04-21** |

### Key Domain Decision (Phase 8)

User's factory is an **OEM Goods Manufacturer** (not contract service provider):
- Own material + own design + own IP + could sell elsewhere
- Customers usually do NOT withhold 3% WHT
- Customer logo engraving = product spec, not service (Thai court precedents ฎ.2776/2532, ฎ.3849/2546)

**System defaults everywhere = `billingNature=GOODS` + `withholdsTax=false`.** WHT management is an optional exception layer. See `memory/tax_classification_decisions.md` for full legal analysis.
