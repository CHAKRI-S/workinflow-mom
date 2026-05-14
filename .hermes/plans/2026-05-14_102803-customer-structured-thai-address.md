# Customer Structured Thai Address Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** เพิ่ม field แยกสำหรับ ตำบล/แขวง, อำเภอ/เขต, จังหวัด, และรหัสไปรษณีย์ ในฟอร์มเพิ่ม/แก้ไขลูกค้า เพื่อเก็บข้อมูลโครงสร้างที่ใช้งานต่อได้ในอนาคต โดยยังคง `billingAddress` เดิมไว้สำหรับเอกสาร/PDF และ backward compatibility

## Implementation Status — 2026-05-14

- Implemented nullable Customer columns + migration: `20260514104500_customer_structured_billing_address`.
- Added Zod validation for optional Thai structured billing address fields; if a Thai customer fills any structured field, the core set must be complete and postal code must be 5 digits.
- Added server-side Thai address master data helper and authenticated endpoint: `GET /api/locations/thai-addresses`.
- Enhanced RD tax-ID lookup to return `subdistrict` and `district` in addition to existing address/province/post code fields.
- Wired customer new/edit form to save/reload the structured fields and render responsive autocomplete-style inputs below the billing address textarea.
- Verification completed locally: targeted Vitest, full Vitest suite, Prisma validate, targeted ESLint, TypeScript, and Next build.
- Production deploy completed after approval on 2026-05-14 04:03 UTC: commit `790581f3` reached Coolify, migration `20260514104500_customer_structured_billing_address` applied, container image tag matched the commit, and public smoke checks passed. Future production migrations/deploys remain approval-gated.

**Architecture:** เก็บ structured address เป็น optional columns บน `Customer` คู่กับ `billingAddress` เดิม แล้วปรับ `BusinessInfoSection`/`CustomerForm` ให้เลือกที่อยู่ไทยแบบ cascading select/autocomplete และ sync กลับไปสร้างที่อยู่เต็มได้. สำหรับข้อมูลตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์ แนะนำเพิ่ม endpoint read-only ภายใน app เพื่อค้นหา/กรองข้อมูล master data แทนโหลด dataset ทั้งประเทศลง client หนัก ๆ.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Prisma 7, PostgreSQL, Base UI Select/shadcn UI, Vitest

---

## Current Context / Findings

- Project: WorkinFlow MOM
- Workdir: `/Users/tik/Projects/WorkinFlow/MOM (Manufacturing Operations Management)`
- Repo: `CHAKRI-S/workinflow-mom`
- Target branch: `main`
- Relevant route: `https://mom.workinflow.cloud/th/sales/customers/new`
- Current customer form:
  - `src/app/[locale]/(main)/sales/customers/customer-form.tsx`
  - Uses `BusinessInfoSection` for legal/tax fields.
  - Maps business info `address` to `billingAddress` only.
- Current business info section:
  - `src/components/forms/business-info-section.tsx`
  - Has one free-text textarea `address` for billing address.
  - RD lookup currently fills `data.address`, `data.province`, `data.postCode` only partially; it does not expose/store tambon/amphoe separately yet.
- Current DB model:
  - `prisma/schema.prisma` model `Customer` has:
    - `billingAddress String?`
    - `shippingAddress String?`
    - `country String @default("TH")`
  - No structured Thai address columns yet.
- Current API:
  - `POST /api/sales/customers` in `src/app/api/sales/customers/route.ts`
  - `PATCH /api/sales/customers/[id]` in `src/app/api/sales/customers/[id]/route.ts`
  - Both parse via `src/lib/validators/customer.ts`
- Current RD lookup:
  - `src/lib/rd-vat-lookup.ts`
  - XML contains tags `vThambol`, `vAmphur`, `vProvince`, `vPostCode` and currently result returns only `province` + `postCode`, while `address` embeds all parts as text.

## Key Decision: Do We Need a New Endpoint?

### Short answer

**Yes, recommended:** add one read-only location lookup endpoint for Thai address master data.

### Why

- If we hardcode all Thai subdistrict data in the client bundle, the customer form gets heavier and harder to maintain.
- Cascading selection needs lookup by province/district/subdistrict/postcode.
- Future uses (shipping reports, zone grouping, delivery routes, province dashboards) benefit from a single source.
- Endpoint can be reused later by tenant settings, supplier forms, shipping address, invoices, etc.

### Endpoint shape recommendation

