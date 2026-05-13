# Quotation Tax Type, Currency, and Customer Legal Name Implementation Plan

> **For Hermes:** Use subagent-driven-development / Kanban hybrid execution. Tik approved implementation on 2026-05-13 11:18 +07. Execute via board `workinflow-mom`, one bounded sprint/profile at a time; do not push, deploy, run production migrations, restart Gateway, touch secrets, or change Coolify/DNS without explicit approval.

**Goal:** เปลี่ยน logic ภาษีของเอกสารขายให้ผู้ใช้เลือกเองที่หน้าใบเสนอราคา (`รวม VAT`, `แยก VAT`, `ไม่มี VAT`) โดยไม่ผูกกับสถานะ VAT ของเรา/ลูกค้า, เพิ่มการเลือกค่าเงินในใบเสนอราคาและให้ไหลต่อไป SO/Invoice/PDF, และปรับการเพิ่มลูกค้าให้เก็บ “ชื่อจริงไม่รวมคำนำหน้า/คำลงท้าย” แล้วสร้างชื่อเต็มภาษาไทยในเอกสารอัตโนมัติจากประเภทนิติบุคคล/คำนำหน้าบุคคลธรรมดา

**Architecture:** เพิ่ม business helpers กลางสำหรับ `tax treatment`, `currency`, และ `customer legal display name` แล้วให้ API/UI/PDF ใช้ helper เดียวกัน ลดการกระจาย logic ในแต่ละ route. ต้องมี Prisma migration เพราะมี field ใหม่และ enum/type ใหม่ที่ต้อง persist เพื่อให้เอกสารที่ออกแล้วไม่เปลี่ยนย้อนหลัง. ใช้แนวทาง backward-compatible: records เก่า default เป็น `THB`, tax type derive จาก `vatModePolicy/vatRate`, customer names เก่าคงไว้แต่เอกสารใหม่ใช้ formatter ใหม่

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 7, PostgreSQL, Zod, react-hook-form, @react-pdf/renderer, next-intl

---

## Project / Thread Metadata

- Discord source: `#workinflow-mom`
- Workdir: `/Users/tik/Projects/WorkinFlow/MOM (Manufacturing Operations Management)`
- Repo: `CHAKRI-S/workinflow-mom`
- Target branch: `main`
- Current dirty state at plan time: `tsconfig.tsbuildinfo` modified only; do not touch/commit unless separately requested
- Production safety: this work includes Prisma schema changes, migrations, billing/tax logic, PDFs, and possibly production data backfill. Require explicit approval before running production migrations or deploys

---

## Requirement Restatement

### 1. Tax selection moved to Quotation

New behavior:

- ไม่สนว่าเรา `isVatRegistered` หรือ customer `isVatRegistered` เป็น true/false เพื่อกำหนด VAT อัตโนมัติอีกต่อไป
- หน้าใบเสนอราคาต้องมี field “ประเภทภาษี” ให้เลือก:
  1. `รวม VAT` — ราคาที่กรอกในสินค้าเป็นราคารวม VAT อยู่แล้ว
  2. `แยก VAT` — ราคาที่กรอกเป็นราคาก่อน VAT แล้วบวก VAT เพิ่ม
  3. `ไม่มี VAT` — ไม่มี VAT เลย, VAT = 0
- ค่า tax type นี้ต้องเป็น snapshot ของ quotation แล้วไหลไป Sales Order, Invoice, Receipt/Credit Note/PDF ที่เกี่ยวข้อง
- สถานะ VAT ของลูกค้าอาจยังเก็บไว้เป็นข้อมูล profile ได้ แต่ไม่ใช่ตัวตัดสิน VAT ของเอกสาร

### 2. Currency selection on Quotation

New behavior:

- หน้าใบเสนอราคาต้องเลือกค่าเงินได้
- ค่าเงินนี้ต้องแสดงใน quotation totals/PDF และควร flow ต่อไป SO/Invoice/Receipt/Credit Note เพื่อให้เอกสารชุดเดียวกัน consistent
- MVP ไม่ทำ FX conversion / exchange rate accounting เว้น Tik สั่งเพิ่มภายหลัง
- ค่า default = `THB`

### 3. Customer legal type and display name

New behavior:

- เพิ่มประเภทนิติบุคคล:
  - ร้านค้า
  - คณะบุคคล
  - ห้างหุ้นส่วนสามัญ
- Dropdown ประเภทนิติบุคคลต้องแสดง label ไทยตามที่เลือก ไม่ใช้ symbol/code เป็นข้อความแสดงผล
- ลูกค้าใส่เฉพาะ “ชื่อจริง” ไม่ต้องใส่คำนำหน้า/คำลงท้าย เช่น:
  - เลือก `บริษัทจำกัด`, name = `เอบีซี` → เอกสารแสดง `บริษัท เอบีซี จำกัด`
  - เลือก `ร้านค้า`, name = `สมชายการช่าง` → เอกสารแสดง `ร้าน สมชายการช่าง`
  - เลือก `ห้างหุ้นส่วนสามัญ`, name = `เอสพีแมชชีน` → เอกสารแสดง `ห้างหุ้นส่วนสามัญ เอสพีแมชชีน`
- ยกเว้น `บุคคลธรรมดา`: ต้องมี field คำนำหน้าให้เลือกเอง:
  - นาย
  - นาง
  - นางสาว
  - คุณ
  - ไม่มี
  - อื่นๆ
- คำนำหน้า/ประเภทนิติบุคคลต้องถูกใช้แทนข้อมูลลูกค้าในเอกสารอัตโนมัติ โดยไม่ให้ผู้ใช้ต้องพิมพ์เองในชื่อ

---

## Proposed Data Model

### A. Tax type

Prefer adding a new business enum instead of overloading old `VatModePolicy` labels:

```prisma
enum DocumentTaxType {
  VAT_INCLUSIVE // รวม VAT ในราคาสินค้า
  VAT_EXCLUSIVE // แยก VAT บวกเพิ่มจากราคาสินค้า
  NO_VAT        // ไม่มี VAT
}
```

Add snapshot field to these models:

```prisma
model Quotation {
  taxType DocumentTaxType @default(VAT_EXCLUSIVE)
}

model SalesOrder {
  taxType DocumentTaxType @default(VAT_EXCLUSIVE)
}

model Invoice {
  taxType DocumentTaxType @default(VAT_EXCLUSIVE)
}

model TaxInvoice {
  taxType DocumentTaxType @default(VAT_EXCLUSIVE)
}

model Receipt {
  taxType DocumentTaxType @default(VAT_EXCLUSIVE)
}

model CreditNote {
  taxType DocumentTaxType @default(VAT_EXCLUSIVE)
}
```

Keep existing `vatModePolicy` temporarily for backward compatibility and internal line calculation during migration. Eventually use helper mapping:

| UI label | New `taxType` | Internal calculation |
|---|---|---|
| รวม VAT | `VAT_INCLUSIVE` | `vatRate=7`, policy `FORCE_INCLUSIVE` |
| แยก VAT | `VAT_EXCLUSIVE` | `vatRate=7`, policy `FORCE_EXCLUSIVE` |
| ไม่มี VAT | `NO_VAT` | `vatRate=0`, policy can be `FORCE_EXCLUSIVE` but ignored |

Do not keep `PER_LINE` visible on new quotation UI unless Tik specifically wants per-line tax later. Existing records with `PER_LINE` can still render/edit safely.

### B. Currency

Use ISO 4217 string instead of enum for flexibility:

```prisma
model Quotation {
  currencyCode String @default("THB") @db.VarChar(3)
}

model SalesOrder {
  currencyCode String @default("THB") @db.VarChar(3)
}

model Invoice {
  currencyCode String @default("THB") @db.VarChar(3)
}

model TaxInvoice {
  currencyCode String @default("THB") @db.VarChar(3)
}

model Receipt {
  currencyCode String @default("THB") @db.VarChar(3)
}

model CreditNote {
  currencyCode String @default("THB") @db.VarChar(3)
}
```

