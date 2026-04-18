import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว — WorkinFlow",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16 prose prose-slate dark:prose-invert">
      <h1>นโยบายความเป็นส่วนตัว</h1>
      <p className="text-muted-foreground">
        อัพเดตล่าสุด: {new Date().toLocaleDateString("th-TH")}
      </p>

      <h2>1. ข้อมูลที่เราเก็บ</h2>
      <p>
        WorkinFlow เก็บข้อมูลเฉพาะที่จำเป็นสำหรับการให้บริการ ได้แก่:
        ชื่อบริษัท เลขผู้เสียภาษี ที่อยู่ อีเมล เบอร์โทร ข้อมูลลูกค้าของคุณ
        และข้อมูลการผลิตที่บริษัทของคุณสร้างขึ้น
      </p>

      <h2>2. การใช้ข้อมูล</h2>
      <p>
        ข้อมูลของคุณถูกใช้เพื่อให้บริการระบบ การออกใบกำกับภาษี การรองรับ
        และการแจ้งเตือนที่จำเป็น เราไม่เปิดเผยข้อมูลให้บุคคลที่สามโดยไม่ได้รับอนุญาต
      </p>

      <h2>3. การเก็บรักษา</h2>
      <p>
        ข้อมูลถูกเก็บในเซิร์ฟเวอร์ในประเทศไทย มีการสำรองข้อมูลรายวัน
        ข้อมูลของแต่ละบริษัทแยก isolation ด้วย tenantId ทุกตาราง
      </p>

      <h2>4. สิทธิ์ของผู้ใช้</h2>
      <p>
        คุณสามารถขอ export ข้อมูลได้ทุกเมื่อ และขอลบข้อมูลได้เมื่อยกเลิกการใช้บริการ
      </p>

      <h2>5. ติดต่อ</h2>
      <p>
        หากมีคำถาม กรุณาส่งอีเมลมาที่ <a href="mailto:privacy@workinflow.cloud">privacy@workinflow.cloud</a>
      </p>
    </div>
  );
}
