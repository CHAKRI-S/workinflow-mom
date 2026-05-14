# Product Master Billing Nature + Drawing Flow Redesign Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** ย้ายการเลือก “สินค้า/บริการ” และข้อมูลแบบงาน/drawing ไปอยู่ที่ Product master เป็นแหล่งจริง ไม่ให้ใบเสนอราคาต้องเลือก/แนบแบบซ้ำ และไม่ให้ drawing source มีส่วนคำนวณ/auto-classify ใน Quotation UI อีกต่อไป

**Architecture:** Product master จะเป็น source of truth สำหรับ `productKind` (สินค้า/บริการ), drawing metadata, และ drawing attachment/link. เอกสารขายจะเลือกสินค้าเท่านั้น แล้ว snapshot ค่า classification จาก Product ลง line เพื่อใช้ downstream audit/PDF/WHT โดยไม่แสดงเป็น field ให้แก้ใน Quotation. Billing nature ของเอกสารจะถูก derive จาก product line kinds บน server เฉพาะเพื่อ snapshot และ flow ภาษี downstream ไม่ใช่การคำนวณยอดในใบเสนอราคา

**Tech Stack:** Next.js App Router, React Hook Form, Zod, Prisma/Postgres, Vitest, React Testing Library, existing `BillingNature`/`DrawingSource` enums, existing Product CRUD and sales document APIs

---

## Context / Current State

**Repo:** `CHAKRI-S/workinflow-mom`
**Workdir:** `/Users/tik/Projects/WorkinFlow/MOM`
**Branch:** `feature/product-master-billing-flow` during implementation; `main` remains protected/approval-gated for push/deploy.
**Discord room:** `#workinflow-mom`

Current implementation has these issues against the desired business flow:

1. Quotation/Sales Order/Invoice create forms show a collapsible section:
   - `แบบงาน / Drawing source (ใช้ auto-classify billing nature)`
   - Component: `src/components/tax/drawing-source-row.tsx`
2. `suggestBillingNature()` derives document billing nature from line `drawingSource`:
   - all `TENANT_OWNED` → `GOODS`
   - all `CUSTOMER_PROVIDED` → `MANUFACTURING_SERVICE`
   - mixed / `JOINT_DEVELOPMENT` → `MIXED`
3. `QuotationLine`, `SalesOrderLine`, and `InvoiceLine` store drawing metadata per line.
4. Product master already has partial drawing fields:
   - `fusionFileName`
   - `fusionFileUrl`
   - `drawingNotes`
   - `ProductImage[]`
5. Product master does **not** currently have an explicit “สินค้า/บริการ” type.

## Product Decision

### New source-of-truth rule

- Product master must explicitly classify each item as:
  - `GOODS` = สินค้า
  - `SERVICE` = บริการ / งานรับจ้าง / ค่าบริการ
- Drawing source is product metadata only. It must **not** auto-classify billing nature.
- Quotation should not ask the user to select drawing source or attach drawings per line.
- Quotation totals should remain price/VAT/discount only; no WHT/drawing-source calculation in quotation.
- When sales documents need tax/PDF/WHT context, they derive it from Product master snapshots.

### Mapping to existing tax terms

Use a product-level enum `ProductKind`:

```prisma
enum ProductKind {
  GOODS
  SERVICE
}
```

Map to existing document billing terms:

```ts
ProductKind.GOODS -> BillingNature.GOODS
ProductKind.SERVICE -> BillingNature.MANUFACTURING_SERVICE
Multiple line kinds -> BillingNature.MIXED
```

Do **not** use `DrawingSource` for this mapping.

## Proposed UX Flow

### Product master creation/edit

Add a new product classification section near Basic Info:

1. **ประเภทสินค้า**
   - Radio/select: `สินค้า`, `บริการ`
   - Required
   - Default for existing/new records: `สินค้า`

2. **ข้อมูลแบบงาน / Drawing metadata**
   - `ที่มาของแบบ` optional metadata:
     - `แบบเรา`
     - `แบบลูกค้า`
     - `ร่วมพัฒนา`
   - `Drawing Rev`
   - `ไฟล์/ลิงก์แบบ` using existing `fusionFileUrl` or a renamed label
   - `ชื่อไฟล์แบบ` using existing `fusionFileName`
   - `หมายเหตุแบบ` using existing `drawingNotes`

3. **Attachment behavior**
   - Phase 1: reuse existing `fusionFileName`, `fusionFileUrl`, `drawingNotes`, and product image upload.
   - Phase 2 optional: add dedicated `ProductDrawingAttachment` if multiple CAD/PDF files per product are needed.

### Quotation form

Quotation line behavior after selecting product:

- Fill price from `product.unitPrice`.
- Fill VAT price mode from `product.defaultVatPriceMode`.
- Fill optional defaults like color/surface finish if existing behavior supports it.
- Snapshot `productKind`/line billing nature **hidden on server**, not shown to user.
- Remove the collapsible `แบบงาน / Drawing source` section entirely.
- Remove `BillingNaturePicker` from Quotation UI unless there is a future explicitly approved accounting override.
- Do not auto-change document totals based on productKind.

