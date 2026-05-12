# Plan: ย้าย cron จาก GitHub Actions ไป Coolify Scheduled Task

## Origin / Metadata

- Channel: Discord `#workinflow-mom`
- User: Tik
- Project: WorkinFlow MOM
- Workdir: `/Users/tik/Projects/WorkinFlow/MOM (Manufacturing Operations Management)`
- Repo: `CHAKRI-S/workinflow-mom`
- Target branch: `main`
- Scope: DevOps / scheduled cron migration
- Plan created: `2026-05-08 16:08`

## Goal

ย้าย scheduled cron ที่ปลุก production endpoint จาก GitHub Actions ไปเป็น Coolify Scheduled Task เพื่อให้ production cron อยู่กับ production infra โดยตรง ลด dependency ต่อ GitHub runner/network และลด notification failed จาก GitHub Actions cron timeout

## Current Context

ตอนนี้ repo มี GitHub Actions cron 2 ตัว:

1. `.github/workflows/trial-expiry-cron.yml`
   - Schedule: ทุก 6 ชั่วโมง
   - Endpoint: `https://mom.workinflow.cloud/api/cron/trial-expiry`
   - Header: `x-cron-secret: ${{ secrets.CRON_SECRET }}`

2. `.github/workflows/renewal-retry-cron.yml`
   - Schedule: ทุก 1 ชั่วโมง
   - Endpoint: `https://mom.workinflow.cloud/api/cron/renewal-retry`
   - Header: `x-cron-secret: ${{ secrets.CRON_SECRET }}`

Production endpoint มี auth guard ด้วย `CRON_SECRET` ฝั่ง app env และต้องส่ง header `x-cron-secret` ให้ตรงกัน

## Important Safety Notes

- งานนี้เกี่ยวกับ production infra / cron / secret ต้องขออนุมัติก่อนลงมือเปลี่ยนจริง
- ห้าม print หรือ commit ค่า `CRON_SECRET`
- ห้ามใส่ secret ลง repo, docs public, GitHub workflow, หรือ chat
- ต้องยืนยันว่า Coolify Scheduled Task สามารถเข้าถึงค่า env `CRON_SECRET` แบบปลอดภัย หรือใช้ secret storage ของ Coolify ได้
- ควรย้ายทั้ง 2 cron พร้อมกัน ไม่ใช่เฉพาะ trial expiry เพราะ renewal retry ก็ใช้ GitHub scheduled cron เหมือนกัน

## Proposed Approach

1. สร้าง Coolify Scheduled Task 2 รายการบน production app/resource
2. ให้ task รัน curl ไปที่ production endpoint พร้อม header `x-cron-secret`
3. ทดสอบ manual run จาก Coolify ว่า response success
4. ปิด GitHub scheduled trigger แต่คง `workflow_dispatch` ไว้สำหรับ manual fallback/test
5. Commit/push เฉพาะการแก้ workflow/docs หลัง Coolify task verified แล้ว

## Target Coolify Scheduled Tasks

### Task A: Trial Expiry Cron

Schedule เดิม:

```cron
0 */6 * * *
```

Command concept:

```bash
curl -fsS --max-time 120 --retry 2 --retry-delay 5 \
  -H "x-cron-secret: $CRON_SECRET" \
  "https://mom.workinflow.cloud/api/cron/trial-expiry"
```

Notes:

- ใช้ `--max-time 120` แทน 60 เพื่อกัน DB/email ช้าชั่วคราว
- ใช้ `-f` เพื่อให้ HTTP 4xx/5xx fail ชัดเจน
- ถ้า Coolify task ไม่มี env context ของ app ต้องตั้ง `CRON_SECRET` ใน task env/command ผ่าน secret mechanism ของ Coolify โดยไม่เผยค่า

### Task B: Renewal Retry Cron

Schedule เดิม:

```cron
0 * * * *
```

Command concept:

