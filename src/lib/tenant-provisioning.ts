import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { BillingNature, JuristicType } from "@/generated/prisma/client";

/** Default trial length for new SaaS signups */
export const TRIAL_DAYS = 30;

// ───────────────────────────────────────────────
// Slug / code helpers
// ───────────────────────────────────────────────

/** Normalize a string to a URL-safe slug */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u0E00-\u0E7F\s-]/g, "") // keep Thai chars
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/** Ensure slug is unique by appending -2, -3, ... if collision */
export async function generateUniqueSlug(base: string): Promise<string> {
  const normalized = normalizeSlug(base) || "tenant";
  let candidate = normalized;
  let counter = 2;
  while (await prisma.tenant.findUnique({ where: { slug: candidate } })) {
    candidate = `${normalized}-${counter}`;
    counter += 1;
  }
  return candidate;
}

/** Max length for tenant code (used as doc number prefix, kept short to
 * keep invoice numbers readable). Matches the UI validator in settings. */
export const TENANT_CODE_MAX = 8;
export const TENANT_CODE_MIN = 2;

/** Random 4-char fallback for tenants whose names strip to empty (e.g.
 * Thai-only "บริษัท เวิร์คอินโฟลว์") — previously we hard-coded "WF"
 * which collided almost instantly. `T` prefix + 4 base36 chars gives a
 * ~1.6M-slot space per prefix, effectively never colliding in practice. */
function randomCodeFallback(): string {
  const rand = Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  return `T${rand}`;
}

/** Ensure tenant code is unique. Strips to A-Z/0-9, caps at TENANT_CODE_MAX,
 * falls back to a random 5-char code when the input has no Latin chars
 * (e.g. Thai-only company names). Tenants can always edit this later at
 * /admin/settings. */
export async function generateUniqueCode(base: string): Promise<string> {
  const normalized = base
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, TENANT_CODE_MAX);

  let candidate = normalized || randomCodeFallback();

  // Try up to 20 times — for normalized names we append a counter; for
  // random fallbacks we re-roll. Extremely unlikely to hit 20.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const clash = await prisma.tenant.findUnique({ where: { code: candidate } });
    if (!clash) return candidate;

    if (normalized) {
      const suffix = String(attempt + 2);
      candidate = `${normalized.slice(0, TENANT_CODE_MAX - suffix.length)}${suffix}`;
    } else {
      candidate = randomCodeFallback();
    }
  }

  throw new Error("Could not generate a unique tenant code after 20 attempts");
}

// ───────────────────────────────────────────────
// Main provisioning
// ───────────────────────────────────────────────

export interface ProvisionTenantInput {
  companyName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  phone?: string;
  taxId?: string;
  address?: string;
  /** Thai juristic type of the business (บริษัทจำกัด, มหาชน, หจก, …) */
  juristicType?: JuristicType;
  /** Branch number (00000 = HQ) */
  branchNo?: string;
  /** ISO country code (default "TH") */
  country?: string;
  /** Default billing nature for new customers/documents. Asked at signup:
   *  "ขายสินค้าออกแบบเอง" → GOODS (default, OEM factor profile) |
   *  "รับจ้างผลิตตามแบบลูกค้า" → MANUFACTURING_SERVICE (ม.3 เตรส) |
   *  "ผสม" → MIXED. Falls back to schema default (GOODS) if omitted. */
  defaultBillingNature?: BillingNature;
  /** Phase 8.12 — VAT registration status. If true (or omitted, since the
   *  schema defaults to true), PDFs render "ใบกำกับภาษี / ใบแจ้งหนี้" + 7%
   *  VAT line. If false, PDFs drop "ใบกำกับภาษี" per ม.86 ประมวลรัษฎากร. */
  isVatRegistered?: boolean;
  /** Override default plan (defaults to FREE) */
  planSlug?: string;
  /** Override trial days (default 30) */
  trialDays?: number;
}

export interface ProvisionTenantResult {
  tenantId: string;
  slug: string;
  code: string;
  adminUserId: string;
  trialEndsAt: Date;
}

/**
 * Create a new tenant from signup form.
 * Runs inside a transaction — either everything succeeds or nothing is persisted.
 *
 * Side effects:
 * - 1 Tenant (status=TRIAL, trialEndsAt=+30 days)
 * - 1 admin User (with the email+password from signup)
 * - Linked to default plan (FREE by default)
 *
 * Note: we intentionally do NOT seed preset users anymore — they consumed
 * seat quota immediately (blocking FREE tenants at signup) and had
 * placeholder `.workinflow.local` emails that couldn't be used to log in.
 * Admins invite real teammates via /admin/users/invite instead.
 */
export async function provisionTenant(
  input: ProvisionTenantInput,
): Promise<ProvisionTenantResult> {
  const {
    companyName,
    adminName,
    adminEmail,
    adminPassword,
    phone,
    taxId,
    address,
    juristicType,
    branchNo,
    country = "TH",
    defaultBillingNature,
    isVatRegistered,
    planSlug = "free",
    trialDays = TRIAL_DAYS,
  } = input;

  // Validate admin email not taken (globally unique per current schema)
  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail.toLowerCase() },
  });
  if (existingUser) {
    throw new Error("อีเมลนี้ถูกใช้แล้ว กรุณาใช้อีเมลอื่น");
  }

  // Lookup plan
  const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
  if (!plan) {
    throw new Error(`Plan "${planSlug}" not found. Run seed first.`);
  }

  // Generate unique slug + code (outside transaction so findUnique can run freely)
  const slug = await generateUniqueSlug(companyName);
  const code = await generateUniqueCode(companyName);

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

  // Hash password
  const adminHash = await bcrypt.hash(adminPassword, 10);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create tenant
    const tenant = await tx.tenant.create({
      data: {
        name: companyName,
        code,
        slug,
        taxId: taxId ?? null,
        address: address ?? null,
        phone: phone ?? null,
        email: adminEmail.toLowerCase(),
        juristicType: juristicType ?? null,
        branchNo: branchNo || null,
        country,
        // If omitted, schema default (GOODS) applies.
        ...(defaultBillingNature ? { defaultBillingNature } : {}),
        // Phase 8.12 — if undefined, schema default (true) applies. Only
        // persist when explicitly set so existing tests / seeders stay stable.
        ...(isVatRegistered !== undefined ? { isVatRegistered } : {}),
        status: "TRIAL",
        trialEndsAt,
        planId: plan.id,
      },
    });

    // 2. Create admin user (only — no preset team members)
    const admin = await tx.user.create({
      data: {
        email: adminEmail.toLowerCase(),
        name: adminName,
        hashedPassword: adminHash,
        role: "ADMIN",
        tenantId: tenant.id,
      },
    });

    return {
      tenantId: tenant.id,
      slug: tenant.slug!,
      code: tenant.code,
      adminUserId: admin.id,
      trialEndsAt,
    };
  });

  return result;
}
