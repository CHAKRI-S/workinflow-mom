import { z } from "zod";

export const customerCreateSchema = z.object({
  code: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  customerType: z.enum(["OEM", "DEALER", "END_USER", "OTHER"]),
  contactName: z.string().optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().optional(),
  lineId: z.string().optional(),
  taxId: z.string().optional(),
  billingAddress: z.string().optional(),
  shippingAddress: z.string().optional(),
  isVatRegistered: z.boolean(),
  paymentTermDays: z.number().int().min(0),
  creditLimit: z.union([z.number().min(0), z.nan()]).optional(),
});

export const customerUpdateSchema = customerCreateSchema.partial().omit({ code: true });

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
