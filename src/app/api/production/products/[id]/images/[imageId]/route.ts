import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";

type Params = { params: Promise<{ id: string; imageId: string }> };

// DELETE /api/production/products/[id]/images/[imageId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.PRODUCTION);
  const { id, imageId } = await params;

  // Verify product belongs to tenant
  const product = await prisma.product.findFirst({
    where: { id, tenantId: session!.user.tenantId },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete only if image belongs to this product
  const deleted = await prisma.productImage.deleteMany({
    where: { id: imageId, productId: id },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