### Sales Order / Invoice creation

- Same principle: no drawing-source selection per document line in normal create forms.
- Server inherits/snapshots product classification and drawing metadata from product at creation/conversion time.
- Invoice/Receipt/WHT downstream use the snapshot, not the live Product record, once the document is created.
- Optional future advanced override can exist only in a restricted finance/admin flow, with audit log, not in the normal Quotation line UI.

## Data Model Plan

### Add Product fields

Modify `prisma/schema.prisma`:

```prisma
enum ProductKind {
  GOODS
  SERVICE
}

model Product {
  // existing fields...
  productKind         ProductKind    @default(GOODS)
  drawingSource       DrawingSource  @default(TENANT_OWNED)
  drawingRevision     String?
  customerDrawingUrl  String?
}
```

Notes:

- Keep existing `fusionFileName`, `fusionFileUrl`, and `drawingNotes` for backward compatibility.
- `drawingSource` is metadata only.
- `customerDrawingUrl` is optional; if a customer drawing is a normal product-level asset, store it on Product.
- Do not make drawing fields required because services or generic products may not have a drawing.

### Keep line snapshot fields short-term

Do **not** immediately drop these from document line tables:

- `drawingSource`
- `lineBillingNature`
- `productCode`
- `drawingRevision`
- `customerDrawingUrl`
- `customerBranding`

Reason: existing invoices/PDFs/reports may already depend on these snapshots. Instead, change how they are populated:

- New documents populate from Product master.
- Old documents keep old values.
- UI no longer asks users to fill them per quotation.

### Future cleanup phase

After confirming all reports/PDFs work with Product-derived snapshots, consider:

- rename comments from “auto-classify billing nature” to “snapshot from Product master”
- keep line fields permanently as legal snapshots
- or add a dedicated `ProductDrawingAttachment` table if attachment history/versioning becomes important

## Billing / Tax Rules After Redesign

### Derivation helper

Create a helper such as `src/lib/product-billing.ts`:

```ts
export type ProductKind = "GOODS" | "SERVICE";
export type BillingNature = "GOODS" | "MANUFACTURING_SERVICE" | "MIXED";

export function billingNatureFromProductKind(kind: ProductKind): BillingNature {
  return kind === "SERVICE" ? "MANUFACTURING_SERVICE" : "GOODS";
}

export function deriveDocumentBillingNature(
  lines: { productKind?: ProductKind | null }[],
): BillingNature {
  const natures = lines.map((line) => billingNatureFromProductKind(line.productKind ?? "GOODS"));
  if (natures.every((n) => n === "GOODS")) return "GOODS";
  if (natures.every((n) => n === "MANUFACTURING_SERVICE")) return "MANUFACTURING_SERVICE";
  return "MIXED";
}
```

### Quotation rule

- Quotation may store `billingNature` as a snapshot for downstream conversion/reporting, but it must be derived server-side from selected Products.
- Quotation UI should not calculate or display billing nature as a user choice.
- No WHT is calculated on Quotation.

### Invoice / Receipt rule

- Invoice stores snapshot `billingNature` from SO/product line snapshots.
- Receipt WHT resolution remains invoice/receipt-stage logic.
- If document is `MIXED`, future improvement should calculate WHT from service portion only, not total invoice gross, if the current implementation does not already do that accurately.

## Files Likely to Change

