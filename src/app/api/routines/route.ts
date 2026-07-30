import { NextResponse } from "next/server";
import { db } from "@/db";
import { routines } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { todayDateISO } from "@/lib/orderActions";

export const dynamic = "force-dynamic";

function yesterdayISO(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

export async function GET() {
  const rows = await db.select().from(routines).orderBy(asc(routines.time));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [created] = await db
    .insert(routines)
    .values({
      time: body.time || "09:00",
      title: body.title,
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

  const [updated] = await db
    .update(routines)
    .set({ time, title })
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
