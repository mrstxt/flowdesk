import { db } from "@/db";
import {
  orders,
  incomes,
  expenses,
  goals,
  cards,
  cardTransactions,
} from "@/db/schema";
import { eq, gte, sql, and, ne } from "drizzle-orm";
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
 * 3) Shu oydagi sof foydadan maqsadlarga ajratish
 *    (har bir maqsad uchun shu oyda yig'ilgan sof foydaning
 *     foiziga teng summa goals.savedAmount ga qo'shiladi)
 * 4) Maqsadga ajratilgan summa "Maqsadga: <nomi>" title bilan
 *    income sifatida yoziladi va maqsadning o'ziga tegishli
 *    kartasiga tushadi
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
    // Qaysi kartaga tushadi? Agar cardId berilmagan bo'lsa — asosiy karta
    let targetCardId = cardId;
    if (!targetCardId) {
      const primary = await getPrimaryCard();
      if (primary) targetCardId = primary.id;
    }

    // 1. Asosiy kirim (income jadvaliga)
    const [income] = await db
      .insert(incomes)
      .values({
        title: `Buyurtma: ${order.title}`,
        amount: String(amt),
        source: "order",
        date: todayDateISO(),
        paymentType,
        cardId: targetCardId,
        orderId,
      })
      .returning();

    // 2. Karta balance ga qo'shamiz + card_transactions yozamiz
    if (targetCardId) {
      await db
        .update(cards)
        .set({ balance: sql`${cards.balance} + ${amt}` })
        .where(eq(cards.id, targetCardId));
      await db.insert(cardTransactions).values({
        cardId: targetCardId,
        date: todayDateISO(),
        type: "in",
        amount: String(amt),
        description: `Buyurtma: ${order.title}`,
      });
    }

    // 3. Shu oydagi sof foyda = kirim - chiqim
    // MUHIM: source="goal" (ichki maqsad transferi) kirimga qo'shilmaydi,
    // aks holda maqsadga ajratilgan pul yana "sof foyda" bo'lib hisoblanib,
    // avtomatik foiz oshib ketardi (feedback loop).
    const ms = monthStartISO();
    const [incSum, expSum] = await Promise.all([
      db
        .select({
          total: sql<string>`COALESCE(SUM(${incomes.amount}), 0)`,
        })
        .from(incomes)
        .where(and(gte(incomes.date, ms), ne(incomes.source, "goal"))),
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

    // 4. Maqsadlarga ajratish
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

      // Maqsadga ajratish: pul buyurtma tushgan kartadan (asosan asosiy
      // kartadan) olinadi va maqsad kartasiga tranzaksiyadek o'tkaziladi.
      const sourceCardId = targetCardId; // buyurtma puli tushgan karta
      if (g.cardId) {
        // Maqsad kartasi manba kartadan FARQLI bo'lsa — haqiqiy tranzaksiya:
        // manbadan ayiramiz, maqsad kartasiga qo'shamiz.
        // Agar maqsad kartasi manba (asosiy) karta bilan bir xil bo'lsa,
        // pul shu kartada allaqachon — balance o'zgartirilmaydi (duplikat
        // qo'shish xatosi bo'lmasligi uchun).
        if (sourceCardId && sourceCardId !== g.cardId) {
          // 1. Manba kartadan (asosiy karta) ayiramiz
          await db
            .update(cards)
            .set({ balance: sql`${cards.balance} - ${remainingAlloc}` })
            .where(eq(cards.id, sourceCardId));
          await db.insert(cardTransactions).values({
            cardId: sourceCardId,
            date: todayDateISO(),
            type: "transfer_out",
            amount: String(remainingAlloc),
            relatedCardId: g.cardId,
            description: `Maqsadga: ${g.title}`,
          });
          // 2. Maqsad kartasiga qo'shamiz
          await db
            .update(cards)
            .set({ balance: sql`${cards.balance} + ${remainingAlloc}` })
            .where(eq(cards.id, g.cardId));
        }
        // Audit: maqsad kartasiga tushganini qayd qilamiz
        await db.insert(cardTransactions).values({
          cardId: g.cardId,
          date: todayDateISO(),
          type: "goal_in",
          amount: String(remainingAlloc),
          relatedCardId: sourceCardId ?? null,
          description: `Maqsadga: ${g.title}`,
        });
      }
      await db.insert(incomes).values({
        title: `Maqsadga: ${g.title}`,
        amount: String(remainingAlloc),
        source: "goal",
        date: todayDateISO(),
        paymentType,
        cardId: g.cardId,
      });

      totalDistributed += remainingAlloc;
    }

    return { ok: true, message: "OK", netDistributed: totalDistributed };
  }

  return { ok: true, message: "OK" };
}
