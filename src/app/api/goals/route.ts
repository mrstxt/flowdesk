import { NextResponse } from "next/server";
import { db } from "@/db";
import { goals } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(goals).orderBy(desc(goals.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [created] = await db
    .insert(goals)
    .values({
      title: body.title,
      targetAmount: body.targetAmount,
      savedAmount: body.savedAmount ?? "0",
      autoPercent: body.autoPercent ?? 0,
    })
    .returning();
  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const [updated] = await db
    .update(goals)
    .set(rest)
    .where(eq(goals.id, id))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(goals).where(eq(goals.id, id));
  return NextResponse.json({ ok: true });
}
