import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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

/** Ensure tenant code is unique by appending digit if collision */
export async function generateUniqueCode(base: string): Promise<string> {
  const normalized = base
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  const fallback = normalized || "WF";
  let candidate = fallback;
  let counter = 1;
  while (await prisma.tenant.findUnique({ where: { code: candidate } })) {
    counter += 1;
    candidate = `${fallback.slice(0, 5)}${counter}`;
  }
  return candidate;
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
