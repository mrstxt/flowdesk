import { NextRequest, NextResponse } from "next/server";
import { isAuthorized, isAuthConfigured } from "@/lib/auth";

/**
 * FlowDesk proxy (Next 16 da middleware ning yangi nomi).
 *
 * Barcha sahifalar va API lar himoyalangan (sessiya cookie YOKI x-api-key).
 * Quyidagilar bundan mustasno:
 *  - /login sahifasi va /api/auth/* (kirish)
 *  - /api/bot (Telegram webhook — o'z BOT_WEBHOOK_SECRET tekshiruvi bor)
 *  - /api/cron/* (Vercel cron — o'z VERCEL_CRON_SECRET tekshiruvi bor)
 *  - /api/health (monitoring)
 *  - statik fayllar (_next, favicon, robots)
 */

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/bot",
  "/api/health",
];

const PUBLIC_PREFIXES = ["/api/cron/", "/_next/"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Auth sozlanmagan bo'lsa:
  //  - production da — kirishga qat'iy yo'l qo'yilmaydi (login sahifasi ogohlantiradi)
  //  - development da — lokal ishlash uchun ochiq (ogohlantirish ko'rsatiladi)
  if (!isAuthConfigured()) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    if (pathname.startsWith("/api/") || pathname.startsWith("/uploads/")) {
      return NextResponse.json(
        {
          error:
            "Server autentifikatsiyasi sozlanmagan. ADMIN_PASSWORD (yoki SESSION_SECRET) env o'rnating va redeploy qiling.",
        },
        { status: 503 }
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?notconfigured=1";
    return NextResponse.redirect(url);
  }

  if (isPublic(pathname)) return NextResponse.next();

  if (await isAuthorized(req.headers)) return NextResponse.next();

  // Ruxsat yo'q
  if (pathname.startsWith("/api/") || pathname.startsWith("/uploads/")) {
    return NextResponse.json({ error: "Autentifikatsiya talab qilinadi." }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  const redirect = NextResponse.redirect(url);
  redirect.headers.set("Cache-Control", "no-store");
  return redirect;
}

export const config = {
  matcher: ["/((?!favicon\\.ico|robots\\.txt|icon).*)"],
};


