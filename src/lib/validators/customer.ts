import { z } from "zod";
import { JURISTIC_TYPES, INDIVIDUAL_TITLES } from "@/lib/customer-name";
import { billingNatureEnum } from "./billing-nature";

export { billingNatureEnum };

export const juristicTypeEnum = z.enum(JURISTIC_TYPES);
export const individualTitleEnum = z.enum(INDIVIDUAL_TITLES);

const optionalIndividualTitle = z
  .union([individualTitleEnum, z.literal(""), z.undefined()])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v));

const optionalTrimmedString = z
  .union([z.string(), z.undefined()])
  .optional()
  .transform((v) => {
    const trimmed = v?.trim();
    return trimmed ? trimmed : undefined;
  });

const optionalThaiPostalCode = z
  .union([z.string(), z.undefined()])
  .optional()
  .transform((v) => {
    const trimmed = v?.trim();
    return trimmed ? trimmed : undefined;
  });

const customerBaseSchema = z.object({
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
  billingSubdistrict: optionalTrimmedString,
  billingDistrict: optionalTrimmedString,
  billingProvince: optionalTrimmedString,
  billingPostalCode: optionalThaiPostalCode,
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
  individualTitle: optionalIndividualTitle,
  individualTitleOther: z.string().optional(),
  // Tax policy — Phase 8A
  /// ลูกค้ารายนี้หัก ณ ที่จ่าย 3% หรือไม่ (default false = ขายสินค้าไม่หัก)
  withholdsTax: z.boolean().optional().default(false),
  /// ประเภทเอกสารเริ่มต้นของลูกค้ารายนี้
  defaultBillingNature: billingNatureEnum.optional().default("GOODS"),
  /// OEM branding defaults — Phase 8.9
  /// ถ้า customer ติดโลโก้บนสินค้า เก็บ default ไว้ที่ระดับลูกค้า
  /// แล้วใช้ auto-fill ในใบเสนอราคา/ใบสั่งซื้อ/Invoice ต่อบรรทัด
  brandingAssets: z
    .object({
      defaultMark: z.string().optional(),
      logoUrl: z.string().optional(),
      notes: z.string().optional(),
    })
    .partial()
    .nullable()
    .optional(),
});

function validateIndividualTitleOther(
  data: {
    juristicType?: string;
    individualTitle?: string;
    individualTitleOther?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (
    data.juristicType === "INDIVIDUAL" &&
    data.individualTitle === "OTHER" &&
    !data.individualTitleOther?.trim()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["individualTitleOther"],
      message: "Required when title is other",
    });
  }
}

function validateStructuredBillingAddress(
  data: {
    country?: string;
    billingSubdistrict?: string;
    billingDistrict?: string;
    billingProvince?: string;
    billingPostalCode?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (data.country && data.country !== "TH") return;

  const structuredFields = {
    billingSubdistrict: data.billingSubdistrict,
    billingDistrict: data.billingDistrict,
    billingProvince: data.billingProvince,
    billingPostalCode: data.billingPostalCode,
  };
  const hasAny = Object.values(structuredFields).some((value) => !!value?.trim());
  if (!hasAny) return;

  if (data.billingPostalCode && !/^\d{5}$/.test(data.billingPostalCode)) {
    ctx.addIssue({
      code: "custom",
      path: ["billingPostalCode"],
      message: "รหัสไปรษณีย์ต้องมี 5 หลัก",
    });
  }

  for (const [field, value] of Object.entries(structuredFields)) {
    if (!value?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: "Required when Thai structured billing address is provided",
      });
    }
  }
}

function normalizeIndividualTitleFields<T extends {
  juristicType?: string;
  individualTitle?: string;
  individualTitleOther?: string;
}>(data: T): T {
  if (data.juristicType !== "INDIVIDUAL") {
    return {
      ...data,
      individualTitle: undefined,
      individualTitleOther: undefined,
    };
  }

  return {
    ...data,
    individualTitleOther: data.individualTitleOther?.trim() || undefined,
  };
}

export const customerCreateSchema = customerBaseSchema
  .superRefine(validateStructuredBillingAddress)
  .superRefine(validateIndividualTitleOther)
  .transform(normalizeIndividualTitleFields);

export const customerUpdateSchema = customerBaseSchema
  .partial()
  .omit({ code: true })
  .superRefine(validateStructuredBillingAddress)
  .superRefine(validateIndividualTitleOther)
  .transform(normalizeIndividualTitleFields);

// Form uses the input type (allows "" for juristicType); server POST handler
// receives the output type after zod parse has transformed "" → undefined.
export type CustomerCreateInput = z.input<typeof customerCreateSchema>;
export type CustomerCreateParsed = z.output<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.input<typeof customerUpdateSchema>;
