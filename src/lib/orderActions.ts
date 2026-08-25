import { db } from "@/db";
import {
  orders,
  incomes,
  expenses,
  goals,
  cards,
  cardTransactions,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { parseMoneyInput } from "@/lib/utils";
import { getPrimaryCard } from "@/lib/cardActions";

export function todayDateISO(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function monthStartISO(date?: string): string {
  const d = date ? new Date(date + "T00:00:00") : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/**
 * Buyurtmani tasdiqlash:
 * 1) stage -> confirmed, archived=true
 * 2) Asosiy kartaga avtomatik kirim
 * 3) Faqat shu buyurtma summasidan maqsadlarga foiz ajratish
 *    (masalan 100 000 so'm va 1% bo'lsa, 1 000 so'm maqsadga o'tadi)
 * 4) Maqsadga ajratilgan summa "Maqsadga: <nomi>" title bilan
 *    income sifatida yoziladi va maqsadning o'ziga tegishli
 *    kartasiga tushadi
 */
export async function confirmOrder(
  orderId: number
): Promise<{ ok: boolean; message: string; netDistributed?: number }> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return { ok: false, message: "Buyurtma topilmadi" };
  if (order.stage === "confirmed")
    return { ok: false, message: "Buyurtma allaqachon tasdiqlangan" };

  const [existingOrderIncome] = await db
    .select({ id: incomes.id })
    .from(incomes)
    .where(and(eq(incomes.orderId, orderId), eq(incomes.source, "order")))
    .limit(1);

  if (existingOrderIncome) {
    await db
      .update(orders)
      .set({
        stage: "confirmed",
        paymentType: "card",
        archived: true,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    return { ok: true, message: "OK", netDistributed: 0 };
  }

  const amt = parseMoneyInput(order.amount);
  let targetCardId: number | null = null;
  if (amt > 0) {
    // Buyurtma puli har doim loyiha asosiy kartasiga tushadi.
    const primary = await getPrimaryCard();
    if (!primary) {
      return {
        ok: false,
        message: "Asosiy karta topilmadi. Avval asosiy karta yarating.",
      };
    }
    targetCardId = primary.id;
  }

  if (amt > 0) {
    const confirmedCardId = targetCardId;
    if (!confirmedCardId) {
      return {
        ok: false,
        message: "Asosiy karta topilmadi. Avval asosiy karta yarating.",
      };
    }

    // 3. Maqsadlarga ajratish faqat tasdiqlanayotgan buyurtma summasidan.
    const allGoals = await db.select().from(goals);
    const totalAutoPercent = allGoals.reduce((sum, g) => {
      const pct = Number(g.autoPercent ?? 0);
      return g.cardId && pct > 0 ? sum + pct : sum;
    }, 0);
    if (totalAutoPercent > 100) {
      return {
        ok: false,
        message:
          "Maqsadlarning jami avtomatik foizi 100% dan oshib ketgan. Foizlarni kamaytiring.",
      };
    }

    const result = await db.transaction(async (tx) => {
      const orderPaymentType = "card";
      const today = todayDateISO();
      let totalDistributed = 0;

      await tx
        .update(orders)
        .set({
          stage: "confirmed",
          paymentType: orderPaymentType,
          archived: true,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));

      // 1. Karta balance ga qo'shamiz + card_transactions yozamiz
      await tx
        .update(cards)
        .set({ balance: sql`${cards.balance} + ${amt}` })
        .where(eq(cards.id, confirmedCardId));
      const [orderTx] = await tx
        .insert(cardTransactions)
        .values({
          cardId: confirmedCardId,
          date: today,
          type: "in",
          amount: String(amt),
          description: `Buyurtma #${orderId}: ${order.title}`,
        })
        .returning();

      // 2. Asosiy kirim (income jadvaliga)
      await tx.insert(incomes).values({
        title: `Buyurtma: ${order.title}`,
        amount: String(amt),
        source: "order",
        date: today,
        paymentType: orderPaymentType,
        cardId: confirmedCardId,
        transactionId: orderTx.id,
        orderId,
      });

      for (const g of allGoals) {
        const pct = Number(g.autoPercent ?? 0);
        if (pct <= 0) continue;
        if (!g.cardId) continue;

        const orderAllocation = (amt * pct) / 100;
        if (orderAllocation <= 0) continue;

        // goals.savedAmount ga qo'shamiz
        await tx
          .update(goals)
          .set({
            savedAmount: String(Number(g.savedAmount) + orderAllocation),
          })
          .where(eq(goals.id, g.id));

        // Maqsadga ajratish: pul buyurtma tushgan asosiy kartadan olinadi
        // va maqsad kartasiga tranzaksiyadek o'tkaziladi.
        const sourceCardId = confirmedCardId; // buyurtma puli tushgan karta
        const desc = `Maqsadga: ${g.title} (buyurtma #${orderId})`;
        let outTxId: number | null = null;

        // Maqsad kartasi manba kartadan FARQLI bo'lsa — haqiqiy tranzaksiya:
        // manbadan ayiramiz, maqsad kartasiga qo'shamiz.
        // Agar maqsad kartasi manba (asosiy) karta bilan bir xil bo'lsa,
        // pul shu kartada allaqachon — balance o'zgartirilmaydi.
        if (sourceCardId !== g.cardId) {
          await tx
            .update(cards)
            .set({
              balance: sql`GREATEST(${cards.balance} - ${orderAllocation}, 0)`,
            })
            .where(eq(cards.id, sourceCardId));
          const [outTx] = await tx
            .insert(cardTransactions)
            .values({
              cardId: sourceCardId,
              date: today,
              type: "transfer_out",
              amount: String(orderAllocation),
              relatedCardId: g.cardId,
              description: desc,
            })
            .returning();
          outTxId = outTx.id;

          await tx
            .update(cards)
            .set({ balance: sql`${cards.balance} + ${orderAllocation}` })
            .where(eq(cards.id, g.cardId));
        }

        const [goalInTx] = await tx
          .insert(cardTransactions)
          .values({
            cardId: g.cardId,
            date: today,
            type: "goal_in",
            amount: String(orderAllocation),
            relatedCardId: sourceCardId,
            description: desc,
          })
          .returning();

        await tx.insert(expenses).values({
          title: desc,
          amount: String(orderAllocation),
          category: "transfer",
          date: today,
          cardId: sourceCardId,
          transactionId: outTxId ?? goalInTx.id,
        });

        await tx.insert(incomes).values({
          title: desc,
          amount: String(orderAllocation),
          source: "goal",
          date: today,
          paymentType: orderPaymentType,
          cardId: g.cardId,
          transactionId: goalInTx.id,
          orderId,
        });

        totalDistributed += orderAllocation;
      }

      return { ok: true, message: "OK", netDistributed: totalDistributed };
    });

    return result;
  }

  await db
    .update(orders)
    .set({
      stage: "confirmed",
      paymentType: "card",
      archived: true,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  return { ok: true, message: "OK" };
}
