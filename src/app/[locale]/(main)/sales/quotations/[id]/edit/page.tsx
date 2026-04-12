import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, ROLES } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { QuotationForm } from "../../quotation-form";

export default async function EditQuotationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  requirePermission(session, ROLES.SALES_TEAM);

  const quotation = await prisma.quotation.findFirst({
    where: { id, tenantId: session!.user.tenantId },
    include: {
      lines: {
        include: {
          product: {
            select: { id: true, code: true, name: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!quotation) {
    notFound();
  }

  // Only DRAFT or REVISED can be edited
  if (quotation.status !== "DRAFT" && quotation.status !== "REVISED") {
    redirect(`/${locale}/sales/quotations/${id}`);
  }

  // Serialize and transform for the form
  const serialized = JSON.parse(JSON.stringify(quotation));

  const defaultValues = {
    customerId: serialized.customerId,
    validUntil: new Date(serialized.validUntil).toISOString().split("T")[0],
    paymentTerms: serialized.paymentTerms || "",
    deliveryTerms: serialized.deliveryTerms || "",
    leadTimeDays: serialized.leadTimeDays ?? undefined,
    discountPercent: Number(serialized.discountPercent),
    notes: serialized.notes || "",
    internalNotes: serialized.internalNotes || "",
    lines: serialized.lines.map(
      (line: {
        productId: string;
        description?: string;
        quantity: string;
        color?: string;
        surfaceFinish?: string;
        materialSpec?: string;
        unitPrice: string;
        discountPercent: string;
        notes?: string;
        sortOrder: number;
      }) => ({
        productId: line.productId,
        description: line.description || "",
        quantity: Number(line.quantity),
        color: line.color || "",
        surfaceFinish: line.surfaceFinish || "",
        materialSpec: line.materialSpec || "",
        unitPrice: Number(line.unitPrice),
        discountPercent: Number(line.discountPercent),
        notes: line.notes || "",
        sortOrder: line.sortOrder,
      })
    ),
  };

  return (
    <div className="mx-auto max-w-5xl">
      <QuotationForm
        mode="edit"
        defaultValues={defaultValues}
        quotationId={id}
      />
    </div>
  );
}
