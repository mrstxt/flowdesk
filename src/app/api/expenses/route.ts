import { NextResponse } from "next/server";
import { db } from "@/db";
import { expenses, cardTransactions, cards } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { parseMoneyInput } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select()
    .from(expenses)
    .orderBy(desc(expenses.date), desc(expenses.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  // Chiqim har doim ASOSIY kartadan olinadi (user talabi)
  const [primary] = await db
    .select()
    .from(cards)
    .where(eq(cards.type, "primary"))
    .limit(1);
  const cardId = primary?.id ?? null;
  const amount = String(parseMoneyInput(body.amount));

  const [created] = await db
    .insert(expenses)
    .values({
      title: body.title,
      amount,
      category: body.category || "other",
      date: body.date,
      cardId,
    })
    .returning();

  // Asosiy karta balance dan ayiramiz
  if (cardId) {
    await db
      .update(cards)
      .set({ balance: sql`${cards.balance} - ${Number(amount)}` })
      .where(eq(cards.id, cardId));
    await db.insert(cardTransactions).values({
      cardId,
      date: body.date,
      type: "out",
      amount,
      description: `Chiqim: ${body.title}`,
    });
  }

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
  const [existing] = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, id))
    .limit(1);
  if (existing && existing.cardId) {
    await db
      .update(cards)
      .set({
        balance: sql`${cards.balance} + ${Number(existing.amount)}`,
      })
      .where(eq(cards.id, existing.cardId));
  }
  await db.delete(expenses).where(eq(expenses.id, id));
  return NextResponse.json({ ok: true });
}
