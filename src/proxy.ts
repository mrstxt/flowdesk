import { NextRequest, NextResponse } from "next/server";


export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Agar login sahifasiga kirishga urinsa, to'g'ridan-to'g'ri bosh sahifaga yo'naltiramiz
  if (pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

