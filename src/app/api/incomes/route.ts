import { NextResponse } from "next/server";
import { db } from "@/db";
import { incomes, cardTransactions, cards } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { parseMoneyInput } from "@/lib/utils";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function isRealIncomeSource(source: string | null | undefined): boolean {
  return source !== "goal" && source !== "transfer";
}

export async function GET() {
  const rows = await db
    .select()
    .from(incomes)
    .orderBy(desc(incomes.date), desc(incomes.createdAt));
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
  let cardId = body.cardId && body.cardId !== "cash" ? Number(body.cardId) : null;
  if (!cardId && body.cardId !== "cash" && body.cardId !== null) {
    const [primary] = await db
      .select()
      .from(cards)
      .where(eq(cards.type, "primary"))
      .limit(1);
    if (primary) cardId = primary.id;
  }
  const amount = String(amountNum);
  const source = body.source || "other";

  const [created] = await db.transaction(async (tx) => {
    const [createdIncome] = await tx
      .insert(incomes)
      .values({
      title,
      amount,
      source,
      date,
      paymentType: body.paymentType || "cash",
      cardId,
      })
      .returning();

    // Agar karta tanlangan bo'lsa, karta balance ga qo'shamiz
    if (cardId && isRealIncomeSource(source)) {
      await tx
        .update(cards)
        .set({ balance: sql`${cards.balance} + ${Number(amount)}` })
        .where(eq(cards.id, cardId));
      const [txRow] = await tx
        .insert(cardTransactions)
        .values({
          cardId,
          date,
          type: "in",
          amount,
          description: `Kirim: ${title}`,
        })
        .returning();
      const [linked] = await tx
        .update(incomes)
        .set({ transactionId: txRow.id })
        .where(eq(incomes.id, createdIncome.id))
        .returning();
      return [linked];
    }

    return [createdIncome];
  });

  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const [existing] = await db
    .select()
    .from(incomes)
    .where(eq(incomes.id, id))
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
      existing.cardId && isRealIncomeSource(existing.source)
        ? existing.cardId
        : null;
    if (oldCardId) {
      await tx
        .update(cards)
        .set({
          balance: sql`GREATEST(${cards.balance} - ${Number(existing.amount)}, 0)`,
        })
        .where(eq(cards.id, oldCardId));
    }

    const [row] = await tx
      .update(incomes)
      .set(rest)
      .where(eq(incomes.id, id))
      .returning();

    const newCardId =
      row.cardId && isRealIncomeSource(row.source) ? row.cardId : null;
    if (newCardId) {
      await tx
        .update(cards)
        .set({ balance: sql`${cards.balance} + ${Number(row.amount)}` })
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
    .from(incomes)
    .where(eq(incomes.id, id))
    .limit(1);
  // source="goal" / "transfer" — ichki o'tkazmalar, balans allaqachon
  // transferBetweenCards/addFundsToGoal orqali tuzatilgan, qayta tuzatilmaydi.
  const deleteCardId =
    existing?.cardId && isRealIncomeSource(existing.source)
      ? existing.cardId
      : null;
  if (existing && deleteCardId) {
    await db.transaction(async (tx) => {
      await tx
        .update(cards)
        .set({
          balance: sql`GREATEST(${cards.balance} - ${Number(existing.amount)}, 0)`,
        })
        .where(eq(cards.id, deleteCardId));
      await tx.delete(incomes).where(eq(incomes.id, id));
    });
    return NextResponse.json({ ok: true });
  }
  await db.delete(incomes).where(eq(incomes.id, id));
  return NextResponse.json({ ok: true });
}
