/**
 * Telegram Bot notification transport.
 *
 * Sends platform-admin alerts (new signup, trial expiry, payment events, ...)
 * to the chat/group destinations stored in the TelegramChat table (managed by
 * the super admin at /superadmin/settings).
 *
 * The bot token is a secret and lives ONLY in the TELEGRAM_BOT_TOKEN env var
 * (never in the DB, never committed). Follows the same "_CONFIGURED" pattern as
 * omise.ts / slipok.ts. All functions are fire-and-forget friendly: they log
 * and swallow errors, never throwing, so a Telegram outage never breaks a
 * signup or a payment.
 */

import { prisma } from "@/lib/prisma";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/** True when the bot token is configured (chat destinations are checked separately). */
export const TELEGRAM_CONFIGURED = Boolean(BOT_TOKEN);

const API_BASE = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : "";

export interface TelegramBroadcastResult {
  ok: boolean;
  sent: number;
  error?: "not_configured" | "no_recipients" | "db_error";
}

/** Low-level: send one HTML message to a specific chat id. Returns success. */
export async function sendToChat(chatId: string, text: string): Promise<boolean> {
  if (!TELEGRAM_CONFIGURED) return false;
  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[telegram] sendMessage to ${chatId} failed: ${res.status} ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[telegram] sendMessage error:", err);
    return false;
  }
}

/**
 * Broadcast a message to every active TelegramChat destination.
 * Never throws — safe to `void` from a request handler.
 */
export async function broadcastTelegram(text: string): Promise<TelegramBroadcastResult> {
  if (!TELEGRAM_CONFIGURED) return { ok: false, sent: 0, error: "not_configured" };

  let chats: { chatId: string }[];
  try {
    chats = await prisma.telegramChat.findMany({
      where: { active: true },
      select: { chatId: true },
    });
  } catch (err) {
    console.error("[telegram] failed to load chat destinations:", err);
    return { ok: false, sent: 0, error: "db_error" };
  }

  if (chats.length === 0) return { ok: false, sent: 0, error: "no_recipients" };

  const results = await Promise.allSettled(
    chats.map((c) => sendToChat(c.chatId, text))
  );
  const sent = results.filter((r) => r.status === "fulfilled" && r.value).length;
  return { ok: sent > 0, sent };
}

export interface DetectedChat {
  chatId: string;
  title: string;
  type: string;
}

/**
 * Poll getUpdates and return the distinct chats that have recently messaged the
 * bot. Used by the settings "ดึง Chat ID อัตโนมัติ" button so the SA can pick a
 * destination after sending /start to the bot (or adding it to a group).
 *
 * Note: getUpdates only works when no webhook is registered (we don't use one).
 */
export async function getRecentChats(): Promise<DetectedChat[]> {
  if (!TELEGRAM_CONFIGURED) return [];
  try {
    const res = await fetch(`${API_BASE}/getUpdates`, { method: "GET" });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      ok?: boolean;
      result?: Array<Record<string, unknown>>;
    };
    const map = new Map<string, DetectedChat>();
    for (const upd of data.result ?? []) {
      const msg = (upd.message ??
        upd.channel_post ??
        upd.my_chat_member ??
        upd.edited_message) as Record<string, unknown> | undefined;
      const chat = msg?.chat as
        | {
            id?: number | string;
            title?: string;
            first_name?: string;
            last_name?: string;
            username?: string;
            type?: string;
          }
        | undefined;
      if (chat?.id != null) {
        const id = String(chat.id);
        const title =
          chat.title ||
          [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
          chat.username ||
          id;
        map.set(id, { chatId: id, title, type: chat.type || "unknown" });
      }
    }
    return [...map.values()];
  } catch (err) {
    console.error("[telegram] getUpdates error:", err);
    return [];
  }
}
