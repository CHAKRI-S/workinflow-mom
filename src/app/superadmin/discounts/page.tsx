import { redirect } from "next/navigation";
import { getSaSession } from "@/lib/sa-auth";
import { SaShell } from "@/components/superadmin/sa-shell";
import { Tag } from "lucide-react";

export default async function DiscountsPage() {
  const session = await getSaSession();
  if (!session) redirect("/login");

  return (
    <SaShell saName={session.name}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Discount Codes</h1>
        <p className="text-muted-foreground">สร้างโค้ดส่วนลดสำหรับลูกค้า</p>
      </div>

      <div className="rounded-xl border-2 border-dashed bg-card p-12 text-center">
        <Tag className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
        <div className="font-medium mb-1">Discount CRUD — Coming in Phase 6</div>
        <div className="text-sm text-muted-foreground">
          จะเปิดใช้งานพร้อมกับ Omise / SlipOK payment integration
        </div>
      </div>
    </SaShell>
  );
}
