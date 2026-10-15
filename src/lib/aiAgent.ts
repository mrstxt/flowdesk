import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { db } from "@/db";
import {
  tasks,
  routines,
  videos,
  books,
  settings,
  cards,
  cardTransactions,
  incomes,
  expenses,
  orders,
  goals,
  contentItems,
} from "@/db/schema";
import { eq, or, isNull, and, ilike, desc } from "drizzle-orm";
import { createSummaryPdf } from "@/lib/pdfService";

export interface AgentResponse {
  text: string;
  pdfUrl?: string;
  actionTaken?: string;
}

// ─── 1. Tool Implementations ───

/**
 * a) Belgilangan sana bo'yicha tasks va routines jadvallaridan kungi rejalarni oladi
 */
export async function getCalendarSchedule(params: { date?: string }) {
  const d = new Date();
  const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const targetDate = params.date || todayISO;

  try {
    const dayTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.date, targetDate));

    const dayRoutines = await db
      .select()
      .from(routines)
      .where(
        or(
          eq(routines.targetDate, targetDate),
          isNull(routines.targetDate)
        )
      );

    return {
      date: targetDate,
      tasks: dayTasks.map((t) => ({
        id: t.id,
        title: t.title,
        completed: !!t.completed,
        category: t.category,
      })),
      routines: dayRoutines.map((r) => ({
        id: r.id,
        time: r.time,
        startTime: r.startTime,
        endTime: r.endTime,
        title: r.title,
        done: r.lastDoneDate === targetDate,
        streak: r.streak || 0,
      })),
    };
  } catch (error: any) {
    console.error("getCalendarSchedule error:", error);
    return { error: error.message, date: targetDate, tasks: [], routines: [] };
  }
}

/**
 * b) tasks jadvaliga yangi vazifa yozadi
 */
