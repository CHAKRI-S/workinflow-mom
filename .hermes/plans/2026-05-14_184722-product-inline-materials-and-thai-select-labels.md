# Product Inline Materials + Thai Select Labels Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** ให้ผู้ใช้เพิ่ม/สร้างวัตถุดิบได้ทันทีระหว่างเพิ่มหรือแก้ไขสินค้า แล้วผูกเป็น BOM ของสินค้านั้นเลย และแก้ dropdown ทั้งระบบให้เมื่ออยู่ locale ไทยแล้วค่าที่เลือกแสดงเป็นภาษาไทย/ข้อความอ่านได้ ไม่โชว์ enum/code อังกฤษ เช่น `GOODS`, `SERVICE`, `EXCLUSIVE`, `INCLUSIVE`.

**Architecture:** ใช้ Product form เป็นจุดรวมการสร้างสินค้า + BOM โดยเพิ่มโหมดเลือกวัตถุดิบเดิมหรือสร้างวัตถุดิบใหม่ในแต่ละ BOM line; ฝั่ง API ของ BOM จะรับ `materialId` หรือ `newMaterial` และสร้าง Material + BomLine ใน transaction เดียวต่อ product. รหัสทุก entity/document ที่ต้องมี code/number ต้อง auto-generate จาก `Tenant.code` (รหัสบริษัทที่ตั้งค่าไว้) ผ่าน helper กลาง ไม่ให้ผู้ใช้จำเป็นต้องกรอกรหัสเอง. สำหรับ dropdown ให้สร้าง label helpers กลางและแทน `<SelectValue />` แบบ self-closing ใน select ที่มีค่า enum/id ด้วย children renderer เช่นเดียวกับที่เคยแก้ `BusinessInfoSection`.

**Tech Stack:** Next.js App Router, React Hook Form, Base UI Select wrapper, next-intl, Prisma/Postgres, Zod, Vitest source/validator/API regression tests.

---

## Execution Policy
Mode: auto-continue
Sprint Turn Budget: 45
Max Sprints Per Auto Run: 6
Stop On Failure: true
Require Approval For:
- deploy
- database migration on production
- destructive command
- push main
- gateway restart
Stop Conditions:
- test/debug fail loop exceeds 2 attempts
- scope drift detected
- unexpected dirty files outside scope
- missing credential/secret required
Report Style: compact Thai progress summaries

## Current State Summary
- 2026-05-14 19:07 +07: Started implementation on branch `feat/product-inline-materials-thai-selects` from clean `main` at `c870f789`.
- Phase 0 baseline verification passed: targeted Vitest tests, Prisma validate, and TypeScript check.
- Phase 0.5 complete: master-data codes now auto-generate from `Tenant.code` across Customer/Product/Material/Consumable/Machine normal create flows; create forms no longer require code.
- Phase 1-3 complete: BOM lines now support sourcing mode and inline Material creation via generated `Tenant.code`-based material codes; API retries whole BOM replacement transaction on code collisions.
- Phase 4 complete: Product form supports existing/new material BOM rows, validates inline new material names, preserves sourcing, and sends normalized BOM payloads.
- Phase 5-6 complete: Select triggers across sales/admin/procurement/production/finance render Thai/readable labels; source audit shows zero self-closing `<SelectValue />`; raw-id entity fallback issue fixed and re-reviewed.
- Phase 7 complete: final verification passed, docs updated, independent review blocker fixed/re-reviewed, local commit prepared for push.
- Next action: push branch `feat/product-inline-materials-thai-selects` and monitor GitHub/Coolify deployment if configured for this branch.

## Progress Log
- 2026-05-14 19:07 +07 — Phase 0 preflight complete: created branch, confirmed baseline green.
- 2026-05-14 19:24 +07 — Phase 0.5 complete: subagent implemented company-code-based master code generation and normal create API/form updates; parent patched remaining Consumable code-input block; independent review approved.
- 2026-05-14 19:45 +07 — Phase 1-3 complete: subagent implemented BOM sourcing enum/migration, inline Material validator/API, and BOM API tests; reviewer requested transaction-safe P2002 handling; parent added whole-transaction retry, strict inline-material validation, sortOrder fix, extra RED/GREEN regressions; final re-review approved.
- 2026-05-14 20:00 +07 — Phase 4 complete: subagent implemented Product form inline Material UX; reviewer requested required-name validation; parent added validation helper/test; re-review approved.
- 2026-05-14 21:01 +07 — Phase 5-6 complete: subagents completed sales/admin/procurement/production/finance Thai/readable dropdown trigger labels; reviewer requested raw-id fallback cleanup; parent replaced missing-entity fallbacks with Thai labels and added regression coverage; focused re-review approved.
- 2026-05-14 21:15 +07 — Phase 7 final review found product-detail BOM save could reset `JOB_SPECIFIC` sourcing; parent added sourcing to detail-page BOM state/select/payload and regression coverage; focused re-review approved.

