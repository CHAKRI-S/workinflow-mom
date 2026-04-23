import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { customerUpdateSchema } from "@/lib/validators/customer";
import { Prisma } from "@/generated/prisma/client";

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

  // Normalize empty-string juristicType → null, handle branchNo/country
  const { juristicType, branchNo, country, brandingAssets, ...rest } = data;
  const patch: Record<string, unknown> = { ...rest };
  if (juristicType !== undefined) {
    patch.juristicType = juristicType || null;
  }
  if (branchNo !== undefined) patch.branchNo = branchNo?.trim() || null;
  if (country !== undefined) patch.country = country?.trim() || "TH";
  if (brandingAssets !== undefined) {
    if (brandingAssets === null) {
      patch.brandingAssets = Prisma.DbNull;
    } else {
      const trimmed = Object.fromEntries(
        Object.entries(brandingAssets).filter(
          ([, v]) => typeof v === "string" && v.trim() !== "",
        ),
      );
      patch.brandingAssets =
        Object.keys(trimmed).length > 0 ? trimmed : Prisma.DbNull;
    }
  }

  const customer = await prisma.customer.updateMany({
    where: { id, tenantId: session!.user.tenantId },
    data: patch,
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
