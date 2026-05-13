import { Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { formatPdfMoney, pdfAmountText } from "../format";

export interface TotalsProps {
  subtotal: number | string;
  discountAmount?: number | string | null;
  vatRate?: number | string | null;
  vatAmount?: number | string | null;
  whtRate?: number | string | null;
  whtAmount?: number | string | null;
  grandTotal: number | string; // ยอดก่อนหัก WHT (totalAmount)
  netTotal?: number | string | null; // ยอดรับสุทธิหลัง WHT (ใช้กับ receipt)
  bahtAmount: number | string; // ตัวเลขสำหรับคำอ่านภาษาไทย (grandTotal หรือ netTotal)
  grandLabel?: string; // default "รวมทั้งสิ้น"
  currencyCode?: string | null;
}

export function TotalsBox({
  subtotal,
  discountAmount,
  vatRate,
  vatAmount,
  whtRate,
  whtAmount,
  grandTotal,
  netTotal,
  bahtAmount,
  grandLabel = "รวมทั้งสิ้น",
  currencyCode = "THB",
}: TotalsProps) {
  const showDiscount =
    discountAmount !== null &&
    discountAmount !== undefined &&
    Number(discountAmount) !== 0;
  const showVat =
    vatAmount !== null && vatAmount !== undefined && Number(vatAmount) !== 0;
  const showWht =
    whtAmount !== null && whtAmount !== undefined && Number(whtAmount) !== 0;
  const showNet = netTotal !== null && netTotal !== undefined;

  return (
    <>
      <View style={pdfStyles.totalsRow}>
        <View style={pdfStyles.totalsBox}>
          <View style={pdfStyles.totalsLine}>
            <Text>รวมเป็นเงิน</Text>
            <Text>{formatPdfMoney(subtotal, currencyCode)}</Text>
          </View>
          {showDiscount && (
            <View style={[pdfStyles.totalsLine, pdfStyles.totalsLineAlt]}>
              <Text>ส่วนลด</Text>
              <Text>({formatPdfMoney(discountAmount, currencyCode)})</Text>
            </View>
          )}
          {showVat && (
            <View style={pdfStyles.totalsLine}>
              <Text>ภาษีมูลค่าเพิ่ม {vatRate ? `${vatRate}%` : ""}</Text>
              <Text>{formatPdfMoney(vatAmount, currencyCode)}</Text>
            </View>
          )}
          <View style={pdfStyles.totalsGrand}>
            <Text>{grandLabel}</Text>
            <Text>{formatPdfMoney(grandTotal, currencyCode)}</Text>
          </View>
          {showWht && (
            <View style={[pdfStyles.totalsLine, pdfStyles.totalsLineAlt]}>
              <Text>
                หัก ณ ที่จ่าย {whtRate ? `${whtRate}%` : ""}
              </Text>
              <Text>({formatPdfMoney(whtAmount, currencyCode)})</Text>
            </View>
          )}
          {showNet && (
            <View style={pdfStyles.totalsGrand}>
              <Text>ยอดรับสุทธิ</Text>
              <Text>{formatPdfMoney(netTotal, currencyCode)}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={pdfStyles.bahtBox}>
        <Text>({pdfAmountText(bahtAmount, currencyCode)})</Text>
      </View>
    </>
  );
}
