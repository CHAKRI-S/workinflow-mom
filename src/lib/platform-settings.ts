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
 *
 * Also holds the bank-account details shown to tenants who pay via manual
 * bank transfer (PaymentGateway.MANUAL).
 */

import { prisma } from "@/lib/prisma";

/** Issuer (legal entity) fields — used on SaaS tax-invoice PDFs. */
export interface PlatformIssuerInfo {
  issuerName: string;
  issuerTaxId: string;
  issuerAddress: string;
  issuerPhone: string;
  issuerEmail: string;
}

/** Bank-account fields — shown to tenants for manual bank transfer. */
export interface PlatformBankInfo {
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranch: string;
  promptPayId: string;
}

/** Full platform settings shape returned to callers. */
export type PlatformSettingsInfo = PlatformIssuerInfo & PlatformBankInfo;

const SINGLETON_ID = "SINGLETON";

const SELECT = {
  issuerName: true,
  issuerTaxId: true,
  issuerAddress: true,
  issuerPhone: true,
  issuerEmail: true,
  bankName: true,
  bankAccountName: true,
  bankAccountNumber: true,
  bankBranch: true,
  promptPayId: true,
} as const;

/**
 * Fetch the platform settings singleton. Upserts an empty row on first call
 * so every caller gets back a valid record (migration seeds this row too,
 * but upsert is a defensive backstop).
 */
export async function getPlatformSettings(): Promise<PlatformSettingsInfo> {
  const row = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
    select: SELECT,
  });
  return row;
}

/**
 * Returns just the bank-account block. Tenants read this to see where to
 * transfer money for manual bank-transfer checkout.
 */
export async function getPlatformBankInfo(): Promise<PlatformBankInfo> {
  const row = await getPlatformSettings();
  return {
    bankName: row.bankName,
    bankAccountName: row.bankAccountName,
    bankAccountNumber: row.bankAccountNumber,
    bankBranch: row.bankBranch,
    promptPayId: row.promptPayId,
  };
}

/** True when at least a bank name + account number are configured. */
export function isBankTransferConfigured(bank: PlatformBankInfo): boolean {
  return Boolean(bank.bankName.trim() && bank.bankAccountNumber.trim());
}

/**
 * Update the platform settings singleton. Returns the updated record.
 *
 * @param data — partial fields to update (any omitted field keeps its
 *               current value). Pass empty string "" to explicitly clear.
 * @param updatedBy — SuperAdmin.id making the change (for audit)
 */
export async function upsertPlatformSettings(
  data: Partial<PlatformSettingsInfo>,
  updatedBy: string | null = null
): Promise<PlatformSettingsInfo> {
  // Only set fields that were explicitly provided (!== undefined).
  const setDefined: Record<string, string> = {};
  for (const key of Object.keys(SELECT) as (keyof PlatformSettingsInfo)[]) {
    const value = data[key];
    if (value !== undefined) setDefined[key] = value;
  }

  const row = await prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      issuerName: data.issuerName ?? "",
      issuerTaxId: data.issuerTaxId ?? "",
      issuerAddress: data.issuerAddress ?? "",
      issuerPhone: data.issuerPhone ?? "",
      issuerEmail: data.issuerEmail ?? "",
      bankName: data.bankName ?? "",
      bankAccountName: data.bankAccountName ?? "",
      bankAccountNumber: data.bankAccountNumber ?? "",
      bankBranch: data.bankBranch ?? "",
      promptPayId: data.promptPayId ?? "",
      updatedBy,
    },
    update: {
      ...setDefined,
      updatedBy,
    },
    select: SELECT,
  });
  return row;
}
