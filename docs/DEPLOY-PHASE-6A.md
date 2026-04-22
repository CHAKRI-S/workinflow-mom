# Phase 6A Go-Live Checklist

Manual steps required before WorkinFlow can actually collect money from tenants.
Complete in order — each step is independent but later steps depend on earlier ones.

---

## ✅ Step 0 — Already done (automated)

- ✅ Code pushed to `origin/main` (commits through `f17b4c3a`)
- ✅ Coolify auto-deploy triggered via GitHub webhook
- ✅ Migration file `20260421120000_add_receipt_wht_cert_fields` in repo
- ✅ Platform Issuer info stored in DB (`PlatformSettings` singleton) — editable at `/superadmin/settings`, no redeploy to change

---

## ⚠️ Step 1 — Run Phase 8C DB migration on production

**Why:** The Receipt WHT cert fields migration (`whtCertReceivedAt`, `whtCertFileUrl`)
is in the repo but has NOT been applied to production Postgres yet. Without it,
the WHT tracking dashboard (Phase 8C) will crash with "column does not exist".

**How (via Coolify terminal on the app container):**
```bash
cd /app
npx prisma migrate deploy
```

**Expected output:**
```
5 migrations found in prisma/migrations
Applying migration `20260421120000_add_receipt_wht_cert_fields`
The following migration(s) have been applied: ...
```

**Verification:**
```sql
-- Run in Coolify DB console or via psql
\d "Receipt"
-- Should show whtCertReceivedAt (timestamp) and whtCertFileUrl (text)
```

**Rollback (if needed):**
```sql
ALTER TABLE "Receipt" DROP COLUMN "whtCertReceivedAt";
ALTER TABLE "Receipt" DROP COLUMN "whtCertFileUrl";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260421120000_add_receipt_wht_cert_fields';
```

---

## ⚠️ Step 2 — Fill Platform Issuer info at `/superadmin/settings`

**Why:** Every SubscriptionInvoice PDF will otherwise show `[SETUP REQUIRED]`
in place of real platform tax ID / address / phone. Tenants will reject these
as invalid Thai tax invoices.

**Where:** `https://admin.workinflow.cloud/superadmin/settings` → Platform Issuer section

**Fill these 5 fields** (use real data for the legal entity operating WorkinFlow):

| Field | Example value |
|---|---|
| ชื่อนิติบุคคล | `บริษัท เวิร์คอินโฟลว์ จำกัด` (or your legal name) |
| เลขประจำตัวผู้เสียภาษี | `0105567xxxxxxxx` (13-digit Thai tax ID) |
| ที่อยู่สำนักงานใหญ่ | `xxx ถนน xxx แขวง xxx เขต xxx กรุงเทพฯ 10xxx` |
| เบอร์โทรศัพท์ | `02-xxx-xxxx` or `081-xxx-xxxx` |
| อีเมล | `billing@workinflow.cloud` |

Click **บันทึก** — no redeploy needed. Values apply instantly to every
new PDF download. Stored in `PlatformSettings` singleton table.

---

## ⚠️ Step 3 — Configure Omise (credit card + PromptPay)

**Prerequisites:**
- Sign up at https://dashboard.omise.co
- Complete KYB (know-your-business) verification — takes 1-3 business days
- Enable both "Credit/Debit Card" and "PromptPay" payment methods

**3a. Get API keys:**
1. Omise dashboard → `Keys` tab
2. Copy `Public key` (starts with `pkey_`)
3. Copy `Secret key` (starts with `skey_`)

**3b. Set on Coolify:**
| Env var | Value |
|---|---|
| `OMISE_PUBLIC_KEY` | `pkey_live_xxx` (use `pkey_test_xxx` to test first!) |
| `OMISE_SECRET_KEY` | `skey_live_xxx` (use `skey_test_xxx` to test first!) |
| `OMISE_WEBHOOK_SECRET` | (see step 3c) |

**3c. Register webhook + get secret:**
1. Omise dashboard → `Webhooks` tab → `Add endpoint`
2. URL: `https://mom.workinflow.cloud/api/billing/webhook/omise`
3. Events to subscribe: `charge.complete`, `charge.create`, `charge.expire`
4. Save → copy the webhook secret → set `OMISE_WEBHOOK_SECRET` on Coolify

