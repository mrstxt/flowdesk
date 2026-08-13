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
  const title = String(body.title || "").trim();
  const amountNum = parseMoneyInput(body.amount);
  const date = body.date || new Date().toISOString().slice(0, 10);
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (amountNum <= 0) {
    return NextResponse.json(
      { error: "Summa 0 dan katta bo'lishi kerak" },
      { status: 400 }
    );
  }
  // Chiqim har doim ASOSIY kartadan olinadi (user talabi)
  const [primary] = await db
    .select()
    .from(cards)
    .where(eq(cards.type, "primary"))
    .limit(1);
  const cardId = primary?.id ?? null;
  const amount = String(amountNum);

  const [created] = await db.transaction(async (tx) => {
    const [createdExpense] = await tx
      .insert(expenses)
      .values({
        title,
        amount,
        category: body.category || "other",
        date,
        cardId,
      })
      .returning();

    // Asosiy karta balance dan ayiramiz (manfiy bo'lmasligi uchun)
    if (cardId) {
      await tx
        .update(cards)
        .set({ balance: sql`GREATEST(${cards.balance} - ${Number(amount)}, 0)` })
        .where(eq(cards.id, cardId));
      const [txRow] = await tx
        .insert(cardTransactions)
        .values({
          cardId,
          date,
          type: "out",
          amount,
          description: `Chiqim: ${title}`,
        })
        .returning();
      const [linked] = await tx
        .update(expenses)
        .set({ transactionId: txRow.id })
        .where(eq(expenses.id, createdExpense.id))
        .returning();
      return [linked];
    }

    return [createdExpense];
  });

  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const [existing] = await db
    .select()
    .from(expenses)
    .where(eq(expenses.id, id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if ("amount" in rest) {
    rest.amount = String(parseMoneyInput(rest.amount));
  }
  if ("cardId" in rest) {
    rest.cardId = rest.cardId ? Number(rest.cardId) : null;
  }
  const [updated] = await db.transaction(async (tx) => {
    const oldCardId =
      existing.cardId && existing.category !== "transfer"
        ? existing.cardId
        : null;
    if (oldCardId) {
      await tx
        .update(cards)
        .set({ balance: sql`${cards.balance} + ${Number(existing.amount)}` })
        .where(eq(cards.id, oldCardId));
    }

    const [row] = await tx
      .update(expenses)
      .set(rest)
      .where(eq(expenses.id, id))
      .returning();

    const newCardId =
      row.cardId && row.category !== "transfer" ? row.cardId : null;
    if (newCardId) {
      await tx
        .update(cards)
        .set({ balance: sql`GREATEST(${cards.balance} - ${Number(row.amount)}, 0)` })
        .where(eq(cards.id, newCardId));
    }

    return [row];
  });
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
  // category="transfer" — ichki o'tkazma, balans allaqachon tuzatilgan,
  // qayta tuzatilmaydi (aks holda ikki marta qo'shiladi).
  const deleteCardId =
    existing?.cardId && existing.category !== "transfer"
      ? existing.cardId
      : null;
  if (existing && deleteCardId) {
    await db.transaction(async (tx) => {
      await tx
        .update(cards)
        .set({
          balance: sql`${cards.balance} + ${Number(existing.amount)}`,
        })
        .where(eq(cards.id, deleteCardId));
      await tx.delete(expenses).where(eq(expenses.id, id));
    });
    return NextResponse.json({ ok: true });
  }
  await db.delete(expenses).where(eq(expenses.id, id));
  return NextResponse.json({ ok: true });
}
