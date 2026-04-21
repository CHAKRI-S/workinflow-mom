import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { createAuditLog, canEditDocument, canCancelDocument } from "@/lib/audit";
import { receiptCertUpdateSchema } from "@/lib/validators/receipt";

type Params = { params: Promise<{ id: string }> };

// GET /api/finance/receipts/[id] — get receipt detail
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);
    const { id } = await params;

    const receipt = await prisma.receipt.findFirst({
      where: { id, tenantId: session!.user.tenantId },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            billingNature: true,
            customer: {
              select: {
                id: true,
                code: true,
                name: true,
                withholdsTax: true,
              },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(JSON.parse(JSON.stringify(receipt)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/finance/receipts/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/finance/receipts/[id] — update receipt status or WHT cert
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);
    const { id } = await params;
    const tenantId = session!.user.tenantId;

    const existing = await prisma.receipt.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();

    // ── 1) Status transition ────────────────────────────
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

      const statusUpdateData: Record<string, unknown> = { status: body.status };

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

      const updated = await prisma.receipt.update({
        where: { id },
        data: statusUpdateData,
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      });

      await createAuditLog({
        action: body.status === "CANCELLED" ? "CANCEL" : "STATUS_CHANGE",
        entityType: "Receipt",
        entityId: id,
        entityNumber: existing.receiptNumber,
        changes: { status: { from: existing.status, to: body.status } },
        reason: body.cancelReason || undefined,
        userId: session!.user.id,
        userName: session!.user.name || "",
        tenantId,
      });

      return NextResponse.json(JSON.parse(JSON.stringify(updated)));
    }

    // ── 2) WHT cert update (allowed on any non-cancelled status) ──
    // Cert tracking is metadata — doesn't change receipt financials.
    if (
      body.whtCertNumber !== undefined ||
      body.whtCertFileUrl !== undefined ||
      body.whtCertReceivedAt !== undefined ||
      body.whtCertStatus !== undefined
    ) {
      if (existing.status === "CANCELLED") {
        return NextResponse.json(
          { error: "Cannot update cert on cancelled receipt" },
          { status: 400 }
        );
      }

      const parsed = receiptCertUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid cert input", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const c = parsed.data;

      // Auto-progression: if file+number provided but status still PENDING → RECEIVED
      let nextStatus = c.whtCertStatus ?? existing.whtCertStatus;
      if (!c.whtCertStatus) {
        const willHaveNumber = c.whtCertNumber ?? existing.whtCertNumber;
        const willHaveFile = c.whtCertFileUrl ?? existing.whtCertFileUrl;
        if (
          existing.whtCertStatus === "PENDING" &&
          (willHaveNumber || willHaveFile)
        ) {
          nextStatus = "RECEIVED";
        }
      }

      // Guard: can't change status to RECEIVED/VERIFIED without a cert number
      if (
        (nextStatus === "RECEIVED" || nextStatus === "VERIFIED") &&
        !(c.whtCertNumber ?? existing.whtCertNumber)
      ) {
        return NextResponse.json(
          { error: "Cert number required for RECEIVED/VERIFIED status" },
          { status: 400 }
        );
      }

      const updated = await prisma.receipt.update({
        where: { id },
        data: {
          ...(c.whtCertNumber !== undefined && {
            whtCertNumber: c.whtCertNumber,
          }),
          ...(c.whtCertFileUrl !== undefined && {
            whtCertFileUrl: c.whtCertFileUrl,
          }),
          ...(c.whtCertReceivedAt !== undefined && {
            whtCertReceivedAt: c.whtCertReceivedAt
              ? new Date(c.whtCertReceivedAt)
              : null,
          }),
          whtCertStatus: nextStatus,
          // Auto-stamp receivedAt if moving into RECEIVED and not provided
          ...(nextStatus === "RECEIVED" &&
            existing.whtCertStatus !== "RECEIVED" &&
            c.whtCertReceivedAt === undefined &&
            !existing.whtCertReceivedAt && {
              whtCertReceivedAt: new Date(),
            }),
        },
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      });

      await createAuditLog({
        action: "UPDATE",
        entityType: "Receipt",
        entityId: id,
        entityNumber: existing.receiptNumber,
        changes: {
          whtCertStatus: {
            from: existing.whtCertStatus,
            to: nextStatus,
          },
          ...(c.whtCertNumber !== undefined && {
            whtCertNumber: {
              from: existing.whtCertNumber,
              to: c.whtCertNumber,
            },
          }),
        },
        userId: session!.user.id,
        userName: session!.user.name || "",
        tenantId,
      });

      return NextResponse.json(JSON.parse(JSON.stringify(updated)));
    }

    // Field edit — only DRAFT
    if (!canEditDocument(existing.status)) {
      return NextResponse.json(
        {
          error:
            "Cannot edit document after it has been issued. Create a credit note or cancel and reissue.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("PATCH /api/finance/receipts/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
