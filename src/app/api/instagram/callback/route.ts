import { NextResponse } from "next/server";
import {
  ConnectedInstagramProfile,
  instagramEnv,
  profileCookieValue,
} from "@/lib/instagram";

export const dynamic = "force-dynamic";

type TokenResponse = {
  access_token?: string;
  user_id?: number;
  error_message?: string;
};

type LongTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type InstagramMeResponse = {
  id?: string;
  username?: string;
  name?: string;
  biography?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
};

function callbackUrl(req: Request) {
  const env = instagramEnv();
  if (env.redirectUri) return env.redirectUri;
  return new URL("/api/instagram/callback", req.url).toString();
}

function fail(req: Request, message: string) {
  const url = new URL("/content-ai", req.url);
  url.searchParams.set("instagram_error", message);
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) return fail(req, "missing_code");

  const cookieState = req.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("flowdesk_ig_oauth_state="))
    ?.split("=")[1];

  if (!state || !cookieState || state !== cookieState) {
    return fail(req, "invalid_state");
  }

  const env = instagramEnv();
  const body = new URLSearchParams();
  body.set("client_id", env.appId);
  body.set("client_secret", env.appSecret);
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", callbackUrl(req));
  body.set("code", code);

  const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body,
  });
  const token = (await tokenRes.json().catch(() => ({}))) as TokenResponse;

  if (!tokenRes.ok || !token.access_token) {
    console.error("Instagram token exchange failed", token);
    return fail(req, token.error_message || "token_exchange_failed");
  }

  const longUrl = new URL("https://graph.instagram.com/access_token");
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_secret", env.appSecret);
  longUrl.searchParams.set("access_token", token.access_token);
  const longRes = await fetch(longUrl);
  const longToken = (await longRes
    .json()
    .catch(() => ({}))) as LongTokenResponse;
  const accessToken = longToken.access_token || token.access_token;
  const tokenMaxAge = longToken.expires_in || 3600;

  const meUrl = new URL(`https://graph.instagram.com/${env.apiVersion}/me`);
  meUrl.searchParams.set(
    "fields",
    "id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count"
  );
  meUrl.searchParams.set("access_token", accessToken);
  const meRes = await fetch(meUrl);
  const me = (await meRes.json().catch(() => ({}))) as InstagramMeResponse;

  if (!meRes.ok || !me.username) {
    console.error("Instagram profile fetch failed", me);
    return fail(req, "profile_fetch_failed");
  }

  const profile: ConnectedInstagramProfile = {
    id: me.id,
    username: me.username,
    displayName: me.name || me.username,
    bio: me.biography || "",
    avatarUrl: me.profile_picture_url || "",
    followers: Number(me.followers_count || 0),
    following: Number(me.follows_count || 0),
    mediaCount: Number(me.media_count || 0),
    profileUrl: `https://instagram.com/${me.username}`,
    connectedAt: new Date().toISOString(),
  };

  const redirectUrl = new URL("/content-ai", req.url);
  redirectUrl.searchParams.set("instagram_connected", "1");
  const res = NextResponse.redirect(redirectUrl);
  res.cookies.set("flowdesk_ig_oauth_state", "", {
    path: "/",
    maxAge: 0,
  });
  res.cookies.set("flowdesk_ig_profile", profileCookieValue(profile), {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: tokenMaxAge,
  });
  res.cookies.set("flowdesk_ig_token", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: tokenMaxAge,
  });
  return res;
}
