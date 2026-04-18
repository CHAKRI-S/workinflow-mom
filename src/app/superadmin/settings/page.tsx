import { redirect } from "next/navigation";
import { getSaSession } from "@/lib/sa-auth";
import { prisma } from "@/lib/prisma";
import { SaShell } from "@/components/superadmin/sa-shell";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await getSaSession();
  if (!session) redirect("/login");

  const admins = await prisma.superAdmin.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return (
    <SaShell saName={session.name}>
      <SettingsClient
        currentSaId={session.sub}
        initialAdmins={admins.map((a) => ({
          id: a.id,
          username: a.username,
          email: a.email,
          name: a.name,
          isActive: a.isActive,
          lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </SaShell>
  );
}
