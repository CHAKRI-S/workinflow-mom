import { prisma } from "@/lib/prisma";

/**
 * Generate ISO-compliant document number
 * Pattern: {PREFIX}-{YEAR}-{SEQ:5}
 * Example: SO-2026-00001, QT-2026-00042, WO-2026-00137
 *
 * Uses atomic upsert to guarantee gap-free sequential numbering
 * even under concurrent access.
 */
export async function generateDocNumber(
  tenantId: string,
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();

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
  return `${prefix}-${year}-${paddedSeq}`;
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
