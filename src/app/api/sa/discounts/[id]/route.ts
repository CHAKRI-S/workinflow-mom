import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaSession } from "@/lib/sa-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSaSession();
    const { id } = await params;
    const body = await req.json();
    const code = await prisma.discountCode.update({
      where: { id },
      data: {
        description: body.description,
        isActive: body.isActive,
        validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
        validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
        maxUses: body.maxUses,
        maxUsesPerTenant: body.maxUsesPerTenant,
      },
    });
    return NextResponse.json(code);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSaSession();
    const { id } = await params;
    const inUse = await prisma.subscription.count({ where: { discountCodeId: id } });
    if (inUse > 0) {
      return NextResponse.json(
        { error: `ลบไม่ได้ — code ถูกใช้โดย ${inUse} subscription` },
        { status: 409 },
      );
    }
    await prisma.discountCode.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
