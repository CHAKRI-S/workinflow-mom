import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight, Factory, Cog, FileText, LineChart, Shield, Zap,
  Calendar, Wrench, Eye, Users, Receipt, BarChart3,
} from "lucide-react";
import { PricingSection } from "@/components/landing/pricing-section";

export const metadata: Metadata = {
  title: "WorkinFlow MOM — ระบบจัดการโรงงาน CNC ครบวงจร (SaaS)",
  description:
    "แพลตฟอร์ม SaaS สำหรับโรงงาน CNC ไทย ครอบคลุมใบเสนอราคา ใบสั่งซื้อ ใบกำกับภาษี แผนการผลิต WO ซ่อมบำรุง Dashboard หน้าโรงงาน — ทดลองใช้ฟรี 30 วัน",
  keywords: ["MOM", "manufacturing", "CNC", "ERP", "ใบกำกับภาษี", "โรงงาน", "ISO 9001", "SaaS ไทย"],
  openGraph: {
    title: "WorkinFlow MOM — ระบบจัดการโรงงาน CNC",
    description: "ทดลองใช้ฟรี 30 วัน ไม่ต้องใส่บัตรเครดิต",
    type: "website",
    locale: "th_TH",
  },
};

const FEATURES = [
  { icon: Factory, title: "จัดการโรงงาน", desc: "วางแผนการผลิต จัดการ Work Order บริหารเครื่อง CNC" },
  { icon: Cog, title: "BOM หลายขนาด", desc: "รองรับการใช้วัตถุดิบหลายขนาดใน 1 ชิ้นงาน" },
  { icon: FileText, title: "เอกสารภาษีไทย", desc: "ใบกำกับภาษี ใบเสร็จ ใบลดหนี้ รองรับทั้ง VAT และ Non-VAT" },
  { icon: Receipt, title: "ใบเสนอราคา → Invoice", desc: "สร้างใบเสนอราคา แปลงเป็นใบสั่งซื้อและ Invoice ได้ในคลิกเดียว" },
  { icon: Calendar, title: "แผนการผลิต Timeline", desc: "Drag & drop จัดคิวงานบนเครื่อง CNC แบบ visual" },
  { icon: Wrench, title: "บันทึกซ่อมบำรุง", desc: "กำหนดตารางซ่อมบำรุง แจ้งเตือนเมื่อถึงเวลา" },
  { icon: Eye, title: "Dashboard TV", desc: "จอ TV หน้าโรงงาน แสดงสถานะงานสด อัพเดตทุก 30 วินาที" },
  { icon: Shield, title: "ISO 9001 Compliance", desc: "Audit log ล็อกเอกสาร ยกเลิกต้องมีเหตุผล" },
  { icon: Users, title: "Multi-user + Roles", desc: "แบ่งสิทธิ์ Admin / Manager / Planner / Sales / Operator / QC / Accounting" },
  { icon: BarChart3, title: "รายงาน + KPI", desc: "ยอดขาย ยอดที่ยังค้าง เครื่องที่ใช้งาน งานที่เลยกำหนด" },
  { icon: LineChart, title: "Multi-tenant", desc: "ข้อมูลแต่ละบริษัทแยกกันชัดเจน ปลอดภัย" },
  { icon: Zap, title: "Self-serve Signup", desc: "สมัครเสร็จใน 2 นาที เริ่มใช้งานได้ทันที ไม่ต้องติดต่อ sales" },
];

const FAQS = [
  {
    q: "ระบบรองรับใบกำกับภาษีไทยถูกต้องตามกฎหมายหรือไม่?",
    a: "ใช่ ระบบออกใบกำกับภาษี ใบเสร็จรับเงิน และใบลดหนี้ ตามรูปแบบของกรมสรรพากร รองรับทั้งลูกค้าที่จด VAT และไม่จด VAT แยก numbering series ชัดเจน",
  },
  {
    q: "ต้องมี Server เองไหม?",
    a: "ไม่ต้อง — WorkinFlow เป็น SaaS บน Cloud ของเรา เพียงเปิดเบราเซอร์ก็ใช้งานได้ทันที ข้อมูลสำรองอัตโนมัติทุกวัน",
  },
  {
    q: "ทดลองใช้ฟรีได้กี่วัน?",
    a: "30 วัน ฟีเจอร์หลักครบ ไม่ต้องใส่บัตรเครดิต ยกเลิกได้ตลอด",
  },
  {
    q: "ย้ายข้อมูลจากระบบเดิมได้ไหม?",
    a: "ได้ — รองรับ import ลูกค้า สินค้า วัตถุดิบ จากไฟล์ Excel / CSV สำหรับแผน Pro+ มีทีมช่วย migration",
  },
  {
    q: "ข้อมูลของเราปลอดภัยแค่ไหน?",
    a: "ข้อมูลแต่ละบริษัทแยก isolation ชัดเจนด้วย tenantId ทุกตาราง Server อยู่ไทย Audit log ทุกการเปลี่ยนแปลงเก็บไว้",
  },
  {
    q: "ยกเลิกภายหลังจะเกิดอะไรขึ้น?",
    a: "Export ข้อมูลทั้งหมดได้ก่อนยกเลิก ไม่มีค่าปรับ ข้อมูลถูกเก็บไว้ 90 วันหลังยกเลิกเผื่อกลับมาใช้ใหม่",
  },
];

