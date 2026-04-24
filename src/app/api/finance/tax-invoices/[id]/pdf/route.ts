import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { renderTaxInvoicePdf } from "@/lib/pdf/render-tax-invoice";
import { mapTaxInvoiceToPdfData } from "@/lib/pdf/mappers";

type Params = { params: Promise<{ id: string }> };

// GET /api/finance/tax-invoices/[id]/pdf — stream rendered PDF
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);
    const { id } = await params;
    const tenantId = session!.user.tenantId;

    const taxInvoice = await prisma.taxInvoice.findFirst({
      where: { id, tenantId },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            lines: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    if (!taxInvoice) {
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
        isVatRegistered: true, // Phase 8.12
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Phase 8.12 — a non-VAT registered seller cannot legally issue a tax
    // invoice (ม.86 ประมวลรัษฎากร). Block at the API layer. The tax-invoice
    // CREATE route should also prevent this; this is belt-and-suspenders
    // for pre-existing rows.
    if (!tenant.isVatRegistered) {
      return NextResponse.json(
        {
          error:
            "ไม่สามารถออกใบกำกับภาษีได้ — บริษัทยังไม่ได้จดทะเบียนภาษีมูลค่าเพิ่ม (ม.86 ประมวลรัษฎากร)",
        },
        { status: 422 }
      );
    }

    const pdfData = mapTaxInvoiceToPdfData(taxInvoice, tenant);
    const buffer = await renderToBuffer(renderTaxInvoicePdf(pdfData));
    const body = new Uint8Array(buffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${taxInvoice.taxInvoiceNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/finance/tax-invoices/[id]/pdf error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
