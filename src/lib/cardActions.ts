import { db } from "@/db";
import {
  cards,
  cardTransactions,
  incomes,
  expenses,
  goals,
} from "@/db/schema";
import { eq, sql, desc, and, gte, isNull, ne } from "drizzle-orm";
import { parseMoneyInput } from "@/lib/utils";

/**
 * Karta operatsiyalari markaziy moduli.
 *
 * MUHIM: Barcha karta bilan bog'liq pul o'tkazmalar shu yerdan
 * o'tishi kerak. Bu yerda:
 * - card_transactions ga yozuv qo'shiladi
 * - cards.balance yangilanadi
 * - incomes/expenses bilan bog'lanadi (transactionId orqali)
 *
 * Bu yerda bitta TAMOYIL:
 * - "primary" tipidagi karta = asosiy karta (faqat 1 ta bo'ladi)
 * - "additional" tipidagi karta = qo'shimcha karta (ixtiyoriy)
 * - Asosiy kartaga har doim BARCHA buyurtma pullari keladi
 * - Qo'shimcha kartaga qo'lda pul kiritiladi yoki transfer qilinadi
 * - Maqsad faqat "kirim" qabul qiladi (chiqim yo'q)
 */

/** Asosiy kartani qaytaradi (1 ta yoki null) */
export async function getPrimaryCard() {
  const [c] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.type, "primary"), eq(cards.archived, false)))
    .limit(1);
  return c || null;
}

/** Barcha faol kartalarni qaytaradi (arxivlanmagan) */
export async function getAllActiveCards() {
  return db
    .select()
    .from(cards)
    .where(eq(cards.archived, false))
    .orderBy(desc(cards.type), cards.id);
}

/**
 * Karta yaratish — primary tipida faqat bitta bo'lishi kerak.
 * Yangi primary karta yaratilsa, boshqalar primary emas bo'ladi.
 */
export async function createCard(opts: {
  name: string;
  bank?: string | null;
  last4?: string | null;
  color?: string;
  type: "primary" | "additional";
  initialBalance?: number;
}): Promise<{ ok: boolean; card?: typeof cards.$inferSelect; error?: string }> {
  if (!opts.name?.trim()) {
    return { ok: false, error: "Karta nomi kerak" };
  }
  if (opts.type === "primary") {
    // Boshqa primary kartalarni additional ga o'tkazamiz
    await db
      .update(cards)
      .set({ type: "additional" })
      .where(eq(cards.type, "primary"));
  }
  const balance = opts.initialBalance ?? 0;
  const [created] = await db
    .insert(cards)
    .values({
      name: opts.name.trim(),
      bank: opts.bank || null,
      last4: opts.last4 || null,
      color: opts.color || "#0a84ff",
      type: opts.type,
      balance: String(balance),
    })
    .returning();
  if (balance > 0) {
    await db.insert(cardTransactions).values({
      cardId: created.id,
      date: new Date().toISOString().slice(0, 10),
      type: "in",
      amount: String(balance),
      description: "Boshlang'ich qoldiq",
    });
  }
  return { ok: true, card: created };
}

/** Karta balance ga pul qo'shish (kirim) */
export async function addCardIncome(
  cardId: number,
  amount: number,
  description: string
) {
  if (amount <= 0) throw new Error("Summa 0 dan katta bo'lishi kerak");
  await db
    .update(cards)
    .set({ balance: sql`${cards.balance} + ${amount}` })
    .where(eq(cards.id, cardId));
  await db.insert(cardTransactions).values({
    cardId,
    date: new Date().toISOString().slice(0, 10),
    type: "in",
    amount: String(amount),
    description,
  });
}

/** Karta balance dan pul ayirish (chiqim) — mablag' yetarli bo'lsa */
export async function addCardExpense(
  cardId: number,
  amount: number,
  description: string
): Promise<{ ok: boolean; error?: string }> {
  if (amount <= 0) return { ok: false, error: "Summa 0 dan katta bo'lishi kerak" };
  const [c] = await db
    .select()
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);
  if (!c) return { ok: false, error: "Karta topilmadi" };
  const bal = Number(c.balance);
  if (bal < amount) {
    return { ok: false, error: `Kartada mablag' yetarli emas (${bal} so'm)` };
  }
  await db
    .update(cards)
    .set({ balance: sql`${cards.balance} - ${amount}` })
    .where(eq(cards.id, cardId));
  await db.insert(cardTransactions).values({
    cardId,
    date: new Date().toISOString().slice(0, 10),
    type: "out",
    amount: String(amount),
    description,
  });
  return { ok: true };
}

/**
 * Kartadan kartaga pul o'tkazish.
 * fromCardId balance dan ayriladi, toCardId balance ga qo'shiladi.
 */