### Prisma / migration

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_product_kind_drawing_metadata/migration.sql`

### Validators / helpers

- Modify: `src/lib/validators/product.ts`
- Modify: `src/lib/validators/billing-nature.ts`
  - remove/stop using drawing-source auto-classify wording
  - keep enum schemas if line snapshots still need them
- Create: `src/lib/product-billing.ts`
- Test: `tests/lib/product-billing.test.ts`
- Update or remove: `tests/lib/billing-nature.test.ts` cases that expect drawing source to classify billing nature

### Product UI/API

- Modify: `src/app/[locale]/(main)/production/products/product-form.tsx`
- Modify: `src/app/[locale]/(main)/production/products/product-list-client.tsx`
- Modify: `src/app/[locale]/(main)/production/products/[id]/product-detail-client.tsx`
- Modify: `src/app/api/production/products/route.ts`
- Modify: `src/app/api/production/products/[id]/route.ts`

### Sales document UI

- Modify: `src/app/[locale]/(main)/sales/quotations/quotation-form.tsx`
- Modify: `src/app/[locale]/(main)/sales/orders/order-form.tsx`
- Modify: `src/app/[locale]/(main)/finance/invoices/new/invoice-form-client.tsx`
- Modify or possibly keep only for read-only/admin use: `src/components/tax/drawing-source-row.tsx`
- Modify: `src/components/tax/billing-nature-picker.tsx` usage; likely remove from normal Quotation/SO create forms

### Sales/Finance APIs

- Modify: `src/app/api/sales/quotations/route.ts`
- Modify: `src/app/api/sales/quotations/[id]/route.ts`
- Modify: `src/app/api/sales/orders/route.ts`
- Modify: `src/app/api/sales/orders/[id]/route.ts`
- Modify: `src/app/api/sales/orders/[id]/convert/route.ts`
- Modify: `src/app/api/finance/invoices/route.ts`
- Modify: `src/app/api/finance/invoices/[id]/route.ts` only if normal line overrides should be restricted/removed

### Reports/PDFs

- Review: `src/app/api/finance/reports/drawing-source-mix/route.ts`
  - Rename report semantics if needed: “Product drawing source mix” not “quotation drawing source mix”
- Review: `src/app/api/finance/reports/revenue-by-nature/route.ts`
- Review: `src/lib/pdf/mappers.ts`
- Review: `src/lib/pdf/templates/invoice-mixed.tsx`

### Docs

- Update: `AGENTS.md` with durable rule:
  - Product master owns product/service and drawing metadata.
  - Quotation must not expose drawing-source/billing-nature auto-classify controls.

## Implementation Tasks

### Task 1: Write Product billing derivation tests

**Objective:** Lock desired business logic before changing UI/API.

**Files:**
- Create: `tests/lib/product-billing.test.ts`
- Create/Modify later: `src/lib/product-billing.ts`

**Tests:**

- `GOODS` product kind maps to `GOODS` billing nature.
- `SERVICE` product kind maps to `MANUFACTURING_SERVICE` billing nature.
- all goods lines derive document `GOODS`.
- all service lines derive document `MANUFACTURING_SERVICE`.
- mixed goods/service lines derive document `MIXED`.
- missing productKind defaults safely to `GOODS` for backward compatibility.
- drawing source is not an input to the derivation helper.

**Run:**

```bash
npm test -- tests/lib/product-billing.test.ts
```

Expected first run: fail because helper does not exist.

### Task 2: Add Prisma product fields and migration

**Objective:** Add Product-level classification and drawing metadata source fields.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration under `prisma/migrations/`

**Implementation notes:**

- Add enum `ProductKind` near Product model or product section.
- Add fields to `Product`:
  - `productKind ProductKind @default(GOODS)`
  - `drawingSource DrawingSource @default(TENANT_OWNED)`
  - `drawingRevision String?`
  - `customerDrawingUrl String?`
- Migration must backfill existing products as `GOODS`.

**Verification:**

```bash
node node_modules/prisma/build/index.js validate
node node_modules/prisma/build/index.js generate
```

### Task 3: Update Product validator and API contracts

**Objective:** Product create/update can save the new source-of-truth fields.

**Files:**
- Modify: `src/lib/validators/product.ts`
- Modify: `src/app/api/production/products/route.ts` only if explicit mapping is needed
- Modify: `src/app/api/production/products/[id]/route.ts` only if explicit mapping is needed

**Validation rules:**

- `productKind` enum required/default `GOODS`.
- `drawingSource` enum optional/default `TENANT_OWNED`.
- `drawingRevision` optional string.
- `customerDrawingUrl` optional URL-or-empty string.
- Existing `fusionFileUrl` stays URL-or-empty string.

**Tests:**

Add/update product validator tests if current test structure exists; otherwise include in `tests/lib/product-billing.test.ts` or create `tests/lib/product-validator.test.ts`.

### Task 4: Update Product form UI

**Objective:** Product creation/edit is where users choose สินค้า/บริการ and attach/store drawing details.

**Files:**
- Modify: `src/app/[locale]/(main)/production/products/product-form.tsx`
- Modify: locale messages if product labels are localized

**UI changes:**

- Add required field under Basic Info:
  - Label: `ประเภท`
  - Options: `สินค้า`, `บริการ`
- Relabel drawing card to make ownership clear:
  - `ข้อมูลแบบงานของสินค้า/บริการ`
- Add/select `ที่มาของแบบ` in Product form.
- Add `Drawing Rev` in Product form.
- Add `ไฟล์แบบจากลูกค้า (URL)` in Product form if `drawingSource=CUSTOMER_PROVIDED`, or keep always optional for simplicity.
- Keep existing `fusionFileName`, `fusionFileUrl`, `drawingNotes`.

**Acceptance:**

- Creating a product requires choosing/using default productKind.
- Editing product preserves productKind and drawing metadata.
- No need to upload/attach drawings in Quotation.

### Task 5: Add product classification to product list/detail

**Objective:** Users can see whether each master item is สินค้า or บริการ before using it.

**Files:**
- Modify: `src/app/[locale]/(main)/production/products/product-list-client.tsx`
- Modify: `src/app/[locale]/(main)/production/products/[id]/product-detail-client.tsx`

**Acceptance:**

- Product list shows a badge/column `สินค้า` or `บริการ`.
- Product detail shows product kind and drawing metadata.
- Drawing source is described as metadata, not tax auto-classification.

### Task 6: Remove drawing source and billing nature controls from Quotation UI

**Objective:** Quotation form becomes product/price/VAT only; no drawing-source/billing-nature decision per quote.

**Files:**
- Modify: `src/app/[locale]/(main)/sales/quotations/quotation-form.tsx`

**Remove:**

- `BillingNaturePicker` import and rendered card.
- `DrawingSourceRow` import and collapsible section.
- `suggestBillingNature` import and computation.
- default line `drawingSource` initialization.
- handlers that set per-line `drawingSource`, `productCode`, `drawingRevision`, `customerDrawingUrl`, `customerBranding` from quotation UI.

**Keep:**

- product selection
- unit price default
- VAT mode default
- color/surface/material fields if still needed for manufacturing details

**Test:**

- Existing UI test should assert `แบบงาน / Drawing source` is not present on quotation form.
- Product select still works.

### Task 7: Server-side derive Quotation line snapshots from Product

**Objective:** Quotation API no longer trusts/needs drawing fields from client; it looks up selected products and snapshots product classification/drawing metadata.

**Files:**
- Modify: `src/app/api/sales/quotations/route.ts`
- Modify: `src/app/api/sales/quotations/[id]/route.ts`

**Implementation:**

- Fetch all products referenced by line `productId` for current tenant.
- Validate every product belongs to tenant and is active.
- For each line create/update snapshot:
  - `drawingSource = product.drawingSource`
  - `lineBillingNature = billingNatureFromProductKind(product.productKind)`
  - `productCode = product.code`
  - `drawingRevision = product.drawingRevision ?? null`
  - `customerDrawingUrl = product.customerDrawingUrl ?? product.fusionFileUrl ?? null` only if desired
- Derive header `billingNature = deriveDocumentBillingNature(products)` unless an explicit internal override is kept.

**Important:** This derived `billingNature` is metadata/snapshot only and must not affect quotation total calculation.

**Tests:**

- API test: client payload with no drawing fields still creates line snapshots from Product.
- API test: client-sent fake drawing fields are ignored/overridden by Product master.
- API test: mixed goods/service products produce header `MIXED`.

### Task 8: Remove drawing source controls from Sales Order create flow

**Objective:** Sales Order create/edit follows the same Product-master source rule.

**Files:**
- Modify: `src/app/[locale]/(main)/sales/orders/order-form.tsx`
- Modify: `src/app/api/sales/orders/route.ts`
- Modify: `src/app/api/sales/orders/[id]/route.ts` if update route writes lines

**Rules:**

- Normal SO form should not show DrawingSourceRow.
- Direct SO creation derives snapshots from Product like Quotation.
- Quotation conversion keeps approved quotation snapshots, not live Product values.

### Task 9: Update Quotation → Sales Order conversion

**Objective:** Preserve approved Quotation snapshots into SO.

**Files:**
- Modify/verify: `src/app/api/sales/orders/[id]/convert/route.ts`

Current route already copies line drawing/tax snapshot fields from quotation line to SO line. Keep this behavior.

**Add test:**

- Conversion preserves `lineBillingNature` and drawing metadata from Quotation snapshot.
- It does not recalculate from Product if product changed after quote approval.

### Task 10: Remove drawing source controls from Invoice create flow

**Objective:** New invoices inherit from SO/product snapshots, not ad-hoc user entry.

**Files:**
- Modify: `src/app/[locale]/(main)/finance/invoices/new/invoice-form-client.tsx`
- Modify/verify: `src/app/api/finance/invoices/route.ts`

**Rules:**

- Invoice create UI should not show DrawingSourceRow in the normal flow.
- Invoices from SO inherit SO line snapshots.
- Invoice header `billingNature` comes from SO snapshot / derived lines.
- If no SO line snapshot exists, fallback to Product master through SO line product relation.

### Task 11: Decide treatment of Invoice detail line override

**Objective:** Avoid accidental post-hoc tax/drawing changes while preserving emergency correction ability.

**Files:**
- Review/modify: `src/app/[locale]/(main)/finance/invoices/[id]/invoice-detail-client.tsx`
- Review/modify: `src/app/api/finance/invoices/[id]/route.ts`

**Recommended behavior:**

- For `DRAFT` invoices: show product-derived line nature/drawing metadata as read-only by default.
- Optional button: `แก้ข้อมูลภาษีขั้นสูง` visible to finance/admin only.
- If override is kept, write audit log and require reason.
- For `ISSUED` invoices: no line classification edits; use cancel/reissue if wrong.

### Task 12: Update reports/PDF wording

**Objective:** Reports reflect Product-derived source and no longer imply Quotation-level auto-classification.

**Files:**
- Modify comments/copy in `src/app/api/finance/reports/drawing-source-mix/route.ts`
- Review `src/app/api/finance/reports/revenue-by-nature/route.ts`
- Review `src/lib/pdf/mappers.ts`
- Review invoice templates

**Acceptance:**

- PDF remains based on invoice snapshots.
- Mixed invoice sections still split by `lineBillingNature`.
- Report label/copy says drawing source is Product master metadata.

### Task 13: Update tests for removed UI behavior

**Objective:** Prevent regression where drawing-source picker appears again in Quotation.

**Test files likely:**
- Existing UI tests under `tests/ui/`
- New: `tests/ui/quotation-product-master-flow.test.tsx`
- Update: any tests referencing `DrawingSourceRow` in Quotation/SO/Invoice create flow

**Assertions:**

- Quotation form does not render `แบบงาน / Drawing source`.
- Quotation form does not render `BillingNaturePicker` normal card.
- Product form renders product kind selector.
- Product form renders drawing metadata fields.
- Selecting a service product in quote does not show WHT or drawing-source inputs.

### Task 14: Update AGENTS.md durable rule

**Objective:** Future agents must not reintroduce quote-level drawing-source auto-classification.

**Files:**
- Modify: `AGENTS.md`

**Add concise note:**

```md
- Product master owns product/service classification and drawing metadata. Quotation/SO/Invoice create flows must not expose per-line drawing-source auto-classification controls; they should snapshot Product master values server-side. Quotation totals are price/VAT/discount only; WHT belongs to invoice/receipt flow.
```

### Task 15: Full verification

**Commands:**

```bash
node node_modules/prisma/build/index.js validate
node node_modules/prisma/build/index.js generate
npm test -- tests/lib/product-billing.test.ts
npm test
node node_modules/eslint/bin/eslint.js
node node_modules/typescript/bin/tsc --noEmit --pretty false
node node_modules/next/dist/bin/next build
```

**Manual QA:**

1. Create Product A as `สินค้า`, with drawing metadata.
2. Create Product B as `บริการ`, with optional drawing metadata.
3. Create Quotation using Product A only:
   - no Drawing source section visible
   - no billing nature picker visible
   - totals calculate normally
   - server stores/snapshots `GOODS`
4. Create Quotation using Product B only:
   - no WHT shown/calculated in quote
   - server stores/snapshots `MANUFACTURING_SERVICE`
5. Create Quotation using A+B:
   - server stores/snapshots `MIXED`
   - quote total still just price/VAT/discount
6. Convert to SO:
   - snapshots preserved
7. Create Invoice:
   - invoice/PDF uses invoice snapshot
8. Create Receipt for service invoice/customer withholds tax:
   - WHT logic applies at receipt/invoice stage only

## Migration / Backward Compatibility

- Existing Products default to `GOODS`.
- Existing document line snapshots remain untouched.
- Existing issued invoices and tax invoices must not change PDF output due to live Product edits.
- Existing reports continue reading invoice line snapshots.
- New documents use Product master snapshots.

## Risks / Tradeoffs

1. **Product updated after quote creation**
   - Decision: Quotation/SO/Invoice keep snapshots. Product edits affect future documents only.

2. **Existing products that are actually services**
   - Default migration sets all to `GOODS`.
   - Need manual cleanup of service products after deploy.
   - Optional admin script/report can list likely service products by name/category for review, but do not auto-change tax classification.

3. **Mixed WHT calculation**
   - Current business rule says WHT applies to service portion.
   - Verify whether receipt/invoice implementation calculates on total or service portion.
   - If not accurate, plan a follow-up task to compute service subtotal for mixed invoices.

4. **Drawing attachment granularity**
   - Phase 1 keeps Product-level single/link fields to avoid overbuilding.
   - If customers need multiple revisions/files, add `ProductDrawingAttachment` later.

5. **Invoice override need**
   - Removing all overrides may block correction before issue.
   - Recommended: keep restricted DRAFT-only advanced override with audit trail if finance needs it.

## Open Questions for Tik Before Implementation

1. Product type labels should be exactly `สินค้า` / `บริการ` or use `สินค้า` / `รับจ้างทำของ`?
2. For Product drawing attachments, is current `fusionFileUrl` enough for Phase 1, or do we need multiple file uploads for CAD/PDF drawings immediately?
3. Should `DrawingSource` remain visible on Product as `แบบเรา/แบบลูกค้า/ร่วมพัฒนา`, or should we simplify and only keep file/revision notes?
4. Should Quotation PDF show any wording difference for service products, or should it remain a normal quotation and only Invoice/Receipt handle service/WHT wording?
5. For mixed invoice WHT, should the next implementation include service-portion WHT accuracy now, or treat it as a follow-up after removing quote-level controls?

## Recommended Implementation Order

1. ProductKind + helper tests
2. Prisma migration + product validator
3. Product form/list/detail UI
4. Quotation UI cleanup + server-side Product snapshot derivation
5. Sales Order UI/API cleanup
6. Invoice create UI/API cleanup
7. Reports/PDF wording review
8. Docs + full verification

## Definition of Done

- Product master is the only normal UI place to choose สินค้า/บริการ.
- Product master is the only normal UI place to keep drawing source/revision/link metadata.
- Quotation form no longer shows Drawing source or Billing nature controls.
- Quotation does not calculate WHT or auto-classify from drawing source.
- Server derives/snapshots line tax nature from ProductKind for downstream docs.
- Existing documents remain backward-compatible.
- All targeted and full verification pass.

## Execution Policy

Mode: manual sprint checkpoints
Branch: `feature/product-master-billing-flow`
Require Approval For:
- push `main`
- deploy
- production database migration
- destructive commands
- gateway/Coolify restart
Stop Conditions:
- targeted verification fails after 2 debug attempts
- scope drift beyond the active sprint
- unexpected dirty files outside sprint scope
Report Style: compact Thai summary

## Sprint Progress

### Sprint 1: Foundation — ProductKind, product billing helper, validator, migration

Status: completed
Completed: 2026-05-14 13:18 +07

Done:
- Added `ProductKind` enum and Product-level classification/drawing metadata fields in Prisma.
- Added migration `20260514125500_product_kind_drawing_metadata` without running production migration.
- Added `src/lib/product-billing.ts` and TDD coverage for ProductKind → BillingNature derivation.
- Updated product Zod validation to default create fields while keeping PATCH partial updates from injecting defaults.

Verification:
- RED: `npm test -- tests/lib/product-validator.test.ts` failed before the PATCH-default fix, proving the regression test caught default injection.
- GREEN: `npm test -- tests/lib/product-validator.test.ts tests/lib/product-billing.test.ts` → 12 passed.
- `node node_modules/prisma/build/index.js validate` → passed.
- `node node_modules/typescript/bin/tsc --noEmit --pretty false --incremental false` → passed.
- Subagent spec review → PASS.
- Subagent quality re-review → APPROVED.

Next Action:
- Sprint 2: Product master UI/API — expose `สินค้า/บริการ` and drawing metadata on product create/edit/list/detail.

### Sprint 2: Product master UI/API — ProductKind + drawing metadata on Product screens

Status: completed
Completed: 2026-05-14 14:03 +07

Done:
- Added Product form controls for `productKind` (`สินค้า`/`บริการ`) and product-level drawing metadata (`drawingSource`, `drawingRevision`, `customerDrawingUrl`) while keeping Fusion file fields and drawing notes.
- Added Product list badge/column and Product detail display for product kind + drawing metadata; copy says drawing source is metadata, not tax auto-classification.
- Added edit-page defaults for productKind/drawing metadata so existing values are preserved when editing.
- Added `tests/ui/product-master-billing-ui.test.ts` to prevent Product UI regressions, and updated `AGENTS.md` with the durable Product-master ownership rule.
- Confirmed existing Product API create/update/read paths save/read the new fields through Zod + Prisma scalar spreads; no API route changes were required.

Verification:
- RED: `npm test -- tests/ui/product-master-billing-ui.test.ts` failed before UI implementation (5 failing assertions reported by implementer subagent).
- GREEN: `npm test -- tests/ui/product-master-billing-ui.test.ts tests/lib/product-validator.test.ts tests/lib/product-billing.test.ts` → 17 passed.
- `node node_modules/prisma/build/index.js validate` → passed.
- `node node_modules/prisma/build/index.js generate` → passed; generated client already aligned/no tracked diff after regeneration.
- `node node_modules/typescript/bin/tsc --noEmit --pretty false --incremental false` → passed.
- `node node_modules/eslint/bin/eslint.js <Sprint 2 touched files>` → 0 errors, 4 pre-existing `no-img-element` warnings in product image surfaces.
- Scoped `git diff --check` → passed.
- Subagent spec review → PASS.
- Subagent quality review → APPROVED; only minor non-blocking notes.

Next Action:
- Sprint 3: Quotation UI cleanup + server-side Product snapshot derivation. Remove normal Quotation drawing-source/billing-nature controls, then derive line snapshots from Product on Quotation create/update.

### Sprint 3: Quotation UI cleanup + server-side Product snapshot derivation

Status: completed
Completed: 2026-05-14 14:21 +07

Done:
- Removed normal Quotation form `BillingNaturePicker`, `DrawingSourceRow`, drawing-source collapsible section, and line-level drawing metadata/customer branding entry from the quotation UI.
- Preserved product selection, unit price defaulting, VAT mode defaulting, and manufacturing detail fields (`color`, `surfaceFinish`, `materialSpec`).
- Added `src/lib/quotation-product-snapshots.ts` to derive quotation line snapshots from active tenant Product master records and fail closed for missing/inactive/foreign products.
- Updated Quotation create/update APIs to override client-sent drawing/tax snapshot fields with Product-derived `drawingSource`, `lineBillingNature`, `productCode`, `drawingRevision`, and `customerDrawingUrl`; header `billingNature` now derives from ProductKind lines.
- Added/updated tests so Quotation UI cannot reintroduce drawing-source/billing-nature controls and helper behavior covers fake client override, URL fallback, mixed goods/service, and missing product fail-closed.

Verification:
- RED: `npm test -- tests/ui/quotation-tax-currency-ui.test.ts tests/lib/quotation-product-snapshots.test.ts` failed before implementation because Quotation UI still contained `BillingNaturePicker` and helper file was missing.
- GREEN: `npm test -- tests/ui/quotation-tax-currency-ui.test.ts tests/lib/quotation-product-snapshots.test.ts tests/lib/product-billing.test.ts tests/lib/document-tax-propagation.test.ts` → 29 passed.
- `node node_modules/prisma/build/index.js validate` → passed.
- `node node_modules/typescript/bin/tsc --noEmit --pretty false --incremental false` → passed.
- `node node_modules/eslint/bin/eslint.js <Sprint 3 touched files>` → passed.
- Scoped `git diff --check` on Sprint 3 touched files → passed.
- Subagent spec review → PASS.
- Subagent quality review → APPROVED.

Next Action:
- Sprint 4: Sales Order UI/API cleanup. Remove normal SO drawing-source controls, derive direct SO snapshots from Product, and preserve approved Quotation snapshots during Quotation → SO conversion.

### Sprint 4: Sales Order UI/API cleanup + conversion snapshot preservation

Status: completed
Completed: 2026-05-14 14:54 +07

Done:
- Removed normal Sales Order form `BillingNaturePicker`, `DrawingSourceRow`, drawing-source/customer-branding controls, and drawing-source auto-classification copy while preserving product selection, unit price defaulting, VAT mode defaulting, and manufacturing detail fields.
- Reused `src/lib/quotation-product-snapshots.ts` as a document-line snapshot helper for direct Sales Order create/update, deriving `drawingSource`, `lineBillingNature`, `productCode`, `drawingRevision`, and `customerDrawingUrl` from active tenant Product master records and ignoring client-sent snapshot/classification fields.
- Added tenant ownership validation for client-sent `quotationId` on direct SO create/update before persisting links.
- Preserved approved Quotation snapshots during Quotation → SO conversion and later converted-SO line edits; converted SO PATCH keeps existing approved line snapshots by `sortOrder:productId` and avoids Product lookup when all patched lines have approved snapshots.
- Added tests for SO UI removal, direct SO Product-derived snapshots, foreign quotation-link rejection, converted snapshot preservation, and existing PATCH tax/currency regressions.

Verification:
- RED: `npm test -- tests/ui/sales-order-form-tax-currency-ui.test.ts tests/api/sales-order-product-snapshots.test.ts tests/api/sales-order-convert-snapshots.test.ts` failed before implementation because SO UI still contained `BillingNaturePicker` and direct SO APIs did not derive Product snapshots.
- GREEN: `npm test -- tests/ui/sales-order-form-tax-currency-ui.test.ts tests/api/sales-order-product-snapshots.test.ts tests/api/sales-order-convert-snapshots.test.ts tests/api/sales-order-patch-tax.test.ts tests/lib/quotation-product-snapshots.test.ts` → 15 passed.
- `node node_modules/typescript/bin/tsc --noEmit --pretty false --incremental false` → passed.
- `node node_modules/eslint/bin/eslint.js <Sprint 4 touched files>` → passed.
- Scoped `git diff --check` on Sprint 4 touched files → passed.
- Subagent spec review → PASS.
- Subagent quality review initially REQUEST_CHANGES for quotationId validation, converted-SO PATCH snapshot preservation, and invalid enum fixture; fixes applied with regression tests.
- Focused final re-review → APPROVED.

Next Action:
- Sprint 5: Invoice create UI/API cleanup. Remove normal Invoice drawing-source controls, inherit SO line snapshots into invoices, and fallback to Product master only when no SO snapshot exists.

### Sprint 5: Invoice create UI/API cleanup + DRAFT patch snapshot hardening

Status: completed
Completed: 2026-05-14 15:29 +07

Done:
- Removed normal Invoice create flow `BillingNaturePicker`, `DrawingSourceRow`, drawing-source/customer-branding controls, and drawing-source auto-classification copy while preserving SO selection, inherited tax type/currency display, line preview totals, notes, and submit flow.
- Hardened Invoice create API to ignore client-sent billing/drawing snapshot fields; invoice lines now inherit authoritative snapshots from Sales Order lines and fallback to Product master through the SO line product relation only when SO snapshots are missing.
- Invoice create now prefers SO line `vatPriceMode` over client payload, uses SO header `billingNature` snapshot when present, derives from line/Product snapshots only as fallback, and fails closed with 400 for invoice lines that do not belong to the selected SO.
- Hardened DRAFT Invoice PATCH so normal edits only update `dueDate`/`notes`; it no longer accepts or writes `billingNature`, line drawing metadata, customer branding, or line billing classification overrides.
- Narrowed Invoice create/update Zod schemas so normal API contracts no longer define billing nature or line drawing/classification override fields.
- Added tests for hostile Invoice create payloads, SO header billing snapshot inheritance, VAT mode spoof prevention, foreign SO line fail-closed behavior, Product fallback, DRAFT PATCH spoof prevention, and Invoice create UI removal.

Verification:
- RED: `npm test -- tests/ui/invoice-from-so-tax-currency-ui.test.ts tests/api/invoice-product-snapshots.test.ts` failed before implementation because Invoice create UI still contained `BillingNaturePicker`/`DrawingSourceRow` and POST accepted client/default billing snapshots.
- RED follow-up: `npm test -- tests/api/invoice-product-snapshots.test.ts` failed before fixes for SO header billing snapshot / VAT mode spoof assertions; `npm test -- tests/api/invoice-patch-snapshots.test.ts` failed before DRAFT PATCH hardening.
- GREEN: `npm test -- tests/api/invoice-product-snapshots.test.ts tests/api/invoice-patch-snapshots.test.ts tests/ui/invoice-from-so-tax-currency-ui.test.ts` → 10 passed.
- Cross-flow regression: `npm test -- tests/ui/invoice-from-so-tax-currency-ui.test.ts tests/api/invoice-product-snapshots.test.ts tests/api/invoice-patch-snapshots.test.ts tests/ui/sales-order-form-tax-currency-ui.test.ts tests/api/sales-order-product-snapshots.test.ts tests/api/sales-order-convert-snapshots.test.ts tests/api/sales-order-patch-tax.test.ts tests/lib/quotation-product-snapshots.test.ts` → 25 passed.
- `node node_modules/prisma/build/index.js validate` → passed.
- `node node_modules/typescript/bin/tsc --noEmit --pretty false --incremental false` → passed.
- `node node_modules/eslint/bin/eslint.js <Sprint 5 touched files>` → passed.
- Scoped `git diff --check` on Sprint 5 touched files → passed.
- Subagent spec/quality review initially REQUEST_CHANGES for client VAT mode spoof, SO header billing snapshot precedence, and DRAFT PATCH spoof bypass; fixes applied with regression tests.
- Focused re-review → APPROVED.

Next Action:
- Sprint 6: completed. Ready for final cross-flow/full verification and deployment planning checkpoint.

### Sprint 6: Invoice detail/report cleanup + snapshot wording alignment

Status: completed
Completed: 2026-05-14 15:48 +07

Done:
- Removed the Invoice detail tax-policy edit surface: no `BillingNaturePicker`, `DrawingSourceRow`, local line edit state, or hidden PATCH path for invoice billing/drawing metadata remains in the detail client.
- Replaced it with read-only Invoice snapshot UI showing header `billingNature` and line snapshot metadata (`lineBillingNature`, `drawingSource`, `productCode`, `drawingRevision`, `customerDrawingUrl`) with copy that changes require cancel/reissue or a separate audited advanced flow.
- Updated Drawing Source report API comments and user-facing report copy to describe drawing source as Product/SO/Invoice snapshot metadata, explicitly separate from Billing Nature/WHT classification.
- Updated Revenue by Nature report API comments and user-facing copy to state it groups by `Invoice.billingNature` snapshot derived from Product/SO.
- Updated invoice PDF mapper/template comments so mixed/service splitting is documented as based on invoice line snapshots, not live Product or quote-level auto-classification.
- Added source-contract tests for Invoice detail read-only behavior and report/PDF wording; tests also reject old drift/WHT-risk wording.

Verification:
- RED: `npm test -- tests/ui/invoice-detail-snapshot-readonly-ui.test.ts tests/api/invoice-report-pdf-snapshot-wording.test.ts` failed before implementation because Invoice detail still had editable tax/drawing controls and report/PDF wording still used the old drawing-source/WHT framing.
- GREEN: `npm test -- tests/ui/invoice-detail-snapshot-readonly-ui.test.ts tests/api/invoice-report-pdf-snapshot-wording.test.ts` → 4 passed.
- Regression: `npm test -- tests/ui/invoice-from-so-tax-currency-ui.test.ts tests/ui/invoice-detail-snapshot-readonly-ui.test.ts tests/api/invoice-product-snapshots.test.ts tests/api/invoice-patch-snapshots.test.ts tests/api/invoice-report-pdf-snapshot-wording.test.ts` → 14 passed.
- `node node_modules/prisma/build/index.js validate` → passed.
- `node node_modules/typescript/bin/tsc --noEmit --pretty false --incremental false` → passed.
- `node node_modules/eslint/bin/eslint.js <Sprint 6 touched files>` → passed.
- `git diff --check` → passed.
- Subagent quality review → APPROVED.
- Subagent spec review initially REQUEST_CHANGES for report page/user-facing copy that still mentioned drift/WHT risk; fixes applied with regression assertions.
- Focused final re-review → APPROVED.

Next Action:
- Final checkpoint: decide whether to run full `npm test` / `next build`, then push/deploy only after explicit approval.
