import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

// GET /api/finance/invoices/[id] — get invoice detail
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);
    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: session!.user.tenantId },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
            isVatRegistered: true,
            taxId: true,
            billingAddress: true,
          },
        },
        salesOrder: {
          select: { id: true, orderNumber: true },
        },
        lines: {
          orderBy: { sortOrder: "asc" },
        },
        taxInvoices: {
          select: {
            id: true,
            taxInvoiceNumber: true,
            status: true,
            totalAmount: true,
            issueDate: true,
          },
          orderBy: { issueDate: "desc" },
        },
        receipts: {
          select: {
            id: true,
            receiptNumber: true,
            status: true,
            amount: true,
            issueDate: true,
          },
          orderBy: { issueDate: "desc" },
        },
        creditNotes: {
          select: {
            id: true,
            creditNoteNumber: true,
            status: true,
            totalAmount: true,
            issueDate: true,
          },
          orderBy: { issueDate: "desc" },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(JSON.parse(JSON.stringify(invoice)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/finance/invoices/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/finance/invoices/[id] — update invoice (only DRAFT)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);
    const { id } = await params;
    const tenantId = session!.user.tenantId;

    const existing = await prisma.invoice.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();

    // Allow status changes
    if (body.status) {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ["ISSUED"],
        ISSUED: ["SENT", "CANCELLED"],
        SENT: ["PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"],
        PARTIALLY_PAID: ["PAID", "OVERDUE", "CANCELLED"],
        OVERDUE: ["PARTIALLY_PAID", "PAID", "CANCELLED"],
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

      const updated = await prisma.invoice.update({
        where: { id },
        data: { status: body.status },
        include: {
          customer: { select: { id: true, code: true, name: true } },
          salesOrder: { select: { id: true, orderNumber: true } },
        },
      });

      return NextResponse.json(JSON.parse(JSON.stringify(updated)));
    }

    // Only allow editing DRAFT invoices
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Can only edit invoices in DRAFT status" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.dueDate) updateData.dueDate = new Date(body.dueDate);
    if (body.notes !== undefined) updateData.notes = body.notes || null;

    const updated = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        customer: { select: { id: true, code: true, name: true } },
        salesOrder: { select: { id: true, orderNumber: true } },
        lines: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(updated)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("PATCH /api/finance/invoices/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
