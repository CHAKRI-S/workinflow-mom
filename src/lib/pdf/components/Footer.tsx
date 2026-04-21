import { Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";

export function SignatureRow({
  leftLabel = "ผู้รับสินค้า / ผู้รับบริการ",
  rightLabel = "ผู้มีอำนาจลงนาม",
}: {
  leftLabel?: string;
  rightLabel?: string;
}) {
  return (
    <View style={pdfStyles.signatureRow}>
      <View style={pdfStyles.signatureBox}>
        <View style={pdfStyles.signatureLine} />
        <Text style={pdfStyles.signatureLabel}>({leftLabel})</Text>
        <Text style={pdfStyles.signatureLabel}>วันที่: ________________</Text>
      </View>
      <View style={pdfStyles.signatureBox}>
        <View style={pdfStyles.signatureLine} />
        <Text style={pdfStyles.signatureLabel}>({rightLabel})</Text>
        <Text style={pdfStyles.signatureLabel}>วันที่: ________________</Text>
      </View>
    </View>
  );
}

export function PageFooter({
  issuedBy,
  docNumber,
}: {
  issuedBy?: string | null;
  docNumber: string;
}) {
  return (
    <View style={pdfStyles.pageFooter} fixed>
      <Text>
        {docNumber}
        {issuedBy ? ` · ออกโดย ${issuedBy}` : ""}
      </Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `หน้า ${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}