Start simple with one endpoint:

```http
GET /api/locations/thai-addresses?q=&province=&district=&subdistrict=&postalCode=&limit=50
```

Response:

```ts
type ThaiAddressOption = {
  subdistrict: string; // ตำบล/แขวง
  district: string;    // อำเภอ/เขต
  province: string;    // จังหวัด
  postalCode: string;  // 5 digits
};
```

For simple dropdown lists, optionally support:

```http
GET /api/locations/thai-addresses/provinces
GET /api/locations/thai-addresses/districts?province=ชลบุรี
GET /api/locations/thai-addresses/subdistricts?province=ชลบุรี&district=เมืองชลบุรี
```

But MVP can keep a single endpoint and let UI query filtered results.

## Data Model Plan

### Add optional Customer fields

Modify `prisma/schema.prisma` model `Customer`:

```prisma
  billingSubdistrict String? // ตำบล/แขวง สำหรับที่อยู่ออกบิล
  billingDistrict    String? // อำเภอ/เขต สำหรับที่อยู่ออกบิล
  billingProvince    String? // จังหวัด สำหรับที่อยู่ออกบิล
  billingPostalCode  String? // รหัสไปรษณีย์ 5 หลัก สำหรับที่อยู่ออกบิล
```

Recommended placement: directly after `billingAddress String?`.

### Why only billing fields now?

User asked from customer create page and future structured use. The current form’s business/legal section is billing/tax document focused. Shipping address can stay free-text for now to keep scope narrow. Later, repeat the same pattern as `shippingSubdistrict`, etc. if needed.

### Migration impact

This is a Prisma schema change and requires migration:

```bash
npx prisma migrate dev --name customer_structured_billing_address
```

Production migration requires explicit approval before deploy:

```bash
npx prisma migrate deploy
```

Risk level: low-to-medium because fields are nullable and non-destructive, but still a production DB migration.

## Master Data Plan

### Recommended MVP source

Create a small local master-data module from a vetted Thai tambon dataset. Store normalized data as JSON or TS array, for example:

- `src/lib/locations/thai-addresses.ts`
- Optional data file: `src/lib/locations/thai-addresses.json`

Each row:

```ts
export type ThaiAddressRow = {
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
};
```

### Normalization rules

- Store Thai names without prefixes:
  - `บางรัก`, not `แขวงบางรัก`
  - `เมืองชลบุรี`, not `อำเภอเมืองชลบุรี`
  - `ชลบุรี`, not `จังหวัดชลบุรี`
- UI labels can show prefixes if desired.
- `postalCode` must be string because leading zero may exist.
- Deduplicate rows by `province|district|subdistrict|postalCode`.

### Dataset size concern

Thai tambon data is thousands of rows. It is okay server-side, but avoid shipping the full dataset to the form by default. Use endpoint filtering/search.

## API Plan

### Task: Add location endpoint

**Files:**
- Create: `src/app/api/locations/thai-addresses/route.ts`
- Create/Modify: `src/lib/locations/thai-addresses.ts`
- Test: `tests/api/thai-addresses.test.ts` or source-contract test if API harness is limited

**Behavior:**
- Public authenticated? Recommendation: require `auth()` + `ROLES.ALL` because this is internal app form data. If signup/onboarding later needs it, split a public endpoint with stricter rate limit.
- Accept query params: `q`, `province`, `district`, `subdistrict`, `postalCode`, `limit`.
- Default limit `50`, max `100`.
- Match Thai text case-insensitively where possible (Thai unaffected); trim spaces.
- Return sorted stable order: province, district, subdistrict, postalCode.

**Example implementation contract:**

```ts
// GET /api/locations/thai-addresses?q=บ้านบึง&limit=20
return NextResponse.json({
  items: [
    {
      subdistrict: "บ้านบึง",
      district: "บ้านบึง",
      province: "ชลบุรี",
      postalCode: "20170",
    },
  ],
});
```

## Validation Plan

### Extend Zod schema

Modify `src/lib/validators/customer.ts`:

```ts
billingSubdistrict: z.string().optional(),
billingDistrict: z.string().optional(),
billingProvince: z.string().optional(),
billingPostalCode: z
  .union([z.string().regex(/^\d{5}$/, "รหัสไปรษณีย์ต้องมี 5 หลัก"), z.literal("")])
  .optional()
  .transform((v) => (v === "" ? undefined : v)),
```

### Cross-field validation

