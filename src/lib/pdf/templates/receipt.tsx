import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { PdfHeader } from "../components/Header";
import { PartyRow } from "../components/PartyBlock";
import { TotalsBox } from "../components/TotalsBox";
import { PageFooter, SignatureRow } from "../components/Footer";
import { CancelledWatermark } from "../components/CancelledWatermark";
import { registerPdfFonts } from "../fonts";
import type { ReceiptPdfData } from "../types";

/**
 * Receipt PDF — "ใบเสร็จรับเงิน"
 *
 * Shows:
 * - Payer vs Seller
 * - Reference invoice
 * - Gross amount, WHT deduction (if any), net amount received
 * - Cert number placeholder if WHT applicable
 */
export function ReceiptPdf({ data }: { data: ReceiptPdfData }) {
  registerPdfFonts();

  const hasWht =
    data.totals.whtAmount != null && Number(data.totals.whtAmount) > 0;

  return (
    <Document
      title={data.doc.number}
      author={data.tenant.name}
      subject="ใบเสร็จรับเงิน"
    >
      <Page size="A4" style={pdfStyles.page}>
        <CancelledWatermark show={data.status === "CANCELLED"} />
        <PdfHeader
          tenant={data.tenant}
          doc={{
            title: "ใบเสร็จรับเงิน",
            subtitle: "RECEIPT",
            number: data.doc.number,
            issueDate: data.doc.issueDate,
            reference: data.doc.invoiceNumber
              ? `อ้างอิง ${data.doc.invoiceNumber}`
              : null,
          }}
        />

        <PartyRow
          left={{ label: "ผู้รับเงิน / Receiver", party: data.seller }}
          right={{ label: "ผู้จ่ายเงิน / Payer", party: data.payer }}
        />

        <View style={pdfStyles.table}>
          <View style={pdfStyles.trHead}>
            <Text style={[pdfStyles.thText, pdfStyles.colNo]}>ลำดับ</Text>
            <Text style={[pdfStyles.thText, pdfStyles.colDescWide]}>
              รายการ
            </Text>
            <Text style={[pdfStyles.thText, pdfStyles.colAmount]}>
              จำนวนเงิน
            </Text>
          </View>
          <View style={pdfStyles.tr}>
            <Text style={[pdfStyles.tdText, pdfStyles.colNo]}>1</Text>
            <Text style={[pdfStyles.tdText, pdfStyles.colDescWide]}>
              {data.summary.description}
            </Text>
            <Text style={[pdfStyles.tdText, pdfStyles.colAmount]}>
              {Number(data.totals.grossAmount).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
        </View>

        <TotalsBox
          subtotal={data.totals.grossAmount}
          grandTotal={data.totals.grossAmount}
          whtRate={data.totals.whtRate}
          whtAmount={data.totals.whtAmount}
          netTotal={data.totals.netAmount}
          bahtAmount={data.totals.netAmount}
          grandLabel="ยอดรวม"
        />

        {hasWht && (
          <View style={pdfStyles.noteBox}>
            <Text style={pdfStyles.bold}>ข้อมูลการหักภาษี ณ ที่จ่าย</Text>
            <Text>
              อัตรา {data.totals.whtRate || 3}% · ยอดหัก{" "}
              {Number(data.totals.whtAmount).toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}{" "}
              บาท
            </Text>
            <Text>
              หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ) เลขที่:{" "}
              {data.whtCertNumber || "________________"}
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
          leftLabel="ผู้รับเงิน"
          rightLabel="ผู้จ่ายเงิน"
        />

        <PageFooter
          issuedBy={data.createdBy}
          docNumber={data.doc.number}
        />
      </Page>
    </Document>
  );
}
