import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { z } from "zod";
import { QuotationStatus } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

const statusChangeSchema = z.object({
  status: z.nativeEnum(QuotationStatus),
});

// Allowed status transitions
const ALLOWED_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: [QuotationStatus.SENT, QuotationStatus.CANCELLED, QuotationStatus.REVISED],
  SENT: [
    QuotationStatus.APPROVED,
    QuotationStatus.REJECTED,
    QuotationStatus.CANCELLED,
    QuotationStatus.REVISED,
  ],
  REVISED: [QuotationStatus.SENT, QuotationStatus.CANCELLED, QuotationStatus.REVISED],
  APPROVED: [QuotationStatus.REVISED],
  REJECTED: [QuotationStatus.REVISED],
  EXPIRED: [QuotationStatus.REVISED],
  CANCELLED: [],
};

// PATCH /api/sales/quotations/[id]/status — change status
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.SALES_TEAM);
    const { id } = await params;
    const tenantId = session!.user.tenantId;

    const body = await req.json();
    const { status: newStatus } = statusChangeSchema.parse(body);

    const existing = await prisma.quotation.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const allowedNext = ALLOWED_TRANSITIONS[existing.status];
    if (!allowedNext.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from ${existing.status} to ${newStatus}`,
          allowedTransitions: allowedNext,
        },
        { status: 400 }
      );
    }

    // If transitioning to REVISED, bump revision number
    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === QuotationStatus.REVISED) {
      updateData.revision = existing.revision + 1;
      // Reset to allow editing
      updateData.status = QuotationStatus.REVISED;
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: updateData,
      include: {
        customer: { select: { id: true, code: true, name: true } },
      },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(updated)));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error },
        { status: 400 }
      );
    }
    console.error("PATCH /api/sales/quotations/[id]/status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