## Verification Log
- 2026-05-14 19:07 +07 — PASS `npm test -- tests/ui/customer-business-info-select-labels.test.ts tests/ui/product-master-billing-ui.test.ts tests/lib/product-validator.test.ts` (16 tests).
- 2026-05-14 19:07 +07 — PASS `node node_modules/prisma/build/index.js validate`.
- 2026-05-14 19:07 +07 — PASS `npx tsc --noEmit --pretty false`.
- 2026-05-14 19:17 +07 — PASS `npm test -- tests/lib/code-gen.test.ts tests/api/master-create-autocode.test.ts tests/ui/master-auto-code-ui.test.ts` (14 tests).
- 2026-05-14 19:18 +07 — PASS combined targeted suite including baseline + new code-gen/API/UI tests (30 tests), Prisma validate, and `npx tsc --noEmit --pretty false`.
- 2026-05-14 19:23 +07 — PASS independent subagent review for Phase 0.5; verdict APPROVED.
- 2026-05-14 19:32 +07 — PASS Phase 1-3 targeted suite `tests/lib/code-gen.test.ts tests/api/master-create-autocode.test.ts tests/ui/master-auto-code-ui.test.ts tests/lib/product-validator.test.ts tests/api/product-bom-inline-material.test.ts` (27 tests), Prisma validate/generate.
- 2026-05-14 19:40 +07 — PASS after transaction retry fix: targeted suite (29 tests), Prisma validate/generate, scoped ESLint.
- 2026-05-14 19:43 +07 — RED validator regression tests for no sortOrder default and rejecting `newMaterial.code` failed as expected.
- 2026-05-14 19:44 +07 — PASS after minor fixes: `tests/lib/product-validator.test.ts tests/api/product-bom-inline-material.test.ts` (17 tests), scoped ESLint, `tsc --noEmit --incremental false --pretty false`.
- 2026-05-14 19:45 +07 — PASS focused final review for Phase 1-3; verdict APPROVED, no remaining critical/important/minor issues.
- 2026-05-14 19:58 +07 — PASS Phase 4 targeted suite `tests/ui/product-inline-material-ui.test.ts tests/ui/product-master-billing-ui.test.ts tests/ui/master-auto-code-ui.test.ts tests/lib/product-validator.test.ts tests/api/product-bom-inline-material.test.ts`, scoped ESLint, `tsc --noEmit --incremental false --pretty false`.
- 2026-05-14 20:00 +07 — PASS focused re-review for Phase 4 after inline-material required-name validation; verdict APPROVED.
- 2026-05-14 20:12 +07 — PASS Phase 5 Part A tests `tests/lib/select-labels.test.ts tests/ui/thai-select-values-ui.test.ts` plus quotation/order/product related UI suites (25 tests) and TypeScript.
- 2026-05-14 20:49 +07 — PASS Phase 5 system-wide tests `tests/lib/select-labels.test.ts tests/ui/thai-select-values-ui.test.ts tests/ui/thai-select-values-system-ui.test.ts`; audit found zero self-closing `<SelectValue />` under `src/**/*.tsx`; TypeScript passed.
- 2026-05-14 20:57 +07 — PASS after raw-id fallback fix: Phase 5 select-label tests (13 tests) and `tsc --noEmit --incremental false --pretty false`.
- 2026-05-14 21:00 +07 — PASS focused re-review for Phase 5 raw-id fallback fixes; verdict APPROVED.
- 2026-05-14 21:08 +07 — PASS final verification: `static_scan_ok`, `git diff --cached --check`, Prisma validate/generate, targeted Vitest suite (13 files / 70 tests), `tsc --noEmit --incremental false --pretty false`, scoped ESLint on changed code files (0 errors / 7 warnings), self-closing `<SelectValue />` audit total 0, `node node_modules/next/dist/bin/next build` exit 0 with local DB `ECONNREFUSED` warning for `/api/public/plans` during prerender.
- 2026-05-14 21:15 +07 — PASS blocker-fix verification: `tests/ui/thai-select-values-system-ui.test.ts tests/api/product-bom-inline-material.test.ts tests/lib/product-validator.test.ts` (22 tests), scoped ESLint (0 errors / 2 existing `<img>` warnings), TypeScript, focused independent re-review APPROVED.

---

## Current context / inspected files

**Repo metadata**
- Discord channel: `#workinflow-mom`
- Workdir: `/Users/tik/Projects/WorkinFlow/MOM`
- Repo: `CHAKRI-S/workinflow-mom`
- Current branch before implementation: `main` clean and synced with `origin/main` at `c870f789`
- Target branch to create when executing: `feat/product-inline-materials-thai-selects`
- Safety: do not push / deploy / migrate production without explicit approval.

**Material/Product/BOM current state**
- Product form already has BOM section using existing materials only:
  - `src/app/[locale]/(main)/production/products/product-form.tsx`
  - BOM line currently requires `materialId`.
  - Create flow: `POST /api/production/products` then `PUT /api/production/products/[id]/bom`.
- New/Edit product pages preload active materials:
  - `src/app/[locale]/(main)/production/products/new/page.tsx`
  - `src/app/[locale]/(main)/production/products/[id]/edit/page.tsx`
- Material create page exists separately:
  - `src/app/[locale]/(main)/production/materials/new/material-form-client.tsx`
- Material API creates inventory master records:
  - `src/app/api/production/materials/route.ts`
- BOM API currently replaces BOM lines and validates with `bomLineSchema`:
  - `src/app/api/production/products/[id]/bom/route.ts`
  - `src/lib/validators/product.ts`
- Schema already has:
  - `Material` with `stockQty`, `minStockQty`, `unitCost`, `unit`, `type`, `specification`, `dimensions`
  - `BomLine` with `qtyPerUnit`, `materialSize`, `materialType`, `piecesPerStock`, `notes`

**Code generation current state / new decision**
- `Tenant.code` already exists and represents the company code (example in schema comment: `WF01`). Document numbering already uses it via `src/lib/doc-numbering.ts` with format `{TENANT_CODE}-{PREFIX}-{YEAR}-{SEQ:5}`.
- `src/lib/code-gen.ts` currently generates only customer and machine codes using hard-coded prefixes (`C-0001`, `M-0001`) and does **not** include `Tenant.code` yet.
- Customer API and Machine API already accept manually provided code but auto-generate when code is omitted:
  - `src/app/api/sales/customers/route.ts`
  - `src/app/api/production/machines/route.ts`
