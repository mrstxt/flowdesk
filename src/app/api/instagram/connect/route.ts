import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { instagramEnv, missingInstagramEnv } from "@/lib/instagram";

export const dynamic = "force-dynamic";

function callbackUrl(req: Request) {
  const env = instagramEnv();
  if (env.redirectUri) return env.redirectUri;
  return new URL("/api/instagram/callback", req.url).toString();
}

export async function GET(req: Request) {
  const missing = missingInstagramEnv();
  if (missing.length) {
    const url = new URL("/content-ai", req.url);
    url.searchParams.set("instagram_error", `missing_env:${missing.join(",")}`);
    return NextResponse.redirect(url);
  }

  const env = instagramEnv();
  const state = randomUUID();
  const authUrl = new URL("https://www.instagram.com/oauth/authorize");
  authUrl.searchParams.set("client_id", env.appId);
  authUrl.searchParams.set("redirect_uri", callbackUrl(req));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", env.scopes);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("force_reauth", "true");
  authUrl.searchParams.set("enable_fb_login", "0");

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("flowdesk_ig_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  return res;
}
