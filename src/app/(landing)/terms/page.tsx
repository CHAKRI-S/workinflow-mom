import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "เงื่อนไขการใช้งาน — WorkinFlow",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16 prose prose-slate dark:prose-invert">
      <h1>เงื่อนไขการใช้งาน</h1>
      <p className="text-muted-foreground">
        อัพเดตล่าสุด: {new Date().toLocaleDateString("th-TH")}
      </p>

      <h2>1. การยอมรับเงื่อนไข</h2>
      <p>
        การใช้บริการ WorkinFlow ถือว่าคุณยอมรับเงื่อนไขเหล่านี้
      </p>

      <h2>2. บัญชีผู้ใช้งาน</h2>
      <p>
        ผู้ใช้งานมีหน้าที่รักษาความปลอดภัยของ username และรหัสผ่าน
        การกระทำใดๆ บนบัญชีถือเป็นความรับผิดชอบของผู้ถือบัญชี
      </p>

      <h2>3. ค่าบริการ</h2>
      <p>
        เริ่มใช้งานฟรี 30 วัน หลังจากนั้นจะเป็นไปตามแผนที่เลือก
        การต่ออายุทำโดยอัตโนมัติจนกว่าจะยกเลิก
      </p>

      <h2>4. การยกเลิกบริการ</h2>
      <p>
        คุณสามารถยกเลิกได้ทุกเมื่อ ไม่มีค่าปรับ ข้อมูลจะถูกเก็บไว้ 90 วันหลังยกเลิก
        สามารถ export ได้ทั้งหมดก่อนยกเลิก
      </p>

      <h2>5. ข้อจำกัดความรับผิด</h2>
      <p>
        WorkinFlow ไม่รับผิดชอบต่อความเสียหายที่เกิดจากการหยุดชะงักของบริการ
        เราพยายามรักษา uptime 99.5% แต่ไม่รับประกัน
      </p>

      <h2>6. การเปลี่ยนแปลงเงื่อนไข</h2>
      <p>
        เราขอสงวนสิทธิ์ในการปรับเงื่อนไข จะแจ้งล่วงหน้าอย่างน้อย 30 วันผ่านอีเมล
      </p>

      <h2>7. ติดต่อ</h2>
      <p>
        <a href="mailto:hello@workinflow.cloud">hello@workinflow.cloud</a>
      </p>
    </div>
  );
}
