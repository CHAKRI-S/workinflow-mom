import type { Metadata } from "next";
import { PricingSection } from "@/components/landing/pricing-section";

export const metadata: Metadata = {
  title: "ราคา — WorkinFlow MOM",
  description: "เลือกแผนที่เหมาะกับโรงงานของคุณ ทดลองใช้ฟรี 30 วัน เริ่มต้นเพียง ฿990/เดือน",
};

export default function PricingPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">ราคา</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          เลือกแผนที่เหมาะกับขนาดโรงงาน อัพเกรด/ดาวน์เกรดได้ทุกเมื่อ
        </p>
      </div>
      <PricingSection showFullTable />
    </div>
  );
}