```bash
curl -fsS --max-time 120 --retry 2 --retry-delay 5 \
  -H "x-cron-secret: $CRON_SECRET" \
  "https://mom.workinflow.cloud/api/cron/renewal-retry"
```

Notes:

- Endpoint นี้เกี่ยวกับ billing/renewal retry จึงต้อง test อย่างระวัง
- Confirm endpoint เป็น idempotent ตาม comment ใน workflow ก่อนปล่อยรันต่อเนื่อง

## Step-by-Step Execution Plan

### Phase 1 — Preflight แบบ read-only

1. ตรวจสถานะ git branch/current worktree
   - `git status --short --branch`
2. อ่าน workflow ทั้ง 2 ไฟล์เพื่อยืนยัน schedule และ endpoint
   - `.github/workflows/trial-expiry-cron.yml`
   - `.github/workflows/renewal-retry-cron.yml`
3. อ่าน route handlers ที่เกี่ยวข้อง
   - `src/app/api/cron/trial-expiry/route.ts`
   - `src/app/api/cron/renewal-retry/route.ts`
4. ตรวจ docs ปัจจุบันเกี่ยวกับ cron
   - `docs/DEPLOY-PHASE-6A.md`
   - `docs/CODEX-CURRENT-PLAN.md` ถ้าเกี่ยวข้อง
5. ยืนยันว่าไม่มีการแก้ production secrets ผ่าน repo

### Phase 2 — Prepare Coolify Scheduled Tasks

1. เข้า Coolify app/resource ของ `mom.workinflow.cloud`
2. ไปที่ Scheduled Tasks / Cron section ของ app/resource
3. สร้าง task `trial-expiry-cron`
   - Schedule: `0 */6 * * *`
   - Command: curl endpoint trial expiry พร้อม `x-cron-secret`
4. สร้าง task `renewal-retry-cron`
   - Schedule: `0 * * * *`
   - Command: curl endpoint renewal retry พร้อม `x-cron-secret`
5. ตรวจให้ command ใช้ secret แบบไม่ expose ค่าใน logs ถ้า Coolify รองรับ
6. ถ้า Coolify task ไม่ inherit app env ให้ตั้ง env เฉพาะ task หรือใช้ command ที่อ้าง secret storage ของ Coolify

### Phase 3 — Manual Verification ก่อนปิด GitHub schedule

1. Run task `trial-expiry-cron` manual 1 ครั้งจาก Coolify
2. Expected result:
   - HTTP 200
   - JSON ประมาณ `{ "success": true, ... }`
   - ไม่มี timeout
3. Run task `renewal-retry-cron` manual 1 ครั้งจาก Coolify
4. Expected result:
   - HTTP 200
   - JSON success ตาม endpoint contract
   - ไม่มี duplicate side effect ที่ผิดปกติ
5. ตรวจ app logs ช่วง manual run
   - ไม่มี secret leak
   - ไม่มี Prisma/DB error
   - ไม่มี Resend/payment error ที่ทำให้ task fail

### Phase 4 — Disable GitHub Schedule, Keep Manual Fallback

หลัง Coolify task verified แล้ว ค่อยแก้ workflow GitHub Actions:

1. แก้ `.github/workflows/trial-expiry-cron.yml`
   - เอา `schedule:` ออก หรือ comment พร้อม note
   - คง `workflow_dispatch:` ไว้
2. แก้ `.github/workflows/renewal-retry-cron.yml`
   - เอา `schedule:` ออก หรือ comment พร้อม note
   - คง `workflow_dispatch:` ไว้
3. เพิ่ม comment ใน workflow ว่า scheduled production cron moved to Coolify Scheduled Tasks
4. อัปเดต docs cron ops ใน `docs/DEPLOY-PHASE-6A.md` หรือไฟล์ docs ที่เหมาะสม
   - ระบุว่า production schedule อยู่ใน Coolify
   - GitHub Actions เหลือ manual fallback เท่านั้น
   - ห้ามใส่ secret value

