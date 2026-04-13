import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { prisma } from "@/lib/prisma";
import { CreditNoteDetailClient } from "./credit-note-detail-client";

export default async function CreditNoteDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.FINANCE)) return <AccessDenied />;

  const creditNote = await prisma.creditNote.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          customer: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
      lines: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!creditNote) notFound();

  return (
    <CreditNoteDetailClient
      creditNote={JSON.parse(JSON.stringify(creditNote))}
    />
  );
}
