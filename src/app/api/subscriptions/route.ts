import { NextResponse } from "next/server";
import { db } from "@/db";
import { cards, cardTransactions, expenses, subscriptions } from "@/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";
import { getCardAvailableBalance, getPrimaryCard } from "@/lib/cardActions";
import { parseMoneyInput, todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

function dueDay(value: unknown): number {
  const n = Number(value) || 1;
  return Math.max(1, Math.min(31, Math.floor(n)));
}

export async function GET() {
  const rows = await db
    .select()
    .from(subscriptions)
    .orderBy(desc(subscriptions.active), asc(subscriptions.dueDay));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = String(body.name || "").trim();
  const amount = parseMoneyInput(body.amount);

  if (!name) {
    return NextResponse.json({ error: "Obuna nomi kerak" }, { status: 400 });
  }
  if (amount <= 0) {
    return NextResponse.json(
      { error: "Obuna summasi 0 dan katta bo'lishi kerak" },
      { status: 400 }
    );
  }

  const [created] = await db
    .insert(subscriptions)
    .values({
      name,
      amount: String(amount),
      dueDay: dueDay(body.dueDay),
      cycle: body.cycle || "monthly",
      category: body.category || "subscriptions",
      notes: body.notes ? String(body.notes).trim() : null,
    })
    .returning();

  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "id kerak" }, { status: 400 });

  if (body.action === "pay") {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);
    if (!sub) return NextResponse.json({ error: "Obuna topilmadi" }, { status: 404 });
    if (!sub.active) {
      return NextResponse.json({ error: "Bu obuna faol emas" }, { status: 400 });
    }

    const primary = await getPrimaryCard();
    if (!primary) {
      return NextResponse.json(
        { error: "Avval asosiy karta yarating" },
        { status: 400 }
      );
    }

    const amount = Number(sub.amount);
    const available = await getCardAvailableBalance(primary.id);
    if (available < amount) {
      return NextResponse.json(
        {
          error: `Asosiy kartada mablag' yetarli emas (${available} so'm)`,
        },
        { status: 400 }
      );
    }

    const date = todayISO();
    const title = `Obuna to'lovi: ${sub.name}`;
    const [paid] = await db.transaction(async (tx) => {
      await tx
        .update(cards)
        .set({ balance: sql`GREATEST(${cards.balance} - ${amount}, 0)` })
        .where(eq(cards.id, primary.id));

      const [txRow] = await tx
        .insert(cardTransactions)
        .values({
          cardId: primary.id,
          date,
          type: "out",
          amount: String(amount),
          description: title,
        })
        .returning();

      await tx.insert(expenses).values({
        title,
        amount: String(amount),
        category: sub.category || "subscriptions",
        date,
        cardId: primary.id,
        transactionId: txRow.id,
      });

      const [updated] = await tx
        .update(subscriptions)
        .set({ lastPaidAt: date })
        .where(eq(subscriptions.id, id))
        .returning();

      return [updated];
    });

    return NextResponse.json({ ok: true, subscription: paid });
  }

  const rest: Record<string, unknown> = { ...body };
  delete rest.id;
  delete rest.action;
  if ("name" in rest) rest.name = String(rest.name || "").trim();
  if ("amount" in rest) rest.amount = String(parseMoneyInput(String(rest.amount ?? "")));
  if ("dueDay" in rest) rest.dueDay = dueDay(rest.dueDay);
  if ("notes" in rest) rest.notes = rest.notes ? String(rest.notes).trim() : null;

  const [updated] = await db
    .update(subscriptions)
    .set(rest)
    .where(eq(subscriptions.id, id))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id kerak" }, { status: 400 });

  await db.delete(subscriptions).where(eq(subscriptions.id, id));
  return NextResponse.json({ ok: true });
}
