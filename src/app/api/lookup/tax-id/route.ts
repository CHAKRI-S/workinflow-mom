import { NextRequest, NextResponse } from "next/server";
import { lookupByTaxId, RdVatLookupError } from "@/lib/rd-vat-lookup";

// Simple token-bucket style rate limit per IP (5 req / 10s)
const rateMap = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10_000;
const MAX_REQ = 5;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_REQ) return false;
  entry.count += 1;
  return true;
}

// POST /api/lookup/tax-id  { taxId, branchNo? }
// Public-ish endpoint: usable during signup too (no tenant context yet).
// Rate-limited per IP to prevent scraping.
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: "กรุณารอสักครู่แล้วลองใหม่" },
      { status: 429 },
    );
  }

  let body: { taxId?: string; branchNo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const taxId = (body.taxId ?? "").trim();
  const branchNo = (body.branchNo ?? "").trim();

  if (!/^\d{13}$/.test(taxId.replace(/[^\d]/g, ""))) {
    return NextResponse.json(
      { error: "เลขผู้เสียภาษีต้องมี 13 หลัก" },
      { status: 400 },
    );
  }

  try {
    const result = await lookupByTaxId(taxId, branchNo);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RdVatLookupError) {
      const statusMap: Record<RdVatLookupError["code"], number> = {
        INVALID_TIN: 400,
        NOT_FOUND: 404,
        UPSTREAM_ERROR: 502,
        NETWORK_ERROR: 504,
      };
      const msgMap: Record<RdVatLookupError["code"], string> = {
        INVALID_TIN: "เลขผู้เสียภาษีไม่ถูกต้อง",
        NOT_FOUND:
          "ไม่พบเลขผู้เสียภาษีนี้ในระบบกรมสรรพากร — กรุณากรอกข้อมูลเอง",
        UPSTREAM_ERROR:
          "ระบบกรมสรรพากรไม่ตอบสนอง — กรุณาลองใหม่ภายหลัง",
        NETWORK_ERROR:
          "ไม่สามารถติดต่อระบบกรมสรรพากร — กรุณาลองใหม่ภายหลัง",
      };
      return NextResponse.json(
        { error: msgMap[err.code], code: err.code },
        { status: statusMap[err.code] },
      );
    }
    console.error("tax-id lookup error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
