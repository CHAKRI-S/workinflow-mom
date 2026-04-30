# Codex Current Plan - 2026-04-30

This plan replaces the stale pending/deferred notes that were copied forward in
`CLAUDE.md` and older deploy docs. It is based on code inspection, not only on
documentation.

## Verified In Code

### Done

- **GitHub deploy trigger exists in repo**
  - Evidence: `.github/workflows/deploy.yml`
  - It triggers Coolify on pushes to `main` using `COOLIFY_URL`,
    `COOLIFY_APP_UUID`, and `COOLIFY_TOKEN` GitHub secrets.
  - Manual trigger is enabled via `workflow_dispatch` for post-VPS-move
    verification.

- **Trial expiry cron endpoint exists and is scheduled**
  - Evidence: `src/app/api/cron/trial-expiry/route.ts`
  - GitHub Actions schedule exists at `.github/workflows/trial-expiry-cron.yml`
    and runs every 6 hours.
  - GitHub runs are succeeding as of 2026-04-30, and the workflow now uses
    `curl --fail` so endpoint failures fail the workflow.
  - Production endpoint returns `401 Unauthorized` without the header, confirming
    `CRON_SECRET` is set on production.

- **Renewal retry endpoint exists and includes saved-card auto-renewal**
  - Evidence: `src/app/api/cron/renewal-retry/route.ts`,
    `src/lib/omise.ts`, `prisma/schema.prisma`
  - The cron attempts saved-card Omise charges when the tenant has
    `omiseCustomerId` and `omiseDefaultCardId`; otherwise it falls back to
    expiring the subscription and emailing the tenant.
  - The old note in `docs/DEPLOY-PHASE-6A.md` saying saved-card auto-charge is a
    future enhancement is stale.
  - Added `.github/workflows/renewal-retry-cron.yml` on 2026-04-30.
  - Production endpoint returns `401 Unauthorized` without the header, confirming
    `CRON_SECRET` is set on production.

- **Super Admin password management exists**
  - Evidence: `src/app/superadmin/settings/settings-client.tsx`,
    `src/app/api/sa/admins/[id]/route.ts`
  - A logged-in SA can create SA users and update an SA user's password.
  - Security follow-up: this is admin reset style; it does not require current
    password confirmation for self-change.

- **Platform Issuer settings exist**
  - Evidence: `src/app/superadmin/settings/settings-client.tsx`,
    `src/app/api/sa/platform-settings/route.ts`,
    `src/lib/platform-settings.ts`, `prisma/schema.prisma`
  - Remaining check is external/database: confirm production
    `PlatformSettings` is filled with real legal issuer data.

- **Phase 8C WHT certificate fields exist in schema and migrations**
  - Evidence: `prisma/migrations/20260421120000_add_receipt_wht_cert_fields`,
    `prisma/schema.prisma`
  - Remaining check is external/database: confirm production has run
    `npx prisma migrate deploy`.

## Still Pending Or Needs External Verification

### P0 - Production Verification

0. **VPS move verification**
   - New VPS is `72.62.194.67`.
   - DNS observed from this machine:
     - `mom.workinflow.cloud` -> `72.62.194.67`
     - `admin.workinflow.cloud` -> `72.62.194.67`
     - `www.workinflow.cloud` -> `72.62.194.67`
     - `workinflow.cloud` resolves to Cloudflare proxy IPs, which is expected
       if the apex record is proxied through Cloudflare.
   - HTTP checks succeeded:
     - `https://workinflow.cloud` -> `200`
     - `https://admin.workinflow.cloud/login` -> `200`
     - cron endpoints return `401` without secret, confirming auth guard.
   - After this branch is pushed, manually run `Deploy to Coolify` once to
     confirm GitHub `COOLIFY_*` secrets target the new Coolify instance.

1. **Verify production migrations are applied**
   - Run in the Coolify app container:

```bash
npx prisma migrate status
npx prisma migrate deploy
```

   - Confirm `Receipt.whtCertReceivedAt`, `Receipt.whtCertFileUrl`,
     `PlatformSettings`, `Tenant.omiseCustomerId`, `Tenant.isVatRegistered`,
     `Product.defaultVatPriceMode`, `Quotation.vatModePolicy`,
     `SalesOrder.vatModePolicy`, `Invoice.vatModePolicy`, and
     `CreditNote.vatModePolicy` exist in production DB.

2. **Verify GitHub/Coolify deploy secrets**
   - Pushes to `main` trigger `.github/workflows/deploy.yml`; recent deploy
     runs are successful.
   - Direct secret listing was not available to the current GitHub token, but
     successful deploy runs strongly indicate `COOLIFY_URL`,
     `COOLIFY_APP_UUID`, and `COOLIFY_TOKEN` are configured.
   - Because the VPS moved, run the workflow manually after push to confirm the
     secrets still point at the current Coolify instance.

3. **Verify production integration env vars**
   - In Super Admin, open `/superadmin/settings` and check Integration Status.
   - Required for go-live:
     `RESEND_API_KEY`, `OMISE_PUBLIC_KEY`, `OMISE_SECRET_KEY`,
     `OMISE_WEBHOOK_SECRET`, `SLIPOK_API_KEY`, `SLIPOK_BRANCH_ID`,
     `CRON_SECRET`, `SA_JWT_SECRET`, and `S3_*`/R2 vars.

4. **Verify scheduled tasks**
   - Trial expiry is scheduled in GitHub Actions and has successful runs.
   - Renewal retry now has a GitHub Actions workflow:
     `.github/workflows/renewal-retry-cron.yml`.
   - After merge/push, verify the first scheduled or manual run succeeds for
     both cron workflows.

5. **Set up database backup schedule**
   - Added `docs/DB-BACKUP-RUNBOOK.md`.
   - Still needs external action in Coolify: enable scheduled PostgreSQL
     backups, set retention, and perform one restore test.

### P1 - Product/Security Follow-Ups

1. **VAT price mode per bill - implemented, needs production migration**
   - New requirement: users must be able to choose per document/bill whether
     prices are VAT outside (`EXCLUSIVE`) or VAT included (`INCLUSIVE`).
   - See `docs/VAT-PRICE-MODE-PLAN.md`.
   - Implemented in code on 2026-04-30 with new migration
     `20260430090000_add_vat_price_mode`.
   - Still requires production `npx prisma migrate deploy` after DB backup.

2. **Improve SA self password change**
   - Current SA password UI works as an admin reset.
   - Add a dedicated "change my password" flow that requires current password,
     or require current password when `id === currentSaId`.

3. **Update stale billing deploy doc**
   - `docs/DEPLOY-PHASE-6A.md` still says renewal auto-charge is future work.
   - Update it after production verification so it reflects Phase 6D correctly.

4. **Production smoke test**
   - Test card checkout, 3DS return, Omise webhook, PromptPay slip upload,
     SubscriptionInvoice PDF, Platform Issuer output, and SA subscription KPIs.

### Deferred

1. **PND53 export**
   - Still deferred.
   - Reason: schema has `PurchaseOrder` with `supplierName`, but no AP module
     with first-class `Supplier` and `Bill` models.
   - Build AP/Supplier/Bill first, then implement PND53 export.

## Updated Priority Order

1. P0: manually run deploy workflow after push to verify new VPS/Coolify link.
2. P0: production migration/env verification.
3. P0: push renewal retry scheduler and verify first run.
4. P0: configure Coolify database backups and run one restore test.
5. P1: deploy VAT price mode migration after backup, then smoke test
   quotation -> SO -> invoice totals.
6. P1: SA self password-change hardening.
7. P1: update stale deployment docs after production verification.
8. Deferred: AP module, then PND53 export.