export async function transferBetweenCards(
  fromCardId: number,
  toCardId: number,
  amount: number,
  description?: string
): Promise<{ ok: boolean; error?: string }> {
  if (fromCardId === toCardId) {
    return { ok: false, error: "Bir xil kartaga o'tkazib bo'lmaydi" };
  }
  if (amount <= 0) return { ok: false, error: "Summa 0 dan katta bo'lishi kerak" };

  const [from] = await db
    .select()
    .from(cards)
    .where(eq(cards.id, fromCardId))
    .limit(1);
  const [to] = await db
    .select()
    .from(cards)
    .where(eq(cards.id, toCardId))
    .limit(1);
  if (!from || !to) return { ok: false, error: "Karta topilmadi" };
  if (Number(from.balance) < amount) {
    return {
      ok: false,
      error: `«${from.name}» kartasida mablag' yetarli emas (${from.balance} so'm)`,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const desc = description || `Transfer: ${from.name} → ${to.name}`;

  // 1. fromCardId dan ayiramiz
  await db
    .update(cards)
    .set({ balance: sql`${cards.balance} - ${amount}` })
    .where(eq(cards.id, fromCardId));
  await db.insert(cardTransactions).values({
    cardId: fromCardId,
    date: today,
    type: "transfer_out",
    amount: String(amount),
    relatedCardId: toCardId,
    description: desc,
  });

  // 2. toCardId ga qo'shamiz
  await db
    .update(cards)
    .set({ balance: sql`${cards.balance} + ${amount}` })
    .where(eq(cards.id, toCardId));
  await db.insert(cardTransactions).values({
    cardId: toCardId,
    date: today,
    type: "transfer_in",
    amount: String(amount),
    relatedCardId: fromCardId,
    description: desc,
  });

  return { ok: true };
}

/**
 * Maqsad uchun pul qo'shish.
 * - fromCardId (asosan asosiy karta) dan pul olinadi
 * - maqsad.cardId (maqsad kartasi) ga pul qo'shiladi
 * - Maqsad balance va savedAmount ga qo'shiladi
 *
 * MUHIM: maqsad faqat "kirim" qabul qiladi, hech qachon chiqim qabul qilmaydi.
 */
export async function addFundsToGoal(
  goalId: number,
  amount: number,
  fromCardId: number | null
): Promise<{ ok: boolean; error?: string; cardName?: string }> {
  if (amount <= 0) return { ok: false, error: "Summa 0 dan katta bo'lishi kerak" };
  const [goal] = await db
    .select()
    .from(goals)
    .where(eq(goals.id, goalId))
    .limit(1);
  if (!goal) return { ok: false, error: "Maqsad topilmadi" };
  if (!goal.cardId) {
    return { ok: false, error: "Maqsadga karta biriktirilmagan" };
  }

  // Manba karta (default: asosiy karta)
  let sourceCardId = fromCardId;
  if (!sourceCardId) {
    const primary = await getPrimaryCard();
    if (!primary) {
      return {
        ok: false,
        error: "Asosiy karta topilmadi. Avval asosiy karta yarating.",
      };
    }
    sourceCardId = primary.id;
  }

  // Manba karta va maqsad kartasi bir xil bo'lsa, transfer qilmaymiz
  if (sourceCardId === goal.cardId) {
    // Faqat maqsad balance va savedAmount ga qo'shamiz
    await db
      .update(goals)
      .set({
        savedAmount: String(Number(goal.savedAmount) + amount),
      })
      .where(eq(goals.id, goalId));
    await db
      .update(cards)
      .set({ balance: sql`${cards.balance} + ${amount}` })
      .where(eq(cards.id, goal.cardId));
    await db.insert(cardTransactions).values({
      cardId: goal.cardId,
      date: new Date().toISOString().slice(0, 10),
      type: "goal_in",
      amount: String(amount),
      description: `Maqsadga qo'shish: ${goal.title}`,
    });
    const [srcCard] = await db
      .select()
      .from(cards)
      .where(eq(cards.id, sourceCardId))
      .limit(1);
    return { ok: true, cardName: srcCard?.name };
  }

  // 1. Manba kartadan ayiramiz
  const srcRes = await addCardExpense(
    sourceCardId,
    amount,
    `Maqsadga: ${goal.title}`
  );
  if (!srcRes.ok) return srcRes;

  // 2. Maqsad kartasiga qo'shamiz
  await db
    .update(cards)
    .set({ balance: sql`${cards.balance} + ${amount}` })
    .where(eq(cards.id, goal.cardId));
  await db.insert(cardTransactions).values({
    cardId: goal.cardId,
    date: new Date().toISOString().slice(0, 10),
    type: "goal_in",
    amount: String(amount),
    relatedCardId: sourceCardId,
    description: `Maqsadga qo'shish: ${goal.title}`,
  });

  // 3. goals.savedAmount ga qo'shamiz
  await db
    .update(goals)
    .set({
      savedAmount: String(Number(goal.savedAmount) + amount),
    })
    .where(eq(goals.id, goalId));

  // 4. Income sifatida ham yozamiz (maqsad kartasiga)
  await db.insert(incomes).values({
    title: `Maqsadga qo'shish: ${goal.title}`,
    amount: String(amount),
    source: "goal",
    date: new Date().toISOString().slice(0, 10),
    paymentType: "card",
    cardId: goal.cardId,
  });

  const [srcCard] = await db
    .select()
    .from(cards)
    .where(eq(cards.id, sourceCardId))
    .limit(1);
  return { ok: true, cardName: srcCard?.name };
}
