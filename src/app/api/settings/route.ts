import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSettingsMap, isValidTime } from "@/lib/appSettings";

export const dynamic = "force-dynamic";

const TIME_KEYS = new Set(["wake_time", "sleep_time"]);

export async function GET() {
  return NextResponse.json(await getSettingsMap());
}

export async function PUT(req: Request) {
  const body = await req.json();
  const values: Record<string, string> = {};

  // Eski { key, value } formatini ham saqlab qolamiz.
  if (body?.key) {
    values[String(body.key)] = String(body.value ?? "");
  } else if (
    body?.values &&
    typeof body.values === "object" &&
    !Array.isArray(body.values)
  ) {
    for (const [key, value] of Object.entries(body.values)) {
      values[key] = String(value ?? "");
    }
  } else {
    return NextResponse.json(
      { error: "key/value yoki values required" },
      { status: 400 }
    );
  }

  for (const [key, value] of Object.entries(values)) {
    if (TIME_KEYS.has(key) && !isValidTime(value)) {
      return NextResponse.json(
        { error: `${key} HH:mm formatida bo'lishi kerak` },
        { status: 400 }
      );
    }
  }

  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(values)) {
      await tx
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } });
    }
  });

  return NextResponse.json({ ok: true, values });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (key) await db.delete(settings).where(eq(settings.key, key));
  return NextResponse.json({ ok: true });
}
