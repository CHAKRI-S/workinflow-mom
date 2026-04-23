import { z } from "zod";

/** WHT certificate status (matches Prisma enum). */
export const whtCertStatusEnum = z.enum([
  "NOT_APPLICABLE",
  "PENDING",
  "RECEIVED",
  "VERIFIED",
  "MISSING_OVERDUE",
]);

export type WhtCertStatus = z.infer<typeof whtCertStatusEnum>;

/**
 * POST /api/finance/receipts — create receipt.
 *
 * Frontend sends gross (pre-WHT) amount + payer info + optional WHT fields.
 * Backend snapshots invoice.billingNature, auto-computes WHT based on
 * customer.withholdsTax AND billingNature (MANUFACTURING_SERVICE / MIXED).
 * Net amount (what tenant actually receives) = gross − whtAmount.
 */
export const receiptCreateSchema = z.object({
  invoiceId: z.string().min(1),
  /** Gross amount ก่อนหัก ณ ที่จ่าย (ปกติ = invoice.totalAmount หรือ partial) */
  grossAmount: z.number().positive(),
  payerName: z.string().min(1),
  payerTaxId: z.string().nullable().optional(),
  payerAddress: z.string().nullable().optional(),
  /** Manual override. Default = auto-compute from invoice snapshot */
  whtRateOverride: z.number().min(0).max(100).optional(),
  /** ถ้ารับ cert มาพร้อมออก receipt เลย (optional) */
  whtCertNumber: z.string().optional(),
  whtCertFileUrl: z.string().optional(), // R2 object key
  whtCertReceivedAt: z.string().optional(), // ISO date
  /** ใบเสร็จเงินมัดจำ — ข้าม WHT (มัดจำยังไม่ใช่รายได้ค่าบริการ) */
  isDeposit: z.boolean().optional(),
  notes: z.string().optional(),
});

export type ReceiptCreateInput = z.input<typeof receiptCreateSchema>;

/** PATCH /api/finance/receipts/[id] — update WHT cert only (post-issue) */
export const receiptCertUpdateSchema = z.object({
  whtCertNumber: z.string().nullable().optional(),
  whtCertFileUrl: z.string().nullable().optional(),
  whtCertReceivedAt: z.string().nullable().optional(),
  whtCertStatus: whtCertStatusEnum.optional(),
});

export type ReceiptCertUpdateInput = z.input<typeof receiptCertUpdateSchema>;

/** Core math: compute WHT amount + net */
export function computeWht(params: {
  grossAmount: number;
  whtRate: number; // percent, e.g. 3
}): { whtAmount: number; netAmount: number } {
  const { grossAmount, whtRate } = params;
  const whtAmount = Math.round((grossAmount * whtRate) / 100 * 100) / 100; // 2dp
  const netAmount = Math.round((grossAmount - whtAmount) * 100) / 100;
  return { whtAmount, netAmount };
}

/**
 * Decide default WHT rate + initial cert status at receipt creation.
 *
 * Returns:
 *   - whtRate: 0 | 3 (or override)
 *   - initialStatus: NOT_APPLICABLE | PENDING (becomes RECEIVED if cert provided)
 */
export function resolveWhtPolicy(params: {
  billingNature: "GOODS" | "MANUFACTURING_SERVICE" | "MIXED";
  customerWithholdsTax: boolean;
  override?: number;
  hasCert: boolean;
  /** ISO-3166 alpha-2 (เช่น "TH", "US"). ประเทศอื่นไม่หัก WHT ไทย */
  customerCountry?: string;
  /** ใบเสร็จเงินมัดจำ — ยังไม่ใช่รายได้ค่าบริการ จึงไม่หัก WHT */
  isDeposit?: boolean;
}): { whtRate: number; certStatus: WhtCertStatus } {
  const {
    billingNature,
    customerWithholdsTax,
    override,
    hasCert,
    customerCountry,
    isDeposit,
  } = params;

  // Short-circuit: มัดจำไม่หัก WHT (ไม่ว่า override จะเป็นอะไร)
  if (isDeposit === true) {
    return { whtRate: 0, certStatus: "NOT_APPLICABLE" };
  }

  // Short-circuit: ลูกค้าต่างชาติไม่หัก WHT ไทย
  if (customerCountry && customerCountry !== "TH") {
    return { whtRate: 0, certStatus: "NOT_APPLICABLE" };
  }

  if (override !== undefined) {
    if (override === 0) {
      return { whtRate: 0, certStatus: "NOT_APPLICABLE" };
    }
    return {
      whtRate: override,
      certStatus: hasCert ? "RECEIVED" : "PENDING",
    };
  }

  const applies =
    customerWithholdsTax &&
    (billingNature === "MANUFACTURING_SERVICE" || billingNature === "MIXED");

  if (!applies) {
    return { whtRate: 0, certStatus: "NOT_APPLICABLE" };
  }

  return {
    whtRate: 3,
    certStatus: hasCert ? "RECEIVED" : "PENDING",
  };
}
