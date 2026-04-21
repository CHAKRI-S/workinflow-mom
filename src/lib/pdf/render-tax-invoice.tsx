import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { TaxInvoicePdf } from "./templates/tax-invoice";
import type { TaxInvoicePdfData } from "./types";

export function renderTaxInvoicePdf(
  data: TaxInvoicePdfData
): ReactElement<DocumentProps> {
  return <TaxInvoicePdf data={data} />;
}
