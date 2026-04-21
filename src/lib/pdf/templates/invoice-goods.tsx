import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { PdfHeader } from "../components/Header";
import { PartyRow } from "../components/PartyBlock";
import { LineItemsTable } from "../components/LineItemsTable";
import { TotalsBox } from "../components/TotalsBox";
import { PageFooter, SignatureRow } from "../components/Footer";
import { CancelledWatermark } from "../components/CancelledWatermark";
import { registerPdfFonts } from "../fonts";
import type { InvoicePdfData } from "../types";

/**
 * GOODS invoice — "ใบกำกับภาษี / ใบแจ้งหนี้"
 *
 * Default template for OEM goods manufacturers.
 * Key characteristics:
 * - Shows SKU column (product catalog evidence)
 * - No WHT notice (normal goods sale — customer typically doesn't withhold)
 * - Optional "OEM disclaimer" when customer branding is present
 *   (helps preempt classification disputes with customer)
 */
export function InvoiceGoodsPdf({ data }: { data: InvoicePdfData }) {
  registerPdfFonts();
  return (
    <Document
      title={`${data.doc.number}`}
      author={data.tenant.name}
      subject="ใบกำกับภาษี / ใบแจ้งหนี้"
    >
      <Page size="A4" style={pdfStyles.page}>
        <CancelledWatermark show={data.status === "CANCELLED"} />
        <PdfHeader
          tenant={data.tenant}
          doc={{
            title: "ใบกำกับภาษี / ใบแจ้งหนี้",
            subtitle: "TAX INVOICE / INVOICE",
            number: data.doc.number,
            issueDate: data.doc.issueDate,
            dueDate: data.doc.dueDate,
            reference: data.doc.reference,
            copyLabel: data.doc.copyLabel,
          }}
        />

        <PartyRow
          left={{ label: "ผู้ขาย / Seller", party: data.seller }}
          right={{ label: "ผู้ซื้อ / Buyer", party: data.buyer }}
        />

        <LineItemsTable
          items={data.items}
          showCodeColumn
          descColLabel="รายการสินค้า"
        />

        <TotalsBox
          subtotal={data.totals.subtotal}
          discountAmount={data.totals.discountAmount}
          vatRate={data.totals.vatRate}
          vatAmount={data.totals.vatAmount}
          grandTotal={data.totals.totalAmount}
          bahtAmount={data.totals.totalAmount}
        />

        {data.oemDisclaimer && (
          <View style={pdfStyles.noteBox}>
            <Text>
              * สินค้านี้ผลิตและจำหน่ายโดย {data.tenant.name} ตามแบบ, วัสดุ
              และกระบวนการผลิตของบริษัทฯ
              การจัดทำสัญลักษณ์ตามที่ลูกค้ากำหนดเป็นเพียง specification
              ของสินค้า ไม่เปลี่ยนลักษณะการขายสินค้า
            </Text>
          </View>
        )}

        {data.notes && (
          <View style={pdfStyles.noteBox}>
            <Text style={pdfStyles.bold}>หมายเหตุ:</Text>
            <Text>{data.notes}</Text>
          </View>
        )}

        <SignatureRow
          leftLabel="ผู้รับสินค้า"
          rightLabel="ผู้มีอำนาจลงนาม"
        />

        <PageFooter
          issuedBy={data.createdBy}
          docNumber={data.doc.number}
        />
      </Page>
    </Document>
  );
}
