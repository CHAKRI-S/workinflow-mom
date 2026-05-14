import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { bomLineSchema } from "@/lib/validators/product";
import { generateMaterialCode } from "@/lib/code-gen";
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

  // Existing material lines must reference materials in the same tenant before
  // we delete any current BOM rows.
  const existingMaterialIds = Array.from(
    new Set(lines.flatMap((line) => (line.materialId ? [line.materialId] : []))),
  );

  if (existingMaterialIds.length > 0) {
    const materials = await prisma.material.findMany({
      where: { id: { in: existingMaterialIds }, tenantId: session!.user.tenantId },
      select: { id: true },
    });

    if (materials.length !== existingMaterialIds.length) {
      return NextResponse.json({ error: "Invalid materialId" }, { status: 400 });
    }
  }

  const tenantId = session!.user.tenantId;

  const isUniqueConstraintError = (err: unknown) =>
    typeof err === "object" && err !== null && "code" in err && err.code === "P2002";

  for (let attempt = 0; attempt < 5; attempt++) {
    const generatedMaterialCodes: string[] = [];

    const reserveGeneratedMaterialCode = async () => {
      const candidate = await generateMaterialCode(tenantId);
      const match = /^(.*?)(\d+)$/.exec(candidate);
      if (!match) return candidate;

      const [, prefix, suffix] = match;
      const width = suffix.length;
      const candidateNumber = Number.parseInt(suffix, 10);
      const maxReserved = generatedMaterialCodes.reduce((max, code) => {
        if (!code.startsWith(prefix)) return max;
        const n = Number.parseInt(code.slice(prefix.length), 10);
        return Number.isFinite(n) && n > max ? n : max;
      }, 0);

      const nextNumber = candidateNumber <= maxReserved ? maxReserved + 1 : candidateNumber;
      return `${prefix}${String(nextNumber).padStart(width, "0")}`;
    };

    try {
      // Replace all BOM lines in a transaction. Unique-code collisions retry the
      // whole transaction because PostgreSQL aborts a transaction after P2002.
      await prisma.$transaction(async (tx) => {
        await tx.bomLine.deleteMany({ where: { productId: id } });

        for (const [idx, line] of lines.entries()) {
          let materialId = line.materialId;

          if (line.newMaterial) {
            const code = await reserveGeneratedMaterialCode();
            const newMaterial = line.newMaterial;
            const material = await tx.material.create({
              data: {
                code,
                name: newMaterial.name,
                type: newMaterial.type || null,
                specification: newMaterial.specification || null,
                unit: newMaterial.unit,
                dimensions: newMaterial.dimensions || null,
                stockQty: 0,
                minStockQty: newMaterial.minStockQty,
                unitCost: newMaterial.unitCost ?? null,
                tenantId,
              },
            });
            generatedMaterialCodes.push(code);
            materialId = material.id;
          }

          await tx.bomLine.create({
            data: {
              productId: id,
              materialId: materialId!,
              qtyPerUnit: line.qtyPerUnit,
              materialSize: line.materialSize,
              materialType: line.materialType,
              piecesPerStock: line.piecesPerStock,
              notes: line.notes,
              sourcing: line.sourcing,
              sortOrder: line.sortOrder ?? idx,
            },
          });
        }
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      if (isUniqueConstraintError(err)) continue;
      throw err;
    }
  }

  return NextResponse.json(
    { error: "ไม่สามารถสร้างรหัสวัตถุดิบที่ไม่ซ้ำได้" },
    { status: 409 },
  );
}
