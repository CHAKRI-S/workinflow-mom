import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { renderInvoicePdf } from "@/lib/pdf/render-invoice";
import { mapInvoiceToPdfData } from "@/lib/pdf/mappers";

type Params = { params: Promise<{ id: string }> };

// GET /api/finance/invoices/[id]/pdf — stream rendered PDF
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);
    const { id } = await params;
    const tenantId = session!.user.tenantId;

    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        salesOrder: { select: { orderNumber: true } },
        customer: {
          select: {
            name: true,
            billingAddress: true,
            taxId: true,
            branchNo: true,
            phone: true,
            email: true,
          },
        },
        createdBy: { select: { name: true } },
        lines: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        taxId: true,
        branchNo: true,
        address: true,
        phone: true,
        email: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const pdfData = mapInvoiceToPdfData(invoice, tenant);
    const buffer = await renderToBuffer(renderInvoicePdf(pdfData));
    // Node Buffer is a Uint8Array subclass — safe to pass directly.
    // Cast to BodyInit to satisfy strict Response types in Next.js.
    const body = new Uint8Array(buffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/finance/invoices/[id]/pdf error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
