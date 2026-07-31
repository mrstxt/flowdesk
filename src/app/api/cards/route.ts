import { NextResponse } from "next/server";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select()
    .from(cards)
    .where(eq(cards.archived, false))
    .orderBy(asc(cards.id));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name || !String(body.name).trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const [created] = await db
    .insert(cards)
    .values({
      name: String(body.name).trim(),
      bank: body.bank || null,
      last4: body.last4 || null,
      color: body.color || "#0a84ff",
    })
    .returning();
  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (body.bank !== undefined) patch.bank = body.bank || null;
  if (body.last4 !== undefined) patch.last4 = body.last4 || null;
  if (body.color !== undefined) patch.color = body.color;
  if (typeof body.archived === "boolean") patch.archived = body.archived;
  const [updated] = await db
    .update(cards)
    .set(patch)
    .where(eq(cards.id, id))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  // Soft delete
  await db.update(cards).set({ archived: true }).where(eq(cards.id, id));
  return NextResponse.json({ ok: true });
}
