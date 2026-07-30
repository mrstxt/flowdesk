import { NextResponse } from "next/server";
import { createToken, checkCredentials, missingAuthEnv } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const missing = missingAuthEnv();
    if (missing.length) {
      console.error(`Missing auth environment variables: ${missing.join(", ")}`);
      return NextResponse.json(
        { error: "Server login sozlamalari to'liq emas" },
        { status: 500 }
      );
    }

    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json(
        { error: "Login va parol kiritilishi kerak" },
        { status: 400 }
      );
    }

    if (!checkCredentials(String(username ?? ""), String(password ?? ""))) {
      return NextResponse.json(
        { error: "Login yoki parol noto'g'ri" },
        { status: 401 }
      );
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set("flowdesk_session", await createToken(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json({ error: "Server xatoligi" }, { status: 500 });
  }
}
