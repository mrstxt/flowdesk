import { NextResponse } from "next/server";
import { db } from "@/db";
import { cardTransactions, cards, incomes, expenses } from "@/db/schema";
import { eq, desc, gte, lte, and, asc } from "drizzle-orm";
import {
  addCardIncome,
  addCardExpense,
  transferBetweenCards,
  addFundsToGoal,
  getPrimaryCard,
} from "@/lib/cardActions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cardId = searchParams.get("cardId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Number(searchParams.get("limit") || "50");

  let where;
  if (cardId && from && to) {
    where = and(
      eq(cardTransactions.cardId, Number(cardId)),
      gte(cardTransactions.date, from),
      lte(cardTransactions.date, to)
    );
  } else if (cardId) {
    where = eq(cardTransactions.cardId, Number(cardId));
  } else if (from && to) {
    where = and(
      gte(cardTransactions.date, from),
      lte(cardTransactions.date, to)
    );
  } else {
    where = undefined;
  }

  const rows = where
    ? await db
        .select()
        .from(cardTransactions)
        .where(where)
        .orderBy(desc(cardTransactions.date), desc(cardTransactions.id))
        .limit(limit)
    : await db
        .select()
        .from(cardTransactions)
        .orderBy(desc(cardTransactions.date), desc(cardTransactions.id))
        .limit(limit);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action;

    if (action === "income") {
      // Qo'shimcha kartaga pul kiritish
      const { cardId, amount, description } = body;
      if (!cardId || !amount) {
        return NextResponse.json(
          { error: "cardId va amount kerak" },
          { status: 400 }
        );
      }
      const desc = description || "Qo'shimcha kirim";
      const amt = Number(amount);
      await addCardIncome(Number(cardId), amt, desc);

      // Asosiy karta: UI umumiy foydani (totalProfitAll) ko'rsatadi, shuning
      // uchun incomes jadvaliga ham yozamiz — aks holda pul ko'rinmaydi.
      const [card] = await db
        .select()
        .from(cards)
        .where(eq(cards.id, Number(cardId)))
        .limit(1);
      if (card && card.type === "primary") {
        await db.insert(incomes).values({
          title: desc,
          amount: String(amt),
          source: "other",
          date: new Date().toISOString().slice(0, 10),
          paymentType: "card",
          cardId: card.id,
        });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "expense") {
      // Kartadan chiqim
      const { cardId, amount, description } = body;
      if (!cardId || !amount) {
        return NextResponse.json(
          { error: "cardId va amount kerak" },
          { status: 400 }
        );
      }
      const desc = description || "Chiqim";
      const amt = Number(amount);
      const res = await addCardExpense(Number(cardId), amt, desc);
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }

      // Asosiy karta: UI umumiy foydani (totalProfitAll) ko'rsatadi, shuning
      // uchun expenses jadvaliga ham yozamiz — aks holda chiqim ko'rinmaydi.
      const [card] = await db
        .select()
        .from(cards)
        .where(eq(cards.id, Number(cardId)))
        .limit(1);
      if (card && card.type === "primary") {
        await db.insert(expenses).values({
          title: desc,
          amount: String(amt),
          category: "other",
          date: new Date().toISOString().slice(0, 10),
          cardId: card.id,
        });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "transfer") {
      // Kartadan kartaga o'tkazish
      const { fromCardId, toCardId, amount, description } = body;
      if (!fromCardId || !toCardId || !amount) {
        return NextResponse.json(
          { error: "fromCardId, toCardId va amount kerak" },
          { status: 400 }
        );
      }
      const res = await transferBetweenCards(
        Number(fromCardId),
        Number(toCardId),
        Number(amount),
        description
      );
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "goal_fund") {
      // Maqsadga pul qo'shish (qaysi kartadan)
      const { goalId, amount, fromCardId, description } = body;
      if (!goalId || !amount) {
        return NextResponse.json(
          { error: "goalId va amount kerak" },
          { status: 400 }
        );
      }
      const res = await addFundsToGoal(
        Number(goalId),
        Number(amount),
        fromCardId ? Number(fromCardId) : null,
        description
      );
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        cardName: res.cardName,
        targetCardName: res.targetCardName,
      });
    }

    return NextResponse.json({ error: "action kerak" }, { status: 400 });
  } catch (e) {
    console.error("POST /api/card-transactions error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