For `country === "TH"`, if user fills any structured address field, require the core set:

- `billingSubdistrict`
- `billingDistrict`
- `billingProvince`
- `billingPostalCode`

Do **not** make these required for all customers initially, because existing customers may have only `billingAddress` and foreign/non-Thai customers may not fit Thai hierarchy.

## API Create/Patch Plan

### POST /api/sales/customers

Modify `src/app/api/sales/customers/route.ts`:

- Destructure structured fields from parsed data or leave in `rest` if schema includes them.
- Trim empty strings to `null`/`undefined` consistently.
- Ensure `billingPostalCode` is saved as string.

### PATCH /api/sales/customers/[id]

Modify `src/app/api/sales/customers/[id]/route.ts`:

- Allow partial updates.
- If field present as empty string, store `null`.
- Keep tenant isolation unchanged.

## UI Plan

### Extend BusinessInfoValue

Modify `src/components/forms/business-info-section.tsx`:

```ts
export interface BusinessInfoValue {
  // existing
  address: string;
  country: string;
  billingSubdistrict?: string;
  billingDistrict?: string;
  billingProvince?: string;
  billingPostalCode?: string;
}
```

### UI layout recommendation

In `BusinessInfoSection`, under the address textarea, add a section:

- `จังหวัด` select/autocomplete
- `อำเภอ/เขต` select/autocomplete, disabled until province selected
- `ตำบล/แขวง` select/autocomplete, disabled until district selected
- `รหัสไปรษณีย์` input/select, auto-filled from selected subdistrict but editable if multiple postal codes exist

Desktop/tablet responsive default:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* province, district, subdistrict, postalCode */}
</div>
```

### Address sync behavior

Recommended behavior for MVP:

1. Keep `billingAddress` textarea as the human-readable tax address.
2. Structured fields are optional metadata.
3. When RD lookup returns address, fill `billingAddress` as before and also fill province/postcode/tambon/amphoe after parser enhancement.
4. When user picks structured fields manually, show a button: `เติมท้ายที่อยู่จากข้อมูลที่เลือก` or helper text, but do not aggressively overwrite the free-text address on every selection.

Reason: tax addresses often include house number, building, moo, road, etc. Structured fields alone are not a complete legal address.

### Better alternative

Split address into:

- Address line: `เลขที่/อาคาร/หมู่/ถนน/ซอย`
- Tambon/district/province/postcode selects
- Generate `billingAddress` from line + structured fields

This is cleaner long-term but bigger scope and requires more UX care. For MVP, keep textarea + structured fields.

## RD Lookup Enhancement Plan

Modify `src/lib/rd-vat-lookup.ts`:

- Add fields to `RdVatResult`:

```ts
subdistrict: string | null;
district: string | null;
```

- Extract:

```ts
const subdistrict = extractFirst(xml, "vThambol");
const district = extractFirst(xml, "vAmphur");
```

- Return normalized values without prefix.

Modify `src/components/forms/business-info-section.tsx` lookup patch:

```ts
billingSubdistrict: data.subdistrict || value.billingSubdistrict,
billingDistrict: data.district || value.billingDistrict,
billingProvince: data.province || value.billingProvince,
billingPostalCode: data.postCode || value.billingPostalCode,
```

Note: existing RD result already has `province` and `postCode`, so this is a small enhancement.

## CustomerForm Wiring Plan

Modify `src/app/[locale]/(main)/sales/customers/customer-form.tsx`:

- Add structured fields to `businessInfo` from `watch()`.
- Extend `patchBusinessInfo()` to call `setValue()` for new fields.
- Add new fields to cleaned payload in `onSubmit`.

Modify edit page `src/app/[locale]/(main)/sales/customers/[id]/page.tsx`:

- Add default values from DB:
  - `billingSubdistrict`
  - `billingDistrict`
  - `billingProvince`
  - `billingPostalCode`

## Tests / Validation Plan

### Unit/source-contract tests

Add/modify tests:

- `tests/lib/validators.test.ts` or new `tests/lib/customer-address-validator.test.ts`
  - accepts empty structured address fields
  - accepts complete Thai structured fields with 5-digit postal code
  - rejects invalid postal code when present
  - requires complete structured set when any one structured field is provided for TH (if this rule is implemented)

- `tests/lib/rd-vat-lookup.test.ts` if existing harness can mock XML/fetch
  - maps `vThambol`, `vAmphur`, `vProvince`, `vPostCode` into structured fields

- `tests/ui/customer-business-info-address-ui.test.ts`
  - asserts `BusinessInfoValue` includes structured fields
  - asserts Thai labels exist: `ตำบล/แขวง`, `อำเภอ/เขต`, `จังหวัด`, `รหัสไปรษณีย์`
  - asserts customer form wires fields into `setValue`

### API tests

If API route test pattern exists:

- `tests/api/customer-structured-address.test.ts`
  - POST customer with structured fields persists them
  - PATCH customer updates/clears them
  - tenant isolation remains unchanged

If API tests are too heavy, use source-contract tests first and validate manually with local app.

### Verification commands

Before commit:

```bash
npx prisma validate
npm test -- tests/lib/customer-address-validator.test.ts tests/ui/customer-business-info-address-ui.test.ts
node node_modules/eslint/bin/eslint.js \
  src/components/forms/business-info-section.tsx \
  src/app/[locale]/(main)/sales/customers/customer-form.tsx \
  src/app/api/sales/customers/route.ts \
  src/app/api/sales/customers/[id]/route.ts \
  src/app/api/locations/thai-addresses/route.ts
