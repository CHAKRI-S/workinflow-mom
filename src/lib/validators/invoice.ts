import { z } from "zod";
import { billingNatureEnum, lineTaxFieldsSchema } from "./billing-nature";

export const invoiceTypeEnum = z.enum([
  "DEPOSIT",
  "FULL",
  "REMAINING",
  "PARTIAL",
]);

export const invoiceLineSchema = z
  .object({
    salesOrderLineId: z.string().nullable().optional(),
    description: z.string().min(1, "Required"),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
    notes: z.string().nullable().optional(),
    sortOrder: z.number().int(),
  })
  .merge(lineTaxFieldsSchema);

export const invoiceCreateSchema = z.object({
  salesOrderId: z.string().min(1, "Required"),
  invoiceType: invoiceTypeEnum,
  dueDate: z.string().min(1, "Required"),
  billingNature: billingNatureEnum.optional().default("GOODS"),
  notes: z.string().optional(),
  lines: z.array(invoiceLineSchema).min(1, "At least one line required"),
});

/// สำหรับ PATCH /invoices/[id] — แก้ไขได้เฉพาะ DRAFT
/// รับ billingNature + lines override (drawingSource, productCode ฯลฯ) ที่ระดับ line
export const invoiceUpdateSchema = z.object({
  dueDate: z.string().optional(),
  notes: z.string().nullable().optional(),
  billingNature: billingNatureEnum.optional(),
  lines: z
    .array(
      z
        .object({
          id: z.string(), // existing InvoiceLine id
        })
        .merge(lineTaxFieldsSchema)
    )
    .optional(),
  status: z.string().optional(),
  cancelReason: z.string().optional(),
});

export type InvoiceLineInput = z.input<typeof invoiceLineSchema>;
export type InvoiceCreateInput = z.input<typeof invoiceCreateSchema>;
export type InvoiceUpdateInput = z.input<typeof invoiceUpdateSchema>;
