import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { ReceiptPdf } from "./templates/receipt";
import type { ReceiptPdfData } from "./types";

export function renderReceiptPdf(
  data: ReceiptPdfData
): ReactElement<DocumentProps> {
  return <ReceiptPdf data={data} />;
}
