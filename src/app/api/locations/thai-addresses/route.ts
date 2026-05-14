import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission, ROLES } from "@/lib/permissions";
import { searchThaiAddresses } from "@/lib/locations/thai-addresses";

// GET /api/locations/thai-addresses?q=&province=&district=&subdistrict=&postalCode=&limit=50
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.ALL);

    const params = req.nextUrl.searchParams;
    const result = searchThaiAddresses({
      q: params.get("q"),
      province: params.get("province"),
      district: params.get("district"),
      subdistrict: params.get("subdistrict"),
      postalCode: params.get("postalCode"),
      limit: params.get("limit"),
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/locations/thai-addresses error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
