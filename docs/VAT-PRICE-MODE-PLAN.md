# VAT Price Mode Plan

Status on 2026-04-30: implementation is in progress/completed in code for the
MVP surfaces below. Production still needs the new Prisma migration deployed.

Implemented in this pass:

- Prisma schema and migration for product default, document policy, line mode,
  and entered unit price snapshots.
- Central VAT helper at `src/lib/vat.ts` with unit tests.
- Product form default VAT mode.
- Quotation and Sales Order create/edit forms: document policy selector,
  line-level VAT mode selector, product default inheritance, and summary counts.
- Invoice creation from SO: inherited VAT policy/line mode with bill-level
  override and recalculated totals.
- Quotation -> Sales Order conversion carries VAT policy and line mode forward.
- Invoice/Credit Note APIs calculate inclusive/exclusive VAT through the shared
  helper.
- Invoice and tax-invoice PDFs show line VAT mode as a small note.

Goal: let products and document lines carry their own VAT price mode, then let
users review and optionally override the summary while creating each commercial
document.

## Core Requirement

Products may already be configured as VAT outside or VAT included. When a user
adds products to a quotation, sales order, invoice, or credit note, the line
should inherit the product's default VAT mode. At bill/document creation time,
the user must see a summary and be able to choose how the bill should handle
VAT modes.

Users must be able to choose:

- `EXCLUSIVE` - VAT outside price, current behavior.
  - Example: price 1,000, VAT 70, total 1,070.
- `INCLUSIVE` - VAT included in price.
  - Example: entered price 1,070, taxable base 1,000, VAT 70, total 1,070.
- `PER_LINE` / `ตามสินค้า` - each line uses its own mode inherited from the
  selected product or manually edited on that line.

This choice must not depend only on product/customer defaults. A user creating a
quotation, sales order, invoice, or credit note must be able to review the
product-derived line modes and either keep them or force the entire document to
"VAT นอก" or "VAT ใน".

## UX Decision

Add a document-level VAT mode policy selector near the customer/VAT summary
area:

- Label: `รูปแบบราคา VAT`
- Options:
  - `ตามสินค้า / รายบรรทัด` (`PER_LINE`)
  - `บังคับ VAT นอกทั้งบิล` (`FORCE_EXCLUSIVE`)
  - `บังคับ VAT ในทั้งบิล` (`FORCE_INCLUSIVE`)

Add a compact line-level indicator/editor:

- Each line shows `VAT นอก` or `VAT ใน`.
- Default is copied from the selected product.
- User can change an individual line while document policy is `PER_LINE`.
- If policy is `FORCE_EXCLUSIVE` or `FORCE_INCLUSIVE`, line controls are locked
  or visually marked as overridden by document policy.

Add a summary box before save:

- Count/total of lines using VAT outside.
- Count/total of lines using VAT included.
- Net subtotal, VAT amount, and grand total after applying the selected policy.

Defaulting behavior:

1. New document starts with `PER_LINE`.
2. Each line inherits `Product.defaultVatPriceMode`, defaulting to `EXCLUSIVE`
   for products that do not have the new field yet.
3. Tenant-level default can choose the starting document policy later, but the
   safest MVP is `PER_LINE`.
4. Quotation -> Sales Order -> Invoice should carry both the document policy and
   the resolved line VAT modes forward, but the user can still change them while
   the target document is draft.

## Data Model

Add enum:

```prisma
enum VatPriceMode {
  EXCLUSIVE
  INCLUSIVE
}

enum VatModePolicy {
  PER_LINE
  FORCE_EXCLUSIVE
  FORCE_INCLUSIVE
}
```

Add product default:

- `Product.defaultVatPriceMode`

Add document-level policy snapshots:

- `Quotation.vatModePolicy`
- `SalesOrder.vatModePolicy`
- `Invoice.vatModePolicy`
- `CreditNote.vatModePolicy`

Add line-level mode snapshots:

- `QuotationLine.vatPriceMode`
- `SalesOrderLine.vatPriceMode`
- `InvoiceLine.vatPriceMode`
- `CreditNoteLine.vatPriceMode`