MVP supported UI options:

- `THB` — บาท
- `USD` — US Dollar
- `JPY` — Japanese Yen
- `CNY` — Chinese Yuan
- `EUR` — Euro

Implementation note: still validate against an allowlist in Zod/UI, but schema remains string so adding currencies later does not require DB enum migration.

### C. Customer legal display name

Extend enum:

```prisma
enum JuristicType {
  COMPANY_LTD
  PUBLIC_CO
  LIMITED_PARTNERSHIP
  ORDINARY_PARTNERSHIP // ห้างหุ้นส่วนสามัญ
  SHOP                 // ร้านค้า
  PERSON_GROUP         // คณะบุคคล
  FOUNDATION
  ASSOCIATION
  JOINT_VENTURE
  OTHER_JURISTIC
  INDIVIDUAL
}

enum IndividualTitle {
  MR
  MRS
  MISS
  KHUN
  NONE
  OTHER
}
```

Add fields to `Customer`:

```prisma
model Customer {
  individualTitle      IndividualTitle?
  individualTitleOther String?
}
```

Potential future field, not required in MVP unless parsing legacy names becomes risky:

```prisma
rawLegalName String? // original RD/autofill name before stripping prefix/suffix
```

### D. Snapshot fields for immutable documents

Current Invoice already has snapshot customer fields. Quotation/SalesOrder currently rely more on relation. To preserve old docs after customer name/prefix changes, consider adding snapshots at least before PDF generation work:

```prisma
model Quotation {
  snapshotCustomerDisplayName String?
  snapshotCustomerTaxId       String?
  snapshotCustomerAddress     String?
}

model SalesOrder {
  snapshotCustomerDisplayName String?
  snapshotCustomerTaxId       String?
  snapshotCustomerAddress     String?
}
```

If sprint needs to stay smaller, compute display name from current customer for Quotation/SO first, then add snapshots in a later hardening sprint. For tax/legal documents, snapshot is strongly preferred.

---

## Helper Design

### `src/lib/tax-type.ts`

Central helper responsibilities:

- Define UI option list and Thai labels
- Convert `DocumentTaxType` to vat rate and VAT calculation policy
- Legacy fallback from old `vatModePolicy/vatRate`

Target API:

```ts
export const TAX_TYPE_OPTIONS = [
  { value: "VAT_INCLUSIVE", labelTh: "รวม VAT", descriptionTh: "ราคาสินค้ารวม VAT แล้ว" },
  { value: "VAT_EXCLUSIVE", labelTh: "แยก VAT", descriptionTh: "บวก VAT เพิ่มจากราคาสินค้า" },
  { value: "NO_VAT", labelTh: "ไม่มี VAT", descriptionTh: "ไม่คิด VAT" },
] as const;

export function resolveTaxCalculation(taxType: DocumentTaxType): {
  vatRate: number;
  vatModePolicy: VatModePolicy;
};
```

### `src/lib/currency.ts`

Central helper responsibilities:

- Define allowed currency options
- Validate ISO 4217 code
- Format amounts for UI/PDF
- Keep `THB` default

Target API:

```ts
export const CURRENCY_OPTIONS = [
  { code: "THB", label: "บาท", symbol: "฿", locale: "th-TH" },
  { code: "USD", label: "US Dollar", symbol: "$", locale: "en-US" },
  ...
] as const;

export function formatMoney(amount: number, currencyCode: string): string;
export function getCurrencyLabel(currencyCode: string): string;
```

### `src/lib/customer-name.ts`

Central helper responsibilities:

- Thai label for juristic type
- Format full display name from stored base name + juristic type + individual title
- Strip known legal affixes for RD lookup/autofill where safe

Target API:

```ts
export function getJuristicTypeLabelTh(type?: JuristicType | null): string;
export function formatCustomerDisplayName(input: {
  name: string;
  juristicType?: JuristicType | null;
  individualTitle?: IndividualTitle | null;
  individualTitleOther?: string | null;
}): string;
```

Initial mapping:

| Juristic type | User-entered name | Display name rule |
|---|---|---|
| `COMPANY_LTD` | `เอบีซี` | `บริษัท เอบีซี จำกัด` |
| `PUBLIC_CO` | `เอบีซี` | `บริษัท เอบีซี จำกัด (มหาชน)` |
| `LIMITED_PARTNERSHIP` | `เอบีซี` | `ห้างหุ้นส่วนจำกัด เอบีซี` |
| `ORDINARY_PARTNERSHIP` | `เอบีซี` | `ห้างหุ้นส่วนสามัญ เอบีซี` |
| `SHOP` | `สมชายการช่าง` | `ร้าน สมชายการช่าง` |
| `PERSON_GROUP` | `เอ บี` | `คณะบุคคล เอ บี` |
| `FOUNDATION` | `เอบีซี` | `มูลนิธิ เอบีซี` |
| `ASSOCIATION` | `เอบีซี` | `สมาคม เอบีซี` |
| `JOINT_VENTURE` | `เอบีซี` | `กิจการร่วมค้า เอบีซี` |
| `OTHER_JURISTIC` | `เอบีซี` | `เอบีซี` unless later adding custom prefix |
| `INDIVIDUAL` + `MR` | `สมชาย ใจดี` | `นาย สมชาย ใจดี` |
| `INDIVIDUAL` + `NONE` | `สมชาย ใจดี` | `สมชาย ใจดี` |
| `INDIVIDUAL` + `OTHER` + `ดร.` | `สมชาย ใจดี` | `ดร. สมชาย ใจดี` |

---

## Phase / Sprint Breakdown

## Phase 0 — Decision Lock + Safety Baseline

### Sprint 0.1: Confirm implementation choices

**Objective:** Lock the exact product semantics before schema migration.

**Decisions to confirm with Tik before coding:**

1. Tax types are exactly `รวม VAT`, `แยก VAT`, `ไม่มี VAT`.
2. VAT rate fixed to 7% for `รวม/แยก` in MVP, still using tenant `vatRate` only if Tik wants variable rate later.
3. Currency MVP list: `THB`, `USD`, `JPY`, `CNY`, `EUR`.
4. No exchange rate conversion in MVP — amounts are entered and stored in selected currency as-is.
5. Customer name storage: `Customer.name` will become “base name without legal affix” for newly edited/created customers; old names remain until edited or manually cleaned.
6. Existing `isVatRegistered` on Customer remains as profile info only, not VAT calculation driver.

**Files:**
- Read only: `prisma/schema.prisma`
- Read only: `src/lib/vat.ts`
- Read only: `src/app/api/sales/quotations/route.ts`
- Read only: `src/app/[locale]/(main)/sales/quotations/quotation-form.tsx`

**Verification:**
- Plan reviewed and approved.
- No code changes in this sprint.

---

## Phase 1 — Core Domain Helpers and Tests

### Sprint 1.1: Add tax type helper tests

**Objective:** Define the new tax behavior in tests before changing production logic.

**Files:**
- Create/Modify test: locate existing test pattern first; likely `src/lib/__tests__/tax-type.test.ts` or project test folder
- Create later: `src/lib/tax-type.ts`

**Test cases:**

1. `VAT_INCLUSIVE` returns `vatRate=7`, `vatModePolicy=FORCE_INCLUSIVE`.
2. `VAT_EXCLUSIVE` returns `vatRate=7`, `vatModePolicy=FORCE_EXCLUSIVE`.
3. `NO_VAT` returns `vatRate=0`.
4. Legacy fallback from old quotation with `vatRate=0` resolves to `NO_VAT`.
5. Thai labels exactly match `รวม VAT`, `แยก VAT`, `ไม่มี VAT`.

**Commands:**

```bash
npm test -- tax-type
```

Expected before implementation: FAIL because helper does not exist.

### Sprint 1.2: Implement `src/lib/tax-type.ts`

**Objective:** Create central tax type helper and keep old `calculateVatTotals` untouched except where needed.

**Files:**
- Create: `src/lib/tax-type.ts`
- Modify: only tests from Sprint 1.1