node node_modules/typescript/bin/tsc --noEmit --pretty false
npm run build
```

Note: current repo had `node_modules/.bin/eslint` permission issue; use `node node_modules/eslint/bin/eslint.js ...` if `npm run lint -- ...` fails with permission denied.

## Step-by-Step Implementation Tasks

### Task 1: Add schema fields + migration

**Objective:** Add nullable structured billing address columns on Customer.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_customer_structured_billing_address/migration.sql`

**Steps:**
1. Add four nullable fields after `billingAddress`.
2. Run `npx prisma migrate dev --name customer_structured_billing_address` locally.
3. Run `npx prisma validate`.
4. Inspect generated SQL and confirm only nullable columns are added.

### Task 2: Add validation fields

**Objective:** Allow create/update payloads to accept structured address fields safely.

**Files:**
- Modify: `src/lib/validators/customer.ts`
- Test: `tests/lib/customer-address-validator.test.ts`

**Steps:**
1. Write failing validator tests.
2. Add fields and postal code validation.
3. Add cross-field complete-set rule if desired.
4. Run targeted tests.

### Task 3: Add Thai address master data helper

**Objective:** Centralize Thai address rows and filtering logic.

**Files:**
- Create: `src/lib/locations/thai-addresses.ts`
- Optional create: `src/lib/locations/thai-addresses.json`
- Test: `tests/lib/thai-addresses.test.ts`

**Steps:**
1. Add type + sample/full dataset.
2. Add `searchThaiAddresses(params)` helper.
3. Test filtering by province/district/subdistrict/postalCode/q/limit.

### Task 4: Add location endpoint

**Objective:** Serve filtered address options without bloating client bundle.

**Files:**
- Create: `src/app/api/locations/thai-addresses/route.ts`
- Test: `tests/api/thai-addresses.test.ts` or source-contract test

**Steps:**
1. Validate query params.
2. Require auth/permission unless public use is needed.
3. Return `{ items }`.
4. Test limit and filtering.

### Task 5: Enhance RD lookup structured output

**Objective:** Reuse RD lookup response to auto-fill structured fields.

**Files:**
- Modify: `src/lib/rd-vat-lookup.ts`
- Modify: `src/app/api/lookup/tax-id/route.ts` only if response typing/contract is documented there
- Test: RD lookup unit/source contract

**Steps:**
1. Add `subdistrict` and `district` to `RdVatResult`.
2. Extract `vThambol` and `vAmphur`.
3. Return normalized fields.
4. Ensure existing `address` remains unchanged.

### Task 6: Wire form state and UI

**Objective:** Let users select/enter structured billing address on customer new/edit form.

**Files:**
- Modify: `src/components/forms/business-info-section.tsx`
- Modify: `src/app/[locale]/(main)/sales/customers/customer-form.tsx`
- Test: `tests/ui/customer-business-info-address-ui.test.ts`

**Steps:**
1. Extend `BusinessInfoValue`.
2. Add structured fields below address textarea.
3. Add fetch/search hook for `/api/locations/thai-addresses`.
4. Use selected values to narrow next dropdown.
5. Auto-fill postal code when subdistrict selection has a unique postal code.
6. Add helper text that `billingAddress` remains the legal full address.

### Task 7: Persist create/update + edit defaults