Recommended line-level fields for audit clarity:

- `enteredUnitPrice` - the exact unit price the user typed.
- `unitPrice` - normalized net price before VAT, used by accounting/reporting.
- `lineTotal` - normalized net line amount before document-level VAT.

Existing rows should default to:

- document policy: `FORCE_EXCLUSIVE` or `PER_LINE` with all existing lines set
  to `EXCLUSIVE`.
- line mode: `EXCLUSIVE`.

This preserves historical totals.

## Calculation Rules

Create a single helper, for example `src/lib/vat.ts`, and use it everywhere.
The helper should resolve effective line mode first:

- if document policy is `FORCE_EXCLUSIVE`, every line is `EXCLUSIVE`.
- if document policy is `FORCE_INCLUSIVE`, every line is `INCLUSIVE`.
- if document policy is `PER_LINE`, use each line's `vatPriceMode`.

For VAT documents:

- `EXCLUSIVE`
  - `net = enteredAmount`
  - `vat = net * vatRate`
  - `gross = net + vat`
- `INCLUSIVE`
  - `gross = enteredAmount`
  - `net = gross / (1 + vatRate)`
  - `vat = gross - net`

For non-VAT documents:

- `vatRate = 0`
- `net = enteredAmount`
- `vat = 0`
- `gross = enteredAmount`
- Keep `vatPriceMode` as a visible snapshot, but it has no monetary effect.

Rounding must be centralized and tested.

The helper should return both line-level breakdown and document totals:

- entered line amount
- effective VAT mode
- net line amount
- VAT line amount
- gross line amount
- summary by VAT mode
- document subtotal, VAT, total

## Files To Change

Schema and migration:

- `prisma/schema.prisma`
- new Prisma migration
- generated Prisma client files through the existing generation flow

Validators:

- `src/lib/validators/quotation.ts`
- `src/lib/validators/sales-order.ts`
- `src/lib/validators/invoice.ts`
- credit-note validation if/when extracted

Calculation/API:

- `src/app/api/sales/quotations/route.ts`
- `src/app/api/sales/quotations/[id]/route.ts`
- `src/app/api/sales/orders/route.ts`
- `src/app/api/sales/orders/[id]/route.ts`
- `src/app/api/finance/invoices/route.ts`
- `src/app/api/finance/invoices/[id]/route.ts`
- `src/app/api/finance/credit-notes/route.ts`

UI:

- `src/app/[locale]/(main)/sales/quotations/quotation-form.tsx`
- `src/app/[locale]/(main)/sales/orders/order-form.tsx`
- `src/app/[locale]/(main)/finance/invoices/new/invoice-form-client.tsx`
- invoice edit/detail draft controls if edits are supported
- credit note form/detail controls
- product form if adding product-level default
- admin settings if adding tenant-level default

PDF:

- `src/lib/pdf/mappers.ts`
- `src/lib/pdf/types.ts`
- `src/lib/pdf/components/LineItemsTable.tsx`
- `src/lib/pdf/components/TotalsBox.tsx`
- invoice, tax invoice, and credit-note templates

Tests:

- add VAT helper unit tests
- update invoice/doc-numbering related tests only if affected
- add regression cases:
  - VAT outside: 1,000 -> VAT 70 -> total 1,070
  - VAT inside: 1,070 -> base 1,000 -> VAT 70 -> total 1,070
  - mixed/per-line: one `EXCLUSIVE` line and one `INCLUSIVE` line summarize
    correctly
  - force policy overrides product/line defaults
  - non-VAT customer: selected mode has no monetary VAT effect
  - quotation mode inherited into SO and invoice

## Rollout Plan

1. Add schema fields and default old records to `EXCLUSIVE`.
2. Add `src/lib/vat.ts` with tests.
3. Add product-level default VAT mode.
4. Wire line-level mode inheritance and document policy selector into Quotation.
5. Propagate Quotation -> Sales Order -> Invoice.
6. Wire Invoice/Credit Note calculation.
7. Update PDFs to clearly show VAT mode per line and summary.
8. Run `npm test`, `npm run lint`, and `npm run build`.
9. Apply production migration only after backup verification.
