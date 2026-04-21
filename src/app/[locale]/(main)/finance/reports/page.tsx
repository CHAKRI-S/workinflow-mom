import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, ROLES } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { BarChart3, FileBarChart, PieChart } from "lucide-react";

export default async function FinanceReportsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!hasPermission(session, ROLES.FINANCE)) return <AccessDenied />;

  const reports = [
    {
      href: "/finance/reports/revenue-by-nature",
      title: "รายงานรายได้ตามประเภทการขาย",
      description:
        "สัดส่วนรายได้แยกตาม Billing Nature (ขายสินค้า / รับจ้างทำของ / ผสม) พร้อม trend รายเดือน",
      icon: <PieChart className="h-5 w-5 text-blue-600" />,
    },
    {
      href: "/finance/reports/wht-credit-ledger",
      title: "รายงาน WHT Credit Ledger",
      description:
        "สรุปยอด WHT ที่ถูกหัก ณ ที่จ่ายทั้งปี สำหรับยื่น ภ.ง.ด.50/51 — มีรายการละเอียดสำหรับ export",
      icon: <FileBarChart className="h-5 w-5 text-emerald-600" />,
    },
    {
      href: "/finance/reports/drawing-source-mix",
      title: "รายงานแหล่งที่มาของแบบงาน",
      description:
        "สัดส่วนงานที่ tenant ออกแบบเอง vs ลูกค้าส่งแบบ — ใช้ detect business model drift และ WHT risk",
      icon: <BarChart3 className="h-5 w-5 text-amber-600" />,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">รายงานการเงิน</h1>
        <p className="text-sm text-muted-foreground mt-1">
          รายงานสำหรับการวิเคราะห์ รายได้ ภาษี และกลยุทธ์ธุรกิจ
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Link key={r.href} href={r.href}>
            <Card className="p-5 h-full hover:border-blue-500 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
                  {r.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{r.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {r.description}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
