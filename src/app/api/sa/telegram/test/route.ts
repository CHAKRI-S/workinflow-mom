import { NextRequest, NextResponse } from "next/server";
import { requireSaSession } from "@/lib/sa-auth";
import { broadcastTelegram, sendToChat, TELEGRAM_CONFIGURED } from "@/lib/telegram";

/**
 * POST /api/sa/telegram/test
 * Send a test message. Body (optional): { chatId?: string }.
 * - With chatId → send only to that chat (used right after adding a destination).
 * - Without    → broadcast to all active destinations.
 */
export async function POST(req: NextRequest) {
  try {
    await requireSaSession();
    if (!TELEGRAM_CONFIGURED) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const chatId = typeof body.chatId === "string" ? body.chatId.trim() : "";
    const text = "🔔 <b>ทดสอบการแจ้งเตือน WorkinFlow</b>\nการเชื่อมต่อ Telegram ทำงานปกติ ✅";

    if (chatId) {
      const ok = await sendToChat(chatId, text);
      return ok
        ? NextResponse.json({ success: true, sent: 1 })
        : NextResponse.json({ error: "ส่งไม่สำเร็จ — ตรวจสอบ chat_id / ให้บอทเริ่มแชตก่อน" }, { status: 400 });
    }

    const result = await broadcastTelegram(text);
    if (!result.ok) {
      const reason =
        result.error === "no_recipients"
          ? "ยังไม่มีปลายทางที่ active"
          : "ส่งไม่สำเร็จ";
      return NextResponse.json({ error: reason }, { status: 400 });
    }
    return NextResponse.json({ success: true, sent: result.sent });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("telegram test error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