**Implementation notes:**

- Do not remove `VatModePolicy` yet.
- Use `resolveTaxCalculation(taxType, tenantVatRate?)` with default rate 7.
- Add type guard `isDocumentTaxType`.
- Avoid `any`.

**Verification:**

```bash
npm test -- tax-type
```

Expected: PASS.

### Sprint 1.3: Add currency helper tests

**Objective:** Define supported currencies and formatting behavior.

**Files:**
- Create test: `src/lib/__tests__/currency.test.ts` or matching project pattern
- Create later: `src/lib/currency.ts`

**Test cases:**

1. `THB` formats with Thai baht / symbol.
2. Unknown code falls back to `THB` or displays code safely; choose one behavior and test it.
3. `isSupportedCurrency("USD")` true.
4. `normalizeCurrencyCode("usd")` returns `USD`.
5. Invalid/empty defaults to `THB`.

**Verification:**

```bash
npm test -- currency
```

Expected before implementation: FAIL.

### Sprint 1.4: Implement `src/lib/currency.ts`

**Objective:** Add currency options and safe formatting utilities.

**Files:**
- Create: `src/lib/currency.ts`

**Verification:**

```bash
npm test -- currency
```

Expected: PASS.

### Sprint 1.5: Add customer legal name helper tests

**Objective:** Lock Thai display name rules and labels.

**Files:**
- Create test: `src/lib/__tests__/customer-name.test.ts`
- Create later: `src/lib/customer-name.ts`

**Test cases:**

1. `COMPANY_LTD + เอบีซี` => `บริษัท เอบีซี จำกัด`.
2. `PUBLIC_CO + เอบีซี` => `บริษัท เอบีซี จำกัด (มหาชน)`.
3. `LIMITED_PARTNERSHIP + เอบีซี` => `ห้างหุ้นส่วนจำกัด เอบีซี`.
4. `ORDINARY_PARTNERSHIP + เอบีซี` => `ห้างหุ้นส่วนสามัญ เอบีซี`.
5. `SHOP + สมชายการช่าง` => `ร้าน สมชายการช่าง`.
6. `PERSON_GROUP + เอ บี` => `คณะบุคคล เอ บี`.
7. `INDIVIDUAL + MR + สมชาย ใจดี` => `นาย สมชาย ใจดี`.
8. `INDIVIDUAL + NONE + สมชาย ใจดี` => `สมชาย ใจดี`.
9. `INDIVIDUAL + OTHER + ดร. + สมชาย ใจดี` => `ดร. สมชาย ใจดี`.
10. Labels for dropdown are Thai, not enum symbols.

**Verification:**

```bash
npm test -- customer-name
```

Expected before implementation: FAIL.

### Sprint 1.6: Implement `src/lib/customer-name.ts`

**Objective:** Add reusable formatter and option lists for UI/API/PDF.

**Files:**
- Create: `src/lib/customer-name.ts`

**Verification:**

```bash
npm test -- customer-name
```

Expected: PASS.

---

## Phase 2 — Database Schema + Migration

### Sprint 2.1: Update Prisma schema

**Objective:** Add persistent fields needed by the new behavior.

**Files:**
- Modify: `prisma/schema.prisma`

**Schema changes:**

1. Add enum `DocumentTaxType`.
2. Add enum `IndividualTitle`.
3. Extend enum `JuristicType` with:
   - `ORDINARY_PARTNERSHIP`
   - `SHOP`
   - `PERSON_GROUP`
4. Add `taxType DocumentTaxType @default(VAT_EXCLUSIVE)` to:
   - `Quotation`
   - `SalesOrder`
   - `Invoice`
   - `TaxInvoice`
   - `Receipt`
   - `CreditNote`
5. Add `currencyCode String @default("THB") @db.VarChar(3)` to:
   - `Quotation`
   - `SalesOrder`
   - `Invoice`
   - `TaxInvoice`
   - `Receipt`
   - `CreditNote`
   - optional later: `Payment`
6. Add `individualTitle IndividualTitle?` and `individualTitleOther String?` to `Customer`.

**Important:** Keep existing `isVatRegistered`, `vatModePolicy`, and `vatPriceMode` fields for compatibility.

**Verification:**

```bash
npx prisma validate
```

Expected: schema valid.

### Sprint 2.2: Create migration

**Objective:** Generate migration without touching production.

**Files:**
- Create: `prisma/migrations/<timestamp>_tax_type_currency_customer_legal_name/migration.sql`
- Generated update: Prisma client files only via project flow if needed

**Command:**

```bash
npx prisma migrate dev --name tax_type_currency_customer_legal_name
```

**Local verification:**

```bash
npx prisma validate
npm test -- tax-type currency customer-name
```

**Production warning:** Do not run `npx prisma migrate deploy` on production without Tik approval.

### Sprint 2.3: Backward compatibility/backfill script or SQL

**Objective:** Ensure existing rows have sensible values.

**Backfill rules:**

- Existing currency: `THB`.
- Existing taxType:
  - if `vatRate = 0` => `NO_VAT`
  - else if `vatModePolicy = FORCE_INCLUSIVE` => `VAT_INCLUSIVE`
  - else => `VAT_EXCLUSIVE`
- Existing customers:
  - leave `name` as-is, do not auto-strip in migration to avoid accidental corruption.
  - `individualTitle` remains null until user edits.

**Files:**
- Migration SQL if Prisma default is insufficient
- Optional one-off local script only if needed: `scripts/backfill-tax-type-currency.ts`

**Verification query:**

```sql
select tax_type, currency_code, count(*) from "Quotation" group by tax_type, currency_code;
```

Use actual table/column names generated by Prisma migration.

---

## Phase 3 — Validators and API Contracts

### Sprint 3.1: Update Zod validators

**Objective:** Accept new tax type, currency, and individual title fields server-side.

**Files:**
- Modify: `src/lib/validators/quotation.ts`
- Modify: `src/lib/validators/sales-order.ts`
- Modify: `src/lib/validators/invoice.ts`
- Modify: `src/lib/validators/receipt.ts`
- Modify: `src/lib/validators/customer.ts`
- Possibly create: `src/lib/validators/shared.ts` for currency/tax enums if helpful

**Details:**

- `quotationCreateSchema` adds:
  - `taxType: documentTaxTypeEnum.default("VAT_EXCLUSIVE")`
  - `currencyCode: currencyCodeSchema.default("THB")`
- Customer schema adds:
  - new juristic enum values
  - `individualTitle`
  - `individualTitleOther`
  - validation: if juristicType = `INDIVIDUAL` and title = `OTHER`, require non-empty other title

**Verification:**

```bash
npm test -- validators
```

or targeted equivalent based on existing test setup.

### Sprint 3.2: Update quotation create/update API

**Objective:** Quotation totals use selected tax type, not customer VAT status.

**Files:**
- Modify: `src/app/api/sales/quotations/route.ts`
- Modify: `src/app/api/sales/quotations/[id]/route.ts`

**Key changes:**

Replace current logic:

```ts
const vatRate = customer.isVatRegistered ? 7 : 0;
```

with helper:

```ts
const { vatRate, vatModePolicy } = resolveTaxCalculation(data.taxType);
```

Store:

- `taxType: data.taxType`
- `currencyCode: data.currencyCode`
- `vatModePolicy` derived from tax type or saved for legacy compatibility

**Tests:**

1. Create quotation with `NO_VAT` for VAT customer → `vatRate=0`, `vatAmount=0`.
2. Create quotation with `VAT_EXCLUSIVE` for non-VAT customer → VAT 7 is calculated.
3. Create quotation with `VAT_INCLUSIVE` → unit price/subtotal split correctly.
4. Currency `USD` persists.

### Sprint 3.3: Update quotation-to-SO conversion

**Objective:** Preserve quotation tax type/currency when converting to SO.

**Files:**
- Modify: `src/app/api/sales/orders/[id]/convert/route.ts`

**Key changes:**

