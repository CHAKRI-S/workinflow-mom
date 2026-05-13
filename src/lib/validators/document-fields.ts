import { z } from "zod";

import { CURRENCY_OPTIONS, normalizeCurrencyCode } from "@/lib/currency";
import { DOCUMENT_TAX_TYPES } from "@/lib/tax-type";

export const documentTaxTypeEnum = z.enum(DOCUMENT_TAX_TYPES);

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (value) => CURRENCY_OPTIONS.some((option) => option.code === value),
    "Unsupported currency",
  )
  .transform((value) => normalizeCurrencyCode(value));

export const documentTaxAndCurrencySchema = z.object({
  taxType: documentTaxTypeEnum.optional().default("VAT_EXCLUSIVE"),
  currencyCode: currencyCodeSchema.optional().default("THB"),
});

export const documentTaxAndCurrencyUpdateSchema = z.object({
  taxType: documentTaxTypeEnum.optional(),
  currencyCode: currencyCodeSchema.optional(),
});

export type DocumentTaxTypeInput = z.input<typeof documentTaxTypeEnum>;
export type CurrencyCodeInput = z.input<typeof currencyCodeSchema>;
