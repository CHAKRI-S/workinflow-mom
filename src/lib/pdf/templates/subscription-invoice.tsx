import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { PdfHeader } from "../components/Header";
import { PartyBlock } from "../components/PartyBlock";
import { TotalsBox } from "../components/TotalsBox";
import { PageFooter, SignatureRow } from "../components/Footer";
import { CancelledWatermark } from "../components/CancelledWatermark";
import { registerPdfFonts } from "../fonts";
import { formatCurrency, formatDateTh } from "../format";
import type { SubscriptionInvoicePdfData } from "../types";

/**
 * Platform issuer info — WorkinFlow itself issues this tax invoice to the
 * tenant for SaaS service fees. This is distinct from tenant-issued invoices
 * (which use tenant's own info as seller).
 *
 * Values come from env vars (set on Coolify for production):
 *   platformIssuer_NAME / _TAX_ID / _ADDRESS / _PHONE / _EMAIL
 *
 * Fallbacks are safe placeholders — PDFs generated with placeholders will
 * be visibly marked "[SETUP REQUIRED]" so unfilled production env is obvious.
 */
function getPlatformIssuer() {
  const missingTag = "[SETUP REQUIRED]";
  return {
    name: process.env.platformIssuer_NAME || `WorkinFlow Co., Ltd. ${missingTag}`,
    taxId: process.env.platformIssuer_TAX_ID || missingTag,
    address: process.env.platformIssuer_ADDRESS || missingTag,
    phone: process.env.platformIssuer_PHONE || missingTag,
    email: process.env.platformIssuer_EMAIL || "billing@workinflow.cloud",
  };
}

const BILLING_CYCLE_LABEL: Record<"MONTHLY" | "YEARLY", string> = {
  MONTHLY: "รายเดือน",
  YEARLY: "รายปี",
};

function satangToBaht(satang: number): number {
  return Math.round(satang) / 100;
}

/**
 * SubscriptionInvoice PDF — "ใบกำกับภาษี / ใบเสร็จรับเงิน (ค่าบริการ SaaS)"
 *
 * Issued by WorkinFlow platform to the tenant for SaaS subscription fees.
 * Different from tenant-issued invoices: the platform is the seller/issuer,
 * and the tenant is the buyer.
 */
export function SubscriptionInvoicePdf({
  data,
}: {
  data: SubscriptionInvoicePdfData;
}) {
  registerPdfFonts();

  const platformIssuer = getPlatformIssuer();

  const subtotal = satangToBaht(data.totals.subtotalSatang);
  const discount = satangToBaht(data.totals.discountSatang);
  const vat = satangToBaht(data.totals.vatSatang);
  const total = satangToBaht(data.totals.totalSatang);

  const cycleLabel = BILLING_CYCLE_LABEL[data.lineItem.billingCycle];
  const periodStart = formatDateTh(data.lineItem.periodStart);
  const periodEnd = formatDateTh(data.lineItem.periodEnd);
  const description = `${data.lineItem.planName} — ${cycleLabel} (${periodStart} – ${periodEnd})`;

  return (
    <Document
      title={data.doc.number}
      author={platformIssuer.name}
      subject="ใบกำกับภาษี / ใบเสร็จรับเงิน (ค่าบริการ SaaS)"
    >
      <Page size="A4" style={pdfStyles.page}>
        <CancelledWatermark show={data.status === "CANCELLED"} />

        <PdfHeader
          tenant={platformIssuer}
          doc={{
            title: "ใบกำกับภาษี / ใบเสร็จรับเงิน (ค่าบริการ SaaS)",
            subtitle: "TAX INVOICE / RECEIPT",
            number: data.doc.number,
            issueDate: data.doc.issueDate,
            reference: data.doc.paidAt
              ? `ชำระเมื่อ ${formatDateTh(data.doc.paidAt)}`
              : null,
          }}
        />

        <View style={pdfStyles.partyRow}>
          <PartyBlock
            label="ผู้ให้บริการ / Service Provider"
            party={platformIssuer}
          />
          <PartyBlock label="ผู้รับบริการ / Customer" party={data.buyer} />
        </View>

        <View style={pdfStyles.table}>
          <View style={pdfStyles.trHead}>
            <Text style={[pdfStyles.thText, pdfStyles.colNo]}>ลำดับ</Text>
            <Text style={[pdfStyles.thText, pdfStyles.colDescWide]}>
              รายการบริการ
            </Text>
            <Text style={[pdfStyles.thText, pdfStyles.colQty]}>จำนวน</Text>
            <Text style={[pdfStyles.thText, pdfStyles.colPrice]}>
              ราคา/หน่วย
            </Text>
            <Text style={[pdfStyles.thText, pdfStyles.colAmount]}>
              จำนวนเงิน
            </Text>
          </View>
          <View style={pdfStyles.tr} wrap={false}>
            <Text style={[pdfStyles.tdText, pdfStyles.colNo]}>1</Text>
            <View style={pdfStyles.colDescWide}>
              <Text style={pdfStyles.tdText}>{description}</Text>
            </View>
            <Text style={[pdfStyles.tdText, pdfStyles.colQty]}>1 งวด</Text>
            <Text style={[pdfStyles.tdText, pdfStyles.colPrice]}>
              {formatCurrency(subtotal)}
            </Text>
            <Text style={[pdfStyles.tdText, pdfStyles.colAmount]}>
              {formatCurrency(subtotal)}
            </Text>
          </View>
        </View>

        <TotalsBox
          subtotal={subtotal}
          discountAmount={discount}
          vatRate={7}
          vatAmount={vat}
          grandTotal={total}
          bahtAmount={total}
        />

        <View style={pdfStyles.noteBox}>
          <Text style={pdfStyles.bold}>เอกสารออกโดยระบบ WorkinFlow SaaS</Text>
          <Text>
            ใบกำกับภาษี/ใบเสร็จรับเงินเลขที่ {data.doc.number} — ค่าบริการ
            Software as a Service สำหรับ {data.lineItem.planName} ({cycleLabel})
          </Text>
          {data.doc.paidAt && (
            <Text>ชำระเรียบร้อยเมื่อ {formatDateTh(data.doc.paidAt)}</Text>
          )}
        </View>

        <SignatureRow
          leftLabel="ผู้รับบริการ"
          rightLabel="ผู้มีอำนาจลงนาม (WorkinFlow)"
        />

        <PageFooter issuedBy={null} docNumber={data.doc.number} />
      </Page>
    </Document>
  );
}