- Stop using `quotation.customer.isVatRegistered` for VAT.
- Recalculate using `quotation.taxType` or use quotation stored totals consistently.
- Copy `taxType` and `currencyCode` to SalesOrder.
- Ensure deposit amount uses selected currency numeric total as-is.

**Tests:**

1. Convert `NO_VAT` quotation → SO has `NO_VAT`, `vatAmount=0`.
2. Convert `VAT_EXCLUSIVE` quotation for non-VAT customer → SO preserves VAT.
3. Convert `USD` quotation → SO currency `USD`.

### Sprint 3.4: Update Sales Order direct create API

**Objective:** Direct SO creation follows same rules as quotation.

**Files:**
- Modify: `src/app/api/sales/orders/route.ts`
- Modify: `src/lib/validators/sales-order.ts`

**Verification:**

- Same tax/currency tests as quotation, adapted for SO.

### Sprint 3.5: Update Invoice create API

**Objective:** Invoice inherits tax type/currency from SO and no longer gates VAT by customer/tenant status.

**Files:**
- Modify: `src/app/api/finance/invoices/route.ts`
- Modify: `src/app/api/finance/invoices/[id]/route.ts`
- Modify: `src/lib/validators/invoice.ts`

**Key changes:**

- Fetch `salesOrder.taxType` and `salesOrder.currencyCode`.
- Default invoice tax/currency from SO if body does not override.
- Generate invoice prefix by tax type:
  - `VAT_INCLUSIVE` or `VAT_EXCLUSIVE` => `INV`
  - `NO_VAT` => `BIL`
- Stop using `invoicePrefix(tenantIsVat, customer.isVatRegistered)` for new logic.

**Tests:**

1. SO `NO_VAT` → invoice prefix `BIL`, VAT 0.
2. SO `VAT_EXCLUSIVE` → invoice prefix `INV`, VAT 7.
3. SO `VAT_INCLUSIVE` → invoice prefix `INV`, VAT calculated inclusive.
4. Currency copied from SO.

### Sprint 3.6: Update Tax Invoice creation rules

**Objective:** Tax invoice can be created based on document tax type, not customer VAT status.

**Files:**
- Modify: `src/app/api/finance/tax-invoices/route.ts`

**Suggested rule:**

- Allow Tax Invoice only when linked invoice `taxType` is `VAT_INCLUSIVE` or `VAT_EXCLUSIVE` and `vatAmount > 0`.
- Reject when `taxType = NO_VAT`.
- Check no duplicate active tax invoice for the same invoice unless the product explicitly supports replacement/cancellation.
- Store `taxType` and `currencyCode` snapshots on TaxInvoice.

**Question for Tik before implementation:** Should the app still block Tax Invoice if tenant `isVatRegistered=false`, or fully trust the user-selected tax type? Tik said “เราจด ลูกค้าจด หรือไม่จดก็ได้ เราสามารถเลือกได้เลย”; this plan assumes user selection is authoritative. If legal guard should remain, decide before Sprint 3.6.

### Sprint 3.7: Update Receipt/Credit Note creation

**Objective:** Downstream finance docs keep same tax/currency context.

**Files:**
- Modify: `src/app/api/finance/receipts/route.ts`
- Modify: `src/app/api/finance/credit-notes/route.ts`
- Modify: relevant `[id]` routes if they update totals/status
- Modify: validators for receipt/credit note if required

**Rules:**

- Receipt inherits `taxType` and `currencyCode` from invoice.
- Credit Note inherits `taxType`, `currencyCode`, and VAT calculation mode from invoice.
- Prefix:
  - Receipt: `RC` when taxType is VAT, `RN` when `NO_VAT`
  - Credit Note: `CN` when taxType is VAT, `CNB` when `NO_VAT`

---

## Phase 4 — Customer Legal Name UX and API

### Sprint 4.1: Extend business info component options

**Objective:** Dropdown shows Thai labels and includes new legal types.

**Files:**
- Modify: `src/components/forms/business-info-section.tsx`
- Modify: `src/lib/customer-name.ts`

**Changes:**

- Add `SHOP`, `PERSON_GROUP`, `ORDINARY_PARTNERSHIP`.
- Keep `SelectItem` display as Thai labels only.
- Make selected value render Thai label in trigger. If current Select only shows item text, verify visually.

**Verification:**

- Open customer form.
- Dropdown contains all Thai options.
- Selecting an option shows Thai text, not `COMPANY_LTD`/symbols.

### Sprint 4.2: Add individual title UI

**Objective:** Show title selector only when `juristicType = INDIVIDUAL`.

**Files:**
- Modify: `src/components/forms/business-info-section.tsx` or `src/app/[locale]/(main)/sales/customers/customer-form.tsx`
- Modify: `src/lib/validators/customer.ts`

**UI behavior:**

- If selected type != `INDIVIDUAL`, hide individual title field and clear `individualTitle/individualTitleOther`.
- If selected type = `INDIVIDUAL`, show selector:
  - นาย
  - นาง
  - นางสาว
  - คุณ
  - ไม่มี
  - อื่นๆ
- If `อื่นๆ`, show text input for custom title.

**Verification:**

- Changing from `INDIVIDUAL` to `COMPANY_LTD` clears title fields.
- `OTHER` title requires text.

### Sprint 4.3: Rename customer name field copy

**Objective:** Make it clear users should enter base name only.

**Files:**
- Modify: `src/components/forms/business-info-section.tsx`
- Modify translations if used: likely `messages/th.json`, `messages/en.json` or equivalent

**Copy proposal:**

- Label: `ชื่อจริง / ชื่อกิจการ (ไม่ต้องใส่คำนำหน้าหรือคำลงท้าย)`
- Placeholder examples:
  - company: `เช่น เอบีซีแมชชีน`
  - shop: `เช่น สมชายการช่าง`
  - individual: `เช่น สมชาย ใจดี`

### Sprint 4.4: Update customer create/update API

**Objective:** Persist new juristic/title fields safely.

**Files:**
- Modify: `src/app/api/sales/customers/route.ts`
- Modify: `src/app/api/sales/customers/[id]/route.ts`
- Modify: `src/lib/validators/customer.ts`

**Rules:**

- Store `name` as entered; do not auto-add prefix/suffix to DB `name`.
- Store `juristicType`, `individualTitle`, `individualTitleOther`.
- If type is not `INDIVIDUAL`, title fields should become null.
- If type is `INDIVIDUAL` and title is `OTHER`, require `individualTitleOther`.

**Tests:**

1. Create shop customer with name `สมชายการช่าง` stores name unchanged and juristicType `SHOP`.
2. Create individual with `MR` stores title.
3. Create individual with `OTHER` and blank custom title returns 400.

### Sprint 4.5: RD/tax-id lookup normalization

**Objective:** If Revenue Department lookup returns full legal name, avoid duplicating prefixes/suffixes.

**Files:**
- Modify: `src/components/forms/business-info-section.tsx`
- Modify: `src/app/api/lookup/tax-id/route.ts` if mapping happens there
- Modify: `src/lib/customer-name.ts`

**Approach:**

- Add helper `stripKnownLegalAffixes(name, juristicType)`.
- Use it only after lookup when `juristicType` is known/confident.
- Preserve safety: if parsing is uncertain, leave as returned and show note “ตรวจสอบชื่อก่อนบันทึก”.

**Tests:**

1. `บริษัท เอบีซี จำกัด` + `COMPANY_LTD` => base `เอบีซี`.
2. `ร้าน สมชายการช่าง` + `SHOP` => base `สมชายการช่าง`.
3. Unknown pattern returns original unchanged.

---

## Phase 5 — Quotation UI

### Sprint 5.1: Replace quotation VAT UI with Tax Type selector

**Objective:** หน้าใบเสนอราคาเลือก “ประเภทภาษี” ที่เข้าใจง่าย.

**Files:**
- Modify: `src/app/[locale]/(main)/sales/quotations/quotation-form.tsx`
- Modify translations/messages if used
- Use: `src/lib/tax-type.ts`

