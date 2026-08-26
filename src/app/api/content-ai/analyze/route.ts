import { NextResponse } from "next/server";
import { verifyCaptchaChallenge } from "@/lib/auth";
import { parseProfileCookie } from "@/lib/instagram";

export const dynamic = "force-dynamic";

type InspirationProfile = {
  username: string;
  mediaRead?: number;
  patterns?: number;
};

function readProfile(req: Request) {
  const profileCookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("flowdesk_ig_profile="))
    ?.split("=")[1];
  return parseProfileCookie(profileCookie);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const verified = await verifyCaptchaChallenge(
    String(body.captchaToken || ""),
    String(body.captchaAnswer || "")
  );

  if (!verified) {
    return NextResponse.json(
      { error: "Verification javobi noto'g'ri yoki muddati o'tgan" },
      { status: 400 }
    );
  }

  const profile = readProfile(req);
  const inspirations = Array.isArray(body.inspirationProfiles)
    ? (body.inspirationProfiles as InspirationProfile[])
    : [];
  const mediaCount = Number(body.mediaCount || 0);
  const commentsCount = Number(body.commentsCount || 0);
  const patternCount = Number(body.patternCount || 0);
  const signalCount =
    (profile ? 1 : 0) +
    inspirations.length +
    mediaCount +
    commentsCount +
    patternCount;
  const readiness = Math.min(100, signalCount * 12);

  const recommendations = [
    profile
      ? `@${profile.username} profili ulangan. Endi media sync bosqichi kerak.`
      : "Avval Instagram profilni OAuth orqali ulang.",
    inspirations.length
      ? `${inspirations.length} ta ilhom profili benchmark sifatida navbatga olindi.`
      : "Kamida 3 ta ilhom profili qo'shing, shunda benchmark patternlar kuchayadi.",
    mediaCount
      ? "Media scoring boshlashga tayyor."
      : "Reels/post data kelmaguncha model real performance pattern topa olmaydi.",
    commentsCount
      ? "Komment sentiment va savollar tahliliga signal bor."
      : "Komment data kelganda audience pain pointlar aniqroq chiqadi.",
  ];

  return NextResponse.json({
    ok: true,
    analyzedAt: new Date().toISOString(),
    readiness,
    summary: {
      profileConnected: Boolean(profile),
      profileUsername: profile?.username || null,
      inspirationProfiles: inspirations.length,
      mediaCount,
      commentsCount,
      patternCount,
      signalCount,
    },
    recommendations,
  });
}
