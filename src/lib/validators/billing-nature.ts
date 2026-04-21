import { z } from "zod";

/// ต้อง sync กับ Prisma enum BillingNature
export const billingNatureEnum = z.enum([
  "GOODS", // ขายสินค้า (default)
  "MANUFACTURING_SERVICE", // รับจ้างทำของ (WHT 3%)
  "MIXED", // ผสม — ระบุ nature ต่อ line
]);

/// ต้อง sync กับ Prisma enum DrawingSource
export const drawingSourceEnum = z.enum([
  "TENANT_OWNED", // tenant ออกแบบเอง → GOODS
  "CUSTOMER_PROVIDED", // ลูกค้าเอาแบบมา → MANUFACTURING_SERVICE
  "JOINT_DEVELOPMENT", // ร่วมพัฒนา (ดู contract)
]);

export type BillingNature = z.infer<typeof billingNatureEnum>;
export type DrawingSource = z.infer<typeof drawingSourceEnum>;

/// Common line-level tax/drawing fields — ใช้ร่วมกันใน Quotation/SalesOrder/Invoice line schemas
export const lineTaxFieldsSchema = z.object({
  drawingSource: drawingSourceEnum.optional().default("TENANT_OWNED"),
  lineBillingNature: billingNatureEnum.optional(),
  productCode: z.string().optional(),
  drawingRevision: z.string().optional(),
  customerDrawingUrl: z.string().optional(),
  customerBranding: z
    .object({
      logoUrl: z.string().optional(),
      markingMethod: z.string().optional(),
      position: z.string().optional(),
    })
    .partial()
    .optional(),
});

/// Auto-suggest billing nature จาก line drawing sources
export function suggestBillingNature(
  lines: { drawingSource?: DrawingSource }[]
): BillingNature {
  if (!lines.length) return "GOODS";
  const sources = lines.map((l) => l.drawingSource ?? "TENANT_OWNED");
  const allTenant = sources.every((s) => s === "TENANT_OWNED");
  const allCustomer = sources.every((s) => s === "CUSTOMER_PROVIDED");
  if (allTenant) return "GOODS";
  if (allCustomer) return "MANUFACTURING_SERVICE";
  return "MIXED";
}
