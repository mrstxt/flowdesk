import { NextResponse } from "next/server";
import { db } from "@/db";
import { routines } from "@/db/schema";
import { eq, asc, isNull, or } from "drizzle-orm";
import { todayDateISO } from "@/lib/orderActions";

export const dynamic = "force-dynamic";

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function yesterdayISO(): string {
  return addDaysISO(todayDateISO(), -1);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || "today"; // "today" | "tomorrow"
  const today = todayDateISO();
  const tomorrowDate = addDaysISO(today, 1);

  if (filter === "tomorrow") {
    // Ertangi kun uchun: targetDate = tomorrow yoki NULL (har kuni, doim ko'rinadi)
    const rows = await db
      .select()
      .from(routines)
      .where(
        or(
          isNull(routines.targetDate),
          eq(routines.targetDate, tomorrowDate)
        )!
      )
      .orderBy(asc(routines.time));
    return NextResponse.json(rows);
  }

  // Bugungi kun uchun: targetDate = today yoki NULL (har kuni, doim ko'rinadi)
  const rows = await db
    .select()
    .from(routines)
    .where(
      or(
        isNull(routines.targetDate),
        eq(routines.targetDate, today)
      )!
    )
    .orderBy(asc(routines.time));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  // Vaqt validatsiyasi: HH:MM format
  const time = body.time || "09:00";
  // targetDate ixtiyoriy — bo'sh string bo'lsa null
  const targetDate = body.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(body.targetDate)
    ? body.targetDate
    : null;
  // startTime / endTime ixtiyoriy
  const startTime = body.startTime && /^\d{1,2}:\d{2}$/.test(body.startTime)
    ? body.startTime
    : null;
  const endTime = body.endTime && /^\d{1,2}:\d{2}$/.test(body.endTime)
    ? body.endTime
    : null;
  const [created] = await db
    .insert(routines)
    .values({
      time,
      title: body.title,
      targetDate,
      startTime,
      endTime,
      lastDoneDate: null,
      streak: 0,
    })
    .returning();
  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, done, time, title } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Done/undone toggle with streak logic
  if (typeof done === "boolean") {
    const [r] = await db
      .select()
      .from(routines)
      .where(eq(routines.id, id))
      .limit(1);
    if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });

    const today = todayDateISO();
    let updated;
    if (done && r.lastDoneDate !== today) {
      const streak =
        r.lastDoneDate === yesterdayISO() ? Number(r.streak ?? 0) + 1 : 1;
      [updated] = await db
        .update(routines)
        .set({ lastDoneDate: today, streak })
        .where(eq(routines.id, id))
        .returning();
    } else if (!done && r.lastDoneDate === today) {
      [updated] = await db
        .update(routines)
        .set({
          lastDoneDate: null,
          streak: Math.max(0, Number(r.streak ?? 0) - 1),
        })
        .where(eq(routines.id, id))
        .returning();
    } else {
      updated = r;
    }
    return NextResponse.json(updated);
  }

  const patch: Record<string, unknown> = {};
  if (typeof time === "string") patch.time = time;
  if (typeof title === "string") patch.title = title;
  if (body.targetDate === null) patch.targetDate = null;
  else if (body.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(body.targetDate))
    patch.targetDate = body.targetDate;
  if (body.startTime === null) patch.startTime = null;
  else if (body.startTime && /^\d{1,2}:\d{2}$/.test(body.startTime))
    patch.startTime = body.startTime;
  if (body.endTime === null) patch.endTime = null;
  else if (body.endTime && /^\d{1,2}:\d{2}$/.test(body.endTime))
    patch.endTime = body.endTime;

  const [updated] = await db
    .update(routines)
    .set(patch)
    .where(eq(routines.id, id))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(routines).where(eq(routines.id, id));
  return NextResponse.json({ ok: true });
}