### Phase 5 — Local Verification

หลังแก้ไฟล์ repo:

1. ตรวจ YAML syntax แบบง่าย
2. Run targeted checks ที่ไม่กระทบ production ถ้ามี
3. ตรวจ diff ให้ไม่มี secret หรือ config sensitive
   - `git diff -- .github/workflows docs`
4. ถ้าจะ commit/push ต้องขออนุมัติคุณติ๊กก่อน เพราะเป็น main/production infra change

### Phase 6 — Post-change Monitoring

1. รอดู Coolify scheduled run รอบถัดไปอย่างน้อย 1 รอบ
2. ตรวจ logs ว่า task สำเร็จ
3. ตรวจ GitHub Actions ว่าไม่มี scheduled run ใหม่จาก workflow เดิม
4. ถ้า Coolify task fail ให้ rollback โดย re-enable GitHub schedule หรือ manual dispatch ชั่วคราว

## Files Likely to Change

- `.github/workflows/trial-expiry-cron.yml`
- `.github/workflows/renewal-retry-cron.yml`
- `docs/DEPLOY-PHASE-6A.md`
- Optional: `docs/CODEX-CURRENT-PLAN.md` ถ้ามี section บอกว่า GitHub cron ยังเป็น active scheduler

## Files to Inspect Only

- `src/app/api/cron/trial-expiry/route.ts`
- `src/app/api/cron/renewal-retry/route.ts`
- `src/lib/email.ts`
- Billing/email helpers ที่ renewal endpoint ใช้

## Validation Checklist

- [ ] Coolify task `trial-expiry-cron` manual run returns HTTP 200
- [ ] Coolify task `renewal-retry-cron` manual run returns HTTP 200
- [ ] App logs show no auth failure / timeout / DB error
- [ ] No secrets printed in logs or committed to repo
- [ ] GitHub workflows retain `workflow_dispatch`
- [ ] GitHub scheduled triggers removed/disabled
- [ ] Docs updated to reflect Coolify as production scheduler
- [ ] Git diff reviewed before commit
- [ ] Commit/push only after explicit approval

## Risks / Tradeoffs

### Risks

- Coolify Scheduled Task command may expose env/secret in logs if configured incorrectly
- If task does not inherit app env, cron will fail with 401 until `CRON_SECRET` is wired correctly
- Renewal retry touches billing/payment behavior; even if idempotent, manual testing must be careful
- If Coolify scheduler is unavailable/misconfigured, production cron may silently stop unless monitoring is set

### Tradeoffs

- Moving to Coolify reduces GitHub runner/network dependency
- GitHub Actions logs become less useful for scheduled runs, but Coolify logs become source of truth
- Keeping `workflow_dispatch` provides safe manual fallback without automatic GitHub schedule

## Rollback Plan

If Coolify cron fails after migration:

1. Re-enable `schedule` blocks in both GitHub workflow files
2. Commit/push rollback after approval
3. Temporarily use GitHub `workflow_dispatch` manually if immediate run needed
4. Fix Coolify Scheduled Task env/command before attempting migration again

## Open Questions Before Execution

1. คุณติ๊กต้องการให้ย้ายทั้ง 2 cron เลยไหม?
   - `trial-expiry` ทุก 6 ชั่วโมง
   - `renewal-retry` ทุก 1 ชั่วโมง
2. มี Coolify access/token/หน้า dashboard พร้อมไหม หรือให้ใช้ SSH/VPS inspection ถ้ามีสิทธิ์?
3. ต้องการให้ผมแก้ workflow/docs และ push `main` หลัง verify Coolify task แล้วไหม?

## Recommended Decision

แนะนำให้ย้ายทั้ง 2 cron ไป Coolify Scheduled Task พร้อมกัน เพราะทั้งคู่เป็น production scheduled jobs ที่ใช้ pattern เดียวกัน และปิด GitHub schedule เหลือ manual fallback เท่านั้น
