import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSaSession } from "@/lib/sa-auth";
import {
  getPlatformSettings,
  upsertPlatformSettings,
} from "@/lib/platform-settings";

// GET /api/sa/platform-settings — return the singleton record
export async function GET() {
  try {
    await requireSaSession();
    const settings = await getPlatformSettings();
    return NextResponse.json(settings);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/sa/platform-settings error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// All fields optional — SA can save partially-filled form as they gather info.
// Empty string "" is allowed (explicit clear). Each field is trimmed.
const putSchema = z.object({
  issuerName: z.string().trim().max(200).optional(),
  issuerTaxId: z.string().trim().max(20).optional(),
  issuerAddress: z.string().trim().max(500).optional(),
  issuerPhone: z.string().trim().max(50).optional(),
  issuerEmail: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine(
      (v) => v === undefined || v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      { message: "Invalid email format" }
    ),
});

// PUT /api/sa/platform-settings — upsert fields
export async function PUT(req: NextRequest) {
  try {
    const session = await requireSaSession();
    const body = await req.json();
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const updated = await upsertPlatformSettings(parsed.data, session.sub);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PUT /api/sa/platform-settings error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
