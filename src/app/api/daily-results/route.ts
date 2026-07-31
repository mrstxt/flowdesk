import { NextResponse } from "next/server";
import { db } from "@/db";
import { dailyResults } from "@/db/schema";
import { eq, gte, lte, desc, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (date) {
    const [row] = await db
      .select()
      .from(dailyResults)
      .where(eq(dailyResults.date, date))
      .limit(1);
    return NextResponse.json(row || null);
  }

  if (from && to) {
    const rows = await db
      .select()
      .from(dailyResults)
      .where(and(gte(dailyResults.date, from), lte(dailyResults.date, to)))
      .orderBy(desc(dailyResults.date));
    return NextResponse.json(rows);
  }

  const rows = await db
    .select()
    .from(dailyResults)
    .orderBy(desc(dailyResults.date))
    .limit(30);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [created] = await db
    .insert(dailyResults)
    .values({
      date: body.date,
      tasksDone: !!body.tasksDone,
      financeRecorded: !!body.financeRecorded,
      responseType: body.responseType || null,
      responseText: body.responseText || null,
      videoFileId: body.videoFileId || null,
    })
    .onConflictDoUpdate({
      target: dailyResults.date,
      set: {
        tasksDone: !!body.tasksDone,
        financeRecorded: !!body.financeRecorded,
        responseType: body.responseType || null,
        responseText: body.responseText || null,
        videoFileId: body.videoFileId || null,
      },
    })
    .returning();
  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id)
    return NextResponse.json({ error: "id required" }, { status: 400 });
  const [updated] = await db
    .update(dailyResults)
    .set(rest)
    .where(eq(dailyResults.id, id))
    .returning();
  return NextResponse.json(updated);
}
