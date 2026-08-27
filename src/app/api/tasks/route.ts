import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { desc, eq, gte, lte, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let rows;
  if (from && to) {
    rows = await db
      .select()
      .from(tasks)
      .where(and(gte(tasks.date, from), lte(tasks.date, to)))
      .orderBy(tasks.date, desc(tasks.createdAt));
  } else {
    rows = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const title = String(body.title || "").trim();
  const date = String(body.date || "").trim();
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (!validDate(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const [created] = await db
    .insert(tasks)
    .values({
      title,
      date,
      completed: false,
      category: String(body.category || "personal").trim() || "personal",
    })
    .returning();
  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const updates: Record<string, unknown> = { ...rest };
  if ("title" in updates) {
    updates.title = String(updates.title || "").trim();
    if (!updates.title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }
  }
  if ("date" in updates) {
    updates.date = String(updates.date || "").trim();
    if (!validDate(String(updates.date))) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }
  }
  const [updated] = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, id))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(tasks).where(eq(tasks.id, id));
  return NextResponse.json({ ok: true });
}
