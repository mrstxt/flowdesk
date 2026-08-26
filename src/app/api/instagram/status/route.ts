import { NextResponse } from "next/server";
import { parseProfileCookie } from "@/lib/instagram";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const profileCookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("flowdesk_ig_profile="))
    ?.split("=")[1];
  const profile = parseProfileCookie(profileCookie);
  return NextResponse.json({ connected: Boolean(profile), profile });
}
