import { Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { formatCurrency } from "../format";

export interface PdfLineItem {
  no: number;
  productCode?: string | null;
  description: string;
  drawingRevision?: string | null;
  customerBranding?: string | null; // human-readable branding note
  quantity: number | string;
  unit?: string | null;
  unitPrice: number | string;
  lineTotal: number | string;
}

export function LineItemsTable({
  items,
  showCodeColumn = true,
  descColLabel = "รายการ",
}: {
  items: PdfLineItem[];
  showCodeColumn?: boolean;
  descColLabel?: string;
}) {
  const descStyle = showCodeColumn ? pdfStyles.colDesc : pdfStyles.colDescWide;
  return (
    <View style={pdfStyles.table}>
      {/* Head */}
      <View style={pdfStyles.trHead}>
        <Text style={[pdfStyles.thText, pdfStyles.colNo]}>ลำดับ</Text>
        {showCodeColumn && (
          <Text style={[pdfStyles.thText, pdfStyles.colCode]}>รหัส</Text>
        )}
        <Text style={[pdfStyles.thText, descStyle]}>{descColLabel}</Text>
        <Text style={[pdfStyles.thText, pdfStyles.colQty]}>จำนวน</Text>
        <Text style={[pdfStyles.thText, pdfStyles.colPrice]}>ราคา/หน่วย</Text>
        <Text style={[pdfStyles.thText, pdfStyles.colAmount]}>จำนวนเงิน</Text>
      </View>

      {items.map((it) => (
        <View style={pdfStyles.tr} key={it.no} wrap={false}>
          <Text style={[pdfStyles.tdText, pdfStyles.colNo]}>{it.no}</Text>
          {showCodeColumn && (
            <Text style={[pdfStyles.tdText, pdfStyles.colCode]}>
              {it.productCode || "-"}
            </Text>
          )}
          <View style={descStyle}>
            <Text style={pdfStyles.tdText}>{it.description}</Text>
            {it.drawingRevision && (
              <Text style={pdfStyles.mutedText}>
                Drawing Rev: {it.drawingRevision}
              </Text>
            )}
            {it.customerBranding && (
              <Text style={pdfStyles.mutedText}>
                Customer Mark: {it.customerBranding}
              </Text>
            )}
          </View>
          <Text style={[pdfStyles.tdText, pdfStyles.colQty]}>
            {formatCurrency(it.quantity)}
            {it.unit ? ` ${it.unit}` : ""}
          </Text>
          <Text style={[pdfStyles.tdText, pdfStyles.colPrice]}>
            {formatCurrency(it.unitPrice)}
          </Text>
          <Text style={[pdfStyles.tdText, pdfStyles.colAmount]}>
            {formatCurrency(it.lineTotal)}
          </Text>
        </View>
      ))}
    </View>
  );
}
