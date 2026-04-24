import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { TENANT_CODE_MAX, TENANT_CODE_MIN } from "@/lib/tenant-provisioning";

const TENANT_CODE_RE = new RegExp(`^[A-Z0-9]{${TENANT_CODE_MIN},${TENANT_CODE_MAX}}$`);

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
    const allowedFields = [
      "name",
      "code",
      "taxId",
      "address",
      "phone",
      "email",
      "vatRate",
      "logo",
      "defaultBillingNature",
    ];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "vatRate") {
          updateData[field] = parseFloat(body[field]) || 7;
        } else if (field === "defaultBillingNature") {
          // Validate enum — reject bad input rather than silently storing.
          const allowed = ["GOODS", "MANUFACTURING_SERVICE", "MIXED"];
          if (!allowed.includes(body[field])) {
            return NextResponse.json(
              { error: "defaultBillingNature ไม่ถูกต้อง" },
              { status: 400 },
            );
          }
          updateData.defaultBillingNature = body[field];
        } else if (field === "code") {
          // Normalize: uppercase + strip invalid chars before validating.
          const raw = typeof body.code === "string" ? body.code : "";
          const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
          if (!TENANT_CODE_RE.test(normalized)) {
            return NextResponse.json(
              {
                error: `รหัสบริษัทต้องเป็น A-Z และ 0-9 เท่านั้น ยาว ${TENANT_CODE_MIN}-${TENANT_CODE_MAX} ตัว`,
              },
              { status: 400 },
            );
          }
          updateData.code = normalized;
        } else {
          updateData[field] = body[field] || null;
        }
      }
    }

    // name is required
    if (updateData.name === null) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    try {
      const tenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: updateData,
      });
      return NextResponse.json(JSON.parse(JSON.stringify(tenant)));
    } catch (err) {
      // Prisma unique constraint violation — code already taken by
      // another tenant.
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        return NextResponse.json(
          { error: "รหัสบริษัทนี้ถูกใช้แล้ว กรุณาเลือกรหัสอื่น" },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
