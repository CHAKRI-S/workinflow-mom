import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSaSession } from "@/lib/sa-auth";

// PATCH /api/sa/telegram/chats/:id — toggle active / rename
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSaSession();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const data: { active?: boolean; label?: string } = {};
    if (typeof body.active === "boolean") data.active = body.active;
    if (typeof body.label === "string") data.label = body.label.trim().slice(0, 100);
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes" }, { status: 400 });
    }

    const chat = await prisma.telegramChat.update({
      where: { id },
      data,
      select: { id: true, chatId: true, label: true, active: true, createdAt: true },
    });
    return NextResponse.json({ chat });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PATCH telegram chat error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/sa/telegram/chats/:id — remove a destination
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSaSession();
    const { id } = await params;
    await prisma.telegramChat.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE telegram chat error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