**3d. Test:**
- Use Omise test keys (`pkey_test_xxx` / `skey_test_xxx`) first
- Trigger a test charge from tenant admin → `/admin/billing` → select a plan
- Verify webhook received at `/api/billing/webhook/omise`
- Check logs: `docker logs <container>` on Coolify

**3e. Switch to live:**
- Swap test keys → live keys on Coolify
- Redeploy

---

## ⚠️ Step 4 — Configure SlipOK (PromptPay slip verification)

**Prerequisites:**
- Sign up at https://slipok.com
- Complete KYC verification
- Link your company's PromptPay account (the one customers transfer to)

**4a. Get credentials:**
1. SlipOK dashboard → `API Keys` tab
2. Copy `API Key`
3. Copy `Branch ID` (numeric, per-branch identifier)

**4b. Set on Coolify:**
| Env var | Value |
|---|---|
| `SLIPOK_API_KEY` | `SLIPOK-xxxxxxxxxxxxx` |
| `SLIPOK_BRANCH_ID` | `12345` |

**4c. Test:**
- Tenant admin → `/admin/billing` → select plan → choose "PromptPay QR"
- Transfer small amount (1 baht test) to the PromptPay number shown
- Upload slip → verify → subscription should activate
- Check R2 bucket `workinflow-wht-certs` (or your chosen bucket) for uploaded slip under `slips/{tenantId}/...`

---

## ✅ Step 5 — Smoke test the full billing flow

1. **Login as test tenant admin** (not super admin)
2. Navigate to `/admin/billing`
3. Verify current plan + trial expiry shown correctly
4. Click "Upgrade to PRO" (or any paid plan)
5. **Card test (Omise test mode):**
   - Select "Credit Card"
   - Use Omise test card: `4242 4242 4242 4242`, any future expiry, any CVV
   - Expect: subscription activates, email arrives
6. **PromptPay test (SlipOK):**
   - Select "PromptPay QR"
   - Transfer real (small) amount — e.g. 1 บาท — to shown number
   - Upload slip
   - Expect: SlipOK verifies, subscription activates, slip stored in R2
7. **Verify SubscriptionInvoice PDF:**
   - Tenant billing page → "ใบกำกับภาษี / ใบเสร็จรับเงิน" panel
   - Click "ดาวน์โหลด PDF"
   - Confirm platform issuer shows real info (not `[SETUP REQUIRED]`)
8. **Verify SA monitoring:**
   - Login as super admin at `admin.workinflow.cloud`
   - `/subscriptions` → new subscription appears
   - MRR KPI updates

---

## Deferred (Phase 6B / 6C)

These are NOT required for go-live but needed within 1-4 weeks of launch:

- **Phase 6B** — Trial expiry cron (currently trial accounts stay active forever
  after trialEndsAt passes). Manual SA action required per expired tenant.
- **Phase 6B** — Renewal retry cron (currently paid subscriptions also stay
  active after periodEnd passes — no auto-suspend). Will need to manually
  run SQL to mark EXPIRED until 6B ships.
- **Phase 6C** — Real Omise.js credit card tokenization + 3DS (currently the
  OMISE path generates a PromptPay source instead of charging card properly).

Track these in memory: `memory/phase_6a_billing_ops.md` → "What Phase 6A does NOT include" section.

---

## Troubleshooting

**"configMissing: true" response from checkout:**
→ `OMISE_SECRET_KEY` env var not set. Check Coolify + redeploy.

**Slip upload succeeds but `slipUrl` still null:**
→ R2 credentials wrong or bucket doesn't exist. Check `S3_*` env vars +
   bucket permissions. The activation itself still succeeds (by design).

**No email received after successful payment:**
→ Check `RESEND_API_KEY` set + `noreply@workinflow.cloud` domain is verified
   in Resend. Emails are fire-and-forget so payment succeeds even if email fails.

**SubscriptionInvoice PDF shows `[SETUP REQUIRED]`:**
→ Step 2 not done. Fill Platform Issuer form at `/superadmin/settings`
   (saves to DB — takes effect on next PDF download, no redeploy needed).

**Super admin `/subscriptions` returns 401:**
→ Not logged in as super admin. Visit `admin.workinflow.cloud/login` first.
   Super admin uses separate `sa_token` cookie, not tenant auth.

**Webhook 500 on charge.complete:**
→ `OMISE_WEBHOOK_SECRET` wrong or subscription already activated (idempotent
   failure). Check container logs for exact error.