**Changes:**

- Remove/stop emphasizing customer VAT rate display as deciding factor.
- Add `Select` for `taxType` near customer/valid until.
- Labels:
  - `รวม VAT` — ราคาที่กรอกเป็นยอดรวม VAT แล้ว
  - `แยก VAT` — บวก VAT เพิ่มจากราคาสินค้า
  - `ไม่มี VAT` — ไม่คิด VAT
- Set form default `taxType = VAT_EXCLUSIVE` unless Tik prefers `NO_VAT` or tenant setting.
- Hide old `vatModePolicy` selector from new UI or keep hidden/internal.
- When tax type changes, recalculate totals immediately.

**Verification:**

- Select `ไม่มี VAT` → VAT line = 0.
- Select `แยก VAT` → total increases by VAT.
- Select `รวม VAT` → total remains equal to gross entered amount, subtotal/VAT split.

### Sprint 5.2: Add currency selector to quotation form

**Objective:** User picks currency on quotation create/edit.

**Files:**
- Modify: `src/app/[locale]/(main)/sales/quotations/quotation-form.tsx`
- Use: `src/lib/currency.ts`

**Changes:**

- Add `currencyCode` select, default `THB`.
- Show currency code/symbol in line prices and totals.
- Do not convert existing amounts when currency changes; show warning/copy:
  - `การเปลี่ยนสกุลเงินไม่แปลงราคาอัตโนมัติ กรุณาตรวจราคาต่อหน่วยอีกครั้ง`

**Verification:**

- Select USD → totals labels show USD/$.
- Submit → API receives `currencyCode: "USD"`.

### Sprint 5.3: Update quotation detail/list/PDF display

**Objective:** Display selected tax type and currency on quotation surfaces.

**Files:**
- Modify: `src/app/[locale]/(main)/sales/quotations/quotation-list-client.tsx`
- Modify: `src/app/[locale]/(main)/sales/quotations/[id]/quotation-detail-client.tsx`
- Search/create PDF route/template if quotation PDF exists

**Changes:**

- Show badge: `รวม VAT` / `แยก VAT` / `ไม่มี VAT`.
- Format amounts with selected currency.
- PDF header/totals include currency.

**Verification:**

- Created quotation detail shows same tax/currency as submitted.
- PDF amount labels match selected currency.

---

## Phase 6 — Downstream UI/PDF Consistency

### Sprint 6.1: Sales Order UI and PDFs

**Objective:** SO displays inherited tax type/currency and does not imply customer VAT controls VAT.

**Files likely:**
- `src/app/[locale]/(main)/sales/orders/**`
- SO PDF renderer/templates if present
- `src/app/api/sales/orders/**`

**Verification:**

- Convert quotation to SO and compare totals/tax/currency.
- Direct SO creation follows selected tax type.

### Sprint 6.2: Invoice UI and PDFs

**Objective:** Invoice creation/display/PDF uses tax type/currency from SO.

**Files:**
- `src/app/[locale]/(main)/finance/invoices/new/invoice-form-client.tsx`
- `src/app/[locale]/(main)/finance/invoices/[id]/invoice-detail-client.tsx`
- `src/lib/pdf/mappers.ts`
- `src/lib/pdf/types.ts`
- `src/lib/pdf/templates/invoice-goods.tsx`
- `src/lib/pdf/templates/invoice-service.tsx`
- `src/lib/pdf/templates/invoice-mixed.tsx`

**Changes:**

- Remove customer VAT badge as the primary determinant; if retained, label it as profile info only.
- PDF title:
  - VAT tax types: can show `ใบกำกับภาษี / ใบแจ้งหนี้` if business rule says selected VAT means tax invoice wording allowed.
  - `NO_VAT`: show `ใบแจ้งหนี้ / ใบส่งของ` or `ใบเรียกเก็บเงิน`.
- PDF totals format currency.

**Verification:**

- Invoice PDF for `NO_VAT` does not show VAT amount or tax invoice wording.
- Invoice PDF for `VAT_INCLUSIVE` shows VAT split and selected currency.
- Invoice PDF for `USD` does not show `บาท` in amount labels except Thai baht text if number-to-words is not multi-currency; either hide baht words for non-THB or implement currency-specific words later.

### Sprint 6.3: Tax Invoice, Receipt, Credit Note UI/PDFs

**Objective:** Downstream finance docs inherit and display correct tax/currency.

**Files:**
- `src/app/[locale]/(main)/finance/tax-invoices/**`
- `src/app/[locale]/(main)/finance/receipts/**`
- `src/app/[locale]/(main)/finance/credit-notes/**`
- `src/lib/pdf/templates/receipt.tsx`
- Tax invoice PDF templates/mappers
- Credit note PDF templates/mappers if present

**Verification:**

- Cannot create Tax Invoice from `NO_VAT` invoice.
- Receipt from USD invoice shows USD.
- Credit Note from VAT invoice preserves VAT type and currency.

---

## Phase 7 — Document Numbering and Prefix Rules

### Sprint 7.1: Replace VAT prefix decisions with tax type decisions

**Objective:** Prefixes follow selected tax type, not VAT registration flags.

**Files:**
- Modify: `src/lib/doc-numbering.ts`
- Modify API callers that use `invoicePrefix`, `receiptPrefix`, `creditNotePrefix`

**New helper proposal:**

```ts
export function invoicePrefixFromTaxType(taxType: DocumentTaxType): string {
  return taxType === "NO_VAT" ? DOC_PREFIX.INVOICE_NON_VAT : DOC_PREFIX.INVOICE_VAT;
}
```

Similarly:

- `receiptPrefixFromTaxType`
- `creditNotePrefixFromTaxType`

**Compatibility:**

- Keep old helper names for old callers temporarily or refactor all callers in same sprint.
- Add deprecation comments to old helpers if retained.

**Tests:**

1. `NO_VAT` invoice gets `BIL`.
2. `VAT_INCLUSIVE` invoice gets `INV`.
3. `VAT_EXCLUSIVE` invoice gets `INV`.
4. Sequence remains ordered per tenant/prefix/year.

---

## Phase 8 — Localization, Copy, and UX polish

### Sprint 8.1: Thai labels across app

**Objective:** No enum symbols leak into UI.

**Files:**
- Search all messages and UI files for enum labels:
  - `COMPANY_LTD`
  - `VAT_INCLUSIVE`
  - `VAT_EXCLUSIVE`
  - `NO_VAT`
  - `INDIVIDUAL`
- Modify relevant components/messages.

**Verification:**

```bash
grep-like search via search_files for enum symbols in UI text paths
```

Expected: enum symbols only in code values, not user-facing labels.

### Sprint 8.2: Mobile/desktop responsive check

**Objective:** New selectors fit existing responsive layouts.

**Files:**
- Quotation form
- Customer form
- Invoice form/detail

**Verification:**

- Desktop: no broken grid.
- Tablet/mobile: selector labels do not overflow.
- Thai text remains readable.

---

## Phase 9 — Test Suite and Regression Matrix

### Sprint 9.1: Unit tests

**Commands:**

```bash
npm test -- tax-type currency customer-name
```

Expected: all pass.

### Sprint 9.2: API integration tests

**Target cases:**

1. Quotation create with all 3 tax types.
2. Quotation edit changes tax type and recalculates totals.
3. Convert quotation to SO preserves tax/currency.
4. Create invoice from SO preserves tax/currency.
5. Tax invoice rejected for `NO_VAT`.
6. Customer create/update legal name fields.

### Sprint 9.3: PDF smoke tests

**Target cases:**

1. THB + VAT exclusive invoice PDF.
2. THB + VAT inclusive invoice PDF.
3. THB + no VAT invoice PDF.
4. USD quotation/invoice PDF.
5. Customer legal display name examples:
   - company limited
   - shop
   - ordinary partnership
   - individual with title

### Sprint 9.4: Manual UI smoke test

**Flow:**

