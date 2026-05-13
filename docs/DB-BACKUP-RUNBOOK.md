# Database Backup Runbook

This project uses PostgreSQL 16. Production runs on Coolify, so the safest
default is to configure automated database backups in Coolify and periodically
test restore.

## Goal

- Automated daily backups.
- Retention of at least 14 daily backups.
- A restore test after first setup and after major schema migrations.
- Backups must not be stored only on the same VPS disk.

## Recommended Production Setup

1. Open Coolify.
2. Go to the WorkinFlow MOM PostgreSQL resource.
3. Enable scheduled backups.
4. Set frequency to daily during low-traffic hours, for example `02:30`
   Bangkok time.
5. Set retention to at least 14 days.
6. Store backups off-server if Coolify storage integration is available.
7. Run a manual backup immediately after enabling.
8. Download or restore one backup into a throwaway database to confirm it is
   valid.

## Manual Backup Command

Run from a secure shell that has access to the production `DATABASE_URL`.
Do not paste the URL into chat or commit it to the repo.

```bash
mkdir -p backups
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl \
  --file "backups/workinflow-mom-$(date +%Y%m%d-%H%M%S).dump"
```

## Restore Test Command

Restore into a temporary empty database, never directly over production:

```bash
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname "$RESTORE_DATABASE_URL" backups/workinflow-mom-YYYYMMDD-HHMMSS.dump
```

Then run:

```bash
npx prisma migrate status
```

## Before Risky Migrations

1. Take a fresh manual backup.
2. Record the backup filename and timestamp.
3. Run `npx prisma migrate status`.
4. Apply migration with `npx prisma migrate deploy`.
5. Verify critical tables and fields.

## Current Critical Fields To Verify

- `Receipt.whtCertReceivedAt`
- `Receipt.whtCertFileUrl`
- `PlatformSettings`
- `Tenant.omiseCustomerId`
- `Tenant.omiseDefaultCardId`
- `Tenant.isVatRegistered`
- `Product.defaultVatPriceMode`
- `Quotation.vatModePolicy`
- `SalesOrder.vatModePolicy`
- `Invoice.vatModePolicy`
- `CreditNote.vatModePolicy`
- `DocumentTaxType` enum
- `IndividualTitle` enum
- `Customer.individualTitle`
- `Customer.individualTitleOther`
- `Quotation.taxType`
- `Quotation.currencyCode`
- `SalesOrder.taxType`
- `SalesOrder.currencyCode`
- `Invoice.taxType`
- `Invoice.currencyCode`
- `TaxInvoice.taxType`
- `TaxInvoice.currencyCode`
- `Receipt.taxType`
- `Receipt.currencyCode`
- `CreditNote.taxType`
- `CreditNote.currencyCode`

See `docs/SALES-DOCUMENT-TAX-CURRENCY.md` for the sales-document tax/currency/legal-name rollout checklist.
