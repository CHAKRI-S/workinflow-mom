import { z } from "zod";
import { billingNatureEnum, lineTaxFieldsSchema } from "./billing-nature";

export const quotationLineSchema = z
  .object({
    productId: z.string().min(1, "Required"),
    description: z.string().optional(),
    quantity: z.number().positive("Must be > 0"),
    color: z.string().optional(),
    surfaceFinish: z.string().optional(),
    materialSpec: z.string().optional(),
    unitPrice: z.number().min(0, "Must be >= 0"),
    discountPercent: z.number().min(0).max(100),
    notes: z.string().optional(),
    sortOrder: z.number().int(),
  })
  .merge(lineTaxFieldsSchema);

export const quotationCreateSchema = z.object({
  customerId: z.string().min(1, "Required"),
  validUntil: z.string().min(1, "Required"),
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  leadTimeDays: z.number().int().min(0).optional(),
  discountPercent: z.number().min(0).max(100),
  billingNature: billingNatureEnum.optional().default("GOODS"),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  lines: z.array(quotationLineSchema).min(1, "At least one line required"),
});

export const quotationUpdateSchema = quotationCreateSchema.partial();

export type QuotationLineInput = z.input<typeof quotationLineSchema>;
export type QuotationCreateInput = z.input<typeof quotationCreateSchema>;
export type QuotationUpdateInput = z.input<typeof quotationUpdateSchema>;