1. Create customer: `ร้านค้า`, name `สมชายการช่าง`.
2. Create quotation with `แยก VAT`, currency `THB`.
3. Approve and convert to SO.
4. Create invoice.
5. Download PDF and verify display name/tax/currency.
6. Repeat quotation with `ไม่มี VAT` and currency `USD`.

---

## Phase 10 — Documentation and Migration Handoff

### Sprint 10.1: Update project docs

**Objective:** Future agents/devs know new tax/currency rules.

**Files:**
- Modify: `AGENTS.md` or a focused doc under `docs/` if more appropriate
- Modify: relevant billing/tax docs if present, e.g. `docs/DEPLOY-PHASE-6A.md` only if it describes tax behavior

**Content:**

- VAT is selected per document at quotation creation, not derived from customer VAT status.
- Currency is a document snapshot and no FX conversion in MVP.
- Customer `name` should be base name only; legal display name is formatted by helper.

### Sprint 10.2: Production deployment plan

**Objective:** Safe migration/deploy checklist.

**Steps:**

1. Ensure working tree clean except intended files.
2. Run local tests.
3. Run local build.
4. Review migration SQL.
5. Commit feature.
6. Push only after approval.
7. Deploy through normal Coolify flow.
8. With approval, run production Prisma migrate deploy.
9. Smoke test production create quotation/customer.

**Production verification:**

- Existing quotations still load.
- Existing customers still load.
- New customer legal name flow works.
- New quotation tax/currency flow works.
- Existing invoices/PDFs still render.

---

## Files Likely to Change

### Schema / generated

- `prisma/schema.prisma`
- `prisma/migrations/**/migration.sql`
- Prisma generated client files via established project flow

### Core helpers

- `src/lib/vat.ts` — likely add support for `NO_VAT` only if helper cannot handle externally
- `src/lib/tax-type.ts` — new
- `src/lib/currency.ts` — new
- `src/lib/customer-name.ts` — new
- `src/lib/doc-numbering.ts`

### Validators

- `src/lib/validators/quotation.ts`
- `src/lib/validators/sales-order.ts`
- `src/lib/validators/invoice.ts`
- `src/lib/validators/receipt.ts`
- `src/lib/validators/customer.ts`

### APIs

- `src/app/api/sales/quotations/route.ts`
- `src/app/api/sales/quotations/[id]/route.ts`
- `src/app/api/sales/orders/route.ts`
- `src/app/api/sales/orders/[id]/convert/route.ts`
- `src/app/api/finance/invoices/route.ts`
- `src/app/api/finance/tax-invoices/route.ts`
- `src/app/api/finance/receipts/route.ts`
- `src/app/api/finance/credit-notes/route.ts`
- `src/app/api/sales/customers/route.ts`
- `src/app/api/sales/customers/[id]/route.ts`
- `src/app/api/lookup/tax-id/route.ts` if lookup mapping changes

### UI

- `src/app/[locale]/(main)/sales/quotations/quotation-form.tsx`
- `src/app/[locale]/(main)/sales/quotations/quotation-list-client.tsx`
- `src/app/[locale]/(main)/sales/quotations/[id]/quotation-detail-client.tsx`
- `src/app/[locale]/(main)/sales/customers/customer-form.tsx`
- `src/components/forms/business-info-section.tsx`
- `src/app/[locale]/(main)/sales/orders/**`
- `src/app/[locale]/(main)/finance/invoices/**`
- `src/app/[locale]/(main)/finance/tax-invoices/**`
- `src/app/[locale]/(main)/finance/receipts/**`
- `src/app/[locale]/(main)/finance/credit-notes/**`

### PDF

- `src/lib/pdf/mappers.ts`
- `src/lib/pdf/types.ts`
- `src/lib/pdf/templates/invoice-goods.tsx`
- `src/lib/pdf/templates/invoice-service.tsx`
- `src/lib/pdf/templates/invoice-mixed.tsx`
- `src/lib/pdf/templates/receipt.tsx`
- Tax invoice / credit note templates if present
- Shared PDF amount/totals components if currency text is centralized

### Docs

- `AGENTS.md` or relevant `docs/*.md`

---

## Acceptance Criteria

### Tax

- [ ] Quotation create/edit has selector: `รวม VAT`, `แยก VAT`, `ไม่มี VAT`.
- [ ] VAT calculation follows selector only, not customer/tenant VAT status.
- [ ] `รวม VAT`: entered price is gross including VAT.
- [ ] `แยก VAT`: entered price is net and VAT is added.
- [ ] `ไม่มี VAT`: VAT rate/amount = 0.
- [ ] Selected tax type persists on Quotation and flows to SO/Invoice/Receipt/Credit Note.
- [ ] Prefix uses tax type: VAT => `INV/RC/CN`, no VAT => `BIL/RN/CNB`.
- [ ] Tax Invoice cannot be created from `NO_VAT` invoice.

### Currency

- [ ] Quotation create/edit has currency selector.
- [ ] Currency persists on Quotation and flows downstream.
- [ ] UI/PDF totals show selected currency.
- [ ] Changing currency does not silently convert numbers.
- [ ] Default currency is `THB`.

### Customer legal name

- [ ] Juristic type dropdown includes ร้านค้า, คณะบุคคล, ห้างหุ้นส่วนสามัญ.
- [ ] Dropdown and selected trigger show Thai labels, not enum symbols.
- [ ] Customer name field asks for base name only.
- [ ] Non-individual legal types auto-format display name in documents.
- [ ] Individual shows title selector.
- [ ] Individual `OTHER` title requires custom text.
- [ ] Documents use formatted customer display name.

### Regression

- [ ] Existing records still load.
- [ ] Existing PDFs still render.
- [ ] No secrets logged or committed.
- [ ] Migration reviewed before production.

---

## Risks and Mitigations

### Risk 1: Legal/tax meaning of Tax Invoice

Tik requested user-selectable tax regardless of registered status. This conflicts with stricter previous guard in code comments. Mitigation: confirm whether app should fully trust selected tax type or still warn/block based on tenant VAT settings.

### Risk 2: Existing customer names may already include prefixes/suffixes

If formatter blindly adds prefixes, old customers may become `บริษัท บริษัท ABC จำกัด จำกัด`. Mitigation: initially apply formatter only when customer record is edited under the new UI or add safe strip helper with tests. For PDF, detect existing legal affixes and avoid duplicate where possible.

### Risk 3: Multi-currency without FX accounting

Users may expect conversion. Mitigation: MVP copy explicitly says no conversion; selected currency is display/document currency only.

### Risk 4: VAT inclusive calculation and baht text in PDFs

Current PDF likely uses Thai baht amount words. For non-THB currencies, baht words are wrong. Mitigation: for non-THB, hide baht words or display numeric-only until currency words are implemented.

### Risk 5: Migration affects billing/tax production flows

Mitigation: local migration + tests + build before production, explicit approval for production migration/deploy.

---

## Resolved Decisions from Tik

Answered: 2026-05-13

1. VAT ของ `รวม/แยก VAT`: ใช้ fixed 7% (`fix 7`) สำหรับ MVP.
2. Currency MVP: `THB/USD/JPY/CNY/EUR` โอเค.
3. `NO_VAT` PDF wording: ใช้ชื่อปกติของเอกสาร/บิลนั้น ๆ โดยไม่มีคำว่า `ใบกำกับภาษี`.
4. Tax Invoice / VAT behavior: เชื่อ `taxType` ที่ผู้ใช้เลือกเป็น source of truth; ไม่ผูก logic กับ tenant/customer VAT registration สำหรับการเลือก VAT ของเอกสาร.
5. Legacy/customer name behavior: ให้เลือก/เปลี่ยนตาม field ใหม่เป็น source of truth; formatter/dedup ควรอิง field ที่เลือกและไม่บังคับ clean-up ย้อนหลังแบบ destructive.

---

## Suggested Execution Order

Recommended sequence after approval:

