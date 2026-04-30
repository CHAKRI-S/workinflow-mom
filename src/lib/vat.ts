export const VAT_PRICE_MODES = ["EXCLUSIVE", "INCLUSIVE"] as const;
export const VAT_MODE_POLICIES = [
  "PER_LINE",
  "FORCE_EXCLUSIVE",
  "FORCE_INCLUSIVE",
] as const;

export type VatPriceMode = (typeof VAT_PRICE_MODES)[number];
export type VatModePolicy = (typeof VAT_MODE_POLICIES)[number];

export interface VatLineInput {
  quantity: number;
  unitPrice?: number | null;
  enteredUnitPrice?: number | null;
  discountPercent?: number | null;
  vatPriceMode?: VatPriceMode | null;
}

export interface VatLineResult {
  enteredUnitPrice: number;
  unitPrice: number;
  vatPriceMode: VatPriceMode;
  quantity: number;
  discountPercent: number;
  lineTotal: number;
  grossLineTotal: number;
  vatAmount: number;
}

export interface VatTotalsResult {
  lines: VatLineResult[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxableAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  modeSummary: Record<VatPriceMode, { count: number; subtotal: number }>;
}

export function roundCurrency(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function normalizeVatPriceMode(
  value: unknown,
  fallback: VatPriceMode = "EXCLUSIVE",
): VatPriceMode {
  return value === "INCLUSIVE" || value === "EXCLUSIVE" ? value : fallback;
}

export function normalizeVatModePolicy(
  value: unknown,
  fallback: VatModePolicy = "PER_LINE",
): VatModePolicy {
  return value === "PER_LINE" ||
    value === "FORCE_EXCLUSIVE" ||
    value === "FORCE_INCLUSIVE"
    ? value
    : fallback;
}

export function resolveVatPriceMode(
  policy: VatModePolicy,
  lineMode?: VatPriceMode | null,
): VatPriceMode {
  if (policy === "FORCE_EXCLUSIVE") return "EXCLUSIVE";
  if (policy === "FORCE_INCLUSIVE") return "INCLUSIVE";
  return normalizeVatPriceMode(lineMode);
}

export function calculateVatLine(
  line: VatLineInput,
  vatRate: number,
  vatModePolicy: VatModePolicy = "PER_LINE",
): VatLineResult {
  const quantity = Number(line.quantity) || 0;
  const enteredUnitPrice =
    Number(line.enteredUnitPrice ?? line.unitPrice ?? 0) || 0;
  const discountPercent = Number(line.discountPercent ?? 0) || 0;
  const vatPriceMode = resolveVatPriceMode(vatModePolicy, line.vatPriceMode);
  const rateMultiplier = 1 + (Number(vatRate) || 0) / 100;

  if (vatPriceMode === "INCLUSIVE" && rateMultiplier > 1) {
    const grossBeforeDiscount = enteredUnitPrice * quantity;
    const grossDiscount = grossBeforeDiscount * (discountPercent / 100);
    const grossLineTotal = roundCurrency(grossBeforeDiscount - grossDiscount);
    const lineTotal = roundCurrency(grossLineTotal / rateMultiplier);
    return {
      enteredUnitPrice: roundCurrency(enteredUnitPrice),
      unitPrice: roundCurrency(enteredUnitPrice / rateMultiplier),
      vatPriceMode,
      quantity,
      discountPercent,
      lineTotal,
      grossLineTotal,
      vatAmount: roundCurrency(grossLineTotal - lineTotal),
    };
  }

  const lineSubtotal = enteredUnitPrice * quantity;
  const lineDiscount = lineSubtotal * (discountPercent / 100);
  const lineTotal = roundCurrency(lineSubtotal - lineDiscount);
  const vatAmount = roundCurrency(lineTotal * ((Number(vatRate) || 0) / 100));

  return {
    enteredUnitPrice: roundCurrency(enteredUnitPrice),
    unitPrice: roundCurrency(enteredUnitPrice),
    vatPriceMode,
    quantity,
    discountPercent,
    lineTotal,
    grossLineTotal: roundCurrency(lineTotal + vatAmount),
    vatAmount,
  };
}

export function calculateVatTotals(
  lines: VatLineInput[],
  params: {
    vatRate: number;
    vatModePolicy?: VatModePolicy | null;
    discountPercent?: number | null;
  },
): VatTotalsResult {
  const vatRate = Number(params.vatRate) || 0;
  const vatModePolicy = normalizeVatModePolicy(params.vatModePolicy);
  const discountPercent = Number(params.discountPercent ?? 0) || 0;
  const calculatedLines = lines.map((line) =>
    calculateVatLine(line, vatRate, vatModePolicy),
  );
  const subtotal = roundCurrency(
    calculatedLines.reduce((sum, line) => sum + line.lineTotal, 0),
  );
  const discountAmount = roundCurrency(subtotal * (discountPercent / 100));
  const taxableAmount = roundCurrency(subtotal - discountAmount);
  const vatAmount = roundCurrency(taxableAmount * (vatRate / 100));
  const totalAmount = roundCurrency(taxableAmount + vatAmount);
  const modeSummary: VatTotalsResult["modeSummary"] = {
    EXCLUSIVE: { count: 0, subtotal: 0 },
    INCLUSIVE: { count: 0, subtotal: 0 },
  };

  for (const line of calculatedLines) {
    const summary = modeSummary[line.vatPriceMode];
    summary.count += 1;
    summary.subtotal = roundCurrency(summary.subtotal + line.lineTotal);
  }

  return {
    lines: calculatedLines,
    subtotal,
    discountPercent,
    discountAmount,
    taxableAmount,
    vatRate,
    vatAmount,
    totalAmount,
    modeSummary,
  };
}
