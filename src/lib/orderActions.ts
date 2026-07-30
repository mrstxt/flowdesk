import { db } from "@/db";
import { orders, incomes, goals } from "@/db/schema";
import { eq } from "drizzle-orm";

export function todayDateISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Buyurtmani tasdiqlash:
 * 1) stage -> confirmed, archived=true
 * 2) Kirim yaratish (order source)
 * 3) autoPercent bo'yicha maqsadlarga ajratish
 */
export async function confirmOrder(
  orderId: number,
  paymentType: string
): Promise<{ ok: boolean; message: string }> {
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

  const amt = parseFloat(String(order.amount));
  if (amt > 0) {
    await db.insert(incomes).values({
      title: `Buyurtma: ${order.title}`,
      amount: String(amt),
      source: "order",
      date: todayDateISO(),
      paymentType,
      orderId,
    });

    const allGoals = await db.select().from(goals);
    for (const g of allGoals) {
      const pct = Number(g.autoPercent ?? 0);
      if (pct > 0) {
        const share = (amt * pct) / 100;
        await db
          .update(goals)
          .set({ savedAmount: String(Number(g.savedAmount) + share) })
          .where(eq(goals.id, g.id));
      }
    }
  }

  return { ok: true, message: "OK" };
}
