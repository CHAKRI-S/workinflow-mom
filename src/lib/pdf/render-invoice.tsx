import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { InvoiceGoodsPdf } from "./templates/invoice-goods";
import { InvoiceServicePdf } from "./templates/invoice-service";
import { InvoiceMixedPdf } from "./templates/invoice-mixed";
import type { InvoicePdfData } from "./types";

/**
 * Pick the right invoice template by billing nature.
 * Keeps API routes dumb: just pass prepared data in, get a React element out.
 */
export function renderInvoicePdf(
  data: InvoicePdfData
): ReactElement<DocumentProps> {
  switch (data.doc.billingNature) {
    case "MANUFACTURING_SERVICE":
      return <InvoiceServicePdf data={data} />;
    case "MIXED":
      return <InvoiceMixedPdf data={data} />;
    case "GOODS":
    default:
      return <InvoiceGoodsPdf data={data} />;
  }
}