export async function createTask(params: {
  title: string;
  date?: string;
  category?: string;
}) {
  const d = new Date();
  const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const targetDate = params.date || todayISO;
  const category = params.category || "personal";

  try {
    const [created] = await db
      .insert(tasks)
      .values({
        title: params.title.trim(),
        date: targetDate,
        category,
        completed: false,
      })
      .returning();

    return {
      success: true,
      message: `Vazifa muvaffaqiyatli saqlandi!`,
      task: created,
    };
  } catch (error: any) {
    console.error("createTask error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * c) Vazifani bajarildi deb belgilash
 */
export async function completeTask(params: { taskId?: number; title?: string }) {
  const d = new Date();
  const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  try {
    if (params.taskId) {
      const numId = Number(params.taskId);
      const [updatedTask] = await db
        .update(tasks)
        .set({ completed: true })
        .where(eq(tasks.id, numId))
        .returning();

      if (updatedTask) {
        return {
          success: true,
          message: `"${updatedTask.title}" vazifasi bajarildi deb belgilandi! 🎉`,
          task: updatedTask,
        };
      }

      const [updatedRoutine] = await db
        .update(routines)
        .set({ lastDoneDate: todayISO })
        .where(eq(routines.id, numId))
        .returning();

      if (updatedRoutine) {
        return {
          success: true,
          message: `"${updatedRoutine.title}" odati bajarildi deb belgilandi! 🎉`,
          routine: updatedRoutine,
        };
      }
    }

    if (params.title) {
      const pattern = `%${params.title.trim().toLowerCase()}%`;
      const updatedTasks = await db
        .update(tasks)
        .set({ completed: true })
        .where(ilike(tasks.title, pattern))
        .returning();

      const updatedRoutines = await db
        .update(routines)
        .set({ lastDoneDate: todayISO })
        .where(ilike(routines.title, pattern))
        .returning();

      if (updatedTasks.length > 0 || updatedRoutines.length > 0) {
        const name = updatedTasks[0]?.title || updatedRoutines[0]?.title || params.title;
        return {
          success: true,
          message: `"${name}" vazifasi muvaffaqiyatli bajarildi deb belgilandi! 🎉`,
        };
      }
    }

    return { success: false, message: "Mos keluvchi ochiq vazifa topilmadi." };
  } catch (error: any) {
    console.error("completeTask error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * d) Deadlineni yoki vaqtni surish
 */
export async function rescheduleTask(params: {
  taskId?: number;
  title?: string;
  newTimeOrDate?: string;
}) {
  const d = new Date();
  let targetDate: string | undefined = undefined;
  let targetTime: string | undefined = undefined;

  if (params.newTimeOrDate) {
    const val = params.newTimeOrDate.trim();
    if (/^\d{1,2}:\d{2}$/.test(val)) {
      targetTime = val.padStart(5, "0");
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      targetDate = val;
    } else if (/ertaga/i.test(val)) {
      const tm = new Date(d);
      tm.setDate(tm.getDate() + 1);
      targetDate = `${tm.getFullYear()}-${String(tm.getMonth() + 1).padStart(2, "0")}-${String(tm.getDate()).padStart(2, "0")}`;
    }
  }

  if (!targetDate && !targetTime) {
    const tm = new Date(d);
    tm.setDate(tm.getDate() + 1);
    targetDate = `${tm.getFullYear()}-${String(tm.getMonth() + 1).padStart(2, "0")}-${String(tm.getDate()).padStart(2, "0")}`;
  }

  try {
    if (params.taskId) {
      const numId = Number(params.taskId);
      if (targetDate) {
        await db.update(tasks).set({ date: targetDate }).where(eq(tasks.id, numId));
      }
      if (targetTime || targetDate) {
        await db
          .update(routines)
          .set({
            ...(targetTime ? { startTime: targetTime, time: targetTime } : {}),
            ...(targetDate ? { targetDate } : {}),
          })
          .where(eq(routines.id, numId));
      }
      return {
        success: true,
        message: `Vazifa yangi vaqtga (${targetDate || ""} ${targetTime || ""}) muvaffaqiyatli surildi! ⏱️`,
      };
    }

    if (params.title) {
      const pattern = `%${params.title.trim().toLowerCase()}%`;
      if (targetDate) {
        await db.update(tasks).set({ date: targetDate }).where(ilike(tasks.title, pattern));
      }
      if (targetTime || targetDate) {
        await db
          .update(routines)
          .set({
            ...(targetTime ? { startTime: targetTime, time: targetTime } : {}),
            ...(targetDate ? { targetDate } : {}),
          })
          .where(ilike(routines.title, pattern));
      }
      return {
        success: true,
        message: `"${params.title}" vazifasi yangi vaqtga (${targetDate || ""} ${targetTime || ""}) surildi! ⏱️`,
      };
    }

    return { success: false, message: "Vazifa topilmadi." };
  } catch (error: any) {
    console.error("rescheduleTask error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * e) Videoni videos jadvaliga kiritadi, createSummaryPdf orqali PDF kitob yaratib,
 * books jadvaliga saqlaydi
 */
export async function saveYouTubeAndBook(params: {
  youtubeUrl: string;
  title: string;
  summaryBookText: string;
}) {
  try {
    let videoId = "";
    try {
      const u = new URL(params.youtubeUrl);
      if (u.hostname.includes("youtu.be")) {
        videoId = u.pathname.slice(1);
      } else if (u.searchParams.has("v")) {
        videoId = u.searchParams.get("v") || "";
      }
    } catch {}

    const [savedVideo] = await db
      .insert(videos)
      .values({
        title: params.title.trim(),
        url: params.youtubeUrl,
        videoId: videoId || `yt_${Date.now()}`,
        category: "rivojlanish",
        summary: params.summaryBookText,
        watched: false,
      })
      .returning();

    const pdfUrl = await createSummaryPdf(
      params.title.trim(),
      params.summaryBookText
    );

    const [savedBook] = await db
      .insert(books)
      .values({
        title: params.title.trim(),
        author: "AI Podkast Xulosasi",
        pdfUrl,
        summary: params.summaryBookText,
        status: "rejalashtirilgan",
        totalPages: 5,
        currentPage: 0,
      })
      .returning();

    return {
      success: true,
      message: "Video va PDF xulosa kitobchasi saqlandi!",
      videoId: savedVideo.id,
      bookId: savedBook.id,
      pdfUrl,
      title: params.title,
    };
  } catch (error: any) {
    console.error("saveYouTubeAndBook error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * f) Yangi xarajat kiritish va karta balansidan yechish
 */
export async function addExpense(params: {
  amount: number;
  title: string;
  category?: string;
  cardId?: number;
}) {
  const d = new Date();
  const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const category = params.category || "boshqa";

  try {
    // Asosiy yoki berilgan kartani topish
    let targetCard: any = null;
    if (params.cardId) {
      const [c] = await db.select().from(cards).where(eq(cards.id, params.cardId));
      targetCard = c;
    }
    if (!targetCard) {
      const [primary] = await db.select().from(cards).where(eq(cards.type, "primary"));
      targetCard = primary;
    }
    if (!targetCard) {
      const [first] = await db.select().from(cards).limit(1);
      targetCard = first;
    }

    let txId: number | undefined = undefined;
    if (targetCard) {
      // 1. Transaction audit log
      const [tx] = await db
        .insert(cardTransactions)
        .values({
          cardId: targetCard.id,
          date: todayISO,
          type: "out",
          amount: String(params.amount),
          description: params.title.trim(),
        })
        .returning();
      txId = tx?.id;

      // 2. Karta balansidan ayirish
      const newBalance = Math.max(0, Number(targetCard.balance || 0) - Number(params.amount));
      await db
        .update(cards)
        .set({ balance: String(newBalance) })
        .where(eq(cards.id, targetCard.id));
    }

    // 3. Expenses jadvaliga kiritish
    const [saved] = await db
      .insert(expenses)
      .values({
        title: params.title.trim(),
        amount: String(params.amount),
        category,
        date: todayISO,
        cardId: targetCard ? targetCard.id : null,
        transactionId: txId || null,
      })
      .returning();

    return {
      success: true,
      message: `${Number(params.amount).toLocaleString("uz-UZ")} so'm xarajat kiritildi (${params.title})!`,
      expense: saved,
      cardName: targetCard?.name || "Naqd",
    };
  } catch (error: any) {
    console.error("addExpense error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * g) Yangi daromad kiritish va karta balansiga qo'shish
 */
export async function addIncome(params: {
  amount: number;
  title: string;
  source?: string;
  cardId?: number;
}) {
  const d = new Date();
  const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const source = params.source || "loyihalar";

  try {
    let targetCard: any = null;
    if (params.cardId) {
      const [c] = await db.select().from(cards).where(eq(cards.id, params.cardId));
      targetCard = c;
    }
    if (!targetCard) {
      const [primary] = await db.select().from(cards).where(eq(cards.type, "primary"));
      targetCard = primary;
    }
    if (!targetCard) {
      const [first] = await db.select().from(cards).limit(1);
      targetCard = first;
    }

    let txId: number | undefined = undefined;
    if (targetCard) {
      const [tx] = await db
        .insert(cardTransactions)
        .values({
          cardId: targetCard.id,
          date: todayISO,
          type: "in",
          amount: String(params.amount),
          description: params.title.trim(),
        })
        .returning();
      txId = tx?.id;

      const newBalance = Number(targetCard.balance || 0) + Number(params.amount);
      await db
        .update(cards)
        .set({ balance: String(newBalance) })
        .where(eq(cards.id, targetCard.id));
    }

    const [saved] = await db
      .insert(incomes)
      .values({
        title: params.title.trim(),
        amount: String(params.amount),
        source,
        date: todayISO,
        cardId: targetCard ? targetCard.id : null,
        transactionId: txId || null,
      })
      .returning();

    return {
      success: true,
      message: `${Number(params.amount).toLocaleString("uz-UZ")} so'm daromad hisobga olindi (${params.title})! 💰`,
      income: saved,
      cardName: targetCard?.name || "Naqd",
    };
  } catch (error: any) {
    console.error("addIncome error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * h) Moliyaviy umumiy holat (balanslar va kartalar)
 */
export async function getFinanceSummary() {
  try {
    const cardList = await db.select().from(cards).where(eq(cards.archived, false));
    const totalBalance = cardList.reduce((sum, c) => sum + Number(c.balance || 0), 0);

    const recentExpenses = await db
      .select()
      .from(expenses)
      .orderBy(desc(expenses.createdAt))
      .limit(5);

    const recentIncomes = await db
      .select()
      .from(incomes)
      .orderBy(desc(incomes.createdAt))
      .limit(5);

    return {
      totalBalance,
      cards: cardList.map((c) => ({
        id: c.id,
        name: c.name,
        bank: c.bank,
        last4: c.last4,
        type: c.type,
        balance: Number(c.balance || 0),
      })),
      recentExpenses: recentExpenses.map((e) => ({
        id: e.id,
        title: e.title,
        amount: Number(e.amount),
        date: e.date,
      })),
      recentIncomes: recentIncomes.map((i) => ({
        id: i.id,
        title: i.title,
        amount: Number(i.amount),
        date: i.date,
      })),
    };
  } catch (error: any) {
    console.error("getFinanceSummary error:", error);
    return { error: error.message, totalBalance: 0, cards: [] };
  }
}

/**
 * i) Yangi mijoz buyurtmasini (orders) kiritish
 */
export async function addClientOrder(params: {
  clientName: string;
  title: string;
  amount: number;
  deadline?: string;
  description?: string;
}) {
  try {
    const [saved] = await db
      .insert(orders)
      .values({
        clientName: params.clientName.trim(),
        title: params.title.trim(),
        amount: String(params.amount || 0),
        deadline: params.deadline || null,
        description: params.description || null,
        stage: "new",
      })
      .returning();

    return {
      success: true,
      message: `"${params.clientName}" mijozi uchun yangi buyurtma (${params.title}) saqlandi!`,
      order: saved,
    };
  } catch (error: any) {
    console.error("addClientOrder error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * j) Yangi moliyaviy maqsad (goal) qo'shish
 */
export async function addGoal(params: {
  title: string;
  targetAmount: number;
  deadline?: string;
}) {
  try {
    const [saved] = await db
      .insert(goals)
      .values({
        title: params.title.trim(),
        targetAmount: String(params.targetAmount),
        deadline: params.deadline || null,
        savedAmount: "0",
        usedAmount: "0",
      })
      .returning();

    return {
      success: true,
      message: `Yangi maqsad: "${params.title}" (${Number(params.targetAmount).toLocaleString("uz-UZ")} so'm) saqlandi! 🎯`,
      goal: saved,
    };
  } catch (error: any) {
    console.error("addGoal error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * k) Yangi kontent rejasi (post/reels/video) qo'shish
 */
export async function createContentPlan(params: {
  title: string;
  type?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  caption?: string;
  hook?: string;
  body?: string;
  cta?: string;
}) {
  try {
    const [saved] = await db
      .insert(contentItems)
      .values({
        title: params.title.trim(),
        type: params.type || "post",
        stage: "idea",
        scheduledDate: params.scheduledDate || null,
        scheduledTime: params.scheduledTime || null,
        caption: params.caption || null,
        hook: params.hook || null,
        body: params.body || null,
        cta: params.cta || null,
      })
      .returning();

    return {
      success: true,
      message: `Kontent g'oyasi "${params.title}" media rejasiga qo'shildi! 🎬`,
      contentItem: saved,
    };
  } catch (error: any) {
    console.error("createContentPlan error:", error);
    return { success: false, error: error.message };
  }
}

// ─── 2. Gemini Function Declarations ───

const getCalendarScheduleDeclaration: FunctionDeclaration = {
  name: "getCalendarSchedule",
  description:
    "Foydalanuvchining taqvimidagi kunlik rejalari, intizom odatlari va vazifalarini DB dan olib beradi.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      date: {
        type: Type.STRING,
        description: "Rejalarni olish sanasi (YYYY-MM-DD formatida, masalan: 2026-10-15). Agar berilmasa bugungi sana olinadi.",
      },
    },
  },
};

const createTaskDeclaration: FunctionDeclaration = {
  name: "createTask",
  description:
    "Foydalanuvchining kunlik rejalari ro'yxatiga yangi vazifa (task) qo'shadi.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "Vazifaning aniq nomi yoki tavsifi.",
      },
      date: {
        type: Type.STRING,
        description: "Vazifa sanasi (YYYY-MM-DD formatida). Agar aytilmasa bugungi sana.",
      },
      category: {
        type: Type.STRING,
        description: "Kategoriya (masalan: personal, work, study). Standart: personal.",
      },
    },
    required: ["title"],
  },
};

const completeTaskDeclaration: FunctionDeclaration = {
  name: "completeTask",
  description: "Bajarilgan vazifa yoki odatni tugallandi (bajarildi) deb belgilaydi.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: { type: Type.INTEGER, description: "Vazifaning ID raqami (agar ma'lum bo'lsa)" },
      title: { type: Type.STRING, description: "Bajarilgan vazifa nomi (masalan: 'kitob o'qish' yoki 'dizayn tayyorlash')" },
    },
  },
};

const rescheduleTaskDeclaration: FunctionDeclaration = {
  name: "rescheduleTask",
  description: "Vazifaning muddatini (deadline yoki soatini) yangi vaqtga yoki ertangi kunga suradi.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: { type: Type.INTEGER, description: "Vazifa ID raqami" },
      title: { type: Type.STRING, description: "Vazifa nomi" },
      newTimeOrDate: { type: Type.STRING, description: "Yangi sana yoki soat (masalan: '17:00' yoki '2026-10-16' yoki 'ertaga')" },
    },
  },
};

const saveYouTubeAndBookDeclaration: FunctionDeclaration = {
  name: "saveYouTubeAndBook",
  description:
    "YouTube video yoki podkast havolasini qabul qilib, uni 'videos' (Rivojlanish) bo'limiga kiritadi va matnli xulosasidan PDF kitobcha yaratib, 'books' (Kitoblar) bo'limiga saqlaydi.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      youtubeUrl: {
        type: Type.STRING,
        description: "YouTube video yoki podkast havolasi (URL).",
      },
      title: {
        type: Type.STRING,
        description: "Video / Kitobning to'liq va jozibali sarlavhasi.",
      },
      summaryBookText: {
        type: Type.STRING,
        description:
          "Videoning batafsil, professional va tizimli xulosasi (Kirish, Asosiy g'oyalar, Muhim saboqlar, Amaliy tavsiyalar va Yakuniy xulosa). Ushbu matn to'g'ridan-to'g'ri PDF kitobga kiritiladi.",
      },
    },
    required: ["youtubeUrl", "title", "summaryBookText"],
  },
};

const addExpenseDeclaration: FunctionDeclaration = {
  name: "addExpense",
  description: "Karta yoki hamyondan xarajat yozish va balansni yangilash.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      amount: { type: Type.NUMBER, description: "Xarajat summasi so'mda (masalan: 50000)" },
      title: { type: Type.STRING, description: "Xarajat nima uchun qilingani (masalan: 'Tushlik', 'Taksi')" },
      category: { type: Type.STRING, description: "Xarajat kategoriyasi (masalan: 'ovqat', 'transport', 'uy', 'boshqa')" },
    },
    required: ["amount", "title"],
  },
};

const addIncomeDeclaration: FunctionDeclaration = {
  name: "addIncome",
  description: "Karta yoki hamyonga pul tushganda daromad yozish va balansni oshirish.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      amount: { type: Type.NUMBER, description: "Daromad summasi so'mda (masalan: 1200000)" },
      title: { type: Type.STRING, description: "Daromad nomi yoki nima uchun tushgani" },
      source: { type: Type.STRING, description: "Daromad manbasi (masalan: 'maosh', 'loyihalar', 'mijoz')" },
    },
    required: ["amount", "title"],
  },
};

const getFinanceSummaryDeclaration: FunctionDeclaration = {
  name: "getFinanceSummary",
  description: "Kartalar va ularning qoldiqlari, jami pul va so'nggi xarajatlar/daromadlar holatini ko'rish.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const addClientOrderDeclaration: FunctionDeclaration = {
  name: "addClientOrder",
  description: "Mijozdan yangi buyurtma yoki loyiha tushganda 'orders' bo'limiga kiritish.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      clientName: { type: Type.STRING, description: "Mijoz yoki kompaniya nomi" },
      title: { type: Type.STRING, description: "Buyurtma nomi yoki qilinadigan ish (masalan: 'Logotip dizayni')" },
      amount: { type: Type.NUMBER, description: "Buyurtma narxi so'mda" },
      deadline: { type: Type.STRING, description: "Topshirish muddati (YYYY-MM-DD)" },
      description: { type: Type.STRING, description: "Qo'shimcha izoh yoki talablar" },
    },
    required: ["clientName", "title", "amount"],
  },
};

const addGoalDeclaration: FunctionDeclaration = {
  name: "addGoal",
  description: "Yangi moliyaviy maqsad yoki jamg'arma rejasini 'goals' jadvaliga qo'shish.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Maqsad nomi (masalan: 'Yangi MacBook', 'Umra safari')" },
      targetAmount: { type: Type.NUMBER, description: "Yig'ilishi kerak bo'lgan maqsad summasi" },
      deadline: { type: Type.STRING, description: "Oxirgi muddat (YYYY-MM-DD)" },
    },
    required: ["title", "targetAmount"],
  },
};

const createContentPlanDeclaration: FunctionDeclaration = {
  name: "createContentPlan",
  description: "Ijtimoiy tarmoqlar (Instagram, Telegram, YouTube) uchun yangi kontent g'oyasi yoki post rejasini saqlash.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Post yoki video mavzusi" },
      type: { type: Type.STRING, description: "Format: post, reels, carousel, story, article" },
      scheduledDate: { type: Type.STRING, description: "Chiqarish sanasi (YYYY-MM-DD)" },
      scheduledTime: { type: Type.STRING, description: "Chiqarish soati (HH:MM)" },
      caption: { type: Type.STRING, description: "Post tavsifi yoki matni" },
      hook: { type: Type.STRING, description: "Diqqatni tortuvchi boshlang'ich jumla (Hook)" },
      body: { type: Type.STRING, description: "Asosiy mazmun" },
      cta: { type: Type.STRING, description: "Harakatga chaqiruv (CTA)" },
    },
    required: ["title"],
  },
};

