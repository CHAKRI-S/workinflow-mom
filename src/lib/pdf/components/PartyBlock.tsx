import { Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { formatTaxId } from "../format";

export interface Party {
  name: string;
  address?: string | null;
  taxId?: string | null;
  branchNo?: string | null;
  phone?: string | null;
  email?: string | null;
  contactPerson?: string | null;
}

export function PartyBlock({
  label,
  party,
}: {
  label: string;
  party: Party;
}) {
  return (
    <View style={pdfStyles.partyCol}>
      <Text style={pdfStyles.partyLabel}>{label}</Text>
      <Text style={pdfStyles.partyName}>{party.name}</Text>
      {party.address && <Text style={pdfStyles.partyLine}>{party.address}</Text>}
      {party.taxId && (
        <Text style={pdfStyles.partyLine}>
          เลขผู้เสียภาษี: {formatTaxId(party.taxId)}
          {party.branchNo ? ` (สาขา ${party.branchNo})` : ""}
        </Text>
      )}
      {party.phone && (
        <Text style={pdfStyles.partyLine}>โทร: {party.phone}</Text>
      )}
      {party.contactPerson && (
        <Text style={pdfStyles.partyLine}>ติดต่อ: {party.contactPerson}</Text>
      )}
    </View>
  );
}

export function PartyRow({
  left,
  right,
}: {
  left: { label: string; party: Party };
  right: { label: string; party: Party };
}) {
  return (
    <View style={pdfStyles.partyRow}>
      <PartyBlock label={left.label} party={left.party} />
      <PartyBlock label={right.label} party={right.party} />
    </View>
  );
}
