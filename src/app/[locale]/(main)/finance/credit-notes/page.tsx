import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CreditNoteListClient } from "./credit-note-list-client";

export default async function CreditNotesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const creditNotes = await prisma.creditNote.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { issueDate: "desc" },
    include: {
      invoice: { select: { id: true, invoiceNumber: true } },
    },
  });

  return (
    <CreditNoteListClient
      creditNotes={JSON.parse(JSON.stringify(creditNotes))}
    />
  );
}
