import { Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { formatDateTh, formatTaxId } from "../format";

export interface HeaderTenant {
  name: string;
  taxId?: string | null;
  branchNo?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface HeaderDoc {
  title: string; // e.g. "ใบกำกับภาษี / ใบแจ้งหนี้"
  subtitle?: string | null; // e.g. "TAX INVOICE / INVOICE"
  number: string; // e.g. "INV-2026-00042"
  issueDate: Date | string;
  dueDate?: Date | string | null;
  reference?: string | null; // e.g. "PO#1234"
  copyLabel?: string | null; // e.g. "ต้นฉบับ" / "สำเนา"
}

export function PdfHeader({
  tenant,
  doc,
}: {
  tenant: HeaderTenant;
  doc: HeaderDoc;
}) {
  return (
    <View style={pdfStyles.headerRow}>
      <View style={pdfStyles.headerCompany}>
        <Text style={pdfStyles.companyName}>{tenant.name}</Text>
        {tenant.address && (
          <Text style={pdfStyles.companyDetails}>{tenant.address}</Text>
        )}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
          {tenant.taxId && (
            <Text style={pdfStyles.companyDetails}>
              เลขผู้เสียภาษี: {formatTaxId(tenant.taxId)}
              {tenant.branchNo ? ` (สาขา ${tenant.branchNo})` : ""}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 1 }}>
          {tenant.phone && (
            <Text style={pdfStyles.companyDetails}>โทร: {tenant.phone}</Text>
          )}
          {tenant.email && (
            <Text style={pdfStyles.companyDetails}>{tenant.email}</Text>
          )}
        </View>
      </View>
      <View style={pdfStyles.docTitleBlock}>
        <Text style={pdfStyles.docTitle}>{doc.title}</Text>
        {doc.subtitle && (
          <Text style={pdfStyles.docSubtitle}>{doc.subtitle}</Text>
        )}
        {doc.copyLabel && (
          <Text style={[pdfStyles.docSubtitle, pdfStyles.bold]}>
            ({doc.copyLabel})
          </Text>
        )}
        <Text style={pdfStyles.docNumber}>เลขที่: {doc.number}</Text>
        <View style={pdfStyles.docMetaRow}>
          <Text>วันที่: {formatDateTh(doc.issueDate)}</Text>
          {doc.dueDate && <Text>ครบกำหนด: {formatDateTh(doc.dueDate)}</Text>}
        </View>
        {doc.reference && (
          <View style={pdfStyles.docMetaRow}>
            <Text>อ้างอิง: {doc.reference}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
