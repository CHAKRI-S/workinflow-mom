import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { customerUpdateSchema } from "@/lib/validators/customer";

type Params = { params: Promise<{ id: string }> };

// GET /api/sales/customers/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.ALL);
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, tenantId: session!.user.tenantId },
    include: {
      contacts: true,
      _count: { select: { salesOrders: true, quotations: true, invoices: true } },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(customer);
}

// PATCH /api/sales/customers/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.SALES_TEAM);
  const { id } = await params;

  const body = await req.json();
  const data = customerUpdateSchema.parse(body);

  const customer = await prisma.customer.updateMany({
    where: { id, tenantId: session!.user.tenantId },
    data,
  });

  if (customer.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/sales/customers/[id] — soft delete
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.MANAGEMENT);
  const { id } = await params;

  await prisma.customer.updateMany({
    where: { id, tenantId: session!.user.tenantId },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
