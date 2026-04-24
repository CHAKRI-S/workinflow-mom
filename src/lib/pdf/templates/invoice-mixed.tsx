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
 * MIXED invoice — "ใบกำกับภาษี (สินค้า + ค่าบริการ)"
 *
 * Used when one invoice bundles product sales + related services
 * (e.g., custom CNC part + special installation fee, or design fee).
 * Key characteristics:
 * - Two separate line sections: goods + service
 * - Service section shows WHT (if applicable); goods section does not
 * - Notice explains WHT applies only to service portion
 */
export function InvoiceMixedPdf({ data }: { data: InvoicePdfData }) {
  registerPdfFonts();

  // Partition lines by lineBillingNature (fallback: default all to GOODS)
  const goodsItems = data.items.filter((it) => {
    const nature = data.linesBillingNature?.[it.no];
    return nature === "GOODS" || nature == null;
  });
  const serviceItems = data.items.filter(
    (it) => data.linesBillingNature?.[it.no] === "MANUFACTURING_SERVICE"
  );

  const hasGoods = goodsItems.length > 0;
  const hasService = serviceItems.length > 0;

  // Phase 8.12 — adjust for non-VAT tenants.
  const title = data.tenantIsVatRegistered
    ? "ใบกำกับภาษี / ใบแจ้งหนี้"
    : "ใบแจ้งหนี้ (สินค้า + บริการ)";
  const subtitle = data.tenantIsVatRegistered
    ? "TAX INVOICE (GOODS + SERVICE)"
    : "INVOICE (GOODS + SERVICE)";

  return (
    <Document
      title={`${data.doc.number}`}
      author={data.tenant.name}
      subject={title}
    >
      <Page size="A4" style={pdfStyles.page}>
        <CancelledWatermark show={data.status === "CANCELLED"} />
        <PdfHeader
          tenant={data.tenant}
          doc={{
            title,
            subtitle,
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

        {hasGoods && (
          <>
            <Text style={pdfStyles.sectionHeading}>รายการสินค้า</Text>
            <LineItemsTable
              items={goodsItems}
              showCodeColumn
              descColLabel="รายการสินค้า"
            />
          </>
        )}

        {hasService && (
          <>
            <Text style={pdfStyles.sectionHeading}>
              รายการบริการ / รับจ้างทำของ
            </Text>
            <LineItemsTable
              items={serviceItems}
              showCodeColumn={false}
              descColLabel="รายการบริการ"
            />
          </>
        )}

        <TotalsBox
          subtotal={data.totals.subtotal}
          discountAmount={data.totals.discountAmount}
          vatRate={data.tenantIsVatRegistered ? data.totals.vatRate : null}
          vatAmount={data.tenantIsVatRegistered ? data.totals.vatAmount : null}
          grandTotal={data.totals.totalAmount}
          whtRate={data.totals.whtRate}
          whtAmount={data.totals.whtAmount}
          bahtAmount={data.totals.totalAmount}
        />

        {hasService && Number(data.totals.whtAmount ?? 0) > 0 && (
            <View style={pdfStyles.whtNotice}>
              <Text style={pdfStyles.bold}>
                หมายเหตุด้านภาษีหัก ณ ที่จ่าย
              </Text>
              <Text>
                ภาษีหัก ณ ที่จ่ายในอัตรา 3% ตามประมวลรัษฎากร มาตรา 3 เตรส
                คำนวณเฉพาะรายการส่วน &quot;บริการ / รับจ้างทำของ&quot; เท่านั้น
                รายการ &quot;สินค้า&quot; ไม่อยู่ในข่ายต้องหัก
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
          leftLabel="ผู้รับสินค้า / ผู้รับบริการ"
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