// ─── 3. Main Agent Processor ───

const ALL_TOOLS: FunctionDeclaration[] = [
  getCalendarScheduleDeclaration,
  createTaskDeclaration,
  completeTaskDeclaration,
  rescheduleTaskDeclaration,
  saveYouTubeAndBookDeclaration,
  addExpenseDeclaration,
  addIncomeDeclaration,
  getFinanceSummaryDeclaration,
  addClientOrderDeclaration,
  addGoalDeclaration,
  createContentPlanDeclaration,
];

export async function processAgentMessage(
  userText: string,
  context?: { senderId?: string; username?: string; source?: string }
): Promise<AgentResponse> {
  const clean = userText.trim();
  if (!clean) {
    return { text: "Assalomu alaykum Sohibjon! Sizga qanday yordam bera olaman?" };
  }

  let apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    try {
      const [k] = await db
        .select()
        .from(settings)
        .where(eq(settings.key, "gemini_api_key"));
      if (k?.value) apiKey = k.value;
    } catch {}
  }

  const d = new Date();
  const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const systemInstruction = `Siz FlowDesk (Sovodesk) boshqaruv tizimining oliy darajadagi boshqaruv kotibi va shaxsiy AI Agentisiz (Madina).
Foydalanuvchi: Sulaymonov Sohibjon (@sulaymonovss, ID: 6724823030).
Bugungi sana: ${todayISO}.
Sizga FlowDesk platformasiga TO'LIQ RUXSAT (FULL ACCESS) berilgan.

Siz quyidagi barcha amallarni to'g'ridan-to'g'ri bajara olasiz:
1. Taqvim va rejalar: getCalendarSchedule, createTask, completeTask, rescheduleTask.
2. Moliya va balans: addExpense (xarajat yozish), addIncome (daromad kiritish), getFinanceSummary (kartalar va jami balans).
3. Buyurtmalar va mijozlar: addClientOrder (yangi mijoz buyurtmasini saqlash).
4. Maqsadlar: addGoal (yangi jamg'arma maqsadi qo'shish).
5. Media & Kontent: createContentPlan (Instagram/Telegram/YouTube post yoki reels g'oyasi).
6. YouTube & Kitoblar: saveYouTubeAndBook (video havolasidan tahliliy konspekt chiqarib, kitoblar bo'limiga PDF yaratib berish).

Muloqot qoidalari:
- Siz tirik insondek, samimiy, tirishqoq va intizomli o'zbek tilida gaplashasiz ("Sohibjon", "Bajarildi Sohibjon!", "Hammasini FlowDesk-ga kiritdim!").
- Agar Sohibjon "Google/Gemini-dan yozdim, buni sovodeskga saqlab qo'y" yoki "buni saqla", "reja tuzib qo'y", "xarajat yozib qo'y" desa, mos vositadan foydalanib darhol bazaga yozing.
- Javoblaringiz chiroyli formatlangan, professional va qat'iy intizomni aks ettirsin.`;

      const TARGET_MODEL = "gemini-flash-lite-latest";

      const chatResponse = await ai.models.generateContent({
        model: TARGET_MODEL,
        contents: clean,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: ALL_TOOLS }],
        },
      });

      const functionCalls = chatResponse.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        let lastPdfUrl: string | undefined = undefined;
        const toolResponses: any[] = [];

        for (const call of functionCalls) {
          const args = (call.args as any) || {};
          let result: any = null;

          switch (call.name) {
            case "getCalendarSchedule":
              result = await getCalendarSchedule(args);
              break;
            case "createTask":
              result = await createTask(args);
              break;
            case "completeTask":
              result = await completeTask(args);
              break;
            case "rescheduleTask":
              result = await rescheduleTask(args);
              break;
            case "saveYouTubeAndBook":
              result = await saveYouTubeAndBook(args);
              if (result.pdfUrl) lastPdfUrl = result.pdfUrl;
              break;
            case "addExpense":
              result = await addExpense(args);
              break;
            case "addIncome":
              result = await addIncome(args);
              break;
            case "getFinanceSummary":
              result = await getFinanceSummary();
              break;
            case "addClientOrder":
              result = await addClientOrder(args);
              break;
            case "addGoal":
              result = await addGoal(args);
              break;
            case "createContentPlan":
              result = await createContentPlan(args);
              break;
            default:
              result = { status: "unknown_function" };
          }

          toolResponses.push({
            name: call.name,
            response: result,
          });
        }

        // 2-bosqich: Yakuniy chiroyli javob
        const modelParts = chatResponse.candidates?.[0]?.content?.parts || functionCalls.map((fc) => ({
          functionCall: { name: fc.name, args: fc.args },
        }));

        const finalResponse = await ai.models.generateContent({
          model: TARGET_MODEL,
          contents: [
            { role: "user", parts: [{ text: clean }] },
            {
              role: "model",
              parts: modelParts,
            },
            {
              role: "user",
              parts: toolResponses.map((tr) => ({
                functionResponse: {
                  name: tr.name,
                  response: tr.response,
                },
              })),
            },
          ],
          config: { systemInstruction },
        });

        const replyText = finalResponse.text || "Barcha buyruqlar muvaffaqiyatli bajarildi va FlowDesk-ga saqlandi, Sohibjon!";
        return {
          text: replyText,
          pdfUrl: lastPdfUrl,
          actionTaken: functionCalls.map((c) => c.name).join(", "),
        };
      }

      if (chatResponse.text) {
        return { text: chatResponse.text };
      }
    } catch (err) {
      console.error("Gemini Agent runtime error:", err);
    }
  }

  // ─── 4. Fallback (Qoidalar asosida) ───

  // A. YouTube link aniqlansa
  const ytMatch = clean.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s]+/i);
  if (ytMatch) {
    const url = ytMatch[0];
    const defaultTitle = clean.replace(url, "").trim() || "Foydali YouTube Podkasti";
    const summary =
      `# ${defaultTitle}\n\n` +
      `📌 Manba havolasi: ${url}\n\n` +
      `💡 Asosiy g'oyalar:\n` +
      `- Ushbu video FlowDesk orqali shaxsiy rivojlanish va kitoblar xulosasi bazasiga kiritildi.\n` +
      `- Doimiy intizom va yangi bilimlar o'zlashtirish uchun tavsiya etiladi.\n\n` +
      `🚀 Amaliy tavsiya:\n` +
      `- Asosiy tushunchalarni FlowDesk taqvimi bo'yicha amalda sinab ko'ring.`;

    const res = await saveYouTubeAndBook({
      youtubeUrl: url,
      title: defaultTitle,
      summaryBookText: summary,
    });

    return {
      text:
        `📹 <b>Video va PDF xulosa muvaffaqiyatli saqlandi, Sohibjon!</b>\n\n` +
        `📌 <b>Nomi:</b> ${defaultTitle}\n` +
        `📂 <b>Videolar:</b> Rivojlanish bo'limiga kiritildi\n` +
        `📚 <b>Kitoblar:</b> Yangi PDF kitobcha shakllantirildi\n` +
        (res.pdfUrl ? `🔗 <b>PDF havolasi:</b> ${res.pdfUrl}\n` : "") +
        `\nFlowDesk platformangizda bemalol o'qishingiz mumkin! 🚀`,
      pdfUrl: res.pdfUrl,
      actionTaken: "saveYouTubeAndBook",
    };
  }

  // B. Xarajat qo'shish
  const expMatch = clean.match(/(?:xarajat|chiqim|sarfladim|to'?ladim)\s*[:\-]?\s*(\d+(?:[\s.,]\d+)*)\s*(?:so'?m)?\s*(.*)/i);
  if (expMatch) {
    const amount = Number(expMatch[1].replace(/[\s.,]/g, ""));
    const title = expMatch[2]?.trim() || "Xarajat";
    const res = await addExpense({ amount, title });
    return {
      text: `💸 <b>${Number(amount).toLocaleString("uz-UZ")} so'm</b> xarajat qayd etildi (${title})!`,
      actionTaken: "addExpense",
    };
  }

  // C. Daromad qo'shish
  const incMatch = clean.match(/(?:daromad|kirim|tushdi|oldim)\s*[:\-]?\s*(\d+(?:[\s.,]\d+)*)\s*(?:so'?m)?\s*(.*)/i);
  if (incMatch) {
    const amount = Number(incMatch[1].replace(/[\s.,]/g, ""));
    const title = incMatch[2]?.trim() || "Daromad";
    const res = await addIncome({ amount, title });
    return {
      text: `💰 <b>${Number(amount).toLocaleString("uz-UZ")} so'm</b> daromad hisobga olindi (${title})! 🎉`,
      actionTaken: "addIncome",
    };
  }

  // D. Balans so'ralsa
  if (/balans|hisobim|qancha pul|moliya/i.test(clean)) {
    const fin = await getFinanceSummary();
    let text = `💳 <b>Moliyaviy hisobot:</b>\n\n`;
    text += `💰 <b>Jami mablag':</b> ${fin.totalBalance.toLocaleString("uz-UZ")} so'm\n\n`;
    fin.cards.forEach((c) => {
      text += `🔹 ${c.name} (${c.bank || "Karta"}): ${c.balance.toLocaleString("uz-UZ")} so'm\n`;
    });
    return { text, actionTaken: "getFinanceSummary" };
  }

  // E. Vazifani tugatish
  if (/bitirdim|bajarildi|tugatdim|yopib qo'?y|bajardim/i.test(clean)) {
    const taskName = clean.replace(/bitirdim|bajarildi|tugatdim|yopib qo'?y|bajardim|vazifani/gi, "").trim();
    const res = await completeTask({ title: taskName || undefined });
    return {
      text: res.message || "Ajoyib, Sohibjon! Vazifa bajarildi deb belgilandi! 🎉",
      actionTaken: "completeTask",
    };
  }

  // F. Vaqtni surish
  if (/yana.*vaqt kerak|surib qo'?y|kechroq|keyinga sur/i.test(clean)) {
    const res = await rescheduleTask({ title: clean, newTimeOrDate: "ertaga" });
    return {
      text: res.message || "Tushundim Sohibjon, vazifangiz vaqti surildi! ⏱️",
      actionTaken: "rescheduleTask",
    };
  }

  // G. Taqvim / Rejalar
  if (/reja|taqvim|jadval|bugun nima|ertaga nima/i.test(clean)) {
    const isTomorrow = /ertaga/i.test(clean);
    const tmDate = new Date(d);
    if (isTomorrow) tmDate.setDate(tmDate.getDate() + 1);
    const qDate = `${tmDate.getFullYear()}-${String(tmDate.getMonth() + 1).padStart(2, "0")}-${String(tmDate.getDate()).padStart(2, "0")}`;

    const sched = await getCalendarSchedule({ date: qDate });
    let text = `📅 <b>${isTomorrow ? "Ertangi" : "Bugungi"} rejalaringiz (${sched.date}):</b>\n\n`;

    if (sched.routines.length > 0) {
      text += `⏰ <b>Intizom & Tartib:</b>\n`;
      sched.routines.forEach((r) => {
        text += `${r.done ? "✅" : "⚪"} ${r.time} — ${r.title}\n`;
      });
      text += `\n`;
    }

    if (sched.tasks.length > 0) {
      text += `📋 <b>Vazifalar:</b>\n`;
      sched.tasks.forEach((t) => {
        text += `${t.completed ? "✅" : "⬜"} ${t.title}\n`;
      });
    } else {
      text += `Hozircha qo'shimcha vazifalar kiritilmagan.`;
    }

    return { text, actionTaken: "getCalendarSchedule" };
  }

  // H. Yangi vazifa qo'shish
  if (/vazifa|qo'?sh|yozib qo'?y|kirit/i.test(clean) && !/rasm|hisob|mijoz/i.test(clean)) {
    const title = clean.replace(/vazifa|qo'?sh|yozib qo'?y|kirit|bugun|ertaga/gi, "").trim() || "Yangi vazifa";
    const res = await createTask({ title, date: todayISO });
    return {
      text: `✅ <b>Vazifa taqvimga kiritildi, Sohibjon!</b>\n\n📋 <b>Ish:</b> ${title}\n📅 <b>Sana:</b> ${todayISO}`,
      actionTaken: "createTask",
    };
  }

  return {
    text: `Tushundim Sohibjon! 😊 Men FlowDesk-ga to'liq ulanganman. Rejalar tuzish, vazifalarni belgilash, xarajat yoki daromad kiritish, balansni tekshirish, yangi buyurtma yoki kontent rejalarini saqlash, YouTube videolarni PDF kitob qilish — barchasini bajarishim mumkin! 🚀`,
  };
}
