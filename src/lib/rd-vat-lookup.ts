/**
 * Thai Revenue Department (RD) VAT Service lookup.
 * SOAP endpoint that returns registered business info by 13-digit Tax ID.
 *
 * Endpoint: https://rdws.rd.go.th/serviceRD3/vatserviceRD3.asmx
 * Method:   Service
 * Namespace: https://rdws.rd.go.th/JserviceRD3/vatserviceRD3
 *
 * NOTE: Server-side only — no CORS, must be proxied.
 */

import type { JuristicType } from "@/generated/prisma/client";

export interface RdVatResult {
  taxId: string;
  branchNo: string;
  branchName: string | null;
  titleName: string | null;
  name: string;
  surname: string | null;
  juristicType: JuristicType | null;
  address: string;
  postCode: string | null;
  province: string | null;
  status: "ACTIVE" | "INACTIVE" | "UNKNOWN";
  businessFirstDate: string | null;
}

export class RdVatLookupError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_TIN"
      | "NOT_FOUND"
      | "UPSTREAM_ERROR"
      | "NETWORK_ERROR",
  ) {
    super(message);
    this.name = "RdVatLookupError";
  }
}

const SOAP_ENDPOINT =
  "https://rdws.rd.go.th/serviceRD3/vatserviceRD3.asmx";
// NOTE: as of 2026 the WSDL uses the namespace `serviceRD3` (not `JserviceRD3`
// which appears in many outdated guides). Using the wrong one returns
// HTTP 500 with "Server did not recognize the value of HTTP Header SOAPAction".
const SOAP_NAMESPACE =
  "https://rdws.rd.go.th/serviceRD3/vatserviceRD3";
const SOAP_ACTION = `${SOAP_NAMESPACE}/Service`;

// Simple in-memory cache (TIN info rarely changes)
type CacheEntry = { at: number; value: RdVatResult };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function cacheKey(taxId: string, branchNo: string) {
  return `${taxId}:${branchNo}`;
}

