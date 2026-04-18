import { NextResponse } from "next/server";
import { SA_COOKIE_NAME } from "@/lib/sa-auth";

// POST /api/sa/auth/logout
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(SA_COOKIE_NAME);
  return res;
}
