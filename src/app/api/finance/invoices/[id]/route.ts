import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { createAuditLog, canEditDocument, canCancelDocument } from "@/lib/audit";

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

      const statusUpdateData: Record<string, unknown> = { status: body.status };

      // Cancel requires reason
      if (body.status === "CANCELLED") {
        if (!canCancelDocument(existing.status)) {
          return NextResponse.json(
            { error: "Document is already cancelled" },
            { status: 400 }
          );
        }
        const { cancelReason } = body;
        if (!cancelReason) {
          return NextResponse.json(
            { error: "Cancel reason is required" },
            { status: 400 }
          );
        }
        statusUpdateData.cancelledAt = new Date();
        statusUpdateData.cancelledById = session!.user.id;
        statusUpdateData.cancelReason = cancelReason;
      }

      const updated = await prisma.invoice.update({
        where: { id },
        data: statusUpdateData,
        include: {
          customer: { select: { id: true, code: true, name: true } },
          salesOrder: { select: { id: true, orderNumber: true } },
        },
      });

      await createAuditLog({
        action: body.status === "CANCELLED" ? "CANCEL" : "STATUS_CHANGE",
        entityType: "Invoice",
        entityId: id,
        entityNumber: existing.invoiceNumber,
        changes: { status: { from: existing.status, to: body.status } },
        reason: body.cancelReason || undefined,
        userId: session!.user.id,
        userName: session!.user.name || "",
        tenantId,
      });

      return NextResponse.json(JSON.parse(JSON.stringify(updated)));
    }

    // Field edit — only DRAFT
    if (!canEditDocument(existing.status)) {
      return NextResponse.json(
        { error: "Cannot edit document after it has been issued. Create a credit note or cancel and reissue." },
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

    await createAuditLog({
      action: "UPDATE",
      entityType: "Invoice",
      entityId: id,
      entityNumber: existing.invoiceNumber,
      changes: Object.fromEntries(
        Object.entries(updateData).map(([k, v]) => [k, { from: (existing as Record<string, unknown>)[k], to: v }])
      ),
      userId: session!.user.id,
      userName: session!.user.name || "",
      tenantId,
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

// DELETE /api/finance/invoices/[id] — soft cancel invoice
export async function DELETE(req: NextRequest, { params }: Params) {
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

    if (!canCancelDocument(existing.status)) {
      return NextResponse.json(
        { error: "Document is already cancelled" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { cancelReason } = body as { cancelReason?: string };

    if (!cancelReason) {
      return NextResponse.json(
        { error: "Cancel reason is required" },
        { status: 400 }
      );
    }

    await prisma.invoice.updateMany({
      where: { id, tenantId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: session!.user.id,
        cancelReason,
      },
    });

    await createAuditLog({
      action: "CANCEL",
      entityType: "Invoice",
      entityId: id,
      entityNumber: existing.invoiceNumber,
      changes: { status: { from: existing.status, to: "CANCELLED" } },
      reason: cancelReason,
      userId: session!.user.id,
      userName: session!.user.name || "",
      tenantId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("DELETE /api/finance/invoices/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