function buildSoapEnvelope(taxId: string, branchNo: string): string {
  // BranchNumber: -1 = HQ auto, otherwise the branch number as integer
  const branchNum =
    branchNo && /^\d+$/.test(branchNo) ? parseInt(branchNo, 10) : -1;

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Service xmlns="${SOAP_NAMESPACE}">
      <username>anonymous</username>
      <password>anonymous</password>
      <TIN>${taxId}</TIN>
      <ProvinceCode>0</ProvinceCode>
      <BranchNumber>${branchNum}</BranchNumber>
      <AmphurCode>0</AmphurCode>
    </Service>
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Extract first occurrence of a leaf XML element's cdata/text content.
 * Response arrays wrap values in <cTag><anyType>VALUE</anyType></cTag>.
 */
function extractFirst(xml: string, tag: string): string | null {
  // Try with anyType wrapper first
  const anyTypeRe = new RegExp(
    `<${tag}>[\\s\\S]*?<anyType[^>]*>([\\s\\S]*?)</anyType>[\\s\\S]*?</${tag}>`,
    "i",
  );
  const m1 = xml.match(anyTypeRe);
  if (m1) {
    const v = m1[1].trim();
    return v === "" ? null : decodeXml(v);
  }
  // Plain element
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m2 = xml.match(plainRe);
  if (m2) {
    const v = m2[1].trim();
    return v === "" ? null : decodeXml(v);
  }
  return null;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Heuristically map RD title + name into a JuristicType enum value.
 * RD doesn't return a structured juristic code — we infer from Thai title.
 */
function inferJuristicType(
  titleName: string | null,
  name: string,
): JuristicType | null {
  const text = `${titleName ?? ""} ${name}`.toLowerCase();

  if (/บริษัท.*มหาชน|public\s+co|public\s+company/i.test(text)) {
    return "PUBLIC_CO";
  }
  if (/บริษัท|co\.?\s*,?\s*ltd|company\s+limited/i.test(text)) {
    return "COMPANY_LTD";
  }
  if (/ห้างหุ้นส่วน|limited\s+partnership|hp\.?\s+ltd|หจก/i.test(text)) {
    return "LIMITED_PARTNERSHIP";
  }
  if (/มูลนิธิ|foundation/i.test(text)) {
    return "FOUNDATION";
  }
  if (/สมาคม|association/i.test(text)) {
    return "ASSOCIATION";
  }
  if (/กิจการร่วมค้า|joint\s+venture/i.test(text)) {
    return "JOINT_VENTURE";
  }
  if (/นาย|นาง|นางสาว|ด\.ช|ด\.ญ|mr\.|mrs\.|miss\.|ms\./i.test(text)) {
    return "INDIVIDUAL";
  }
  return "OTHER_JURISTIC";
}

function buildAddress(xml: string): string {
  // Build a readable Thai address from the response parts.
  const parts = [
    extractFirst(xml, "vHouseNumber"),
    extractFirst(xml, "vBuildingName"),
    extractFirst(xml, "vFloorNumber"),
    extractFirst(xml, "vVillageName"),
    extractFirst(xml, "vRoomNumber"),
  ]
    .filter((x) => x && x !== "-")
    .filter(Boolean) as string[];

  const moo = extractFirst(xml, "vMooNumber");
  if (moo && moo !== "-") parts.push(`หมู่ ${moo}`);

  const soi = extractFirst(xml, "vSoiName");
  if (soi && soi !== "-") parts.push(`ซอย${soi}`);

  const street = extractFirst(xml, "vStreetName");
  if (street && street !== "-") parts.push(`ถนน${street}`);

  const thambol = extractFirst(xml, "vThambol");
  if (thambol && thambol !== "-") parts.push(`ตำบล/แขวง${thambol}`);

  const amphur = extractFirst(xml, "vAmphur");
  if (amphur && amphur !== "-") parts.push(`อำเภอ/เขต${amphur}`);

  const province = extractFirst(xml, "vProvince");
  if (province && province !== "-") parts.push(`จังหวัด${province}`);

  const postCode = extractFirst(xml, "vPostCode");
  if (postCode && postCode !== "-") parts.push(postCode);

  return parts.join(" ").trim();
}

export async function lookupByTaxId(
  rawTaxId: string,
  rawBranchNo?: string,
): Promise<RdVatResult> {
  const taxId = (rawTaxId ?? "").replace(/[^\d]/g, "");
  if (!/^\d{13}$/.test(taxId)) {
    throw new RdVatLookupError("Tax ID must be 13 digits", "INVALID_TIN");
  }
  const branchNo = (rawBranchNo ?? "").replace(/[^\d]/g, "") || "00000";

  const key = cacheKey(taxId, branchNo);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  const envelope = buildSoapEnvelope(taxId, branchNo);

  let xml: string;
  try {
    const res = await fetch(SOAP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${SOAP_ACTION}"`,
      },
      body: envelope,
      // Short timeout (RD is sometimes slow)
      signal: AbortSignal.timeout(10_000),
    });
    xml = await res.text();
    if (!res.ok) {
      const fault = extractFirst(xml, "faultstring");
      console.error(
        `[rd-vat] HTTP ${res.status} from RD service:`,
        fault ?? xml.slice(0, 500),
      );
      throw new RdVatLookupError(
        fault
          ? `RD service error: ${fault}`
          : `RD service returned HTTP ${res.status}`,
        "UPSTREAM_ERROR",
      );
    }
  } catch (e) {
    if (e instanceof RdVatLookupError) throw e;
    throw new RdVatLookupError(
      e instanceof Error ? e.message : "Network error",
      "NETWORK_ERROR",
    );
  }

  const errMsg = extractFirst(xml, "vmsgerr");
  if (errMsg && errMsg.trim()) {
    throw new RdVatLookupError(
      `RD: ${errMsg.trim()}`,
      "NOT_FOUND",
    );
  }

  const vTin = extractFirst(xml, "vtin");
  if (!vTin) {
    throw new RdVatLookupError("Tax ID not found", "NOT_FOUND");
  }

  // Actual XML tag is `vtitleName` (lowercase t) — not `vTitleName` as
  // some docs claim.
  const titleName =
    extractFirst(xml, "vtitleName") ?? extractFirst(xml, "vTitleName");
  const name = extractFirst(xml, "vName") ?? "";
  const surname = extractFirst(xml, "vSurname");
  const branchName = extractFirst(xml, "vBranchName");
  const branchNumber = extractFirst(xml, "vBranchNumber");
  const statusRaw = extractFirst(xml, "vStatus");
  const businessFirstDate = extractFirst(xml, "vBusinessFirstDate");
  const postCode = extractFirst(xml, "vPostCode");
  const province = extractFirst(xml, "vProvince");

  const status: RdVatResult["status"] =
    statusRaw === "AC"
      ? "ACTIVE"
      : statusRaw === "IN"
        ? "INACTIVE"
        : "UNKNOWN";

  const displayName = [titleName, name, surname]
    .filter((x) => x && x !== "-")
    .join(" ")
    .trim();

  const result: RdVatResult = {
    taxId,
    branchNo: (branchNumber ?? branchNo).padStart(5, "0"),
    branchName: branchName && branchName !== "-" ? branchName : null,
    titleName: titleName && titleName !== "-" ? titleName : null,
    name: displayName || name,
    surname: surname && surname !== "-" ? surname : null,
    juristicType: inferJuristicType(titleName, displayName || name),
    address: buildAddress(xml),
    postCode: postCode && postCode !== "-" ? postCode : null,
    province: province && province !== "-" ? province : null,
    status,
    businessFirstDate:
      businessFirstDate && businessFirstDate !== "-"
        ? businessFirstDate
        : null,
  };

  cache.set(key, { at: Date.now(), value: result });
  return result;
}
