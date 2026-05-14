import {
  billingNatureFromProductKind,
  deriveDocumentBillingNature,
  type BillingNature,
  type ProductKind,
} from "@/lib/product-billing";
import type { DrawingSource } from "@/lib/validators/billing-nature";

export class ProductSnapshotLookupError extends Error {
  constructor(productId: string) {
    super(`Product not found or inactive for document line: ${productId}`);
    this.name = "ProductSnapshotLookupError";
  }
}

export type ProductSnapshotSource = {
  id: string;
  code: string;
  productKind?: ProductKind | null;
  drawingSource?: DrawingSource | null;
  drawingRevision?: string | null;
  customerDrawingUrl?: string | null;
  fusionFileUrl?: string | null;
};

type DocumentLineWithProductId = {
  productId: string;
};

export type LineProductSnapshot = {
  drawingSource: DrawingSource;
  lineBillingNature: Exclude<BillingNature, "MIXED">;
  productCode: string;
  drawingRevision: string | null;
  customerDrawingUrl: string | null;
};

export function applyProductSnapshotsToDocumentLines<
  TLine extends DocumentLineWithProductId,
>({
  lines,
  products,
}: {
  lines: TLine[];
  products: ProductSnapshotSource[];
}): {
  lines: Array<TLine & LineProductSnapshot>;
  billingNature: BillingNature;
} {
  const productById = new Map(products.map((product) => [product.id, product]));

  const linesWithSnapshots = lines.map((line) => {
    const product = productById.get(line.productId);
    if (!product) {
      throw new ProductSnapshotLookupError(line.productId);
    }

    return {
      ...line,
      drawingSource: product.drawingSource ?? "TENANT_OWNED",
      lineBillingNature: billingNatureFromProductKind(product.productKind),
      productCode: product.code,
      drawingRevision: product.drawingRevision ?? null,
      customerDrawingUrl: product.customerDrawingUrl ?? product.fusionFileUrl ?? null,
    };
  });

  return {
    lines: linesWithSnapshots,
    billingNature: deriveDocumentBillingNature(
      linesWithSnapshots.map((line) => ({
        productKind: productById.get(line.productId)?.productKind,
      })),
    ),
  };
}

export type QuotationProductSnapshotSource = ProductSnapshotSource;
export type QuotationLineProductSnapshot = LineProductSnapshot;
export const applyProductSnapshotsToQuotationLines =
  applyProductSnapshotsToDocumentLines;