- Product, Material, Consumable creation still need an auto-code path.
- **Accepted decision from Tik:** all places that require a code/number should auto-generate it from the configured company code. Users should not have to manually type code for Product/Material/Consumable/Customer/Machine or inline Material. Thai labels for BOM sourcing are accepted as:
  - `สต๊อกแล้วแบ่งตัด`
  - `สั่งเฉพาะงาน/สินค้านี้`

**Dropdown current state**
- Select wrapper is `src/components/ui/select.tsx` using Base UI. `<SelectValue />` self-closing can show selected raw value/code instead of option display text.
- Existing fixed example:
  - `src/components/forms/business-info-section.tsx`
  - `tests/ui/customer-business-info-select-labels.test.ts`
- Source scan found many self-closing `SelectValue` occurrences, including:
  - Product form: product kind, VAT mode, drawing source, material select
  - Sales quotation/order forms: customer/product, VAT/currency/tax dropdowns
  - Admin settings: VAT registered, default billing nature
  - Users: role select/filter
  - Procurement: PO line type/material/consumable, consumable category
  - Production: work-order status/priority/material readiness, machines type/status, maintenance
  - Finance: invoice/receipt/tax invoice/credit note status and payment method/status
  - Plan scheduler: SO/SO line/machine/material readiness
- Static option labels currently include some Thai option text, but selected trigger value may still render raw enum/code because the trigger uses self-closing `SelectValue`.

---

## Product/material behavior decision

### Business model

Support two sourcing patterns at BOM line level:

1. **สต๊อกแล้วแบ่งตัด** (`STOCK_CUT`)
   - Material is stock master item.
   - Use `piecesPerStock` / `qtyPerUnit` to represent how stock material is split into product pieces.
   - After Product save, material appears in `/th/production/materials` and purchasing can use it to increase stock.

2. **สั่งเฉพาะงาน/สินค้านี้** (`JOB_SPECIFIC`)
   - Material is created from the Product form and linked to this product's BOM immediately.
   - Initial stock defaults to `0`.
   - It still appears in Material master so procurement can create PO and stock movement later.
   - Keep it as a Material record because PO line already points to `Material`.

### Where to store sourcing mode

Recommended minimal + future-safe approach:

- Add nullable/default enum on **BomLine**, not only Material, because sourcing strategy can depend on product usage even if the same raw material exists in stock.
- Optional default on `Material` can come later if needed.

Prisma proposal:

```prisma
enum BomMaterialSourcing {
  STOCK_CUT
  JOB_SPECIFIC
}

model BomLine {
  // existing fields...
  sourcing BomMaterialSourcing @default(STOCK_CUT)
}
```

Why BOM line instead of only Material:
- Same material master can be used differently for different products/jobs.
- Purchase planning later can read BOM line sourcing to distinguish stock replenishment vs job-specific purchase requirement.
- No need to duplicate similar Material records just to change sourcing semantics.

---

## Phase 0 — Branch + baseline verification

### Task 0.1: Create implementation branch

**Objective:** Isolate work from production main.

**Commands:**

```bash
cd /Users/tik/Projects/WorkinFlow/MOM
git status --short --branch
git switch -c feat/product-inline-materials-thai-selects
```

**Expected:** clean branch from `main`.

### Task 0.2: Baseline tests

**Objective:** Know current test state before changes.

**Commands:**

```bash
npm test -- tests/ui/customer-business-info-select-labels.test.ts tests/ui/product-master-billing-ui.test.ts tests/lib/product-validator.test.ts
node node_modules/prisma/build/index.js validate
npx tsc --noEmit --pretty false
```

**Expected:** pass or document any pre-existing failures before changing code.

---

## Phase 0.5 — Company-code-based auto code generation everywhere

### Task 0.5.1: Add tests for master code generator using Tenant.code

**Objective:** Define one consistent code format for all master records before changing APIs.

**Files:**
- Modify/Create: `tests/lib/code-gen.test.ts`
- Modify: `src/lib/code-gen.ts`

**Accepted format:**
- Documents keep existing tax/legal format from `doc-numbering.ts`: `{TENANT_CODE}-{DOC_PREFIX}-{YEAR}-{SEQ:5}`, e.g. `WF01-SO-2026-00001`.
- Master data uses tenant/company code + entity prefix + sequence without year: `{TENANT_CODE}-{ENTITY_PREFIX}-{SEQ:4}`.
  - Customer: `WF01-CUS-0001`
  - Product: `WF01-PRD-0001`
  - Material: `WF01-MAT-0001`
  - Consumable: `WF01-CON-0001`
  - Machine: `WF01-MCN-0001`
- If a legacy tenant somehow has no code, fallback to `{ENTITY_PREFIX}-{SEQ:4}` rather than blocking creation.
- Scan only codes matching the current prefix. Legacy codes like `C-0001` or manually typed codes should not break the next generated sequence.

**Test cases:**

```ts
it("builds master codes with tenant/company code", () => {
  expect(nextCodeFromExisting(["WF01-MAT-0001"], {
    prefix: "WF01-MAT-",
  })).toBe("WF01-MAT-0002");
});

it("ignores legacy/manual codes when finding the next generated code", () => {
  expect(nextCodeFromExisting(["MAT-OLD", "C-0009", "WF01-PRD-0003"], {
    prefix: "WF01-PRD-",
  })).toBe("WF01-PRD-0004");
});
```

**Run:**

```bash
npm test -- tests/lib/code-gen.test.ts
```

**Expected first:** fail until helper supports tenant-code prefixes for every master type.

### Task 0.5.2: Implement central master code helpers

**Objective:** Make every master code generator derive from the same `Tenant.code` source.

**Files:**
- Modify: `src/lib/code-gen.ts`

**Implementation notes:**
- Add `getTenantCodePrefix(tenantId)` that fetches `tenant.code`, trims it, and returns `TENANT_CODE-` or empty fallback.
- Add generic helper:

