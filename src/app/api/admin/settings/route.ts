import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

// GET /api/admin/settings — get tenant info + document sequences
export async function GET() {
  try {
    const session = await auth();
    requirePermission(session, ROLES.ADMIN_ONLY);
    const tenantId = session!.user.tenantId;

    const [tenant, sequences] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.documentSequence.findMany({
        where: { tenantId },
        orderBy: [{ prefix: "asc" }, { year: "desc" }],
      }),
    ]);

    return NextResponse.json({
      tenant: JSON.parse(JSON.stringify(tenant)),
      sequences: JSON.parse(JSON.stringify(sequences)),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/admin/settings — update tenant info
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.ADMIN_ONLY);
    const tenantId = session!.user.tenantId;

    const body = await req.json();
    const allowedFields = ["name", "taxId", "address", "phone", "email", "vatRate", "logo"];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "vatRate") {
          updateData[field] = parseFloat(body[field]) || 7;
        } else {
          updateData[field] = body[field] || null;
        }
      }
    }

    // name is required
    if (updateData.name === null) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    return NextResponse.json(JSON.parse(JSON.stringify(tenant)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
