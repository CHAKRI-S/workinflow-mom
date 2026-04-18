import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { provisionTenant } from "@/lib/tenant-provisioning";
import { sendWelcomeEmail } from "@/lib/email";

const signupSchema = z.object({
  companyName: z.string().min(2, "ชื่อบริษัทต้องมีอย่างน้อย 2 ตัวอักษร").max(100),
  adminName: z.string().min(2, "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร").max(100),
  adminEmail: z.email("อีเมลไม่ถูกต้อง"),
  adminPassword: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัว"),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  acceptTerms: z.boolean().refine((v) => v === true, "กรุณายอมรับเงื่อนไขการใช้งาน"),
});

// POST /api/auth/signup — สร้าง tenant ใหม่ + admin user + preset users
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "ข้อมูลไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const { companyName, adminName, adminEmail, adminPassword, phone, taxId, address } =
      parsed.data;

    const result = await provisionTenant({
      companyName,
      adminName,
      adminEmail,
      adminPassword,
      phone,
      taxId,
      address,
      planSlug: "free", // new tenants start on FREE trial
    });

    // Fire-and-forget welcome email
    sendWelcomeEmail(adminEmail, {
      adminName,
      companyName,
      trialEndsAt: result.trialEndsAt,
    }).catch((e) => console.error("welcome email error:", e));

    // Determine login URL based on environment
    const isProd = process.env.NODE_ENV === "production";
    const loginUrl = isProd
      ? "https://mom.workinflow.cloud/th/login"
      : "/th/login";

    return NextResponse.json(
      {
        success: true,
        tenantId: result.tenantId,
        slug: result.slug,
        code: result.code,
        trialEndsAt: result.trialEndsAt.toISOString(),
        loginUrl,
        message: "สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบที่ mom.workinflow.cloud",
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Signup error:", err);
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
