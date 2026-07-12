import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSaSession } from "@/lib/sa-auth";
import { TELEGRAM_CONFIGURED } from "@/lib/telegram";

// GET /api/sa/telegram/chats — list destinations + bot-configured flag
export async function GET() {
  try {
    await requireSaSession();
    const chats = await prisma.telegramChat.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, chatId: true, label: true, active: true, createdAt: true },
    });
    return NextResponse.json({ chats, botConfigured: TELEGRAM_CONFIGURED });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET telegram chats error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const addSchema = z.object({
  chatId: z.string().trim().min(1).max(64),
  label: z.string().trim().max(100).optional(),
});

// POST /api/sa/telegram/chats — add (or re-activate) a destination
export async function POST(req: NextRequest) {
  try {
    await requireSaSession();
    const body = await req.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const { chatId, label } = parsed.data;
    const chat = await prisma.telegramChat.upsert({
      where: { chatId },
      create: { chatId, label: label ?? "", active: true },
      update: { label: label ?? "", active: true },
      select: { id: true, chatId: true, label: true, active: true, createdAt: true },
    });
    return NextResponse.json({ chat });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST telegram chat error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
