/**
 * Platform Settings helper
 *
 * WorkinFlow platform-level info (legal entity that issues SaaS tax invoices
 * to tenants). Stored as a single-row table; the super admin edits this at
 * /superadmin/settings — no redeploy needed when phone/address changes.
 *
 * Used by SubscriptionInvoice PDF to render ผู้ให้บริการ info. Blank values
 * render as "[SETUP REQUIRED]" in the PDF so it's obvious when the row
 * hasn't been filled in production yet.
 */

import { prisma } from "@/lib/prisma";

/** Public shape returned to callers — always the 5 issuer fields. */
export interface PlatformIssuerInfo {
  issuerName: string;
  issuerTaxId: string;
  issuerAddress: string;
  issuerPhone: string;
  issuerEmail: string;
}

const SINGLETON_ID = "SINGLETON";

/**
 * Fetch the platform settings singleton. Upserts an empty row on first call
 * so every caller gets back a valid record (migration seeds this row too,
 * but upsert is a defensive backstop).
 */
export async function getPlatformSettings(): Promise<PlatformIssuerInfo> {
  const row = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
    select: {
      issuerName: true,
      issuerTaxId: true,
      issuerAddress: true,
      issuerPhone: true,
      issuerEmail: true,
    },
  });
  return row;
}

/**
 * Update the platform settings singleton. Returns the updated record.
 *
 * @param data — partial fields to update (any omitted field keeps its
 *               current value). Pass empty string "" to explicitly clear.
 * @param updatedBy — SuperAdmin.id making the change (for audit)
 */
export async function upsertPlatformSettings(
  data: Partial<PlatformIssuerInfo>,
  updatedBy: string | null = null
): Promise<PlatformIssuerInfo> {
  const row = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      issuerName: data.issuerName ?? "",
      issuerTaxId: data.issuerTaxId ?? "",
      issuerAddress: data.issuerAddress ?? "",
      issuerPhone: data.issuerPhone ?? "",
      issuerEmail: data.issuerEmail ?? "",
      updatedBy,
    },
    update: {
      ...(data.issuerName !== undefined ? { issuerName: data.issuerName } : {}),
      ...(data.issuerTaxId !== undefined ? { issuerTaxId: data.issuerTaxId } : {}),
      ...(data.issuerAddress !== undefined
        ? { issuerAddress: data.issuerAddress }
        : {}),
      ...(data.issuerPhone !== undefined ? { issuerPhone: data.issuerPhone } : {}),
      ...(data.issuerEmail !== undefined ? { issuerEmail: data.issuerEmail } : {}),
      updatedBy,
    },
    select: {
      issuerName: true,
      issuerTaxId: true,
      issuerAddress: true,
      issuerPhone: true,
      issuerEmail: true,
    },
  });
  return row;
}