```ts
export type MasterCodeKind = "CUSTOMER" | "PRODUCT" | "MATERIAL" | "CONSUMABLE" | "MACHINE";

export const MASTER_CODE_PREFIX: Record<MasterCodeKind, string> = {
  CUSTOMER: "CUS",
  PRODUCT: "PRD",
  MATERIAL: "MAT",
  CONSUMABLE: "CON",
  MACHINE: "MCN",
};

export async function generateMasterCode(
  tenantId: string,
  kind: MasterCodeKind,
): Promise<string> {
  const tenantPrefix = await getTenantCodePrefix(tenantId);
  const entityPrefix = MASTER_CODE_PREFIX[kind];
  const prefix = `${tenantPrefix}${entityPrefix}-`;
  // query the relevant table by kind, where code startsWith prefix
  // return nextCodeFromExisting(rows.map(r => r.code), { prefix })
}
```

- Keep wrappers for existing callers, but update their output:
  - `generateCustomerCode(tenantId)` => `generateMasterCode(tenantId, "CUSTOMER")`
  - `generateMachineCode(tenantId)` => `generateMasterCode(tenantId, "MACHINE")`
  - Add `generateProductCode`, `generateMaterialCode`, `generateConsumableCode`.
- Keep `createWithGeneratedCode` retry behavior.

### Task 0.5.3: Make create APIs auto-generate code by default

**Objective:** Apply Tik's rule: every create point that needs a code should generate it automatically from company code.

**Files:**
- Modify: `src/app/api/sales/customers/route.ts`
- Modify: `src/app/api/production/machines/route.ts`
- Modify: `src/app/api/production/products/route.ts`
- Modify: `src/app/api/production/materials/route.ts`
- Modify: `src/app/api/procurement/consumables/route.ts` or the actual consumables API file found during implementation
- Tests:
  - Existing/new API tests for customers/machines if present
  - Add `tests/api/product-auto-code.test.ts`
  - Add `tests/api/material-auto-code.test.ts`
  - Add `tests/api/consumable-auto-code.test.ts` if consumable API supports create

**Behavior:**
- For new records, backend ignores empty/missing code and generates one.
- If a non-empty code is still sent by old normal create clients, ignore it and generate server-side. Manual override should exist only in explicit admin/import flows if such a flow is intentionally built later.
- Error messages remain Thai if unique-code generation still collides after retries.

### Task 0.5.4: Update forms to show auto-code preview/read-only, not required input

**Objective:** Users should understand codes are automatic and not be blocked by code fields.

**Files likely:**
- Product: `src/app/[locale]/(main)/production/products/product-form.tsx`
- Material: `src/app/[locale]/(main)/production/materials/new/material-form-client.tsx`
- Consumable: `src/app/[locale]/(main)/procurement/consumables/new/consumable-form-client.tsx`
- Customer: `src/app/[locale]/(main)/sales/customers/customer-form.tsx`
- Machine: `src/app/[locale]/(main)/production/machines/new/machine-form-client.tsx`

**UI rule:**
- Do not require users to type code.
- Either hide the code field or render disabled/read-only text: `ระบบจะสร้างรหัสให้อัตโนมัติจากรหัสบริษัท เช่น WF01-MAT-0001`.
- Edit/detail pages may show existing code as read-only display.
- Inline Material form in Product BOM should not ask for code; it should show `รหัสวัตถุดิบจะถูกสร้างอัตโนมัติ`.

**Tests:**
- UI tests should assert Product/Material/Customer/Machine/Consumable create forms mention auto-generated code and do not require code input for submission.

---

## Phase 1 — TDD for inline material creation from Product form

### Task 1.1: Add validator tests for BOM line with existing or new material

**Objective:** Define accepted BOM payload shape before implementation.

**Files:**
- Modify: `tests/lib/product-validator.test.ts`
- Modify: `src/lib/validators/product.ts`

**Test cases:**

```ts
it("accepts BOM lines that reference an existing material", () => {
  const parsed = bomLineSchema.parse({
    materialId: "mat_123",
    qtyPerUnit: 1,
    materialSize: "20x15x60",
    materialType: "AL6061-T6",
    piecesPerStock: 4,
    sourcing: "STOCK_CUT",
    notes: "ตัดแบ่งจาก bar stock",
    sortOrder: 0,
  });
  expect(parsed.materialId).toBe("mat_123");
});

it("accepts BOM lines that create a new material inline", () => {
  const parsed = bomLineSchema.parse({
    newMaterial: {
      name: "AL6061-T6 Flat Bar 20x15",
      type: "Aluminium",
      specification: "6061-T6",
      unit: "BAR",
      dimensions: "20x15x6000mm",
      minStockQty: 0,
      unitCost: 0,
    },
    qtyPerUnit: 1,
    materialSize: "20x15x60",
    materialType: "AL6061-T6",
    piecesPerStock: 100,
    sourcing: "JOB_SPECIFIC",
    sortOrder: 0,
  });
  expect(parsed.newMaterial?.name).toBe("AL6061-T6 Flat Bar 20x15");
  expect(parsed.newMaterial).not.toHaveProperty("code");
});

it("rejects BOM lines with neither existing material nor inline material", () => {
  expect(() =>
    bomLineSchema.parse({ qtyPerUnit: 1, sortOrder: 0, sourcing: "STOCK_CUT" }),
  ).toThrow();
});
```

**Run:**

```bash
npm test -- tests/lib/product-validator.test.ts
```

**Expected first:** fail because schema does not support `newMaterial` / `sourcing` yet.

### Task 1.2: Implement validator types

**Objective:** Make BOM schema accept either `materialId` or `newMaterial` and require one of them.