export default function LandingHome() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "WorkinFlow MOM",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "THB",
      description: "30-day free trial",
    },
  };

  return (
    <>
      {/* JSON-LD SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />

      {/* Hero */}
      <section className="container mx-auto max-w-6xl px-4 py-20 md:py-32 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          SaaS สำหรับโรงงานไทย — ทดลองใช้ฟรี 30 วัน
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          ระบบจัดการโรงงาน CNC
          <br />
          <span className="text-primary">ครบวงจร มาตรฐาน ISO 9001</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground mb-8">
          WorkinFlow MOM — งานเสนอราคา งานสั่งผลิต เอกสารภาษีไทย
          บันทึกซ่อมบำรุง และ Dashboard หน้าโรงงาน ในแพลตฟอร์มเดียว
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-md hover:bg-blue-600 transition gap-2"
          >
            เริ่มใช้ฟรี 30 วัน <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex h-12 items-center justify-center rounded-lg border bg-background px-8 text-sm font-semibold hover:bg-muted transition"
          >
            ดูราคา
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          ไม่ต้องใส่บัตรเครดิต • ยกเลิกได้ทุกเมื่อ • รองรับภาษาไทยเต็มรูปแบบ
        </p>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-muted/30 py-20">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center mb-14">
            <div className="inline-flex rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground mb-3">
              Features
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">ทุกอย่างที่โรงงาน CNC ต้องการ</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              ออกแบบสำหรับโรงงานไทยโดยเฉพาะ — เอกสารภาษี ระบบ BOM หลายขนาด
              และมาตรฐาน ISO 9001
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-5 hover:shadow-md transition">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="font-semibold mb-1">{f.title}</div>
                <div className="text-sm text-muted-foreground">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">เริ่มใช้ได้ภายใน 5 นาที</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "สมัครใช้งาน", desc: "กรอกข้อมูลบริษัท สร้าง admin account" },
              { step: "2", title: "ตั้งค่าระบบ", desc: "อัพโหลดโลโก้ เพิ่มเครื่อง CNC เพิ่มลูกค้า" },
              { step: "3", title: "เริ่มใช้งาน", desc: "เสนอราคา สร้าง WO และบริหารโรงงานได้ทันที" },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  {s.step}
                </div>
                <div className="font-semibold mb-2">{s.title}</div>
                <div className="text-sm text-muted-foreground">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t bg-muted/30 py-20">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center mb-10">
            <div className="inline-flex rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground mb-3">
              Pricing
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">ราคาที่โปร่งใส เลือกแผนที่เหมาะกับคุณ</h2>
            <p className="text-muted-foreground">
              ทุกแผนทดลองใช้ฟรี 30 วัน ยกเลิกได้ตลอด
            </p>
          </div>
          <PricingSection />
          <div className="text-center mt-8">
            <Link
              href="/pricing"
              className="text-sm text-primary hover:underline font-medium"
            >
              ดูตารางเปรียบเทียบเต็ม →
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">คำถามที่พบบ่อย</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <details key={i} className="group rounded-xl border bg-card p-5 cursor-pointer">
                <summary className="flex items-center justify-between font-semibold list-none">
                  <span>{f.q}</span>
                  <span className="ml-4 text-muted-foreground group-open:rotate-180 transition">
                    ▾
                  </span>
                </summary>
                <div className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {f.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center bg-primary/5 border-t">
        <div className="container mx-auto max-w-3xl px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">พร้อมเริ่มแล้วหรือยัง?</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            ทดลองใช้ฟรี 30 วัน ไม่ต้องใส่บัตรเครดิต
          </p>
          <Link
            href="/signup"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-md hover:bg-blue-600 transition gap-2"
          >
            สมัครใช้งานฟรี <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
