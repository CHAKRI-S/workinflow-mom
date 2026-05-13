import { z } from "zod";
import { billingNatureEnum, lineTaxFieldsSchema } from "./billing-nature";
import { documentTaxAndCurrencySchema, documentTaxAndCurrencyUpdateSchema } from "./document-fields";
import { VAT_MODE_POLICIES, VAT_PRICE_MODES } from "@/lib/vat";

export const salesOrderLineSchema = z
  .object({
    productId: z.string().min(1, "Required"),
    description: z.string().optional(),
    quantity: z.number().positive("Must be > 0"),
    color: z.string().optional(),
    surfaceFinish: z.string().optional(),
    materialSpec: z.string().optional(),
    enteredUnitPrice: z.number().min(0).optional(),
    unitPrice: z.number().min(0),
    vatPriceMode: z.enum(VAT_PRICE_MODES).optional().default("EXCLUSIVE"),
    discountPercent: z.number().min(0).max(100),
    notes: z.string().optional(),
    sortOrder: z.number().int(),
  })
  .merge(lineTaxFieldsSchema);

const salesOrderBaseSchema = z.object({
  customerId: z.string().min(1, "Required"),
  quotationId: z.string().optional(),
  customerPoNumber: z.string().optional(),
  requestedDate: z.string().min(1, "Required"),
  promisedDate: z.string().optional(),
  shippingAddress: z.string().optional(),
  depositPercent: z.number().min(0).max(100),
  paymentTerms: z.string().optional(),
  vatModePolicy: z.enum(VAT_MODE_POLICIES).optional().default("PER_LINE"),
  billingNature: billingNatureEnum.optional().default("GOODS"),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  lines: z.array(salesOrderLineSchema).min(1, "At least one line required"),
});

const salesOrderUpdateBaseSchema = z.object({
  customerId: z.string().min(1, "Required").optional(),
  quotationId: z.string().optional(),
  customerPoNumber: z.string().optional(),
  requestedDate: z.string().min(1, "Required").optional(),
  promisedDate: z.string().optional(),
  shippingAddress: z.string().optional(),
  depositPercent: z.number().min(0).max(100).optional(),
  paymentTerms: z.string().optional(),
  vatModePolicy: z.enum(VAT_MODE_POLICIES).optional(),
  billingNature: billingNatureEnum.optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  lines: z.array(salesOrderLineSchema).min(1, "At least one line required").optional(),
});

export const salesOrderCreateSchema = salesOrderBaseSchema.merge(documentTaxAndCurrencySchema);

export const salesOrderUpdateSchema = salesOrderUpdateBaseSchema.merge(documentTaxAndCurrencyUpdateSchema);

export type SalesOrderLineInput = z.input<typeof salesOrderLineSchema>;
export type SalesOrderCreateInput = z.input<typeof salesOrderCreateSchema>;
export type SalesOrderUpdateInput = z.input<typeof salesOrderUpdateSchema>;
