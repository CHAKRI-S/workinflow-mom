# Sales Document Tax, Currency, and Legal Customer Name Rules

Status on 2026-05-13: implemented in code locally; production still needs the Prisma migration deployed after backup verification.

This note is the compact handoff for the quotation -> sales order -> invoice -> tax invoice/receipt/credit-note chain. It complements `docs/VAT-PRICE-MODE-PLAN.md`, which covers line-level VAT price mode (`EXCLUSIVE`/`INCLUSIVE`) and `VatModePolicy`.

## Concepts

### 1. Document tax type

`DocumentTaxType` is the document-level customer-facing tax choice:

- `VAT_EXCLUSIVE` - VAT is added on top of the document net amount.
- `VAT_INCLUSIVE` - entered prices are treated as VAT-included.
- `NO_VAT` - no VAT is charged/shown as tax amount.

Rules:

- The selected tax type belongs to the document, not only to the customer.
- Customer or tenant VAT registration remains profile/reference data only. The implemented document flow must not silently override, block, or rename a user's explicit document tax choice based on those flags.
- Downstream documents should copy the source document tax type so totals and wording remain auditable.

### 2. Line VAT price mode

Line VAT mode remains separate from document tax type:

- `VatPriceMode.EXCLUSIVE` / `INCLUSIVE` records how a line price was entered.
- `VatModePolicy.PER_LINE` / `FORCE_EXCLUSIVE` / `FORCE_INCLUSIVE` resolves effective line mode.
- `DocumentTaxType.NO_VAT` removes VAT monetary effect but should not erase the line-mode snapshot.

### 3. Currency snapshot

`currencyCode` is stored on each sales/finance document as a 3-letter code.

MVP rules:

- Store and display the selected currency code.
- Do not perform automatic FX conversion.
- Do not recalculate historical documents if the app later adds exchange rates.
- PDFs and money formatting should use the document's own `currencyCode` where available, with `THB` as the safe fallback.

### 4. Customer legal display name

Customer `name` is the base/common customer name. Do not mutate it into a legal-string-only field.

For legal/accounting documents:

- Use the shared customer-name helper to build legal display names from `Customer.name`, `juristicType`, `individualTitle`, and `individualTitleOther`.
- Store formatted names in document snapshots at document creation time where the target model has a snapshot field, for example `Invoice.snapshotCustomerName`, `TaxInvoice.buyerName`, and `Receipt.payerName`.
- Tax Invoices created from Invoices should prefer the source Invoice snapshot before falling back to current Customer fields.

## Schema fields introduced by this feature set

Migration directory:

- `prisma/migrations/20260513113300_tax_type_currency_customer_legal_name/`

Important fields/enums:

- `DocumentTaxType`: `VAT_INCLUSIVE`, `VAT_EXCLUSIVE`, `NO_VAT`
- `IndividualTitle`: `MR`, `MRS`, `MISS`, `KHUN`, `NONE`, `OTHER`
- `JuristicType`: now also includes `ORDINARY_PARTNERSHIP`, `SHOP`, and `PERSON_GROUP`
- `Customer.individualTitle`
- `Customer.individualTitleOther`
- `Quotation.taxType`, `Quotation.currencyCode`
- `SalesOrder.taxType`, `SalesOrder.currencyCode`
- `Invoice.taxType`, `Invoice.currencyCode`
- `TaxInvoice.taxType`, `TaxInvoice.currencyCode`
- `Receipt.taxType`, `Receipt.currencyCode`
- `CreditNote.taxType`, `CreditNote.currencyCode`

## Propagation chain

Expected default propagation:

1. Quotation captures `taxType` and `currencyCode`.
2. Quotation -> Sales Order copies `taxType`, `currencyCode`, line VAT mode, and billing nature.
3. Sales Order -> Invoice copies `taxType`, `currencyCode`, line VAT mode, billing nature, and formatted customer snapshot.
4. Invoice -> Tax Invoice copies `taxType`, `currencyCode`, totals, billing nature, and buyer snapshot from the Invoice before current Customer fallback.
5. Invoice -> Receipt copies `taxType`, `currencyCode`, billing nature, payer snapshot, and WHT metadata.
6. Invoice -> Credit Note copies `taxType`, `currencyCode`, VAT policy, and billing/WHT context for reversal.

## Tax Invoice singleton rule

Only one active Tax Invoice may exist per source Invoice.

- Creating another Tax Invoice is allowed only after the previous Tax Invoice is cancelled.
- This protects legal document numbering and avoids two active tax invoices for the same source invoice.
- Tax Invoice creation is blocked for `NO_VAT` or zero-VAT source Invoices; tenant/customer VAT-registration flags are not the gate in this MVP because `taxType` is the approved source of truth.

## Production rollout checklist

Before deploy/migration:

- Confirm database backup schedule exists or take a fresh manual backup.
- Run `npx prisma migrate status` in the production app container.
- Review the migration `20260513113300_tax_type_currency_customer_legal_name`.

Deploy/migrate:

- Run `npx prisma migrate deploy` in the Coolify app container only after backup verification.
- Deploy the app build that contains the matching Prisma client and UI/API code.

Post-migration verification:

- Confirm the new enum/fields exist in production DB.
- Smoke test Quotation creation with each tax type and at least `THB` plus one non-THB currency code.
- Convert Quotation -> Sales Order -> Invoice and confirm `taxType`, `currencyCode`, totals, and PDF labels carry forward.
- Create Tax Invoice from Invoice, then try creating a second active Tax Invoice and confirm the API blocks it.
- Create Receipt and Credit Note from the same Invoice and confirm currency/tax snapshots display correctly in PDFs.

## Related files

- `src/lib/tax-type.ts`
- `src/lib/currency.ts`
- `src/lib/customer-name.ts`
- `src/lib/document-tax-propagation.ts`
- `src/lib/validators/document-fields.ts`
- `src/lib/pdf/format.ts`
- `src/lib/pdf/mappers.ts`
- `docs/VAT-PRICE-MODE-PLAN.md`
- `docs/DB-BACKUP-RUNBOOK.md`
