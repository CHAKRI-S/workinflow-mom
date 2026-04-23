import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { generateDocNumber, receiptPrefix } from "@/lib/doc-numbering";
import { createAuditLog } from "@/lib/audit";
import { Prisma } from "@/generated/prisma/client";
import {
  receiptCreateSchema,
  computeWht,
  resolveWhtPolicy,
} from "@/lib/validators/receipt";

// GET /api/finance/receipts — list all receipts for tenant
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const whtCertStatus = searchParams.get("whtCertStatus");

    const where: Prisma.ReceiptWhereInput = {
      tenantId: session!.user.tenantId,
    };

    if (status && status !== "ALL") {
      where.status = status as Prisma.ReceiptWhereInput["status"];
    }
    if (whtCertStatus && whtCertStatus !== "ALL") {
      where.whtCertStatus =
        whtCertStatus as Prisma.ReceiptWhereInput["whtCertStatus"];
    }

    const receipts = await prisma.receipt.findMany({
      where,
      orderBy: { issueDate: "desc" },
      include: {
        invoice: { select: { id: true, invoiceNumber: true } },
      },
    });

    return NextResponse.json(JSON.parse(JSON.stringify(receipts)));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("GET /api/finance/receipts error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/finance/receipts — create new receipt
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    requirePermission(session, ROLES.FINANCE);

    const raw = await req.json();
    const parsed = receiptCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const tenantId = session!.user.tenantId;

    // Fetch invoice + customer (for VAT + WHT policy)
    const invoice = await prisma.invoice.findFirst({
      where: { id: body.invoiceId, tenantId },
      include: {
        customer: {
          select: {
            isVatRegistered: true,
            withholdsTax: true,
            country: true,
          },
        },
      },
    });

    if (!invoice || !invoice.customer) {
      return NextResponse.json(
        { error: "Invoice or customer not found" },
        { status: 404 }
      );
    }

    if (invoice.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cannot create receipt for cancelled invoice" },
        { status: 400 }
      );
    }

    // Resolve WHT policy
    const hasCert = Boolean(body.whtCertNumber || body.whtCertFileUrl);
    const { whtRate, certStatus } = resolveWhtPolicy({
      billingNature: invoice.billingNature,
      customerWithholdsTax: invoice.customer.withholdsTax,
      override: body.whtRateOverride,
      hasCert,
      customerCountry: invoice.customer.country,
      isDeposit: body.isDeposit ?? false,
    });

    const { whtAmount, netAmount } = computeWht({
      grossAmount: body.grossAmount,
      whtRate,
    });

    const receipt = await prisma.$transaction(async (tx) => {
      const prefix = receiptPrefix(invoice.customer!.isVatRegistered);
      const receiptNumber = await generateDocNumber(tenantId, prefix);

      const created = await tx.receipt.create({
        data: {
          receiptNumber,
          invoiceId: body.invoiceId,
          status: "DRAFT",
          issueDate: new Date(),
          // ยอดสุทธิที่รับจริง (net of WHT)
          amount: new Prisma.Decimal(netAmount),
          // Snapshot billing nature
          billingNature: invoice.billingNature,
          grossAmount: new Prisma.Decimal(body.grossAmount),
          whtRate: new Prisma.Decimal(whtRate),
          whtAmount: new Prisma.Decimal(whtAmount),
          whtCertNumber: body.whtCertNumber || null,
          whtCertFileUrl: body.whtCertFileUrl || null,
          whtCertReceivedAt: body.whtCertReceivedAt
            ? new Date(body.whtCertReceivedAt)
            : hasCert
              ? new Date()
              : null,
          whtCertStatus: certStatus,
          payerName: body.payerName,
          payerTaxId: body.payerTaxId || null,
          payerAddress: body.payerAddress || null,
          isDeposit: body.isDeposit ?? false,
          notes: body.notes || null,
          createdById: session!.user.id,
          tenantId,
        },
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      });

      return created;
    });

    await createAuditLog({
      action: "CREATE",
      entityType: "Receipt",
      entityId: receipt.id,
      entityNumber: receipt.receiptNumber,
      changes: {
        grossAmount: { from: null, to: body.grossAmount },
        whtRate: { from: null, to: whtRate },
        whtAmount: { from: null, to: whtAmount },
        netAmount: { from: null, to: netAmount },
        whtCertStatus: { from: null, to: certStatus },
        isDeposit: { from: null, to: body.isDeposit ?? false },
      },
      userId: session!.user.id,
      userName: session!.user.name || "",
      tenantId,
    });

    return NextResponse.json(JSON.parse(JSON.stringify(receipt)), {
      status: 201,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.error("POST /api/finance/receipts error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
