import { redirect } from "next/navigation";
import { getSaSession } from "@/lib/sa-auth";
import { SaShell } from "@/components/superadmin/sa-shell";
import { SubscriptionDetailClient } from "./subscription-detail-client";

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSaSession();
  if (!session) redirect("/login");
  const { id } = await params;

  return (
    <SaShell saName={session.name}>
      <SubscriptionDetailClient id={id} />
    </SaShell>
  );
}
