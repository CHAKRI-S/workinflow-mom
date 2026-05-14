import { z } from "zod";
import { documentTaxAndCurrencySchema } from "./document-fields";
import { VAT_MODE_POLICIES, VAT_PRICE_MODES } from "@/lib/vat";

export const invoiceTypeEnum = z.enum([
  "DEPOSIT",
  "FULL",
  "REMAINING",
  "PARTIAL",
]);

export const invoiceLineSchema = z.object({
  salesOrderLineId: z.string().nullable().optional(),
  description: z.string().min(1, "Required"),
  quantity: z.number().positive(),
  enteredUnitPrice: z.number().min(0).optional(),
  unitPrice: z.number().min(0),
  vatPriceMode: z.enum(VAT_PRICE_MODES).optional().default("EXCLUSIVE"),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int(),
});

export const invoiceCreateSchema = z
  .object({
  salesOrderId: z.string().min(1, "Required"),
  invoiceType: invoiceTypeEnum,
  dueDate: z.string().min(1, "Required"),
  vatModePolicy: z.enum(VAT_MODE_POLICIES).optional().default("PER_LINE"),
  notes: z.string().optional(),
  lines: z.array(invoiceLineSchema).min(1, "At least one line required"),
})
  .merge(documentTaxAndCurrencySchema);

/// สำหรับ PATCH /invoices/[id] — แก้ไขได้เฉพาะ DRAFT
/// ไม่รับ billing/drawing classification overrides; snapshots derive from SO/Product only.
export const invoiceUpdateSchema = z
  .object({
  dueDate: z.string().optional(),
  notes: z.string().nullable().optional(),
  status: z.string().optional(),
  cancelReason: z.string().optional(),
})
  .merge(documentTaxAndCurrencySchema.partial());

export type InvoiceLineInput = z.input<typeof invoiceLineSchema>;
export type InvoiceCreateInput = z.input<typeof invoiceCreateSchema>;
export type InvoiceUpdateInput = z.input<typeof invoiceUpdateSchema>;