**Objective:** Save and reload structured fields.

**Files:**
- Modify: `src/app/api/sales/customers/route.ts`
- Modify: `src/app/api/sales/customers/[id]/route.ts`
- Modify: `src/app/[locale]/(main)/sales/customers/[id]/page.tsx`
- Test: `tests/api/customer-structured-address.test.ts` or source contract

**Steps:**
1. Include fields in cleaned POST payload.
2. Include fields in PATCH payload and support clearing to null.
3. Load defaults in edit page.
4. Verify create → edit shows selected values.

### Task 8: Manual QA on customer form

**Objective:** Confirm real route behavior.

**Steps:**
1. Start/reuse local dev server.
2. Open `/th/sales/customers/new`.
3. Create customer with:
   - country `ไทย (TH)`
   - province/district/subdistrict/postal code
   - billing address free text
4. Confirm save succeeds.
5. Open edit page and confirm values persist.
6. Test RD lookup fills old address plus structured fields where available.
7. Test non-TH customer does not force Thai hierarchy.

## Open Questions

1. ต้องการให้ช่อง structured address เป็น mandatory สำหรับลูกค้าไทยใหม่เลยไหม หรือ optional ก่อนเพื่อไม่กระทบ workflow เดิม?
   - Recommendation: optional first, but if user fills one of the four, validate complete set.
2. ต้องการแยก shipping address ด้วยพร้อมกันไหม?
   - Recommendation: ยังไม่ทำในรอบแรก; ทำ billing/tax address ก่อน.
3. ต้องการให้ระบบ auto-generate `billingAddress` จาก house/address line + structured fields ไหม?
   - Recommendation: รอบแรกไม่ overwrite อัตโนมัติ; ให้ผู้ใช้คุมที่อยู่เต็มเอง.
4. Dataset Thai address จะเอาจาก source ไหนและต้องการเก็บไว้ใน repo ได้ไหม?
   - Recommendation: ใช้ public/open dataset ที่ vetted แล้วแปลงเป็น normalized JSON/TS, commit เฉพาะ data ที่จำเป็น.

## Risks / Tradeoffs

- **Migration risk:** ต้องเพิ่ม nullable columns และ deploy migration บน production; ต้องขออนุมัติก่อน deploy/migrate.
- **Address correctness:** ตำบล/อำเภอ/จังหวัดของไทยมีชื่อซ้ำ ต้องใช้ tuple ทั้งชุด + postal code ไม่ใช่เก็บชื่อเดียวลอย ๆ.
- **Dataset maintenance:** ข้อมูลเขต/รหัสไปรษณีย์อาจเปลี่ยนในอนาคต ควรมี source note และ script/update procedure.
- **PDF/legal docs:** ยังใช้ `billingAddress` เดิม จึงไม่กระทบเอกสารภาษีทันที. ห้ามเปลี่ยน PDF ให้ประกอบ address ใหม่จนกว่าจะ QA ดีแล้ว.
- **Client performance:** อย่าโหลด dataset ทั้งประเทศเข้าหน้า form ถ้าไม่จำเป็น.

## Recommended First Commit Scope

หนึ่ง commit สำหรับ feature นี้:

```bash
git add \
  prisma/schema.prisma \
  prisma/migrations/*_customer_structured_billing_address/migration.sql \
  src/lib/validators/customer.ts \
  src/lib/locations/thai-addresses.ts \
  src/app/api/locations/thai-addresses/route.ts \
  src/lib/rd-vat-lookup.ts \
  src/components/forms/business-info-section.tsx \
  src/app/[locale]/(main)/sales/customers/customer-form.tsx \
  src/app/[locale]/(main)/sales/customers/[id]/page.tsx \
  tests/lib/customer-address-validator.test.ts \
  tests/lib/thai-addresses.test.ts \
  tests/ui/customer-business-info-address-ui.test.ts

git commit -m "feat: add structured billing address fields for customers"
```

Do not push/deploy until migration and verification are reviewed.

## Deployment Notes

- This requires DB migration.
- Before production deploy:
  1. `npx prisma validate`
  2. targeted tests
  3. `node node_modules/typescript/bin/tsc --noEmit --pretty false`
  4. `npm run build`
  5. explicit approval from Tik for production migration/deploy
- After deploy:
  1. verify customer create/edit form
  2. create a test customer or use staging tenant
  3. confirm old customers still load with empty structured fields
  4. confirm PDF/invoice address output is unchanged