**Files:**
- Modify: `src/lib/validators/product.ts`

**Implementation notes:**
- Add `materialUnitEnum = z.enum(["PCS", "KG", "M", "MM", "CM", "SHEET", "BAR", "ROD", "BLOCK", "SET", "BOX"])`.
- Add `bomMaterialSourcingEnum = z.enum(["STOCK_CUT", "JOB_SPECIFIC"])`.
- Add `newMaterialSchema` for name/type/spec/unit/dimensions/minStockQty/unitCost. Do **not** require `code`; inline Material code must be generated server-side from `Tenant.code` via `generateMaterialCode`.
- Change `bomLineSchema` to:
  - `materialId: z.string().min(1).optional()`
  - `newMaterial: newMaterialSchema.optional()`
  - `sourcing: bomMaterialSourcingEnum.optional().default("STOCK_CUT")`
  - `.superRefine()` requiring one of `materialId` or `newMaterial`.
- Reject both if duplicate semantics would be confusing, or prefer existing `materialId` if both set; recommendation: reject both to avoid accidental wrong linking.

**Run:**

```bash
npm test -- tests/lib/product-validator.test.ts
```

**Expected:** pass.

---

## Phase 2 — Prisma schema/migration for BOM sourcing

### Task 2.1: Add enum + column

**Objective:** Persist BOM sourcing mode for purchase planning.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_bom_material_sourcing/migration.sql`

**Migration:**

```sql
CREATE TYPE "BomMaterialSourcing" AS ENUM ('STOCK_CUT', 'JOB_SPECIFIC');
ALTER TABLE "BomLine" ADD COLUMN "sourcing" "BomMaterialSourcing" NOT NULL DEFAULT 'STOCK_CUT';
```

**Run:**

```bash
node node_modules/prisma/build/index.js validate
node node_modules/prisma/build/index.js generate
```

**Expected:** Prisma valid; generated client updated.

### Task 2.2: Seed/update sample BOM if needed

**Objective:** Keep seed stable with new default.

**Files:**
- Inspect/modify only if needed: `prisma/seed.ts`

**Expected:** Existing BOM creation works via default `STOCK_CUT`; no broad seed rewrite unless TypeScript requires it.

---

## Phase 3 — API: create inline material while saving BOM

### Task 3.1: Add API tests for BOM PUT inline material

**Objective:** Prove `/api/production/products/[id]/bom` can create Material and BomLine together.

**Files:**
- Create or modify: `tests/api/product-bom-inline-material.test.ts`
- Target: `src/app/api/production/products/[id]/bom/route.ts`

**Test expectations:**
- Existing material line still creates BOM line unchanged.
- Inline material line:
  - creates `Material` with tenant id from session
  - initial `stockQty = 0`
  - creates `BomLine` referencing the new material id
  - stores `sourcing = JOB_SPECIFIC`
- Generated material code uses `Tenant.code` and `generateMaterialCode`; inline payload must not include or require a user-entered code.
- If generated-code collision occurs under concurrency, retries via `createWithGeneratedCode`; after retry exhaustion returns Thai conflict/error and does not leave a partial BOM replacement.
- Cross-tenant material ids are rejected or fail safely; do not link another tenant's material.

**Run:**

```bash
npm test -- tests/api/product-bom-inline-material.test.ts
```

**Expected first:** fail until route is implemented.

### Task 3.2: Implement transaction in BOM route

**Objective:** Replace BOM and create inline materials atomically for one product.

**Files:**
- Modify: `src/app/api/production/products/[id]/bom/route.ts`

**Implementation sketch:**

```ts
await prisma.$transaction(async (tx) => {
  await tx.bomLine.deleteMany({ where: { productId: id } });

  for (const [idx, line] of lines.entries()) {
    let materialId = line.materialId;

    if (line.newMaterial) {
      const material = await createWithGeneratedCode({
        generate: () => generateMaterialCode(session!.user.tenantId),
        create: (code) => tx.material.create({
          data: {
          code,
          name: line.newMaterial.name,
          type: line.newMaterial.type || null,
          specification: line.newMaterial.specification || null,
          unit: line.newMaterial.unit || "PCS",
          dimensions: line.newMaterial.dimensions || null,
          stockQty: 0,
          minStockQty: line.newMaterial.minStockQty ?? 0,
          unitCost: line.newMaterial.unitCost ?? null,
          tenantId: session!.user.tenantId,
          },
        }),
      });
      materialId = material.id;
    }

    // If materialId is existing, verify tenant ownership first.
    await tx.bomLine.create({
      data: {
        productId: id,
        materialId: materialId!,
        qtyPerUnit: line.qtyPerUnit,
        materialSize: line.materialSize || null,
        materialType: line.materialType || null,
        piecesPerStock: line.piecesPerStock ?? null,
        notes: line.notes || null,
        sourcing: line.sourcing ?? "STOCK_CUT",
        sortOrder: line.sortOrder ?? idx,
      },
    });
  }
});
```

**Important:** verify existing `materialId` belongs to same tenant before creating BOM line; current route relies on FK only and should be hardened.

**Run:**

```bash
npm test -- tests/api/product-bom-inline-material.test.ts tests/lib/product-validator.test.ts
```

---

## Phase 4 — Product form UX for inline material creation

### Task 4.1: Add UI regression tests for Product form inline material

**Objective:** Lock in the Product form behavior without relying only on manual QA.

**Files:**
- Modify: `tests/ui/product-master-billing-ui.test.ts` or create `tests/ui/product-inline-material-ui.test.ts`
- Target: `src/app/[locale]/(main)/production/products/product-form.tsx`

**Assertions:**
- Product form contains a visible action like `สร้างวัตถุดิบใหม่` / `เลือกวัตถุดิบเดิม` in BOM area.
- Inline material payload contains `newMaterial` fields, not only `materialId`, and does not require a manually typed material code.
- BOM line supports `sourcing` with Thai option labels:
  - `สต๊อกแล้วแบ่งตัด`
  - `สั่งเฉพาะงาน/สินค้านี้`
- Existing materials still render as `{code} — {name}`.

**Run:**

```bash
npm test -- tests/ui/product-inline-material-ui.test.ts
```

**Expected first:** fail.

### Task 4.2: Extend ProductForm BOM line state

**Objective:** Let each BOM row be either existing-material or inline-new-material.

**Files:**
- Modify: `src/app/[locale]/(main)/production/products/product-form.tsx`

**State shape suggestion:**

```ts
type BomMaterialMode = "existing" | "new";
type BomSourcing = "STOCK_CUT" | "JOB_SPECIFIC";

