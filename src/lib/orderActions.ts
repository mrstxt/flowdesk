import { db } from "@/db";
import {
  orders,
  incomes,
  expenses,
  goals,
} from "@/db/schema";
import { eq, gte, sql, and } from "drizzle-orm";
import { parseMoneyInput } from "@/lib/utils";

export function todayDateISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthStartISO(date?: string): string {
  const d = date ? new Date(date + "T00:00:00") : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/**
 * Maqsad uchun sof foydadan ajratish.
 * Sof foyda = (Kirim - Chiqim) shu oyda.
 * autoPercent % sof foydadan maqsadga qo'shiladi.
 */
export async function distributeGoalFromNetProfit(
  goal: typeof goals.$inferSelect,
  netProfit: number,
  excludeOrderId?: number
): Promise<number> {
  const pct = Number(goal.autoPercent ?? 0);
  if (pct <= 0 || netProfit <= 0) return 0;
  // Bu maqsad uchun allaqachon shu oyda qancha ajratilganini hisoblaymiz
  // (bu buyurtmani chiqarib tashlab)
  const ms = monthStartISO();
  const [existing] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${incomes.amount}), 0)`,
    })
    .from(incomes)
    .where(
      and(
        gte(incomes.date, ms),
        eq(incomes.title, `Maqsadga: ${goal.title}`)
      )
    );
  // Yangi summa: sof foydaning foizi, lekin ortiqcha qismini chegiramiz
  const target = netProfit * (pct / 100);
  const current = Number(existing?.total || 0);
  const addAmount = Math.max(0, target - current);
  return addAmount;
}

/**
 * Buyurtmani tasdiqlash:
 * 1) stage -> confirmed, archived=true
 * 2) Kirim yaratish (order source) - tanlangan kartaga
 * 3) Shu oydagi sof foydadan maqsadlarga ajratish
 *    - har bir maqsad uchun shu oyda yig'ilgan sof foydaning
 *      foiziga teng summa goals.savedAmount ga qo'shiladi
 *    - va bu summa "Maqsadga: <nomi>" title bilan income sifatida
 *      yoziladi (qaysi kartaga - maqsad.cardId ga)
 */
export async function confirmOrder(
  orderId: number,
  paymentType: string,
  cardId?: number | null
): Promise<{ ok: boolean; message: string; netDistributed?: number }> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return { ok: false, message: "Buyurtma topilmadi" };
  if (order.stage === "confirmed")
    return { ok: false, message: "Buyurtma allaqachon tasdiqlangan" };

  await db
    .update(orders)
    .set({
      stage: "confirmed",
      paymentType,
      archived: true,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  const amt = parseMoneyInput(order.amount);
  if (amt > 0) {
    // 1. Asosiy kirim
    await db.insert(incomes).values({
      title: `Buyurtma: ${order.title}`,
      amount: String(amt),
      source: "order",
      date: todayDateISO(),
      paymentType,
      cardId: cardId ?? null,
      orderId,
    });

    // 2. Shu oydagi sof foyda = kirim - chiqim
    const ms = monthStartISO();
    const [incSum, expSum] = await Promise.all([
      db
        .select({
          total: sql<string>`COALESCE(SUM(${incomes.amount}), 0)`,
        })
        .from(incomes)
        .where(gte(incomes.date, ms)),
      db
        .select({
          total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
        })
        .from(expenses)
        .where(gte(expenses.date, ms)),
    ]);
    const totalIn = Number(incSum[0]?.total || 0);
    const totalOut = Number(expSum[0]?.total || 0);
    const net = totalIn - totalOut;

    // 3. Maqsadlarga ajratish
    const allGoals = await db.select().from(goals);
    let totalDistributed = 0;
    for (const g of allGoals) {
      const pct = Number(g.autoPercent ?? 0);
      if (pct <= 0 || net <= 0) continue;

      // Bu maqsad uchun shu oyda qancha ajratilgan
      const [existingRows] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${incomes.amount}), 0)`,
        })
        .from(incomes)
        .where(
          and(
            gte(incomes.date, ms),
            eq(incomes.source, "goal"),
            eq(incomes.title, `Maqsadga: ${g.title}`)
          )
        );
      const alreadyAllocated = Number(existingRows?.total || 0);

      // Shu oy uchun maqsadga ajratilishi kerak bo'lgan summa
      // (sof foydaning foizi minus allaqachon ajratilgan)
      const targetAlloc = (net * pct) / 100;
      const remainingAlloc = Math.max(0, targetAlloc - alreadyAllocated);
      if (remainingAlloc <= 0) continue;

      // goals.savedAmount ga qo'shamiz
      await db
        .update(goals)
        .set({
          savedAmount: String(Number(g.savedAmount) + remainingAlloc),
        })
        .where(eq(goals.id, g.id));

      // Shu ajratmani income sifatida ham yozamiz (qaysi kartaga - g.cardId)
      await db.insert(incomes).values({
        title: `Maqsadga: ${g.title}`,
        amount: String(remainingAlloc),
        source: "goal",
        date: todayDateISO(),
        paymentType,
        cardId: g.cardId ?? null,
      });

      totalDistributed += remainingAlloc;
    }

    return { ok: true, message: "OK", netDistributed: totalDistributed };
  }

  return { ok: true, message: "OK" };
}
