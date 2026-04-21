import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { PdfHeader } from "../components/Header";
import { PartyRow } from "../components/PartyBlock";
import { LineItemsTable } from "../components/LineItemsTable";
import { TotalsBox } from "../components/TotalsBox";
import { PageFooter, SignatureRow } from "../components/Footer";
import { registerPdfFonts } from "../fonts";
import type { InvoicePdfData } from "../types";

/**
 * SERVICE invoice — "ใบแจ้งหนี้ค่าบริการ / รับจ้างทำของ"
 *
 * Used when tenant provides manufacturing service on customer-owned drawings.
 * Key characteristics:
 * - Wording "รายการบริการ" instead of "รายการสินค้า"
 * - No SKU column (service doesn't have a catalog)
 * - WHT 3% notice per ม.3 เตรส ประมวลรัษฎากร
 * - Signature label "ผู้รับบริการ" instead of "ผู้รับสินค้า"
 */
export function InvoiceServicePdf({ data }: { data: InvoicePdfData }) {
  registerPdfFonts();
  return (
    <Document
      title={`${data.doc.number}`}
      author={data.tenant.name}
      subject="ใบแจ้งหนี้ค่าบริการ / รับจ้างทำของ"
    >
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader
          tenant={data.tenant}
          doc={{
            title: "ใบแจ้งหนี้ค่าบริการ",
            subtitle: "SERVICE INVOICE",
            number: data.doc.number,
            issueDate: data.doc.issueDate,
            dueDate: data.doc.dueDate,
            reference: data.doc.reference,
            copyLabel: data.doc.copyLabel,
          }}
        />

        <PartyRow
          left={{ label: "ผู้ให้บริการ / Service Provider", party: data.seller }}
          right={{ label: "ผู้รับบริการ / Client", party: data.buyer }}
        />

        <LineItemsTable
          items={data.items}
          showCodeColumn={false}
          descColLabel="รายการบริการ / รับจ้างทำของ"
        />

        <TotalsBox
          subtotal={data.totals.subtotal}
          discountAmount={data.totals.discountAmount}
          vatRate={data.totals.vatRate}
          vatAmount={data.totals.vatAmount}
          grandTotal={data.totals.totalAmount}
          whtRate={data.totals.whtRate}
          whtAmount={data.totals.whtAmount}
          bahtAmount={data.totals.totalAmount}
        />

        <View style={pdfStyles.whtNotice}>
          <Text style={pdfStyles.bold}>
            หมายเหตุด้านภาษีหัก ณ ที่จ่าย
          </Text>
          <Text>
            ผู้จ่ายเงินที่เป็นนิติบุคคลมีหน้าที่หักภาษี ณ ที่จ่ายในอัตรา 3%
            ตามประมวลรัษฎากร มาตรา 3 เตรส และออกหนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ)
            ให้แก่ผู้ให้บริการ
          </Text>
        </View>

        {data.notes && (
          <View style={pdfStyles.noteBox}>
            <Text style={pdfStyles.bold}>หมายเหตุ:</Text>
            <Text>{data.notes}</Text>
          </View>
        )}

        <SignatureRow
          leftLabel="ผู้รับบริการ"
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
