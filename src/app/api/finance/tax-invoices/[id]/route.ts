import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET /api/finance/tax-invoices/[id] — get tax invoice detail
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);
    const { id } = await params;

    const taxInvoice = await prisma.taxInvoice.findFirst({
      where: { id, tenantId: session!.user.tenantId },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            customer: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!taxInvoice) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(JSON.parse(JSON.stringify(taxInvoice)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/finance/tax-invoices/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/finance/tax-invoices/[id] — update tax invoice status
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);
    const { id } = await params;
    const tenantId = session!.user.tenantId;

    const existing = await prisma.taxInvoice.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();

    if (body.status) {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ["ISSUED"],
        ISSUED: ["CANCELLED"],
      };

      const allowed = validTransitions[existing.status] || [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          {
            error: `Cannot transition from ${existing.status} to ${body.status}`,
          },
          { status: 400 }
        );
      }

      const updated = await prisma.taxInvoice.update({
        where: { id },
        data: { status: body.status },
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      });

      return NextResponse.json(JSON.parse(JSON.stringify(updated)));
    }

    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("PATCH /api/finance/tax-invoices/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
