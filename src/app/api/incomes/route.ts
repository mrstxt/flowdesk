import { NextResponse } from "next/server";
import { db } from "@/db";
import { incomes, cardTransactions, cards } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { parseMoneyInput } from "@/lib/utils";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(incomes).orderBy(desc(incomes.date));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  let cardId = body.cardId && body.cardId !== "cash" ? Number(body.cardId) : null;
  if (!cardId && body.cardId !== "cash" && body.cardId !== null) {
    const [primary] = await db
      .select()
      .from(cards)
      .where(eq(cards.type, "primary"))
      .limit(1);
    if (primary) cardId = primary.id;
  }
  const amount = String(parseMoneyInput(body.amount));

  const [created] = await db
    .insert(incomes)
    .values({
      title: body.title,
      amount,
      source: body.source || "other",
      date: body.date,
      paymentType: body.paymentType || "cash",
      cardId,
    })
    .returning();

  // Agar karta tanlangan bo'lsa, karta balance ga qo'shamiz
  if (cardId) {
    await db
      .update(cards)
      .set({ balance: sql`${cards.balance} + ${Number(amount)}` })
      .where(eq(cards.id, cardId));
    await db.insert(cardTransactions).values({
      cardId,
      date: body.date,
      type: "in",
      amount,
      description: `Kirim: ${body.title}`,
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
    .update(incomes)
    .set(rest)
    .where(eq(incomes.id, id))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const [existing] = await db
    .select()
    .from(incomes)
    .where(eq(incomes.id, id))
    .limit(1);
  if (existing && existing.cardId) {
    await db
      .update(cards)
      .set({
        balance: sql`${cards.balance} - ${Number(existing.amount)}`,
      })
      .where(eq(cards.id, existing.cardId));
  }
  await db.delete(incomes).where(eq(incomes.id, id));
  return NextResponse.json({ ok: true });
}
