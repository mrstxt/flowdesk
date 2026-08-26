import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  for (const name of [
    "flowdesk_ig_profile",
    "flowdesk_ig_token",
    "flowdesk_ig_oauth_state",
  ]) {
    res.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
    });
  }
  return res;
}