1. Phase 1 helpers/tests.
2. Phase 2 schema/migration local only.
3. Phase 3 API contracts and propagation.
4. Phase 4 customer legal name UX/API.
5. Phase 5 quotation UI.
6. Phase 6 downstream UI/PDF.
7. Phase 7 numbering cleanup.
8. Phase 8 polish.
9. Phase 9 full regression.
10. Phase 10 docs/deploy handoff.

Do not start production migration/deploy until all local verification passes and Tik explicitly approves.

---

## Execution Log

### 2026-05-13 — Sprint 1 domain helpers/tests

Status: done

Changed files:
- `src/lib/tax-type.ts`
- `src/lib/currency.ts`
- `src/lib/customer-name.ts`
- `tests/lib/tax-type.test.ts`
- `tests/lib/currency.test.ts`
- `tests/lib/customer-name.test.ts`

Verification:
- RED: `npm test -- tax-type currency customer-name` failed because helpers did not exist.
- GREEN targeted: `npm test -- tax-type currency customer-name` passed 31 tests.
- Full unit suite: `npm test` passed 78 tests across 7 files.
- TypeScript: `npx tsc --noEmit` passed.

Notes:
- Used document tax type as the new source of truth for helper mapping only; did not touch Prisma schema/API/UI/PDF in this sprint.
- Currency helper stores/displays allowed document currencies only; no FX conversion is implemented.
- Customer name helper formats Thai legal display names from base names and title/type inputs.

### 2026-05-13 — Sprint 2 schema/migration/validators

Status: done

Changed files:
- `prisma/schema.prisma`
- `prisma/migrations/20260513113300_tax_type_currency_customer_legal_name/migration.sql`
- `src/lib/validators/document-fields.ts`
- `src/lib/validators/quotation.ts`
- `src/lib/validators/sales-order.ts`
- `src/lib/validators/invoice.ts`
- `src/lib/validators/receipt.ts`
- `src/lib/validators/customer.ts`
- `tests/lib/validators.test.ts`

Verification:
- RED: `npm test -- validators` failed 7 tests before validator implementation because tax/currency/customer title fields were missing.
- Prisma validate: `node node_modules/prisma/build/index.js validate` passed. `npx prisma validate` could not run because local `node_modules/.bin/prisma` lacks execute permission in this checkout.
- Targeted: `npm test -- validators tax-type currency customer-name` passed 38 tests across 4 files.
- Full unit suite: `npm test` passed 85 tests across 8 files.
- TypeScript: `npx tsc --noEmit` passed.
- Scoped whitespace: `git diff --check -- prisma/schema.prisma src/lib/validators/document-fields.ts src/lib/validators/quotation.ts src/lib/validators/customer.ts src/lib/validators/sales-order.ts src/lib/validators/invoice.ts src/lib/validators/receipt.ts tests/lib/validators.test.ts prisma/migrations/20260513113300_tax_type_currency_customer_legal_name/migration.sql` passed.

Notes:
- Migration is local file only; did not run production migration/deploy.
- `migrate dev --create-only` was attempted via the Prisma CLI entrypoint but local PostgreSQL at `localhost:5433` was unavailable, so the migration SQL was created manually following existing migration style.
- Existing customer names are preserved; migration only adds nullable title fields.
- Existing document rows default `currencyCode` to `THB`; `taxType` is backfilled from legacy `vatRate`/`vatModePolicy` where available, and Receipt/TaxInvoice inherit from linked Invoice where feasible.

### 2026-05-13 — Sprint 4 customer legal-name UX/API integration

Status: done

Changed files:
- `src/components/forms/business-info-section.tsx`
- `src/app/[locale]/(main)/sales/customers/customer-form.tsx`
- `src/app/[locale]/(main)/sales/customers/[id]/page.tsx`
- `src/app/(landing)/signup/page.tsx`
- `src/app/api/sales/customers/route.ts`
- `src/app/api/sales/customers/[id]/route.ts`
- `src/lib/validators/customer.ts`
- `tests/lib/validators.test.ts`

Verification:
- RED: `npm test -- validators` failed on the new regression that non-individual customers must clear `individualTitle/individualTitleOther`.
- Targeted: `npm test -- validators customer-name` passed 26 tests across 2 files.
- Full unit suite: `npm test` passed 99 tests across 9 files.
- TypeScript: `npx tsc --noEmit` passed.
- Static UI contract: Node script over `business-info-section.tsx`/`customer-form.tsx` passed, confirming Thai option helpers, individual-only title UI, title clearing, base-name copy, and no direct enum-label `SelectItem` leaks for the new juristic types.
- Scoped lint: `node node_modules/eslint/bin/eslint.js src/components/forms/business-info-section.tsx 'src/app/[locale]/(main)/sales/customers/customer-form.tsx' 'src/app/[locale]/(main)/sales/customers/[id]/page.tsx' src/app/api/sales/customers/route.ts 'src/app/api/sales/customers/[id]/route.ts' 'src/app/(landing)/signup/page.tsx'` passed. Whole `npm run lint` could not run through the package script because `node_modules/.bin/eslint` is not executable in this checkout; running eslint via `node node_modules/eslint/bin/eslint.js` works and shows unrelated pre-existing errors outside this sprint.

Notes:
- Juristic type options now come from the shared customer-name helper, so `SHOP`, `PERSON_GROUP`, and `ORDINARY_PARTNERSHIP` render with Thai labels and no enum-symbol dropdown text.
- Individual title selector appears only for `INDIVIDUAL`; switching to another type clears title fields in UI and API persistence.
- Customer name copy now asks for the base name only; create/edit payloads keep `Customer.name` unchanged and store/clear title fields separately.
- Did not start a dev server and did not run production migration/deploy/push.

---

## Kanban Execution Graph

Created: 2026-05-13 11:18 +07
Board: `workinflow-mom`
Mode: hybrid Kanban — board is the audit trail; each sprint is assigned to a profile. Shared repo workspace is serialized through dependencies to avoid overlapping edits in `/Users/tik/Projects/WorkinFlow/MOM (Manufacturing Operations Management)`.

### Safety Policy for All Cards

- No push to GitHub without Tik approval.
- No production deploy, Coolify change, DNS change, Gateway restart, or production `prisma migrate deploy` without Tik approval.
- Local code changes and local migration files are allowed under sprint scope.
- Preserve existing dirty `tsconfig.tsbuildinfo` unless a sprint explicitly proves it must change.
- Every worker must report changed files and verification commands/results.

### Task Graph

| Label | Task ID | Profile | Sprint / Scope | Parents |
|---|---|---|---|---|
| T0 | `t_22205ddc` | `orchestrator` | Monitor board, route follow-ups, do not implement | — |
| T1 | `t_817eb977` | `backend-eng` | Domain helpers/tests: tax type, currency, customer display name | — |
| T2 | `t_dcb929d7` | `backend-eng` | Prisma schema/migration + Zod validators | T1 |
| T3 | `t_cc3b62df` | `backend-eng` | Quotation/SO/Invoice API propagation + numbering prefixes | T2 |
| T4 | `t_1e35904d` | `frontend-eng` | Customer legal-name UX + form/API integration | T3 |
| T5 | `t_07342d83` | `frontend-eng` | Quotation tax type + currency UI/display/PDF surface | T4 |
| T6 | `t_93648a37` | `backend-eng` | Downstream finance docs/PDF/tax invoice hardening | T5 |
| T7 | `t_635055c5` | `reviewer` | Spec/code/accounting review gate | T6 |
| T8 | `t_82cdeda3` | `qa` | Regression + quotation/customer/PDF smoke | T7 |
| T9 | `t_ff55b989` | `writer` | Docs + final handoff update | T8 |
| T10 | `t_92b2d1fe` | `ops` | Local release checklist only; no deploy/no prod migrate | T9 |

### 2026-05-13 — Sprint 5 quotation tax type + currency UI/display

Status: done

Changed files:
- `src/app/[locale]/(main)/sales/quotations/quotation-form.tsx`
- `src/app/[locale]/(main)/sales/quotations/quotation-list-client.tsx`
- `src/app/[locale]/(main)/sales/quotations/[id]/quotation-detail-client.tsx`
- `src/app/[locale]/(main)/sales/quotations/[id]/edit/page.tsx`
- `tests/ui/quotation-tax-currency-ui.test.ts`

