import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { Role } from "@/generated/prisma/client";

/** Default trial length for new SaaS signups */
export const TRIAL_DAYS = 30;

/** Roles that are auto-created as preset users for a new tenant */
export const PRESET_ROLES: { role: Role; name: string; roleKey: string }[] = [
  { role: "MANAGER", name: "Factory Manager", roleKey: "manager" },
  { role: "PLANNER", name: "Production Planner", roleKey: "planner" },
  { role: "SALES", name: "Sales Team", roleKey: "sales" },
  { role: "OPERATOR", name: "CNC Operator", roleKey: "operator" },
  { role: "QC", name: "QC Inspector", roleKey: "qc" },
  { role: "ACCOUNTING", name: "Accounting", roleKey: "accounting" },
];

/** Default password for auto-created preset users (admin prompts them to change) */
export const PRESET_DEFAULT_PASSWORD = "changeme123";

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
  presetUserEmails: string[];
}

/**
 * Create a new tenant from signup form.
 * Runs inside a transaction — either everything succeeds or nothing is persisted.
 *
 * Side effects:
 * - 1 Tenant (status=TRIAL, trialEndsAt=+30 days)
 * - 1 admin User (with the email+password from signup)
 * - 6 preset Users (manager/planner/sales/operator/qc/accounting) with placeholder emails
 * - Linked to default plan (FREE by default)
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

  // Hash passwords
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const presetHash = await bcrypt.hash(PRESET_DEFAULT_PASSWORD, 10);

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

    // 2. Create admin user
    const admin = await tx.user.create({
      data: {
        email: adminEmail.toLowerCase(),
        name: adminName,
        hashedPassword: adminHash,
        role: "ADMIN",
        tenantId: tenant.id,
      },
    });

    // 3. Create preset users (placeholder emails using slug)
    const presetEmails: string[] = [];
    for (const p of PRESET_ROLES) {
      const presetEmail = `${p.roleKey}.${slug}@workinflow.local`;
      await tx.user.create({
        data: {
          email: presetEmail,
          name: p.name,
          hashedPassword: presetHash,
          role: p.role,
          tenantId: tenant.id,
        },
      });
      presetEmails.push(presetEmail);
    }

    return {
      tenantId: tenant.id,
      slug: tenant.slug!,
      code: tenant.code,
      adminUserId: admin.id,
      trialEndsAt,
      presetUserEmails: presetEmails,
    };
  });

  return result;
}
