import { NextResponse } from "next/server";
import {
  createToken,
  checkOneTimeLogin,
  missingAuthEnv,
  verifyCaptchaChallenge,
} from "@/lib/auth";

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

    const { username, otp, captchaAnswer, captchaToken } = await req.json();
    if (!username || !otp || !captchaAnswer || !captchaToken) {
      return NextResponse.json(
        { error: "Login, bir martalik kod va tekshiruv javobi kerak" },
        { status: 400 }
      );
    }

    const captchaOk = await verifyCaptchaChallenge(
      String(captchaToken ?? ""),
      String(captchaAnswer ?? "")
    );
    if (!captchaOk) {
      return NextResponse.json(
        { error: "Robot emasligingizni tekshirish javobi noto'g'ri" },
        { status: 400 }
      );
    }

    if (!(await checkOneTimeLogin(String(username ?? ""), String(otp ?? "")))) {
      return NextResponse.json(
        { error: "Login yoki bir martalik kod noto'g'ri" },
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