interface NewMaterialDraft {
  name: string;
  type: string;
  specification: string;
  unit: MaterialUnit;
  dimensions: string;
  minStockQty: number | null;
  unitCost: number | null;
}

interface BomFormLine {
  materialMode: BomMaterialMode;
  materialId: string;
  newMaterial: NewMaterialDraft;
  sourcing: BomSourcing;
  qtyPerUnit: number;
  materialSize: string;
  materialType: string;
  piecesPerStock: number | null;
  notes: string;
  sortOrder: number;
}
```

**UX layout:**
- In BOM card header: `เพิ่มวัตถุดิบ`
- Per row:
  - Select: `เลือกวัตถุดิบเดิม` / `สร้างวัตถุดิบใหม่`
  - Sourcing select: `สต๊อกแล้วแบ่งตัด` / `สั่งเฉพาะงาน/สินค้านี้`
  - Existing mode: material select from existing list
  - New mode: fields for name, type, specification, unit, dimensions, unit cost/min stock. Do not show a required code input; show read-only helper text that the code will be generated from company code, e.g. `WF01-MAT-0001`.
  - Shared BOM fields: qty per unit, material size, material type, pieces per stock, notes
- Default sourcing:
  - `existing` => `STOCK_CUT`
  - `new` => `JOB_SPECIFIC` unless user changes it
- Keep desktop/tablet responsive: avoid wide table-only layout for inline forms. Prefer card rows or table with expandable inline panel.

**Payload conversion:**

```ts
const validLines = bomLines
  .filter((line) => line.materialMode === "existing" ? line.materialId : line.newMaterial.name)
  .map((line, idx) => ({
    materialId: line.materialMode === "existing" ? line.materialId : undefined,
    newMaterial: line.materialMode === "new" ? normalizeNewMaterial(line.newMaterial) : undefined,
    sourcing: line.sourcing,
    qtyPerUnit: line.qtyPerUnit,
    materialSize: line.materialSize || undefined,
    materialType: line.materialType || undefined,
    piecesPerStock: line.piecesPerStock ?? undefined,
    notes: line.notes || undefined,
    sortOrder: idx,
  }));
```

### Task 4.3: Preserve edit mode for existing BOM lines

**Objective:** Existing products should load current BOM as `materialMode = "existing"` and preserve sourcing.

**Files:**
- Modify: `src/app/[locale]/(main)/production/products/[id]/edit/page.tsx`
- Modify: `src/app/[locale]/(main)/production/products/product-form.tsx`

**Notes:**
- Include `sourcing` in `existingBomLines` type.
- Existing BOM lines should display Thai sourcing label in the select trigger.
- New inline materials created during edit should be appended to material master and linked in BOM PUT.

### Task 4.4: Product detail display

**Objective:** Product detail BOM should show sourcing mode and make procurement intent obvious.

**Files:**
- Modify: `src/app/[locale]/(main)/production/products/[id]/product-detail-client.tsx`

**Display:**
- Badge or text:
  - `สต๊อกแล้วแบ่งตัด`
  - `สั่งเฉพาะงาน/สินค้านี้`
- Keep material code/name visible.
- If sourcing is `JOB_SPECIFIC`, consider badge color/info text: “ไปจัดซื้อเพื่อเพิ่มเข้าสต็อกได้จากหน้าวัตถุดิบ/PO”.

---

## Phase 5 — Thai display labels for all dropdown selected values

### Task 5.1: Add central display label helpers

**Objective:** Avoid scattered hard-coded enum label functions and stop regressions.

**Files:**
- Create: `src/lib/select-labels.ts`
- Test: `tests/lib/select-labels.test.ts`

**Recommended helpers:**

```ts
export function getProductKindLabelTh(value?: string | null) { ... }
export function getDrawingSourceLabelTh(value?: string | null) { ... }
export function getVatPriceModeLabelTh(value?: string | null) { ... }
export function getVatModePolicyLabelTh(value?: string | null) { ... }
export function getBillingNatureLabelTh(value?: string | null) { ... }
export function getMaterialUnitLabelTh(value?: string | null) { ... }
export function getBomMaterialSourcingLabelTh(value?: string | null) { ... }
export function getUserRoleLabelTh(value?: string | null) { ... }
export function getWorkOrderStatusLabelTh(value?: string | null) { ... }
export function getWorkOrderPriorityLabelTh(value?: string | null) { ... }
export function getMachineTypeLabelTh(value?: string | null) { ... }
export function getMachineStatusLabelTh(value?: string | null) { ... }
export function getConsumableCategoryLabelTh(value?: string | null) { ... }
export function getPurchaseOrderLineTypeLabelTh(value?: string | null) { ... }
export function getFinanceStatusLabelTh(value?: string | null) { ... }
export function getPaymentMethodLabelTh(value?: string | null) { ... }
```

**Rule:** fallback should be `""` or the original value only for unknown/dynamic values, but known enums must return Thai text in Thai UI.

**Run:**

```bash
npm test -- tests/lib/select-labels.test.ts
```

### Task 5.2: Product form dropdowns

**Objective:** Fix examples explicitly called out by user.

**Files:**
- Modify: `src/app/[locale]/(main)/production/products/product-form.tsx`
- Test: `tests/ui/product-master-billing-ui.test.ts` or `tests/ui/thai-select-labels-ui.test.ts`

**Replace:**

```tsx
<SelectValue />
```

with children renderer:

```tsx
<SelectValue>
  {(value) => getProductKindLabelTh(value) || "สินค้า"}
