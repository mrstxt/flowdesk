import { NextResponse } from "next/server";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { parseMoneyInput } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(expenses).orderBy(desc(expenses.date));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [created] = await db
    .insert(expenses)
    .values({
      title: body.title,
      amount: String(parseMoneyInput(body.amount)),
      category: body.category || "other",
      date: body.date,
      cardId: body.cardId ? Number(body.cardId) : null,
    })
    .returning();
  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if ("amount" in rest) {
    rest.amount = String(parseMoneyInput(rest.amount));
  }
  if ("cardId" in rest) {
    rest.cardId = rest.cardId ? Number(rest.cardId) : null;
  }
  const [updated] = await db
    .update(expenses)
    .set(rest)
    .where(eq(expenses.id, id))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(expenses).where(eq(expenses.id, id));
  return NextResponse.json({ ok: true });
}
