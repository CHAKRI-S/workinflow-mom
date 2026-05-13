import { normalizeCurrencyCode, type CurrencyCode } from "@/lib/currency";
import {
  normalizeDocumentTaxType,
  resolveTaxCalculation,
  type DocumentTaxType,
} from "@/lib/tax-type";
import {
  calculateVatTotals,
  type VatLineInput,
  type VatModePolicy,
  type VatTotalsResult,
} from "@/lib/vat";

export interface DocumentTaxCurrencyInput {
  taxType?: DocumentTaxType | string | null;
  currencyCode?: string | null;
}

export interface CalculateDocumentTotalsInput extends DocumentTaxCurrencyInput {
  lines: VatLineInput[];
  discountPercent?: number | null;
  tenantVatRate?: number | null;
}

export interface DocumentTotalsResult extends VatTotalsResult {
  taxType: DocumentTaxType;
  currencyCode: CurrencyCode;
  vatModePolicy: VatModePolicy;
}

export function inheritDocumentTaxAndCurrency({
  source,
  override,
}: {
  source?: DocumentTaxCurrencyInput | null;
  override?: DocumentTaxCurrencyInput | null;
}): { taxType: DocumentTaxType; currencyCode: CurrencyCode } {
  return {
    taxType: normalizeDocumentTaxType(override?.taxType ?? source?.taxType),
    currencyCode: normalizeCurrencyCode(override?.currencyCode ?? source?.currencyCode),
  };
}

export function calculateDocumentTotals({
  taxType: rawTaxType,
  currencyCode: rawCurrencyCode,
  lines,
  discountPercent,
  tenantVatRate,
}: CalculateDocumentTotalsInput): DocumentTotalsResult {
  const taxType = normalizeDocumentTaxType(rawTaxType);
  const currencyCode = normalizeCurrencyCode(rawCurrencyCode);
  const taxCalculation = resolveTaxCalculation(taxType, tenantVatRate ?? undefined);
  const totals = calculateVatTotals(lines, {
    vatRate: taxCalculation.vatRate,
    vatModePolicy: taxCalculation.vatModePolicy,
    discountPercent,
  });

  return {
    ...totals,
    taxType,
    currencyCode,
    vatModePolicy: taxCalculation.vatModePolicy,
  };
}
