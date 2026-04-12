import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const createImageSchema = z.object({
  url: z.string().min(1),
  caption: z.string().optional(),
});

// GET /api/production/products/[id]/images — list images for product
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.PRODUCTION);
  const { id } = await params;

  // Verify product belongs to tenant
  const product = await prisma.product.findFirst({
    where: { id, tenantId: session!.user.tenantId },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const images = await prisma.productImage.findMany({
    where: { productId: id },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(images);
}

// POST /api/production/products/[id]/images — create image record
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  requirePermission(session, ROLES.PRODUCTION);
  const { id } = await params;

  // Verify product belongs to tenant
  const product = await prisma.product.findFirst({
    where: { id, tenantId: session!.user.tenantId },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const data = createImageSchema.parse(body);

  // Get next sort order
  const maxSort = await prisma.productImage.aggregate({
    where: { productId: id },
    _max: { sortOrder: true },
  });

  const image = await prisma.productImage.create({
    data: {
      productId: id,
      url: data.url,
      caption: data.caption || null,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(image, { status: 201 });
}