</SelectValue>
```

**Targets:**
- Product kind: `GOODS` / `SERVICE` → `สินค้า` / `บริการ`
- Default VAT mode: `EXCLUSIVE` / `INCLUSIVE` → `VAT นอก` / `VAT ใน`
- Drawing source: `TENANT_OWNED` / `CUSTOMER_PROVIDED` / `JOINT_DEVELOPMENT` → Thai labels
- BOM sourcing: new labels from Phase 4
- Material select: selected id should display `code — name`, not material id.

### Task 5.3: Sales forms dropdowns

**Objective:** Make quotation and sales order selects readable in Thai.

**Files:**
- Modify: `src/app/[locale]/(main)/sales/quotations/quotation-form.tsx`
- Modify: `src/app/[locale]/(main)/sales/orders/order-form.tsx`
- Modify: existing UI tests:
  - `tests/ui/quotation-tax-currency-ui.test.ts`
  - `tests/ui/sales-order-form-tax-currency-ui.test.ts`

**Targets:**
- Customer select: selected customer name/code, not id.
- Product select: selected product code/name, not id.
- VAT mode: Thai text.
- Tax/currency dropdowns: ensure selected trigger text is Thai/readable where options are coded values.

### Task 5.4: Admin/user/procurement/production/finance dropdowns

**Objective:** System-wide audit for all remaining dropdowns under Thai locale.

**Files to inspect/modify:**
- `src/app/[locale]/(main)/admin/settings/settings-client.tsx`
- `src/app/[locale]/(main)/admin/users/user-list-client.tsx`
- `src/app/[locale]/(main)/admin/users/new/user-form-client.tsx`
- `src/app/[locale]/(main)/admin/users/[id]/user-detail-client.tsx`
- `src/app/[locale]/(main)/procurement/purchase-orders/new/po-form-client.tsx`
- `src/app/[locale]/(main)/procurement/consumables/consumable-list-client.tsx`
- `src/app/[locale]/(main)/procurement/consumables/new/consumable-form-client.tsx`
- `src/app/[locale]/(main)/procurement/consumables/[id]/consumable-detail-client.tsx`
- `src/app/[locale]/(main)/production/work-orders/work-order-list-client.tsx`
- `src/app/[locale]/(main)/production/work-orders/new/work-order-form-client.tsx`
- `src/app/[locale]/(main)/production/materials/new/material-form-client.tsx`
- `src/app/[locale]/(main)/production/materials/[id]/material-detail-client.tsx`
- `src/app/[locale]/(main)/production/plans/plan-scheduler.tsx`
- `src/app/[locale]/(main)/production/machines/new/machine-form-client.tsx`
- `src/app/[locale]/(main)/production/machines/[id]/machine-detail-client.tsx`
- `src/app/[locale]/(main)/production/maintenance/maintenance-client.tsx`
- `src/app/[locale]/(main)/finance/receipts/receipt-list-client.tsx`
- `src/app/[locale]/(main)/finance/receipts/new/receipt-form-client.tsx`
- `src/app/[locale]/(main)/finance/receipts/[id]/receipt-detail-client.tsx`
- `src/app/[locale]/(main)/finance/invoices/invoice-list-client.tsx`
- `src/app/[locale]/(main)/finance/invoices/new/invoice-form-client.tsx`
- `src/app/[locale]/(main)/finance/invoices/[id]/invoice-detail-client.tsx`
- `src/app/[locale]/(main)/finance/tax-invoices/tax-invoice-list-client.tsx`
- `src/app/[locale]/(main)/finance/credit-notes/credit-note-list-client.tsx`

**Implementation pattern:**
- Enum select: `SelectValue` with label helper.
- Entity/id select: `SelectValue` with lookup from loaded arrays, e.g. `products.find(p => p.id === selected)?.code + " — " + name`.
- Filters with `ALL`: display `ทั้งหมด` or `สถานะ: ทั้งหมด`, not `ALL`.
- Keep option list labels Thai as well.

### Task 5.5: Add a source-level regression audit test

**Objective:** Prevent reintroducing self-closing SelectValue for enum/id selects.

**Files:**
- Create: `tests/ui/thai-select-values-ui.test.ts`

**Suggested checks:**
- Keep an allowlist for self-closing `SelectValue` only where placeholder-only dynamic behavior is proven okay.
- Assert critical files contain label helpers:
  - `product-form.tsx` contains `getProductKindLabelTh`, `getVatPriceModeLabelTh`, `getDrawingSourceLabelTh`, `getBomMaterialSourcingLabelTh`.
  - quotation/order forms contain product/customer display label functions.
  - admin/user/finance/procurement files no longer use raw enum display for known selects.
- Add comments in test explaining this is because Base UI `SelectValue` can display raw codes.

**Run:**

```bash
npm test -- tests/ui/thai-select-values-ui.test.ts tests/ui/customer-business-info-select-labels.test.ts
```

---

## Phase 6 — Browser/manual QA

### Task 6.1: Local QA with authenticated session if available

**Objective:** Verify real trigger text after selecting options, not only source tests.

**Routes to check in Thai locale:**
- `/th/production/products/new`
  - Product kind displays `สินค้า` / `บริการ` after selection.
  - VAT displays `VAT นอก` / `VAT ใน` after selection.
  - Drawing source displays Thai text.
  - BOM line can choose existing material and create new material.
- `/th/production/materials`
  - Inline-created material appears in list after product save.
- `/th/production/products/[id]`
  - BOM line shows linked material and sourcing Thai label.
- `/th/sales/quotations/new` and `/th/sales/orders/new`
  - customer/product/VAT/tax dropdown selected values are readable Thai/names, not ids/enums.
- Admin/procurement/production/finance representative pages from Phase 5.

**If no login/browser auth available:** rely on Vitest + source audit and note browser QA pending.

### Task 6.2: Responsive acceptance

**Objective:** New Product BOM inline fields should not break tablet/desktop layout.

**Viewports:**
- 1440px desktop
- 1024px tablet
- 768px tablet

**Pass criteria:**
- No body horizontal overflow.
- Inline material form is usable with long Thai labels.
- Action buttons remain reachable.

---

## Phase 7 — Full verification + review + docs

### Task 7.1: Verification commands

**Run:**

```bash
node node_modules/prisma/build/index.js validate
node node_modules/prisma/build/index.js generate
npm test -- tests/lib/code-gen.test.ts tests/lib/product-validator.test.ts tests/lib/select-labels.test.ts tests/api/product-auto-code.test.ts tests/api/material-auto-code.test.ts tests/api/product-bom-inline-material.test.ts tests/ui/product-inline-material-ui.test.ts tests/ui/thai-select-values-ui.test.ts tests/ui/customer-business-info-select-labels.test.ts
npx tsc --noEmit --pretty false
npx eslint --max-warnings=0 \
  src/lib/validators/product.ts \
  src/lib/select-labels.ts \
  src/app/api/production/products/[id]/bom/route.ts \
  src/app/[locale]/\(main\)/production/products/product-form.tsx
