export type ProductKind = "GOODS" | "SERVICE";
export type BillingNature = "GOODS" | "MANUFACTURING_SERVICE" | "MIXED";

export function billingNatureFromProductKind(
  kind: ProductKind | null | undefined,
): Exclude<BillingNature, "MIXED"> {
  return kind === "SERVICE" ? "MANUFACTURING_SERVICE" : "GOODS";
}

export function deriveDocumentBillingNature(
  lines: { productKind?: ProductKind | null }[],
): BillingNature {
  if (!lines.length) return "GOODS";

  const natures = lines.map((line) =>
    billingNatureFromProductKind(line.productKind),
  );

  if (natures.every((nature) => nature === "GOODS")) return "GOODS";
  if (natures.every((nature) => nature === "MANUFACTURING_SERVICE")) {
    return "MANUFACTURING_SERVICE";
  }

  return "MIXED";
}
