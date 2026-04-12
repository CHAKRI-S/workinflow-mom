import { z } from "zod";

export const salesOrderLineSchema = z.object({
  productId: z.string().min(1, "Required"),
  description: z.string().optional(),
  quantity: z.number().positive("Must be > 0"),
  color: z.string().optional(),
  surfaceFinish: z.string().optional(),
  materialSpec: z.string().optional(),
  unitPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100),
  notes: z.string().optional(),
  sortOrder: z.number().int(),
});

export const salesOrderCreateSchema = z.object({
  customerId: z.string().min(1, "Required"),
  quotationId: z.string().optional(),
  customerPoNumber: z.string().optional(),
  requestedDate: z.string().min(1, "Required"),
  promisedDate: z.string().optional(),
  shippingAddress: z.string().optional(),
  depositPercent: z.number().min(0).max(100),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  lines: z.array(salesOrderLineSchema).min(1, "At least one line required"),
});

export const salesOrderUpdateSchema = salesOrderCreateSchema.partial();

export type SalesOrderLineInput = z.infer<typeof salesOrderLineSchema>;
export type SalesOrderCreateInput = z.infer<typeof salesOrderCreateSchema>;
export type SalesOrderUpdateInput = z.infer<typeof salesOrderUpdateSchema>;
