import { prisma } from "@/lib/prisma";

/**
 * Generate ISO-compliant document number
 * Pattern: {TENANT_CODE}-{PREFIX}-{YEAR}-{SEQ:5}
 * Example: WF01-SO-2026-00001, ACME-QT-2026-00042
 *
 * If the tenant has no code set (legacy / defensive), falls back to the
 * short form: {PREFIX}-{YEAR}-{SEQ:5} — same as before the code prefix
 * feature shipped, so existing tenants keep working.
 *
 * Doc numbers are immutable per Thai tax rules. If a tenant changes
 * their code at /admin/settings, already-issued docs keep their old
 * number; only future docs pick up the new prefix. The internal
 * DocumentSequence counter is keyed on tenantId+prefix+year (no code
 * component), so sequence numbers stay gap-free across a code change.
 *
 * Uses atomic upsert to guarantee gap-free sequential numbering
 * even under concurrent access.
 */
export async function generateDocNumber(
  tenantId: string,
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();

  // Fetch tenant code once, outside the sequence transaction — it almost
  // never changes and this lookup doesn't need to race with the sequence
  // increment.
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { code: true },
  });
  const tenantCode = tenant?.code?.trim() || null;

  const sequence = await prisma.$transaction(async (tx) => {
    // Try to increment existing sequence
    const existing = await tx.documentSequence.findUnique({
      where: {
        tenantId_prefix_year: { tenantId, prefix, year },
      },
    });

    if (existing) {
      const updated = await tx.documentSequence.update({
        where: { id: existing.id },
        data: { lastSeq: { increment: 1 } },
      });
      return updated.lastSeq;
    }

    // Create new sequence for this tenant+prefix+year
    const created = await tx.documentSequence.create({
      data: {
        tenantId,
        prefix,
        year,
        lastSeq: 1,
      },
    });
    return created.lastSeq;
  });

  const paddedSeq = String(sequence).padStart(5, "0");
  return tenantCode
    ? `${tenantCode}-${prefix}-${year}-${paddedSeq}`
    : `${prefix}-${year}-${paddedSeq}`;
}

/**
 * Pure helper — build a preview doc number without hitting the DB.
 * Used by the settings UI to show "next invoice will look like X"
 * when the tenant is editing their code.
 */
export function previewDocNumber(
  tenantCode: string | null | undefined,
  prefix: string,
  seq = 1,
  year: number = new Date().getFullYear(),
): string {
  const paddedSeq = String(seq).padStart(5, "0");
  const code = tenantCode?.trim() || null;
  return code
    ? `${code}-${prefix}-${year}-${paddedSeq}`
    : `${prefix}-${year}-${paddedSeq}`;
}

// ─── Document prefix constants ───────────────────
export const DOC_PREFIX = {
  QUOTATION: "QT",
  SALES_ORDER: "SO",
  INVOICE_VAT: "INV",       // ใบแจ้งหนี้ (มี VAT)
  INVOICE_NON_VAT: "BIL",   // ใบเรียกเก็บเงิน (ไม่มี VAT)
  TAX_INVOICE: "TI",        // ใบกำกับภาษี (เฉพาะลูกค้า VAT)
  RECEIPT_VAT: "RC",        // ใบเสร็จ (มี VAT)
  RECEIPT_NON_VAT: "RN",    // ใบเสร็จ (ไม่มี VAT)
  CREDIT_NOTE_VAT: "CN",    // ใบลดหนี้ (มี VAT)
  CREDIT_NOTE_NON_VAT: "CNB", // ใบลดหนี้ (ไม่มี VAT)
  PAYMENT: "PAY",
  PRODUCTION_PLAN: "PP",
  WORK_ORDER: "WO",
  PURCHASE_ORDER: "PO",
} as const;

/** Pick invoice prefix based on customer VAT status */
export function invoicePrefix(isVatRegistered: boolean): string {
  return isVatRegistered ? DOC_PREFIX.INVOICE_VAT : DOC_PREFIX.INVOICE_NON_VAT;
}

/** Pick receipt prefix based on customer VAT status */
export function receiptPrefix(isVatRegistered: boolean): string {
  return isVatRegistered ? DOC_PREFIX.RECEIPT_VAT : DOC_PREFIX.RECEIPT_NON_VAT;
}

/** Pick credit note prefix based on customer VAT status */
export function creditNotePrefix(isVatRegistered: boolean): string {
  return isVatRegistered ? DOC_PREFIX.CREDIT_NOTE_VAT : DOC_PREFIX.CREDIT_NOTE_NON_VAT;
}
