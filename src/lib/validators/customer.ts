import { z } from "zod";

export const juristicTypeEnum = z.enum([
  "COMPANY_LTD",
  "PUBLIC_CO",
  "LIMITED_PARTNERSHIP",
  "FOUNDATION",
  "ASSOCIATION",
  "JOINT_VENTURE",
  "OTHER_JURISTIC",
  "INDIVIDUAL",
]);

export const customerCreateSchema = z.object({
  // Optional — auto-generated server-side when blank/omitted
  code: z.string().optional(),
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
  // Juristic / RD lookup fields
  // Accept "" from form defaults then transform to undefined
  juristicType: z
    .union([juristicTypeEnum, z.literal(""), z.undefined()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  branchNo: z.string().optional(),
  country: z.string().optional(),
});

export const customerUpdateSchema = customerCreateSchema.partial().omit({ code: true });

// Form uses the input type (allows "" for juristicType); server POST handler
// receives the output type after zod parse has transformed "" → undefined.
export type CustomerCreateInput = z.input<typeof customerCreateSchema>;
export type CustomerCreateParsed = z.output<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.input<typeof customerUpdateSchema>;
