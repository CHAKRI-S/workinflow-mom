import type { VatModePolicy } from "@/lib/vat";

export const DOCUMENT_TAX_TYPES = [
  "VAT_INCLUSIVE",
  "VAT_EXCLUSIVE",
  "NO_VAT",
] as const;

export type DocumentTaxType = (typeof DOCUMENT_TAX_TYPES)[number];

export const TAX_TYPE_OPTIONS = [
  {
    value: "VAT_INCLUSIVE",
    labelTh: "รวม VAT",
    descriptionTh: "ราคาสินค้ารวม VAT แล้ว",
  },
  {
    value: "VAT_EXCLUSIVE",
    labelTh: "แยก VAT",
    descriptionTh: "บวก VAT เพิ่มจากราคาสินค้า",
  },
  {
    value: "NO_VAT",
    labelTh: "ไม่มี VAT",
    descriptionTh: "ไม่คิด VAT",
  },
] as const satisfies readonly {
  value: DocumentTaxType;
  labelTh: string;
  descriptionTh: string;
}[];

export interface TaxCalculation {
  vatRate: number;
  vatModePolicy: VatModePolicy;
}

export interface LegacyVatInput {
  vatRate?: number | string | null;
  vatModePolicy?: VatModePolicy | string | null;
}

export function isDocumentTaxType(value: unknown): value is DocumentTaxType {
  return (
    typeof value === "string" &&
    (DOCUMENT_TAX_TYPES as readonly string[]).includes(value)
  );
}

export function normalizeDocumentTaxType(
  value: unknown,
  fallback: DocumentTaxType = "VAT_EXCLUSIVE",
): DocumentTaxType {
  return isDocumentTaxType(value) ? value : fallback;
}

export function getTaxTypeLabelTh(value: unknown): string {
  const taxType = normalizeDocumentTaxType(value);
  return TAX_TYPE_OPTIONS.find((option) => option.value === taxType)?.labelTh ?? "แยก VAT";
}

export function resolveTaxCalculation(
  taxType: DocumentTaxType,
  tenantVatRate = 7,
): TaxCalculation {
  if (taxType === "NO_VAT") {
    return { vatRate: 0, vatModePolicy: "FORCE_EXCLUSIVE" };
  }

  return {
    vatRate: Number(tenantVatRate) || 7,
    vatModePolicy:
      taxType === "VAT_INCLUSIVE" ? "FORCE_INCLUSIVE" : "FORCE_EXCLUSIVE",
  };
}

export function deriveTaxTypeFromLegacyVat(input: LegacyVatInput): DocumentTaxType {
  if ((Number(input.vatRate) || 0) <= 0) {
    return "NO_VAT";
  }

  if (input.vatModePolicy === "FORCE_INCLUSIVE") {
    return "VAT_INCLUSIVE";
  }

  return "VAT_EXCLUSIVE";
}
