import { NextResponse } from "next/server";
import { requireSaSession } from "@/lib/sa-auth";
import { getRecentChats, TELEGRAM_CONFIGURED } from "@/lib/telegram";

/**
 * GET /api/sa/telegram/detect
 * Poll Telegram getUpdates and return the chats that have recently messaged the
 * bot, so the SA can pick a chat_id after sending /start (or adding the bot to
 * a group). Only works when the bot token is configured and no webhook is set.
 */
export async function GET() {
  try {
    await requireSaSession();
    if (!TELEGRAM_CONFIGURED) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN", chats: [] },
        { status: 400 }
      );
    }
    const chats = await getRecentChats();
    return NextResponse.json({ chats });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("telegram detect error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
