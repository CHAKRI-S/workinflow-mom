import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { FileText, Table2, Users, Package, Boxes, Cpu, ShoppingCart, Receipt, ClipboardList } from "lucide-react";

interface ExportItem {
  entity: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const EXPORTS: ExportItem[] = [
  { entity: "customers", label: "ลูกค้า", desc: "รายชื่อลูกค้าทั้งหมด (code, name, taxId, address)", icon: Users },
  { entity: "products", label: "สินค้า", desc: "ชิ้นงานสำเร็จรูปและราคาอ้างอิง", icon: Package },
  { entity: "materials", label: "วัตถุดิบ", desc: "สต็อกและต้นทุนวัตถุดิบ", icon: Boxes },
  { entity: "machines", label: "เครื่อง CNC", desc: "รายการเครื่อง CNC และสถานะ", icon: Cpu },
  { entity: "sales-orders", label: "ใบสั่งซื้อ", desc: "Sales Orders ทั้งหมด", icon: ShoppingCart },
  { entity: "invoices", label: "ใบแจ้งหนี้", desc: "Invoices ทั้งหมด", icon: Receipt },
  { entity: "work-orders", label: "ใบสั่งผลิต", desc: "Work Orders ทั้งหมด", icon: ClipboardList },
];

export default async function ExportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.MANAGEMENT)) return <AccessDenied />;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Export ข้อมูล</h1>
        <p className="text-sm text-muted-foreground">
          ดาวน์โหลดข้อมูลของบริษัทเป็น CSV (เปิดด้วย Excel ได้ รองรับภาษาไทย)
        </p>
      </div>

      <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-800">
        XLSX รองรับ Excel ทุกเวอร์ชัน เหมาะสำหรับวิเคราะห์ข้อมูล
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {EXPORTS.map((e) => (
          <div
            key={e.entity}
            className="flex items-start gap-3 rounded-xl border bg-card p-4"
          >
            <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <e.icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium mb-1">{e.label}</div>
              <div className="text-xs text-muted-foreground mb-3">{e.desc}</div>
              <div className="flex gap-2">
                <a
                  href={`/api/admin/export/${e.entity}`}
                  download
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition"
                >
                  <FileText className="h-3.5 w-3.5" />
                  CSV
                </a>
                <a
                  href={`/api/admin/export/${e.entity}?format=xlsx`}
                  download
                  className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 transition"
                >
                  <Table2 className="h-3.5 w-3.5" />
                  XLSX
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
        <strong>หมายเหตุ:</strong> ข้อมูลถูก export ในขณะที่คุณดาวน์โหลด — ไม่ได้เก็บไว้บน server
      </div>
    </div>
  );
}
