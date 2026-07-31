import { NextResponse } from "next/server";
import { db } from "@/db";
import { sleepLogs } from "@/db/schema";
import { eq, gte, lte, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (date) {
    const [row] = await db
      .select()
      .from(sleepLogs)
      .where(eq(sleepLogs.date, date))
      .limit(1);
    return NextResponse.json(row || null);
  }

  if (from && to) {
    const rows = await db
      .select()
      .from(sleepLogs)
      .where(and(gte(sleepLogs.date, from), lte(sleepLogs.date, to)))
      .orderBy(desc(sleepLogs.date));
    return NextResponse.json(rows);
  }

  const rows = await db
    .select()
    .from(sleepLogs)
    .orderBy(desc(sleepLogs.date))
    .limit(30);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const date = body.date;
  if (!date)
    return NextResponse.json({ error: "date required" }, { status: 400 });

  // Shu kun uchun yozuv bor yoki yo'qligini tekshiramiz
  const [existing] = await db
    .select()
    .from(sleepLogs)
    .where(eq(sleepLogs.date, date))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(sleepLogs)
      .set({
        expectedWake: body.expectedWake ?? existing.expectedWake,
        actualWake: body.actualWake ?? existing.actualWake,
        expectedSleep: body.expectedSleep ?? existing.expectedSleep,
        actualSleep: body.actualSleep ?? existing.actualSleep,
        overslept: body.overslept ?? existing.overslept,
        wentLateSleep: body.wentLateSleep ?? existing.wentLateSleep,
        reason: body.reason ?? existing.reason,
      })
      .where(eq(sleepLogs.id, existing.id))
      .returning();
    return NextResponse.json(updated);
  }

  const [created] = await db
    .insert(sleepLogs)
    .values({
      date,
      expectedWake: body.expectedWake || null,
      actualWake: body.actualWake || null,
      expectedSleep: body.expectedSleep || null,
      actualSleep: body.actualSleep || null,
      overslept: !!body.overslept,
      wentLateSleep: !!body.wentLateSleep,
      reason: body.reason || null,
    })
    .returning();
  return NextResponse.json(created);
}
