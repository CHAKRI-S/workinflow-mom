import { StyleSheet } from "@react-pdf/renderer";
import { PDF_FONT_FAMILY } from "./fonts";

/**
 * Shared StyleSheet for all invoice/receipt/tax-invoice PDFs.
 * Designed for A4 portrait (210 × 297 mm) with 40pt margins.
 */
export const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    color: "#111",
    lineHeight: 1.4,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    borderBottom: "1px solid #333",
    paddingBottom: 10,
  },
  headerCompany: {
    flexDirection: "column",
    maxWidth: "60%",
  },
  companyName: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 2,
  },
  companyDetails: {
    fontSize: 9,
    color: "#444",
  },
  docTitleBlock: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  docTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  docSubtitle: {
    fontSize: 10,
    color: "#555",
    marginTop: 2,
  },
  docNumber: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: "bold",
  },
  docMetaRow: {
    flexDirection: "row",
    gap: 12,
    fontSize: 9,
    color: "#444",
    marginTop: 2,
  },

  // Party blocks (buyer/seller)
  partyRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  partyCol: {
    flex: 1,
    borderLeft: "3px solid #3b82f6",
    paddingLeft: 8,
  },
  partyLabel: {
    fontSize: 9,
    color: "#666",
    marginBottom: 2,
  },
  partyName: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 2,
  },
  partyLine: {
    fontSize: 9,
    color: "#333",
    marginBottom: 1,
  },

  // Table
  table: {
    marginTop: 6,
    borderTop: "1px solid #333",
    borderBottom: "1px solid #333",
  },
  tr: {
    flexDirection: "row",
    borderBottom: "0.5px solid #ddd",
    minHeight: 20,
    alignItems: "flex-start",
    paddingVertical: 4,
  },
  trHead: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottom: "1px solid #333",
    paddingVertical: 5,
  },
  trTotal: {
    flexDirection: "row",
    borderTop: "0.5px solid #ddd",
    paddingVertical: 4,
  },
  thText: {
    fontWeight: "bold",
    fontSize: 9,
  },
  tdText: {
    fontSize: 9,
  },

  // Table column widths (in flex units)
  colNo: { width: "5%", paddingHorizontal: 3, textAlign: "center" },
  colCode: { width: "14%", paddingHorizontal: 3 },
  colDesc: { width: "41%", paddingHorizontal: 3 },
  colDescWide: { width: "55%", paddingHorizontal: 3 }, // when no code col
  colQty: { width: "10%", paddingHorizontal: 3, textAlign: "right" },
  colPrice: { width: "15%", paddingHorizontal: 3, textAlign: "right" },
  colAmount: { width: "15%", paddingHorizontal: 3, textAlign: "right" },

  // Totals
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  totalsBox: {
    width: "50%",
  },
  totalsLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingHorizontal: 8,
    fontSize: 10,
  },
  totalsLineAlt: {
    backgroundColor: "#f9fafb",
  },
  totalsGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: "bold",
    backgroundColor: "#e5e7eb",
    marginTop: 2,
  },

  // Baht text box
  bahtBox: {
    marginTop: 6,
    padding: 6,
    backgroundColor: "#f3f4f6",
    fontSize: 10,
    textAlign: "center",
  },

  // Notes + WHT notice
  noteBox: {
    marginTop: 12,
    padding: 8,
    border: "1px solid #d1d5db",
    fontSize: 9,
    color: "#444",
  },
  whtNotice: {
    marginTop: 8,
    padding: 6,
    backgroundColor: "#fef3c7",
    border: "1px solid #f59e0b",
    fontSize: 9,
    color: "#78350f",
  },

  // Footer signatures
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 36,
    gap: 20,
  },
  signatureBox: {
    flex: 1,
    alignItems: "center",
  },
  signatureLine: {
    width: "80%",
    borderBottom: "0.5px solid #666",
    marginBottom: 4,
    height: 40,
  },
  signatureLabel: {
    fontSize: 9,
    color: "#444",
  },

  // Absolute footer (page number + confidentiality)
  pageFooter: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#888",
    borderTop: "0.5px solid #ddd",
    paddingTop: 4,
  },

  // Utility
  mutedText: {
    fontSize: 8,
    color: "#666",
  },
  bold: {
    fontWeight: "bold",
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottom: "0.5px solid #ccc",
  },
});
