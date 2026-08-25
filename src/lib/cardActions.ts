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

function monthStartISO(date?: string): string {
  const d = date ? new Date(date + "T00:00:00") : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function goalSavedAmountForCurrentPeriod(goal: typeof goals.$inferSelect): number {
  if (goal.period !== "monthly") return Number(goal.savedAmount);
  const currentMonthStart = monthStartISO();
  if (!goal.periodStartedAt || goal.periodStartedAt < currentMonthStart) {
    return 0;
  }
  return Number(goal.savedAmount);
}

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

/**
 * Karta uchun REAL mavjud pul miqdori.
 * - Asosiy karta: umumiy foyda = barcha real kirimlar (goal kirmaydi) − barcha chiqimlar.
 *   (UI asosiy kartada shu pulni ko'rsatadi, DB balance esa odatda 0 bo'ladi)
 * - Qo'shimcha kartalar: DB balance.
 */
export async function getCardAvailableBalance(cardId: number): Promise<number> {
  const [c] = await db
    .select()
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);
  if (!c) return 0;
  if (c.type !== "primary") return Number(c.balance);
  const inRows = await db
    .select()
    .from(incomes)
    .where(ne(incomes.source, "goal"));
  const outRows = await db.select().from(expenses);
  const totalIn = inRows.reduce((s, r) => s + Number(r.amount), 0);
  const totalOut = outRows.reduce((s, r) => s + Number(r.amount), 0);
  return totalIn - totalOut;
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
  // Real mavjud pul: asosiy karta = umumiy foyda, qolgani = DB balance
  const available = await getCardAvailableBalance(cardId);
  if (available < amount) {
    return {
      ok: false,
      error: `Kartada mablag' yetarli emas (${available} so'm)`,
    };
  }
  await db
    .update(cards)
    .set({ balance: sql`GREATEST(${cards.balance} - ${amount}, 0)` })
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
  // Real mavjud pul (asosiy karta = umumiy foyda)
  const fromAvailable = await getCardAvailableBalance(fromCardId);
  if (fromAvailable < amount) {
    return {
      ok: false,
      error: `«${from.name}» kartasida mablag' yetarli emas (${fromAvailable} so'm)`,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const desc = description || `Transfer: ${from.name} → ${to.name}`;

  // 1. fromCardId dan ayiramiz (manfiy bo'lmasligi uchun 0 bilan cheklaymiz)
  await db
    .update(cards)
    .set({ balance: sql`GREATEST(${cards.balance} - ${amount}, 0)` })
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

  // Asosiy karta ishtirok etsa — umumiy foyda (totalProfitAll) ham o'zgarishi
  // kerak, chunki UI asosiy kartani totalProfitAll orqali ko'rsatadi:
  // - Asosiy kartadan chiqsa → expense (foyda kamayadi)
  // - Asosiy kartaga tushsa → income (foyda oshadi)
  if (from.type === "primary") {
    await db.insert(expenses).values({
      title: desc,
      amount: String(amount),
      category: "transfer",
      date: today,
      cardId: fromCardId,
    });
  }
  if (to.type === "primary") {
    await db.insert(incomes).values({
      title: desc,
      amount: String(amount),
      source: "transfer",
      date: today,
      paymentType: "card",
      cardId: toCardId,
    });
  }

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
  fromCardId: number | null,
  description?: string
): Promise<{ ok: boolean; error?: string; cardName?: string; targetCardName?: string }> {
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

  const sourceCardId = fromCardId;
  const [srcCard] = sourceCardId
    ? await db
        .select()
        .from(cards)
        .where(eq(cards.id, sourceCardId))
        .limit(1)
    : [null];
  const [targetCard] = await db
    .select()
    .from(cards)
    .where(eq(cards.id, goal.cardId))
    .limit(1);

  if (!targetCard || (sourceCardId && !srcCard)) {
    return { ok: false, error: "Manba yoki maqsad kartasi topilmadi" };
  }
  const targetCardId = goal.cardId;

  const desc = description || `Maqsadga: ${goal.title}`;
  const today = new Date().toISOString().slice(0, 10);
  const currentSavedAmount = goalSavedAmountForCurrentPeriod(goal);
  const nextPeriodStartedAt =
    goal.period === "monthly" ? monthStartISO() : goal.periodStartedAt;

  if (!sourceCardId) {
    await db.transaction(async (tx) => {
      await tx
        .update(goals)
        .set({
          savedAmount: String(currentSavedAmount + amount),
          periodStartedAt: nextPeriodStartedAt,
        })
        .where(eq(goals.id, goalId));

      await tx
        .update(cards)
        .set({ balance: sql`${cards.balance} + ${amount}` })
        .where(eq(cards.id, targetCardId));

      const [goalTx] = await tx
        .insert(cardTransactions)
        .values({
          cardId: targetCardId,
          date: today,
          type: "goal_in",
          amount: String(amount),
          description: desc,
        })
        .returning();

      await tx.insert(incomes).values({
        title: desc,
        amount: String(amount),
        source: "goal",
        date: today,
        paymentType: "card",
        cardId: targetCardId,
        transactionId: goalTx.id,
      });
    });

    return { ok: true, cardName: "Qo'shimcha kirim", targetCardName: targetCard.name };
  }

  // Manba karta va maqsad kartasi bir xil bo'lsa
  if (sourceCardId === targetCardId) {
    await db.transaction(async (tx) => {
      await tx
        .update(goals)
        .set({
          savedAmount: String(currentSavedAmount + amount),
          periodStartedAt: nextPeriodStartedAt,
        })
        .where(eq(goals.id, goalId));
      const [goalTx] = await tx
        .insert(cardTransactions)
        .values({
          cardId: targetCardId,
          date: today,
          type: "goal_in",
          amount: String(amount),
          description: desc,
        })
        .returning();
      await tx.insert(incomes).values({
        title: desc,
        amount: String(amount),
        source: "goal",
        date: today,
        paymentType: "card",
        cardId: targetCardId,
        transactionId: goalTx.id,
      });
      await tx.insert(expenses).values({
        title: desc,
        amount: String(amount),
        category: "transfer",
        date: today,
        cardId: sourceCardId,
        transactionId: goalTx.id,
      });
    });
    return { ok: true, cardName: srcCard?.name, targetCardName: targetCard.name };
  }

  // Boshqa kartadan maqsad kartasiga (Masalan: Asosiy kartadan Maqsad kartasiga transaksiyadek o'tkazish):
  // Real mavjud pul tekshiriladi (asosiy karta = umumiy foyda)
  const srcAvailable = await getCardAvailableBalance(sourceCardId);
  if (srcAvailable < amount) {
    return {
      ok: false,
      error: `«${srcCard?.name || "Karta"}» kartasida mablag' yetarli emas (${srcAvailable} so'm)`,
    };
  }

  await db.transaction(async (tx) => {
    // 1. Manba kartadan (Asosiy kartadan) pul ayiramiz
    await tx
      .update(cards)
      .set({ balance: sql`GREATEST(${cards.balance} - ${amount}, 0)` })
      .where(eq(cards.id, sourceCardId));
    const [outTx] = await tx
      .insert(cardTransactions)
      .values({
        cardId: sourceCardId,
        date: today,
        type: "transfer_out",
        amount: String(amount),
        relatedCardId: targetCardId,
        description: desc,
      })
      .returning();

    // 2. Maqsad kartasiga (Target kartaga) pul qo'shamiz
    await tx
      .update(cards)
      .set({ balance: sql`${cards.balance} + ${amount}` })
      .where(eq(cards.id, targetCardId));
    const [goalTx] = await tx
      .insert(cardTransactions)
      .values({
        cardId: targetCardId,
        date: today,
        type: "goal_in",
        amount: String(amount),
        relatedCardId: sourceCardId,
        description: desc,
      })
      .returning();

    // 3. goals.savedAmount ga qo'shamiz
    await tx
      .update(goals)
      .set({
        savedAmount: String(currentSavedAmount + amount),
        periodStartedAt: nextPeriodStartedAt,
      })
      .where(eq(goals.id, goalId));

    // 4. Income sifatida yozamiz (maqsad kartasiga)
    await tx.insert(incomes).values({
      title: desc,
      amount: String(amount),
      source: "goal",
      date: today,
      paymentType: "card",
      cardId: goal.cardId,
      transactionId: goalTx.id,
    });

    // 5. Asosiy kartadan pul chiqqanini ko'rsatamiz
    await tx.insert(expenses).values({
      title: desc,
      amount: String(amount),
      category: "transfer",
      date: today,
      cardId: sourceCardId,
      transactionId: outTx.id,
    });
  });

  return { ok: true, cardName: srcCard?.name, targetCardName: targetCard.name };
}
