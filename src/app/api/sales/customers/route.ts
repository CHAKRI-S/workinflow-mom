import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { customerCreateSchema } from "@/lib/validators/customer";
import { requireCustomerAvailable, planLimitResponse } from "@/lib/plan-limits";
import {
  createWithGeneratedCode,
  generateCustomerCode,
} from "@/lib/code-gen";
import { Prisma } from "@/generated/prisma/client";

// GET /api/sales/customers — list all customers
export async function GET() {
  const session = await auth();
  requirePermission(session, ROLES.ALL);

  const customers = await prisma.customer.findMany({
    where: { tenantId: session!.user.tenantId, isActive: true },
    orderBy: { code: "asc" },
    include: { _count: { select: { salesOrders: true, quotations: true } } },
  });

  return NextResponse.json(customers);
}

// POST /api/sales/customers — create new customer
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.SALES_TEAM);

    const body = await req.json();
    const data = customerCreateSchema.parse(body);
    const tenantId = session!.user.tenantId;

    // Plan limit check
    await requireCustomerAvailable(tenantId);

    const providedCode = data.code?.trim();
    const { code: _ignored, juristicType, branchNo, country, ...rest } = data;
    const cleaned = {
      ...rest,
      juristicType: juristicType || null,
      branchNo: branchNo?.trim() || null,
      country: country?.trim() || "TH",
    };

    const customer = providedCode
      ? await prisma.customer.create({
          data: { ...cleaned, code: providedCode, tenantId },
        })
      : await createWithGeneratedCode({
          generate: () => generateCustomerCode(tenantId),
          create: (code) =>
            prisma.customer.create({
              data: { ...cleaned, code, tenantId },
            }),
        });

    return NextResponse.json(customer, { status: 201 });
  } catch (err) {
    const limitRes = planLimitResponse(err);
    if (limitRes) return limitRes;
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    // Manually-entered code collides with an existing customer in this tenant
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "รหัสลูกค้านี้ถูกใช้แล้ว" },
        { status: 409 },
      );
    }
    console.error("POST /api/sales/customers error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
