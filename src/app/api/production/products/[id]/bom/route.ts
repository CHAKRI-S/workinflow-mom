import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { bomLineSchema } from "@/lib/validators/product";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

// PUT /api/production/products/[id]/bom — replace all BOM lines
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.PLANNING);
  const { id } = await params;

  const body = await req.json();
  const lines = z.array(bomLineSchema).parse(body.lines);

  // Verify product belongs to tenant
  const product = await prisma.product.findFirst({
    where: { id, tenantId: session!.user.tenantId },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Replace all BOM lines in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.bomLine.deleteMany({ where: { productId: id } });

    if (lines.length > 0) {
      await tx.bomLine.createMany({
        data: lines.map((line, idx) => ({
          productId: id,
          materialId: line.materialId,
          qtyPerUnit: line.qtyPerUnit,
          materialSize: line.materialSize,
          materialType: line.materialType,
          piecesPerStock: line.piecesPerStock,
          notes: line.notes,
          sortOrder: line.sortOrder ?? idx,
        })),
      });
    }
  });

  return NextResponse.json({ success: true });
}
