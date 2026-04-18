import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { customerCreateSchema } from "@/lib/validators/customer";
import { requireCustomerAvailable, planLimitResponse } from "@/lib/plan-limits";

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

    // Plan limit check
    await requireCustomerAvailable(session!.user.tenantId);

    const customer = await prisma.customer.create({
      data: {
        ...data,
        tenantId: session!.user.tenantId,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (err) {
    const limitRes = planLimitResponse(err);
    if (limitRes) return limitRes;
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("POST /api/sales/customers error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
