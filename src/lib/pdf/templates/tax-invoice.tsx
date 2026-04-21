import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { PdfHeader } from "../components/Header";
import { PartyRow } from "../components/PartyBlock";
import { LineItemsTable } from "../components/LineItemsTable";
import { TotalsBox } from "../components/TotalsBox";
import { PageFooter, SignatureRow } from "../components/Footer";
import { registerPdfFonts } from "../fonts";
import type { TaxInvoicePdfData } from "../types";

/**
 * Standalone Tax Invoice PDF — "ใบกำกับภาษี"
 *
 * Used when TaxInvoice is issued separately from Invoice (abridged tax invoice
 * scenario for VAT bookkeeping). Billing nature wording adapts automatically.
 */
export function TaxInvoicePdf({ data }: { data: TaxInvoicePdfData }) {
  registerPdfFonts();

  const isService = data.doc.billingNature === "MANUFACTURING_SERVICE";
  const isMixed = data.doc.billingNature === "MIXED";
  const title = isService
    ? "ใบกำกับภาษี (ค่าบริการ)"
    : isMixed
      ? "ใบกำกับภาษี"
      : "ใบกำกับภาษี";

  return (
    <Document
      title={data.doc.number}
      author={data.tenant.name}
      subject="ใบกำกับภาษี"
    >
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader
          tenant={data.tenant}
          doc={{
            title,
            subtitle: "TAX INVOICE",
            number: data.doc.number,
            issueDate: data.doc.issueDate,
            reference: data.doc.invoiceNumber
              ? `อ้างอิง ${data.doc.invoiceNumber}`
              : null,
            copyLabel: data.doc.copyLabel,
          }}
        />

        <PartyRow
          left={{ label: "ผู้ขาย / Seller", party: data.seller }}
          right={{ label: "ผู้ซื้อ / Buyer", party: data.buyer }}
        />

        <LineItemsTable
          items={data.items}
          showCodeColumn={!isService}
          descColLabel={
            isService ? "รายการบริการ" : isMixed ? "รายการ" : "รายการสินค้า"
          }
        />

        <TotalsBox
          subtotal={data.totals.subtotal}
          vatRate={data.totals.vatRate}
          vatAmount={data.totals.vatAmount}
          grandTotal={data.totals.totalAmount}
          bahtAmount={data.totals.totalAmount}
        />

        {data.notes && (
          <View style={pdfStyles.noteBox}>
            <Text style={pdfStyles.bold}>หมายเหตุ:</Text>
            <Text>{data.notes}</Text>
          </View>
        )}

        <SignatureRow
          leftLabel="ผู้รับเอกสาร"
          rightLabel="ผู้มีอำนาจลงนาม"
        />

        <PageFooter issuedBy={null} docNumber={data.doc.number} />
      </Page>
    </Document>
  );
}