```

**Note:** If existing repo lint has unrelated warnings, rerun scoped lint with changed files and document warnings separately.

### Task 7.2: Independent review

**Objective:** Catch API/schema/UI edge cases before commit.

**Use delegate_task:**
- Reviewer 1: product/material/BOM flow, transaction safety, tenant isolation.
- Reviewer 2: Thai select label audit, missed dropdowns, test coverage.

**Must fix blockers before commit.**

### Task 7.3: Documentation decision

**Docs likely needed:** yes, because this changes durable product/material/BOM sourcing behavior and dropdown UI convention.

**Search docs first:**

```bash
git ls-files '*.md' ':!:node_modules/**'
```

**Likely update target:**
- `AGENTS.md` or `CLAUDE.md` with a concise rule:
  - Product BOM supports inline Material creation.
  - Master codes must auto-generate from `Tenant.code`; normal create forms should not require manual code entry.
  - Dropdown selected values in Thai UI must render Thai/readable labels; do not leave self-closing `SelectValue` for enum/id selects unless audited.

Avoid secrets and avoid long implementation logs in docs.

### Task 7.4: Commit handoff

**Commit:**

```bash
git add <changed files>
git commit -m "feat: create product materials inline"
```

**Final handoff before push/deploy:**
- Commit SHA
- Tests run and results
- Docs updated/not updated
- Open QA notes
- Ask Tik for approval before push/deploy.

---

## Risks / tradeoffs

1. **Partial product create if BOM save fails**
   - Current Product form already saves product first then BOM.
   - Extending BOM route creates inline materials transactionally with BOM, but product may already exist if BOM fails.
   - Acceptable for first pass because current flow already has same shape; future improvement could add a single `POST /api/production/products-with-bom` transaction.

2. **Generated code uniqueness**
   - Customer/Product/Material/Consumable/Machine codes must use the same `Tenant.code`-based helper and retry on unique constraint collisions.
   - Inline material creation must not accept a manually typed code in normal flow; this prevents duplicate-code UX mistakes and keeps code style consistent.
   - UI should surface Thai conflict/error only if generation fails after retries.

3. **Tenant isolation**
   - Existing BOM route should explicitly verify all existing `materialId`s belong to current tenant.
   - This is important before allowing mixed existing/new material payloads.

4. **Dropdown audit breadth**
   - There are many selects across the app. The safest implementation is central helpers + source audit test + representative browser QA.
   - Do not change the global Select component behavior blindly unless proven safe; it could affect every select and introduce regressions.

5. **Thai vs English locale**
   - User specifically reports Thai UI. First pass can make selected values Thai/readable in current Thai views.
   - If true bilingual label switching is required, add `getXLabel(value, locale)` later. For now, keep Thai labels for Thai locale paths and avoid raw codes.

## Accepted decisions / remaining open questions

**Accepted by Tik**
- BOM sourcing Thai labels are final:
  - `สต๊อกแล้วแบ่งตัด`
  - `สั่งเฉพาะงาน/สินค้านี้`
- Codes must be generated automatically from the configured company code (`Tenant.code`) everywhere a code/number is required. Do not make users type codes manually in normal create flows.

**Remaining open question**
1. ตอนสร้าง inline material ต้องการใส่ supplier เริ่มต้นด้วยไหม?
   - ตอนนี้ Material API รองรับ `supplierId` แต่ Product form ยังไม่ได้โหลด supplier list
   - แนะนำไม่ทำในรอบแรก; ให้ไปเลือก supplier ตอนทำ PO

## Recommended execution order

1. Company-code-based auto code generation helpers + create API/form updates
2. Validators + migration
3. BOM API transaction + tenant checks with generated inline Material codes
4. Product form inline material UX
5. Product detail display
6. Select label helper + fix product/sales first
7. System-wide select audit fixes
8. Full verification + review + docs + commit
