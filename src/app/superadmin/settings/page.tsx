import { redirect } from "next/navigation";
import { getSaSession } from "@/lib/sa-auth";
import { SaShell } from "@/components/superadmin/sa-shell";

export default async function SettingsPage() {
  const session = await getSaSession();
  if (!session) redirect("/login");

  return (
    <SaShell saName={session.name}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Settings</h1>
        <p className="text-muted-foreground">Platform configuration</p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div>
          <div className="text-sm text-muted-foreground">Logged in as</div>
          <div className="font-medium">{session.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {session.username} • {session.email}
          </div>
        </div>
        <div className="text-sm text-muted-foreground pt-4 border-t">
          Change password, platform config (Omise keys, SlipOK, email), และ SA user management
          จะเปิดใช้งานในเฟสถัดไป
        </div>
      </div>
    </SaShell>
  );
}