Verification:
- RED: `npm test -- tests/ui/quotation-tax-currency-ui.test.ts` failed 4 tests before UI implementation because quotation form/list/detail/edit did not expose tax type/currency contracts.
- GREEN targeted: `npm test -- tests/ui/quotation-tax-currency-ui.test.ts` passed 4 tests.
- Related targeted: `npm test -- tests/lib/tax-type.test.ts tests/lib/currency.test.ts tests/lib/document-tax-propagation.test.ts tests/lib/validators.test.ts tests/ui/quotation-tax-currency-ui.test.ts` passed 38 tests across 5 files.
- Full unit suite: `npm test` passed 103 tests across 10 files.
- TypeScript: `npx tsc --noEmit` passed.
- Scoped lint: `node node_modules/eslint/bin/eslint.js 'src/app/[locale]/(main)/sales/quotations/quotation-form.tsx' 'src/app/[locale]/(main)/sales/quotations/quotation-list-client.tsx' 'src/app/[locale]/(main)/sales/quotations/[id]/quotation-detail-client.tsx' 'src/app/[locale]/(main)/sales/quotations/[id]/edit/page.tsx' 'src/lib/validators/quotation.ts' tests/ui/quotation-tax-currency-ui.test.ts` passed.

Notes:
- Quotation form now selects document `taxType` (`รวม VAT` / `แยก VAT` / `ไม่มี VAT`) and `currencyCode`; VAT is recalculated from selected tax type, not customer VAT registration.
- Form/list/detail amounts now use `formatMoney(..., currencyCode)` and show tax/currency badges; edit page preserves stored tax/currency defaults.
- No dedicated quotation PDF route/template exists in this repo (`quotation pdf` search returned 0); downstream invoice/tax-invoice/receipt PDF work remains in T6.
- Did not start a dev server, push, deploy, or run production migration.

### 2026-05-13 — Sprint 6 downstream finance docs/PDF/tax invoice hardening

Status: done

Changed files:
- `src/app/api/finance/tax-invoices/route.ts`
- `src/app/api/finance/tax-invoices/[id]/pdf/route.ts`
- `src/app/api/finance/receipts/route.ts`
- `src/app/api/finance/credit-notes/route.ts`
- `src/lib/doc-numbering.ts`
- `src/lib/pdf/format.ts`
- `src/lib/pdf/mappers.ts`
- `src/lib/pdf/types.ts`
- `src/lib/pdf/components/LineItemsTable.tsx`
- `src/lib/pdf/components/TotalsBox.tsx`
- `src/lib/pdf/templates/invoice-goods.tsx`
- `src/lib/pdf/templates/invoice-service.tsx`
- `src/lib/pdf/templates/invoice-mixed.tsx`
- `src/lib/pdf/templates/tax-invoice.tsx`
- `src/lib/pdf/templates/receipt.tsx`
- `scripts/smoke-pdf.ts`
- `tests/lib/pdf-tax-currency.test.ts`

Verification:
- RED: `npm test -- tests/lib/pdf-tax-currency.test.ts` failed 2 tests before final fixes because receipt PDF did not pass currency to money renderers and tax-invoice PDF route still blocked on tenant VAT registration.
- Targeted: `npm test -- tests/lib/pdf-tax-currency.test.ts tests/lib/document-tax-propagation.test.ts tests/lib/validators.test.ts` passed 26 tests across 3 files.
- PDF smoke: `node node_modules/tsx/dist/cli.mjs scripts/smoke-pdf.ts` rendered invoice goods/service/mixed, receipt, tax invoice, and subscription invoice successfully; `npx tsx ...` could not run because `node_modules/.bin/tsx` lacks execute permission in this checkout.
- TypeScript: `npx tsc --noEmit` passed.
- Full unit suite: `npm test` passed 108 tests across 11 files.
- Scoped lint: `node node_modules/eslint/bin/eslint.js ...` over touched finance/PDF/script/test files passed.

Notes:
- Tax Invoice creation now rejects `NO_VAT`/zero-VAT source invoices and snapshots `taxType`/`currencyCode`; the PDF route trusts document tax type instead of tenant/customer VAT registration and keeps a defensive NO_VAT guard for legacy rows.
- Receipt and Credit Note creation inherit source invoice `taxType`/`currencyCode`; receipt/tax invoice/invoice PDFs pass currency into line items, totals, WHT display, and amount text. Non-THB PDFs use numeric money text instead of Thai baht words.
- Invoice PDF mappers use formatted customer legal display name and derive VAT wording from document `taxType`; legacy `tenantIsVatRegistered` PDF flag is retained only as a template compatibility name.
- Did not start a dev server, push, deploy, run production migration, restart Gateway, touch secrets, or edit `tsconfig.tsbuildinfo` intentionally.

### 2026-05-13 — Sprint 7–10 review, QA, docs, and local release checklist

Status: done

Completed tasks:
- Sprint 7 reviewer gate and fixes: legal customer snapshots, duplicate Tax Invoice guard, Sales Order PATCH taxType preservation, invoice-from-SO UI inheritance, and direct Sales Order tax/currency UI source-of-truth.
- Sprint 8 QA: command-level regression passed; browser E2E deferred because local PostgreSQL `localhost:5433` was not listening in this environment.
- Sprint 9 docs/handoff: `docs/SALES-DOCUMENT-TAX-CURRENCY.md` added with rollout checklist and source-of-truth rules.
- Sprint 10 ops: local release checklist only; no deploy, push, production migration, Coolify/DNS change, or Gateway restart.

Verification recorded from worker gates:
- `npm test` passed 120 tests across 14 files.
- `npx tsc --noEmit` passed.
- `node node_modules/prisma/build/index.js validate` passed.
- `node node_modules/next/dist/bin/next build` passed; package script `npm run build` hits local `.bin/next` execute-permission issue in this checkout.
- Scoped eslint on sprint-touched files passed; whole-repo lint still has unrelated pre-existing files outside this feature scope.
- Local `prisma migrate status` could not run because local DB `localhost:5433` was unavailable.

### 2026-05-13 — Direct continuation without Kanban

Status: done locally, commit-ready after final verification

Reason:
- Tik asked to continue the remaining work without Kanban after the duplicate auxiliary P0-P8 graph made the board look stuck.
- The duplicate graph was archived; no active/ready/running/blocked Kanban tasks remain on `workinflow-mom`.

Direct follow-up performed:
- Re-ran local verification outside Kanban.
- Clarified PDF template comments and `docs/SALES-DOCUMENT-TAX-CURRENCY.md` so future reviewers understand that the legacy `tenantIsVatRegistered` PDF flag is derived from document `taxType`, not tenant settings.
- Independent review flagged removal of the old tenant-VAT Tax Invoice gate as a legal/accounting concern. This is recorded as an accepted product decision for this MVP because Tik explicitly approved `taxType` as source of truth; production rollout still requires backup/migration/deploy approval.

Latest direct verification:
- `node node_modules/prisma/build/index.js validate`: PASS.
- `npm test`: PASS, 120 tests / 14 files.
- `npx tsc --noEmit`: PASS.
- `node node_modules/tsx/dist/cli.mjs scripts/smoke-pdf.ts`: PASS.
- `node node_modules/next/dist/bin/next build`: PASS; build logs a local `ECONNREFUSED` for `/api/public/plans` during static generation when DB is unavailable, but exits 0.
- Scoped eslint and diff hygiene checks: PASS.

### Current Direct Next Action

- Local commit may be created from sprint-relevant files only, excluding dirty `tsconfig.tsbuildinfo`.
- Do not push to GitHub, deploy, run production migration, change Coolify/DNS, or restart Gateway without explicit approval.
- Before production deploy: verify backup, run `npx prisma migrate status` in the production/Coolify app container, then deploy/migrate only after approval.
