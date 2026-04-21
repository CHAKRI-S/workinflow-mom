import { Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";

/**
 * Diagonal red "CANCELLED / ยกเลิก" watermark overlaid on the page content
 * when the document status is CANCELLED.
 *
 * Uses absolute positioning so it floats over the existing layout without
 * shifting any table/signature/footer positions.
 */
export function CancelledWatermark({ show }: { show?: boolean | null }) {
  if (!show) return null;
  return (
    <View style={pdfStyles.watermarkLayer} fixed>
      <Text style={pdfStyles.watermarkText}>ยกเลิก / CANCELLED</Text>
    </View>
  );
}
