import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  isAuthConfigured,
  verifyPassword,
  SESSION_COOKIE,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 * Body: { "password": "..." }
 * To'g'ri bo'lsa imzolangan sessiya cookie qaytaradi.
 */
export async function POST(req: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Server autentifikatsiyasi sozlanmagan. ADMIN_PASSWORD (yoki SESSION_SECRET) env o'rnating.",
      },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  if (!password || !(await verifyPassword(password))) {
    // Bir oz kechiktirib, tez taxmin qilishni qiyinlashtiramiz
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "Parol noto'g'ri." }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
