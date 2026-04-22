import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SubscriptionInvoicePdf } from "@/lib/pdf/templates/subscription-invoice";
import { mapSubscriptionInvoiceForPdf } from "@/lib/pdf/mappers";
import { getPlatformSettings } from "@/lib/platform-settings";

type Params = { params: Promise<{ id: string }> };

// GET /api/billing/invoices/[id]/pdf — download PDF for a SubscriptionInvoice.
// Tenant-side auth (NextAuth session) — tenant can only download their own
// platform subscription invoices.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.user.tenantId;

    const invoice = await prisma.subscriptionInvoice.findUnique({
      where: { id },
      include: {
        subscription: {
          select: {
            billingCycle: true,
            periodStart: true,
            periodEnd: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (invoice.tenantId !== tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const platformSettings = await getPlatformSettings();

    const pdfData = mapSubscriptionInvoiceForPdf(
      {
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        paidAt: invoice.paidAt,
        tenantName: invoice.tenantName,
        tenantTaxId: invoice.tenantTaxId,
        tenantAddress: invoice.tenantAddress,
        planName: invoice.planName,
        subtotalSatang: invoice.subtotalSatang,
        discountSatang: invoice.discountSatang,
        vatSatang: invoice.vatSatang,
        totalSatang: invoice.totalSatang,
      },
      invoice.subscription,
      { name: invoice.planName },
      platformSettings
    );

    const buffer = await renderToBuffer(SubscriptionInvoicePdf({ data: pdfData }));
    const body = new Uint8Array(buffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="SUB-INV-${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/billing/invoices/[id]/pdf error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
