import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  orders,
  tasks,
  incomes,
  expenses,
  goals,
  books,
  videos,
  botReminders,
  routines,
  sleepLogs,
  dailyResults,
  settings,
} from "@/db/schema";
import { desc, eq, gte, and, asc, isNull, sql, desc as descOrd } from "drizzle-orm";
import { confirmOrder, todayDateISO } from "@/lib/orderActions";
import { parseMoneyInput } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ALLOWED = (process.env.TELEGRAM_ADMIN_CHAT_ID || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/* ── Helpers ── */

async function sendMessage(chatId: number, text: string, extra?: Record<string, unknown>) {
  if (!TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...extra,
      }),
    });
  } catch (e) {
    console.error("sendMessage:", e);
  }
}

/**
 * Asosiy menyu — Reply Keyboard (tugmalar).
 * Telegramda klaviatura pastda doim ko'rinib turadi.
 */
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "📋 Rejalar" }, { text: "📅 Bugungi vazifalar" }],
    [{ text: "➕ Buyurtma" }, { text: "💸 Chiqim" }, { text: "💰 Kirim" }],
    [{ text: "📊 Statistika" }, { text: "📚 Kitob qo'shish" }],
    [{ text: "🎬 Video qo'shish" }, { text: "🎯 Maqsad" }],
    [
      { text: "☀️ Uyg'onish vaqti" },
      { text: "🌙 Uxlash vaqti" },
    ],
    [{ text: "🔔 Botni yoqish" }, { text: "🔕 Botni o'chirish" }],
    [{ text: "🏠 Menyu" }, { text: "❓ Yordam" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

/**
 * Telefon raqam kiritishni so'rash uchun maxsus klaviatura (keyingi safar ishlatiladi).
 */
const REQUEST_CANCEL_KEYBOARD = {
  keyboard: [[{ text: "❌ Bekor" }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

/**
 * Reply keyboardni yashirish (bir martalik suhbatlardan keyin).
 */
const REMOVE_KEYBOARD = { remove_keyboard: true, selective: false };

/**
 * Tugma bosilganda /command ko'rinishiga o'girish.
 * Reply keyboard bosilganda Telegram text yuboradi, shuning uchun
 * label -> command mapping kerak.
 */
const BUTTON_TO_CMD: Record<string, string> = {
  "📋 Rejalar": "/rejalarni",
  "📅 Bugungi vazifalar": "/bugun",
  "➕ Buyurtma": "/buyurtma_qilish",
  "💸 Chiqim": "/chiqim_qilish",
  "💰 Kirim": "/kirim_qilish",
  "📊 Statistika": "/stat",
  "📚 Kitob qo'shish": "/kitob_qilish",
  "🎬 Video qo'shish": "/video_qilish",
  "🎯 Maqsad": "/maqsad_qilish",
  "☀️ Uyg'onish vaqti": "/uyg_onish",
  "🌙 Uxlash vaqti": "/uxlash",
  "🔔 Botni yoqish": "/bot_yoq",
  "🔕 Botni o'chirish": "/bot_och",
  "❓ Yordam": "/yordam",
  "🏠 Menyu": "/menu",
  "❌ Bekor": "/bekor",
};

/**
 * Foydalanuvchi qaysi "kiritish rejimi"da ekanini vaqtinchalik saqlash.
 * Process darajasida Map — Vercel'da single instance bo'lsa ishlaydi.
 * Multi-instance bo'lsa botReminders yoki settings ga saqlash kerak,
 * lekin soddalik uchun Map yetarli.
 */
const userState = new Map<
  number,
  { mode: string; step: number; data: Record<string, string | null> }
>();

async function answerCallback(chatId: number, callbackId: string, text: string) {
  if (!TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text,
        show_alert: false,
      }),
    });
    await sendMessage(chatId, text, { reply_markup: MAIN_KEYBOARD });
  } catch (e) {
    console.error("answerCallback:", e);
  }
}

function fmt(n: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so'm";
}

function parseAmount(raw: string): number {
  return parseMoneyInput(raw);
}

function parseDate(raw: string | undefined): string {
  const t = (raw || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : todayDateISO();
}

function splitParts(args: string): string[] {
  return args
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
  return [error.message, cause ? errorText(cause) : ""].filter(Boolean).join("\n");
}

function setupErrorMessage(error: unknown): string {
  const message = errorText(error);
  if (message.includes("DATABASE_URL is required")) {
    return "❌ DATABASE_URL sozlanmagan. Vercel Environment Variables ichiga DATABASE_URL qo'ying va redeploy qiling.";
  }
  if (message.includes("relation") && message.includes("does not exist")) {
    return "❌ Database jadvallari yaratilmagan. Lokal terminalda DATABASE_URL bilan `npm run db:push` ishlating.";
  }
  if (
    message.includes("password authentication failed") ||
    message.includes("Tenant or user not found") ||
    message.includes("ENOTFOUND") ||
    message.includes("ECONNREFUSED")
  ) {
    if (message.includes("ENOTFOUND base")) {
      return "❌ DATABASE_URL noto'g'ri: host `base` bo'lib qolgan. Vercel Environment Variables ichiga Neon/Supabase/Vercel Postgres bergan to'liq postgresql URLni qo'ying va redeploy qiling.";
    }
    return "❌ Database ulanishida xatolik. Vercel'dagi DATABASE_URL qiymatini tekshiring va redeploy qiling.";
  }
  return "❌ Xatolik yuz berdi. Vercel Logs ichida `Bot command error` sababini tekshiring.";
}

function parseYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/
  );
  return m ? m[1] : null;
}

const EXPENSE_CAT: Record<string, string> = {
  ijara: "rent",
  reklama: "ads",
  obuna: "subscriptions",
  shaxsiy: "personal",
  boshqa: "other",
};

const TASK_CAT: Record<string, string> = {
  shoshilinch: "urgent",
  shaxsiy: "personal",
  moliyaviy: "financial",
};

const VIDEO_CAT: Record<string, string> = {
  biznes: "business",
  dasturlash: "coding",
  psixologiya: "psychology",
  moliya: "finance",
  boshqa: "other",
};

const HELP = [
  "<b>FlowDesk bot — buyruqlar:</b>",
  "",
  "<b>Boshqaruv:</b>",
  "/buyurtma Nomi, summa, deadline, mijoz",
  "/chiqim Nomi, summa, kategoriya",
  "/kirim Nomi, summa, naqd/karta",
  "/tolov ID — tasdiqlash",
  "/buyurtmalar — ro'yxat",
  "",
  "<b>Intizom:</b>",
  "/vazifa Matn, sana, kategoriya",
  "/rejalarni — bugungi rejalarni ko'rish",
  "/stat — oylik statistika",
  "",
  "<b>Rivojlanish:</b>",
  "/kitob Nomi, muallif, sahifalar",
  "/video YouTube_havola, nomi, kategoriya",
  "/maqsad Nomi, summa, auto foiz",
  "/bot_yoq — ogohlantirishni yoqish",
  "/bot_och — ogohlantirishni o'chirish",
  "",
  "Kategoriyalar: ijara, reklama, obuna, shaxsiy, biznes, dasturlash, psixologiya",
].join("\n");

/* ── Wizard (kiritish rejimi) handlerlari ── */

async function handleWizardStep(chatId: number, text: string) {
  const state = userState.get(chatId);
  if (!state) return;
  const today = todayDateISO();

  // ── Buyurtma wizard ──
  if (state.mode === "order") {
    if (state.step === 1) {
      state.data.title = text.trim();
      state.step = 2;
      userState.set(chatId, state);
      await sendMessage(chatId, "2️⃣ Summani kiriting (so'mda):");
      return;
    }
    if (state.step === 2) {
      const amount = parseAmount(text);
      if (!amount || amount <= 0) {
        await sendMessage(chatId, "⚠️ Noto'g'ri summa. Qaytadan kiriting:");
        return;
      }
      state.data.amount = String(amount);
      state.step = 3;
      userState.set(chatId, state);
      await sendMessage(
        chatId,
        "3️⃣ Muddatni kiriting (YYYY-MM-DD) yoki \"-\" yozing:",
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
      return;
    }
    if (state.step === 3) {
      const dl = text.trim();
      state.data.deadline = dl === "-" || !dl ? null : dl;
      state.step = 4;
      userState.set(chatId, state);
      await sendMessage(chatId, "4️⃣ Mijoz ismini kiriting yoki \"-\" yozing:");
      return;
    }
    if (state.step === 4) {
      const client = text.trim();
      state.data.client = client === "-" || !client ? null : client;
      userState.delete(chatId);
      await db.insert(orders).values({
        title: state.data.title ?? "",
        amount: state.data.amount ?? "0",
        deadline: state.data.deadline,
        clientName: state.data.client,
        stage: "new",
        paymentType: "cash",
        archived: false,
      });
      await sendMessage(
        chatId,
        `<b>✅ Buyurtma qo'shildi:</b>\n${state.data.title}\n💰 ${fmt(
          Number(state.data.amount)
        )}${state.data.deadline ? `\n📅 ${state.data.deadline}` : ""}${
          state.data.client ? `\n👤 ${state.data.client}` : ""
        }`,
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }
  }

  // ── Chiqim wizard ──
  if (state.mode === "expense") {
    if (state.step === 1) {
      state.data.title = text.trim();
      state.step = 2;
      userState.set(chatId, state);
      await sendMessage(chatId, "2️⃣ Summani kiriting (so'mda):");
      return;
    }
    if (state.step === 2) {
      const amount = parseAmount(text);
      if (!amount || amount <= 0) {
        await sendMessage(chatId, "⚠️ Noto'g'ri summa. Qaytadan kiriting:");
        return;
      }
      state.data.amount = String(amount);
      state.step = 3;
      userState.set(chatId, state);
      await sendMessage(
        chatId,
        "3️⃣ Kategoriya tanlang yoki yozing:\n\nijara / reklama / obuna / shaxsiy / boshqa",
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
      return;
    }
    if (state.step === 3) {
      const cat = EXPENSE_CAT[text.trim().toLowerCase()] || "other";
      userState.delete(chatId);
      await db.insert(expenses).values({
        title: state.data.title ?? "",
        amount: state.data.amount ?? "0",
        category: cat,
        date: today,
      });
      await sendMessage(
        chatId,
        `<b>📉 Chiqim qo'shildi:</b>\n${state.data.title}\n💸 ${fmt(
          Number(state.data.amount)
        )}`,
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }
  }

  // ── Kirim wizard ──
  if (state.mode === "income") {
    if (state.step === 1) {
      state.data.title = text.trim();
      state.step = 2;
      userState.set(chatId, state);
      await sendMessage(chatId, "2️⃣ Summani kiriting (so'mda):");
      return;
    }
    if (state.step === 2) {
      const amount = parseAmount(text);
      if (!amount || amount <= 0) {
        await sendMessage(chatId, "⚠️ Noto'g'ri summa. Qaytadan kiriting:");
        return;
      }
      state.data.amount = String(amount);
      state.step = 3;
      userState.set(chatId, state);
      await sendMessage(
        chatId,
        "3️⃣ To'lov turi: naqd yoki karta yozing:",
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
      return;
    }
    if (state.step === 3) {
      const t = text.toLowerCase();
      const pay = t.includes("karta") || t.includes("card") ? "card" : "cash";
      userState.delete(chatId);
      await db.insert(incomes).values({
        title: state.data.title ?? "",
        amount: state.data.amount ?? "0",
        source: "other",
        date: today,
        paymentType: pay,
      });
      await sendMessage(
        chatId,
        `<b>📈 Kirim qo'shildi:</b>\n${state.data.title}\n💰 ${fmt(
          Number(state.data.amount)
        )}\n💳 ${pay === "card" ? "Plastik" : "Naqd"}`,
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }
  }

  // ── Kitob wizard ──
  if (state.mode === "book") {
    if (state.step === 1) {
      state.data.title = text.trim();
      state.step = 2;
      userState.set(chatId, state);
      await sendMessage(chatId, "2️⃣ Muallif ismini yozing (yoki \"-\"):");
      return;
    }
    if (state.step === 2) {
      state.data.author = text.trim() === "-" ? null : text.trim();
      state.step = 3;
      userState.set(chatId, state);
      await sendMessage(chatId, "3️⃣ Sahifalar sonini yozing (yoki \"-\"):");
      return;
    }
    if (state.step === 3) {
      const total = text.trim() === "-" ? 0 : parseAmount(text);
      state.data.totalPages = String(Math.max(0, total));
      state.step = 4;
      userState.set(chatId, state);
      await sendMessage(
        chatId,
        "4️⃣ PDF variant havolasini yuboring (yoki \"-\"):",
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
      return;
    }
    if (state.step === 4) {
      const pdf = text.trim();
      state.data.pdfUrl = pdf === "-" || !pdf ? null : pdf;
      userState.delete(chatId);
      await db.insert(books).values({
        title: state.data.title ?? "",
        author: state.data.author,
        totalPages: Number(state.data.totalPages) || 0,
        currentPage: 0,
        status: "plan",
        pdfUrl: state.data.pdfUrl,
      });
      let msg = `<b>📚 Kitob qo'shildi:</b>\n${state.data.title}`;
      if (state.data.author) msg += ` — ${state.data.author}`;
      if (state.data.totalPages && Number(state.data.totalPages) > 0)
        msg += `\n📄 ${state.data.totalPages} sahifa`;
      if (state.data.pdfUrl) msg += `\n📎 PDF saqlandi`;
      await sendMessage(chatId, msg, { reply_markup: MAIN_KEYBOARD });
      return;
    }
  }

  // ── Video wizard ──
  if (state.mode === "video") {
    if (state.step === 1) {
      const videoId = parseYouTubeId(text);
      if (!videoId) {
        await sendMessage(
          chatId,
          "⚠️ YouTube havolasi noto'g'ri. Qaytadan yuboring:"
        );
        return;
      }
      state.data.url = text.trim();
      state.data.videoId = videoId;
      state.step = 2;
      userState.set(chatId, state);
      await sendMessage(chatId, "2️⃣ Video nomini yozing:");
      return;
    }
    if (state.step === 2) {
      state.data.title = text.trim() || "YouTube video";
      state.step = 3;
      userState.set(chatId, state);
      await sendMessage(
        chatId,
        "3️⃣ Kategoriya tanlang yoki yozing:\n\nbiznes / dasturlash / psixologiya / moliya / boshqa",
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
      return;
    }
    if (state.step === 3) {
      const cat = VIDEO_CAT[text.trim().toLowerCase()] || "other";
      userState.delete(chatId);
      await db.insert(videos).values({
        title: state.data.title ?? "YouTube video",
        url: state.data.url ?? "",
        videoId: state.data.videoId ?? "",
        category: cat,
        watched: false,
      });
      await sendMessage(
        chatId,
        `<b>🎬 Video qo'shildi:</b>\n${state.data.title}\nPaneldagi Videolar bo'limida ko'rasiz.`,
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }
  }

  // ── Maqsad wizard ──
  if (state.mode === "goal") {
    if (state.step === 1) {
      state.data.title = text.trim();
      state.step = 2;
      userState.set(chatId, state);
      await sendMessage(chatId, "2️⃣ Maqsad summasini kiriting (so'mda):");
      return;
    }
    if (state.step === 2) {
      const amount = parseAmount(text);
      if (!amount || amount <= 0) {
        await sendMessage(chatId, "⚠️ Noto'g'ri summa. Qaytadan kiriting:");
        return;
      }
      state.data.amount = String(amount);
      state.step = 3;
      userState.set(chatId, state);
      await sendMessage(
        chatId,
        "3️⃣ Avtomatik foiz (0-100) — har bir kirimdan qancha % maqsadga tushadi:",
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
      return;
    }
    if (state.step === 3) {
      const pct = Math.min(100, Math.max(0, parseAmount(text)));
      userState.delete(chatId);
      await db.insert(goals).values({
        title: state.data.title ?? "",
        targetAmount: state.data.amount ?? "0",
        savedAmount: "0",
        autoPercent: pct,
      });
      let msg = `<b>🎯 Maqsad yaratildi:</b>\n${state.data.title}\n💰 ${fmt(
        Number(state.data.amount)
      )}`;
      if (pct > 0) msg += `\n🔄 Har bir kirimdan: ${pct}%`;
      await sendMessage(chatId, msg, { reply_markup: MAIN_KEYBOARD });
      return;
    }
  }

  // ── Wake reason (uxlab qolish sababi) ──
  if (state.mode === "wake_reason") {
    const reason = text.trim();
    if (!reason) {
      await sendMessage(chatId, "Sabab bo'sh bo'lmasligi kerak. Yozing:");
      return;
    }
    userState.delete(chatId);
    const settingsData = await fetch("/api/settings").then((r) => r.json());
    const expectedWake = settingsData.wake_time || "04:30";
    const actualWake = new Date().toTimeString().slice(0, 5);
    const today = todayDateISO();
    // Yozuvni yangilash yoki qo'shish
    const [existing] = await db
      .select()
      .from(sleepLogs)
      .where(eq(sleepLogs.date, today))
      .limit(1);
    if (existing) {
      await db
        .update(sleepLogs)
        .set({ reason, actualWake, expectedWake, overslept: true })
        .where(eq(sleepLogs.id, existing.id));
    } else {
      await db.insert(sleepLogs).values({
        date: today,
        reason,
        actualWake,
        expectedWake,
        overslept: true,
      });
    }
    await sendMessage(
      chatId,
      `📝 Sabab saqlandi: "${reason}"\n\n⚠️ Kecha kech yotdingizmi? Ertaga ${
        settingsData.sleep_time || "23:00"
      } da yotishga harakat qiling. Sifatli uxlash = sifatli ish! 💪\n\n📊 Sababingiz analitika sahifasida saqlandi.`,
      { reply_markup: MAIN_KEYBOARD }
    );
    return;
  }

  // ── Ertangi ish qo'shish ──
  if (state.mode === "tomorrow_task") {
    if (state.step === 1) {
      state.data.title = text.trim();
      state.step = 2;
      userState.set(chatId, state);
      await sendMessage(
        chatId,
        "2️⃣ Kategoriya tanlang yoki yozing:\n\nshoshilinch / shaxsiy / moliyaviy",
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
      return;
    }
    if (state.step === 2) {
      const cat = TASK_CAT[text.trim().toLowerCase()] || "personal";
      userState.delete(chatId);
      await db.insert(tasks).values({
        title: state.data.title ?? "",
        date: state.data.targetDate ?? today,
        category: cat,
        completed: false,
      });
      await sendMessage(
        chatId,
        `<b>✅ Ertangi ish qo'shildi:</b>\n${state.data.title}\n📅 ${state.data.targetDate}\n🏷 ${cat}`,
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }
  }

  // ── Ertangi reja qo'shish ──
  if (state.mode === "tomorrow_routine") {
    if (state.step === 1) {
      state.data.title = text.trim();
      state.step = 2;
      userState.set(chatId, state);
      await sendMessage(chatId, "2️⃣ Boshlanish vaqtini kiriting (masalan: 07:00):");
      return;
    }
    if (state.step === 2) {
      const time = text.trim();
      if (!/^\d{1,2}:\d{2}$/.test(time)) {
        await sendMessage(chatId, "⚠️ Vaqt formati noto'g'ri. HH:MM ko'rinishida kiriting:");
        return;
      }
      // Vaqt allaqachon o'tgan bo'lsa, ertangi kunga o'tkazishni tavsiya qilamiz
      const [hh, mm] = time.split(":").map(Number);
      const target = new Date(state.data.targetDate + "T00:00:00");
      target.setHours(hh, mm, 0, 0);
      const now = new Date();
      if (target.getTime() <= now.getTime()) {
        // Bugungi kunga o'tkazamiz
        const todayISO = todayDateISO();
        await sendMessage(
          chatId,
          `⚠️ Bu vaqt (${time}) allaqachon o'tib ketgan. Ertangi kun uchun saqlanadi, lekin agar shu vaqtda bajarmoqchi bo'lsangiz — bugungi kun uchun qo'shamiz.\n\nDavom etamiz.`
        );
      }
      state.data.time = time;
      state.step = 3;
      userState.set(chatId, state);
      await sendMessage(
        chatId,
        "3️⃣ Deadline (ixtiyoriy, masalan: 09:00) yoki \"-\" yozing:",
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
      return;
    }
    if (state.step === 3) {
      const endTime = text.trim();
      state.data.endTime = endTime === "-" || !endTime ? null : endTime;
      userState.delete(chatId);
      await db.insert(routines).values({
        title: state.data.title ?? "",
        time: state.data.time ?? "09:00",
        startTime: state.data.time ?? "09:00",
        endTime: state.data.endTime,
        targetDate: state.data.targetDate,
        lastDoneDate: null,
        streak: 0,
      });
      let msg = `<b>✅ Ertangi reja qo'shildi:</b>\n${state.data.title}\n⏰ ${state.data.time}`;
      if (state.data.endTime) msg += ` → ${state.data.endTime}`;
      msg += `\n📅 ${state.data.targetDate}`;
      await sendMessage(chatId, msg, { reply_markup: MAIN_KEYBOARD });
      return;
    }
  }

  // ── Kunlik natija javobi (sabab yoki video) ──
  if (state.mode === "result_response") {
    const responseText = text.trim();
    if (!responseText) {
      await sendMessage(chatId, "Sabab yoki video yuboring:");
      return;
    }
    userState.delete(chatId);
    const today = todayDateISO();
    // Matnli javob
    const [existing] = await db
      .select()
      .from(dailyResults)
      .where(eq(dailyResults.date, today))
      .limit(1);
    if (existing) {
      await db
        .update(dailyResults)
        .set({ responseText, responseType: "text" })
        .where(eq(dailyResults.id, existing.id));
    } else {
      await db.insert(dailyResults).values({
        date: today,
        responseText,
        responseType: "text",
      });
    }
    await sendMessage(
      chatId,
      `📝 Sababingiz saqlandi: "${responseText}"\n\nErtaga yaxshiroq harakat qiling! 💪`,
      { reply_markup: MAIN_KEYBOARD }
    );
    return;
  }

  // ── Uyg'onish vaqtini o'rnatish ──
  if (state.mode === "set_wake_time") {
    const time = text.trim();
    if (!/^\d{1,2}:\d{2}$/.test(time)) {
      await sendMessage(chatId, "⚠️ Vaqt formati noto'g'ri. HH:MM ko'rinishida kiriting (masalan: 06:30):");
      return;
    }
    userState.delete(chatId);
    await db
      .insert(settings)
      .values({ key: "wake_time", value: time })
      .onConflictDoUpdate({ target: settings.key, set: { value: time } });
    await sendMessage(
      chatId,
      `✅ Uyg'onish vaqti yangilandi: <b>${time}</b>\n\nErtalab shu vaqtda "Turingmi?" xabari keladi.`,
      { reply_markup: MAIN_KEYBOARD }
    );
    return;
  }

  // ── Uxlash vaqtini o'rnatish ──
  if (state.mode === "set_sleep_time") {
    const time = text.trim();
    if (!/^\d{1,2}:\d{2}$/.test(time)) {
      await sendMessage(chatId, "⚠️ Vaqt formati noto'g'ri. HH:MM ko'rinishida kiriting (masalan: 22:00):");
      return;
    }
    userState.delete(chatId);
    await db
      .insert(settings)
      .values({ key: "sleep_time", value: time })
      .onConflictDoUpdate({ target: settings.key, set: { value: time } });
    await sendMessage(
      chatId,
      `✅ Uxlash vaqti yangilandi: <b>${time}</b>\n\nKechqurun shu vaqtda "Kun yakuni" va ertangi reja so'raladi.`,
      { reply_markup: MAIN_KEYBOARD }
    );
    return;
  }
}

/* ── Callback handlers (inline buttons from cron) ── */

async function handleCallback(chatId: number, callbackId: string, data: string) {
  const today = todayDateISO();

  if (data === "woke_yes") {
    const actualWake = new Date().toTimeString().slice(0, 5);
    const settingsData = await fetch("/api/settings").then((r) => r.json());
    const expectedWake = settingsData.wake_time || "04:30";
    const [eh, em] = expectedWake.split(":").map(Number);
    const [ah, am] = actualWake.split(":").map(Number);
    const expMin = (eh || 0) * 60 + (em || 0);
    const actMin = (ah || 0) * 60 + (am || 0);
    const delay = actMin - expMin;
    const overslept = delay > 5;

    // sleepLogs ga yozish
    const [existing] = await db
      .select()
      .from(sleepLogs)
      .where(eq(sleepLogs.date, today))
      .limit(1);
    if (existing) {
      await db
        .update(sleepLogs)
        .set({ actualWake, overslept, expectedWake })
        .where(eq(sleepLogs.id, existing.id));
    } else {
      await db.insert(sleepLogs).values({
        date: today,
        expectedWake,
        actualWake,
        overslept,
      });
    }

    await db
      .update(botReminders)
      .set({ responded: true, responseText: "✅ Turdim" })
      .where(
        and(eq(botReminders.date, today), eq(botReminders.type, "wake_up"))
      );

    const onTimeMsg = overslept
      ? `⚠️ Siz ${delay} daqiqa kechikdingiz. Ertaga yana 10 daqiqa oldinroq uyg'onishga harakat qiling.`
      : "✅ Ajoyib! O'z vaqtida turibsiz. Kun rejalaringiz oldinda. Kuchli boshlang! 💪";

    await answerCallback(chatId, callbackId, onTimeMsg);

    // Bugungi rejalar
    const routinesToday = await db
      .select()
      .from(routines)
      .where(sql`${routines.targetDate} IS NULL OR ${routines.targetDate} = ${today}`)
      .orderBy(asc(routines.time));
    if (routinesToday.length > 0) {
      const lines = routinesToday.map((r) => {
        const done = r.lastDoneDate === today;
        return `${done ? "✅" : "⬜"} <b>${r.time}</b> — ${r.title}`;
      });
      await sendMessage(
        chatId,
        `📋 <b>Bugungi rejalar (${routinesToday.filter((r) => r.lastDoneDate === today).length}/${routinesToday.length}):</b>\n\n${lines.join("\n")}`
      );
    }
    return;
  }

  if (data === "woke_no") {
    await db
      .update(botReminders)
      .set({ responded: true, responseText: "😴 Uxlab qoldim" })
      .where(
        and(eq(botReminders.date, today), eq(botReminders.type, "wake_up"))
      );
    // Wizard rejimiga o'tkazamiz — foydalanuvchi sabab yozadi
    userState.set(chatId, { mode: "wake_reason", step: 1, data: {} });
    await answerCallback(
      chatId,
      callbackId,
      "😴 Nima uchun uxlab qoldingiz? Sababini yozing — sababni bilish = kelgisi safar o'zgartirish!\n\nMasalan: kech yotdim, ertalab kech turdim..."
    );
    return;
  }

  if (data === "sleep_ack") {
    const actualSleep = new Date().toTimeString().slice(0, 5);
    const settingsData = await fetch("/api/settings").then((r) => r.json());
    const expectedSleep = settingsData.sleep_time || "21:40";
    const [eh, em] = expectedSleep.split(":").map(Number);
    const [ah, am] = actualSleep.split(":").map(Number);
    const expMin = (eh || 0) * 60 + (em || 0);
    const actMin = (ah || 0) * 60 + (am || 0);
    // Uxlash vaqti kechqurungi — kech yotish = actMin > expMin
    const wentLateSleep = actMin > expMin + 5;

    const [existing] = await db
      .select()
      .from(sleepLogs)
      .where(eq(sleepLogs.date, today))
      .limit(1);
    if (existing) {
      await db
        .update(sleepLogs)
        .set({ actualSleep, wentLateSleep, expectedSleep })
        .where(eq(sleepLogs.id, existing.id));
    } else {
      await db.insert(sleepLogs).values({
        date: today,
        expectedSleep,
        actualSleep,
        wentLateSleep,
      });
    }

    await db
      .update(botReminders)
      .set({ responded: true, responseText: "👍 OK" })
      .where(
        and(eq(botReminders.date, today), eq(botReminders.type, "sleep"))
      );

    await answerCallback(
      chatId,
      callbackId,
      "🌙 Yaxshi! Telefonni qo'ying, ertaga kuchli kun sizni kutmoqda! Yaxshi dam oling 💤"
    );
    return;
  }

  // ── Ertangi kun uchun ish qo'shish (cron tugmasi) ──
  if (data === "tomorrow_task") {
    const tomorrow = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    })();
    userState.set(chatId, {
      mode: "tomorrow_task",
      step: 1,
      data: { targetDate: tomorrow },
    });
    await sendMessage(
      chatId,
      `📋 <b>Ertangi kun uchun ish qo'shish</b>\n\n📅 ${tomorrow}\n\n1️⃣ Ish matnini yozing:`,
      { reply_markup: REQUEST_CANCEL_KEYBOARD }
    );
    await answerCallback(chatId, callbackId, "📝 Ish matnini yozing");
    return;
  }

  // ── Ertangi kun uchun reja qo'shish ──
  if (data === "tomorrow_routine") {
    const tomorrow = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    })();
    userState.set(chatId, {
      mode: "tomorrow_routine",
      step: 1,
      data: { targetDate: tomorrow },
    });
    await sendMessage(
      chatId,
      `🎯 <b>Ertangi kun uchun reja</b>\n\n📅 ${tomorrow}\n\n1️⃣ Reja nomini yozing (masalan: "Sport bilan shug'ullanish"):`,
      { reply_markup: REQUEST_CANCEL_KEYBOARD }
    );
    await answerCallback(chatId, callbackId, "📝 Reja nomini yozing");
    return;
  }

  // ── Kunlik natija: ishlarni bajardingizmi ──
  if (data === "result_done_yes" || data === "result_done_no") {
    const tasksDone = data === "result_done_yes";
    // Yozuvni yangilash
    const [existing] = await db
      .select()
      .from(dailyResults)
      .where(eq(dailyResults.date, today))
      .limit(1);
    if (existing) {
      await db
        .update(dailyResults)
        .set({ tasksDone })
        .where(eq(dailyResults.id, existing.id));
    } else {
      await db.insert(dailyResults).values({ date: today, tasksDone });
    }
    await answerCallback(
      chatId,
      callbackId,
      tasksDone
        ? "✅ Ajoyib! Ishlar bajarilgan deb belgilandi"
        : "❌ Ishlar bajarilmagan deb belgilandi. Ertaga urinib ko'ring!"
    );
    // Agar "yo'q" bo'lsa — video yoki matn yuboring
    if (!tasksDone) {
      userState.set(chatId, {
        mode: "result_response",
        step: 1,
        data: { question: "tasksDone" },
      });
      await sendMessage(
        chatId,
        "📝 Nima uchun bajara olmadingiz? Sababini yozing yoki qisqa video yuboring (maks 1 minut):",
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
    }
    return;
  }

  // ── Kunlik natija: hisob yozdingizmi ──
  if (data === "result_finance_yes" || data === "result_finance_no") {
    const financeRecorded = data === "result_finance_yes";
    const [existing] = await db
      .select()
      .from(dailyResults)
      .where(eq(dailyResults.date, today))
      .limit(1);
    if (existing) {
      await db
        .update(dailyResults)
        .set({ financeRecorded })
        .where(eq(dailyResults.id, existing.id));
    } else {
      await db.insert(dailyResults).values({ date: today, financeRecorded });
    }
    await answerCallback(
      chatId,
      callbackId,
      financeRecorded
        ? "✅ Hisob yozilgan. Zo'r!"
        : "❌ Hisob yozilmagan. Bugungi natijalarni kiriting."
    );
    if (!financeRecorded) {
      userState.set(chatId, {
        mode: "result_response",
        step: 1,
        data: { question: "financeRecorded" },
      });
      await sendMessage(
        chatId,
        "📝 Nima uchun yozmadingiz? Yoki kiriting:\n• 💸 /chiqim — chiqim qo'shish\n• 💰 /kirim — kirim qo'shish\n\nYoki sabab yozing / video yuboring:",
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
    } else {
      // Hisob yozilgan bo'lsa, kun yakunlandi
      const allYes = await checkAllDone(chatId, today);
      if (allYes) {
        await sendMessage(
          chatId,
          "🌟 <b>Kun yakunlandi!</b>\n\nBarcha natijalar qayd etildi. Yaxshi dam oling! Ertaga kuchliroq davom etamiz 💪",
          { reply_markup: MAIN_KEYBOARD }
        );
      }
    }
    return;
  }

  if (data.startsWith("routine_yes_")) {
    const rid = Number(data.split("_").pop());
    await db
      .update(routines)
        .set({
        lastDoneDate: today,
        streak: sql`GREATEST(${routines.streak} + 1, 1)`,
      })
      .where(eq(routines.id, rid));
    await db
      .update(botReminders)
      .set({ responded: true, responseText: "✅ Bajarildi" })
      .where(
        and(eq(botReminders.date, today), eq(botReminders.routineId, rid))
      );
    const [r] = await db
      .select()
      .from(routines)
      .where(eq(routines.id, rid))
      .limit(1);
    const streak = r?.streak ?? 0;
    const streakMsg = streak >= 7 ? "🔥🔥🔥" : streak >= 3 ? "🔥" : "💪";
    await answerCallback(
      chatId,
      callbackId,
      `${streakMsg} <b>${r?.title} bajarildi!</b>\nStreak: ${streak} kun`
    );
    return;
  }

  if (data.startsWith("routine_no_")) {
    const rid = Number(data.split("_").pop());
    await db
      .update(botReminders)
      .set({ responded: true, responseText: "⏭ O'tkazildi" })
      .where(
        and(eq(botReminders.date, today), eq(botReminders.routineId, rid))
      );
    await answerCallback(
      chatId,
      callbackId,
      "⏭ Hech qanday muammo yo'q — lekin ehtiyot bo'ling! Ketma-ket o'tkazish odatga aylanishi mumkin. Yana urinib ko'ring 🔄"
    );
    return;
  }
}

async function checkAllDone(chatId: number, today: string): Promise<boolean> {
  const [r] = await db
    .select()
    .from(dailyResults)
    .where(eq(dailyResults.date, today))
    .limit(1);
  return !!(r && r.tasksDone && r.financeRecorded);
}

/* ── Text command handlers ── */

async function handleCommand(chatId: number, text: string) {
  const [cmdRaw, ...rest] = text.split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase();
  const args = rest.join(" ");

  // ── Tugma bosilganda: label -> command ga o'girish ──
  if (BUTTON_TO_CMD[text]) {
    await handleCommand(chatId, BUTTON_TO_CMD[text]);
    return;
  }

  try {
    if (cmd === "/start" || cmd === "/yordam" || cmd === "/help") {
      await sendMessage(
        chatId,
        HELP + "\n\n👇 Quyidagi tugmalar orqali tez foydalaning:",
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }

    // ── Asosiy menyuni ko'rsatish ──
    if (cmd === "/menu") {
      userState.delete(chatId);
      await sendMessage(chatId, "🏠 <b>Asosiy menyu</b>", {
        reply_markup: MAIN_KEYBOARD,
      });
      return;
    }

    // ── Uyg'onish vaqtini sozlash (bot orqali) ──
    if (cmd === "/uyg_onish") {
      userState.set(chatId, { mode: "set_wake_time", step: 1, data: {} });
      const cur = (await fetch("/api/settings").then((r) => r.json())).wake_time || "04:30";
      await sendMessage(
        chatId,
        `☀️ <b>Uyg'onish vaqtini o'zgartirish</b>\n\nHozirgi vaqt: <b>${cur}</b>\n\nYangi vaqtni HH:MM formatida yozing:`,
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
      return;
    }

    // ── Uxlash vaqtini sozlash ──
    if (cmd === "/uxlash") {
      userState.set(chatId, { mode: "set_sleep_time", step: 1, data: {} });
      const cur = (await fetch("/api/settings").then((r) => r.json())).sleep_time || "21:40";
      await sendMessage(
        chatId,
        `🌙 <b>Uxlash vaqtini o'zgartirish</b>\n\nHozirgi vaqt: <b>${cur}</b>\n\nYangi vaqtni HH:MM formatida yozing:`,
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
      return;
    }

    // ── Bekor qilish (kiritish rejimidan chiqish) ──
    if (cmd === "/bekor") {
      userState.delete(chatId);
      await sendMessage(chatId, "❌ Bekor qilindi.", { reply_markup: MAIN_KEYBOARD });
      return;
    }

    // ── Kiritish rejimlari: tugmalar bosilganda boshlaydi ──
    if (cmd === "/buyurtma_qilish") {
      userState.set(chatId, { mode: "order", step: 1, data: {} });
      await sendMessage(
        chatId,
        "🆕 <b>Yangi buyurtma qo'shish</b>\n\n1️⃣ Buyurtma nomini yozing:",
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
      return;
    }

    if (cmd === "/chiqim_qilish") {
      userState.set(chatId, { mode: "expense", step: 1, data: {} });
      await sendMessage(
        chatId,
        "💸 <b>Chiqim qo'shish</b>\n\n1️⃣ Chiqim nomini yozing:",
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
      return;
    }

    if (cmd === "/kirim_qilish") {
      userState.set(chatId, { mode: "income", step: 1, data: {} });
      await sendMessage(
        chatId,
        "💰 <b>Kirim qo'shish</b>\n\n1️⃣ Kirim nomini yozing:",
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
      return;
    }

    if (cmd === "/kitob_qilish") {
      userState.set(chatId, { mode: "book", step: 1, data: {} });
      await sendMessage(
        chatId,
        "📚 <b>Kitob qo'shish</b>\n\n1️⃣ Kitob nomini yozing:",
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
      return;
    }

    if (cmd === "/video_qilish") {
      userState.set(chatId, { mode: "video", step: 1, data: {} });
      await sendMessage(
        chatId,
        "🎬 <b>Video qo'shish</b>\n\n1️⃣ YouTube havolasini yuboring:",
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
      return;
    }

    if (cmd === "/maqsad_qilish") {
      userState.set(chatId, { mode: "goal", step: 1, data: {} });
      await sendMessage(
        chatId,
        "🎯 <b>Maqsad yaratish</b>\n\n1️⃣ Maqsad nomini yozing:",
        { reply_markup: REQUEST_CANCEL_KEYBOARD }
      );
      return;
    }

    // ── Kiritish rejimi davom ettirilayotgan bo'lsa ──
    if (userState.has(chatId) && !cmd.startsWith("/")) {
      // Avval wake reminder javobini tekshiramiz
      const todayCheck = todayDateISO();
      const wakeReminderCheck = await db
        .select()
        .from(botReminders)
        .where(
          and(
            eq(botReminders.date, todayCheck),
            eq(botReminders.type, "wake_up"),
            eq(botReminders.responded, false)
          )
        )
        .limit(1);

      if (wakeReminderCheck.length === 0) {
        // Wake reminder yo'q bo'lsa, wizard step ni davom ettiramiz
        await handleWizardStep(chatId, text);
        return;
      }
      // Aks holda pastdagi wake handler ishlaydi
    }

    // ── Bot toggle ──
    if (cmd === "/bot_yoq") {
      await db
        .insert(settings)
        .values({ key: "bot_enabled", value: "true" })
        .onConflictDoUpdate({ target: settings.key, set: { value: "true" } });
      await sendMessage(
        chatId,
        "✅ <b>Bot yoqildi!</b>\n\nErtalab uyg'onish vaqtida xabar keladi. Har bir reja vaqtida eslatma yuboriladi. Kechqurun kunlik hisobot olasaniz.",
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }
    if (cmd === "/bot_och") {
      await db
        .insert(settings)
        .values({ key: "bot_enabled", value: "false" })
        .onConflictDoUpdate({ target: settings.key, set: { value: "false" } });
      await sendMessage(chatId, "🔇 Bot o'chirildi. Es-latmalar to'xtatildi.", {
        reply_markup: MAIN_KEYBOARD,
      });
      return;
    }

    // ── Check if responding to "uxlab qoldim" legacy handler olib tashlandi,
    //    wake_reason wizard orqali ishlaydi ──

    if (cmd === "/rejalarni") {
      const today = todayDateISO();
      const allRoutines = await db
        .select()
        .from(routines)
        .where(
          sql`${routines.targetDate} IS NULL OR ${routines.targetDate} = ${today}`
        )
        .orderBy(asc(routines.time));
      if (allRoutines.length === 0) {
        await sendMessage(chatId, "📋 Bugungi reja yo'q. Intizom bo'limidan qo'shing.", { reply_markup: MAIN_KEYBOARD });
        return;
      }
      const lines = allRoutines.map((r) => {
        const done = r.lastDoneDate === today;
        return `${done ? "✅" : "⬜"} <b>${r.time}</b> — ${r.title}${
          Number(r.streak) > 1 ? ` 🔥${r.streak}` : ""
        }`;
      });
      const done = allRoutines.filter((r) => r.lastDoneDate === today).length;
      const wake =
        (await fetch("/api/settings").then((r) => r.json())).wake_time ||
        "06:30";
      const sleep =
        (await fetch("/api/settings").then((r) => r.json())).sleep_time ||
        "23:00";
      await sendMessage(
        chatId,
        `<b>📋 Bugungi rejalar (${done}/${allRoutines.length}):</b>\n\n⏰ Turish: ${wake} | 💤 Uxlash: ${sleep}\n\n${lines.join(
          "\n"
        )}`,
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }

    if (cmd === "/buyurtma") {
      const p = splitParts(args);
      if (p.length < 1) {
        await sendMessage(
          chatId,
          "Format: /buyurtma Nomi, summa, deadline(YYYY-MM-DD), mijoz",
          { reply_markup: MAIN_KEYBOARD }
        );
        return;
      }
      const amount = p[1] ? String(parseAmount(p[1])) : "0";
      const deadline = p[2] && /^\d{4}-\d{2}-\d{2}$/.test(p[2]) ? p[2] : null;
      await db.insert(orders).values({
        title: p[0],
        amount,
        deadline,
        clientName: p[3] || null,
        stage: "new",
        paymentType: "cash",
        archived: false,
      });
      await sendMessage(
        chatId,
        `<b>✅ Buyurtma qo'shildi:</b>\n${p[0]}\n💰 ${fmt(Number(amount))}${
          deadline ? `\n📅 ${deadline}` : ""
        }${p[3] ? `\n👤 ${p[3]}` : ""}`,
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }

    if (cmd === "/chiqim") {
      const p = splitParts(args);
      if (p.length < 2) {
        await sendMessage(chatId, "Format: /chiqim Nomi, summa, kategoriya", {
          reply_markup: MAIN_KEYBOARD,
        });
        return;
      }
      const cat = EXPENSE_CAT[(p[2] || "").toLowerCase()] || "other";
      const amount = String(parseAmount(p[1]));
      await db
        .insert(expenses)
        .values({ title: p[0], amount, category: cat, date: todayDateISO() });
      await sendMessage(
        chatId,
        `<b>📉 Chiqim qo'shildi:</b>\n${p[0]}\n💸 ${fmt(Number(amount))}`,
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }

    if (cmd === "/kirim") {
      const p = splitParts(args);
      if (p.length < 2) {
        await sendMessage(
          chatId,
          "Format: /kirim Nomi, summa, naqd yoki karta",
          { reply_markup: MAIN_KEYBOARD }
        );
        return;
      }
      const amount = String(parseAmount(p[1]));
      const pay =
        (p[2] || "").toLowerCase().includes("karta") ||
        (p[2] || "").toLowerCase().includes("card")
          ? "card"
          : "cash";
      await db.insert(incomes).values({
        title: p[0],
        amount,
        source: "other",
        date: todayDateISO(),
        paymentType: pay,
      });
      await sendMessage(
        chatId,
        `<b>📈 Kirim qo'shildi:</b>\n${p[0]}\n💰 ${fmt(Number(amount))}\n💳 ${
          pay === "card" ? "Plastik" : "Naqd"
        }`,
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }

    if (cmd === "/vazifa") {
      const p = splitParts(args);
      if (p.length < 1) {
        await sendMessage(
          chatId,
          "Format: /vazifa Matn, sana(YYYY-MM-DD), kategoriya",
          { reply_markup: MAIN_KEYBOARD }
        );
        return;
      }
      const date = parseDate(p[1]);
      const category = TASK_CAT[(p[2] || "").toLowerCase()] || "personal";
      await db
        .insert(tasks)
        .values({ title: p[0], date, category, completed: false });
      await sendMessage(
        chatId,
        `<b>📋 Vazifa qo'shildi:</b>\n${p[0]}\n📅 ${date}`,
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }

    if (cmd === "/maqsad") {
      const p = splitParts(args);
      if (p.length < 2) {
        await sendMessage(
          chatId,
          "Format: /maqsad Nomi, summa, avtomatik foiz",
          { reply_markup: MAIN_KEYBOARD }
        );
        return;
      }
      const amount = String(parseAmount(p[1]));
      const pct = p[2] ? Math.min(100, Math.max(0, parseAmount(p[2]))) : 0;
      await db.insert(goals).values({
        title: p[0],
        targetAmount: amount,
        savedAmount: "0",
        autoPercent: pct,
      });
      await sendMessage(
        chatId,
        `<b>🎯 Maqsad yaratildi:</b>\n${p[0]}\n💰 ${fmt(Number(amount))}${
          pct > 0 ? `\n🔄 Har buyurtmadan: ${pct}%` : ""
        }`,
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }

    if (cmd === "/kitob") {
      const p = splitParts(args);
      if (p.length < 1) {
        await sendMessage(chatId, "Format: /kitob Nomi, muallif, sahifalar soni", { reply_markup: MAIN_KEYBOARD });
        return;
      }
      await db.insert(books).values({
        title: p[0],
        author: p[1] || null,
        totalPages: p[2] ? Number(parseAmount(p[2])) : 0,
        currentPage: 0,
        status: "plan",
      });
      await sendMessage(
        chatId,
        `<b>📚 Kitob qo'shildi:</b>\n${p[0]}${p[1] ? ` — ${p[1]}` : ""}${
          p[2] ? `\n${parseAmount(p[2])} sahifa` : ""
        }`,
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }

    if (cmd === "/video") {
      const p = splitParts(args);
      const videoId = parseYouTubeId(p[0] || "");
      if (!videoId) {
        await sendMessage(
          chatId,
          "Format: /video YouTube_havola, nomi, kategoriya",
          { reply_markup: MAIN_KEYBOARD }
        );
        return;
      }
      const category = VIDEO_CAT[(p[2] || "").toLowerCase()] || "other";
      await db.insert(videos).values({
        title: p[1] || "YouTube video",
        url: p[0],
        videoId,
        category,
        watched: false,
      });
      await sendMessage(
        chatId,
        `<b>🎬 Video qo'shildi:</b>\n${p[1] || "YouTube video"}\nPaneldagi Videolar bo'limida ko'rasiz.`,
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }

    if (cmd === "/tolov") {
      const id = parseAmount(args);
      if (!id) {
        await sendMessage(
          chatId,
          "Format: /tolov ID\nMisol: /tolov 12\n(ID ni /buyurtmalar dan ko'ring)",
          { reply_markup: MAIN_KEYBOARD }
        );
        return;
      }
      const result = await confirmOrder(id, "cash");
      if (!result.ok) {
        await sendMessage(chatId, result.message, { reply_markup: MAIN_KEYBOARD });
        return;
      }
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);
      await sendMessage(
        chatId,
        `<b>✅ Buyurtma tasdiqlandi va yopildi:</b>\n${order?.title ?? ""}\n💰 ${fmt(
          Number(order?.amount ?? 0)
        )}\n\nMablag' Kirimlarga yozildi va maqsadlar ulushi avtomatik ajratildi.`,
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }

    if (cmd === "/buyurtmalar") {
      const rows = await db
        .select()
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(15);
      const active = rows.filter((r) => r.stage !== "confirmed" && !r.archived);
      if (active.length === 0) {
        await sendMessage(chatId, "Faol buyurtmalar yo'q.", { reply_markup: MAIN_KEYBOARD });
        return;
      }
      const STAGE_LABEL: Record<string, string> = {
        new: "🆕 Yangi",
        in_progress: "🔄 Jarayonda",
        review: "🔍 Tekshiruvda",
        confirmed: "✅ Tasdiqlandi",
      };
      const lines = active.map(
        (r) =>
          `• <b>#${r.id}</b> ${r.title} — ${fmt(Number(r.amount))} (${
            STAGE_LABEL[r.stage] || r.stage
          })${r.deadline ? ` · 📅 ${r.deadline}` : ""}`
      );
      await sendMessage(
        chatId,
        `<b>Faol buyurtmalar (${active.length}):</b>\n${lines.join(
          "\n"
        )}\n\n💰 Tasdiqlash: /tolov ID`,
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }

    if (cmd === "/bugun") {
      const rows = await db
        .select()
        .from(tasks)
        .where(eq(tasks.date, todayDateISO()))
        .orderBy(descOrd(tasks.createdAt));
      if (rows.length === 0) {
        await sendMessage(chatId, "Bugunga vazifa yo'q.", {
          reply_markup: MAIN_KEYBOARD,
        });
        return;
      }
      const lines = rows.map(
        (t) => `${t.completed ? "✅" : "⬜"} ${t.title}`
      );
      const done = rows.filter((t) => t.completed).length;
      await sendMessage(
        chatId,
        `<b>Bugungi vazifalar (${done}/${rows.length}):</b>\n${lines.join("\n")}`,
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }

    if (cmd === "/stat") {
      const ms = todayDateISO().slice(0, 8) + "01";
      const [incomeRows, expenseRows, goalRows, orderRows] = await Promise.all([
        db.select().from(incomes).where(gte(incomes.date, ms)),
        db.select().from(expenses).where(gte(expenses.date, ms)),
        db.select().from(goals),
        db.select().from(orders),
      ]);
      const totalIn = incomeRows.reduce((s, r) => s + Number(r.amount), 0);
      const totalOut = expenseRows.reduce((s, r) => s + Number(r.amount), 0);
      const savedTotal = goalRows.reduce(
        (s, r) => s + Number(r.savedAmount),
        0
      );
      const active = orderRows.filter(
        (r) => r.stage !== "confirmed" && !r.archived
      ).length;
      await sendMessage(
        chatId,
        [
          `<b>📊 Shu oy statistikasi:</b>`,
          `💰 Kirim: ${fmt(totalIn)}`,
          `💸 Chiqim: ${fmt(totalOut)}`,
          `📈 Sof foyda: <b>${fmt(totalIn - totalOut)}</b>`,
          `🎯 Maqsadlarda: ${fmt(savedTotal)}`,
          `📋 Faol buyurtmalar: ${active} ta`,
        ].join("\n"),
        { reply_markup: MAIN_KEYBOARD }
      );
      return;
    }

    await sendMessage(chatId, "Noma'lum buyruq.\n\n" + HELP, {
      reply_markup: MAIN_KEYBOARD,
    });
  } catch (e) {
    console.error("Bot command error:", e);
    await sendMessage(chatId, setupErrorMessage(e), { reply_markup: MAIN_KEYBOARD });
  }
}

/* ── Webhook ── */

export async function POST(req: Request) {
  const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (
    process.env.BOT_WEBHOOK_SECRET &&
    headerSecret !== process.env.BOT_WEBHOOK_SECRET
  ) {
    return NextResponse.json({ ok: true });
  }

  try {
    const update = await req.json();

    // ── Callback query (inline button press) ──
    const cb = update?.callback_query;
    if (cb) {
      const chatId: number = cb.message?.chat?.id || cb.from?.id;
      if (ALLOWED.length > 0 && !ALLOWED.includes(String(chatId))) {
        await answerCallback(chatId, cb.id, "Ruxsat yo'q.");
        return NextResponse.json({ ok: true });
      }
      await handleCallback(chatId, cb.id, cb.data || "");
      return NextResponse.json({ ok: true });
    }

    const msg = update?.message;
    if (!msg) return NextResponse.json({ ok: true });

    const chatId: number = msg.chat.id;
    if (!TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN not set");
      return NextResponse.json({ ok: true });
    }

    if (ALLOWED.length > 0 && !ALLOWED.includes(String(chatId))) {
      await sendMessage(
        chatId,
        "Ruxsat yo'q. Bu bot faqat administrator uchun."
      );
      return NextResponse.json({ ok: true });
    }

    // ── Video note (dumaloq video) — faqat result_response rejimida ──
    if (msg.video_note) {
      const state = userState.get(chatId);
      if (state?.mode === "result_response") {
        const fileId = msg.video_note.file_id;
        const today = todayDateISO();
        const [existing] = await db
          .select()
          .from(dailyResults)
          .where(eq(dailyResults.date, today))
          .limit(1);
        if (existing) {
          await db
            .update(dailyResults)
            .set({ videoFileId: fileId, responseType: "video" })
            .where(eq(dailyResults.id, existing.id));
        } else {
          await db.insert(dailyResults).values({
            date: today,
            videoFileId: fileId,
            responseType: "video",
          });
        }
        userState.delete(chatId);
        await sendMessage(
          chatId,
          "🎥 Video saqlandi! Analitika sahifasida ko'rishingiz mumkin. Ertaga yaxshiroq harakat qiling! 💪",
          { reply_markup: MAIN_KEYBOARD }
        );
        return NextResponse.json({ ok: true });
      }
    }

    // ── Oddiy video (video message) ──
    if (msg.video && !msg.video_note) {
      const state = userState.get(chatId);
      if (state?.mode === "result_response") {
        const fileId = msg.video.file_id;
        const today = todayDateISO();
        const [existing] = await db
          .select()
          .from(dailyResults)
          .where(eq(dailyResults.date, today))
          .limit(1);
        if (existing) {
          await db
            .update(dailyResults)
            .set({ videoFileId: fileId, responseType: "video" })
            .where(eq(dailyResults.id, existing.id));
        } else {
          await db.insert(dailyResults).values({
            date: today,
            videoFileId: fileId,
            responseType: "video",
          });
        }
        userState.delete(chatId);
        await sendMessage(
          chatId,
          "🎥 Video saqlandi! Analitika sahifasida ko'rishingiz mumkin. Ertaga yaxshiroq harakat qiling! 💪",
          { reply_markup: MAIN_KEYBOARD }
        );
        return NextResponse.json({ ok: true });
      }
    }

    if (!msg.text) return NextResponse.json({ ok: true });

    await handleCommand(chatId, msg.text.trim());
  } catch (e) {
    console.error("Webhook error:", e);
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    name: "FlowDesk Telegram Bot",
    tokenConfigured: Boolean(TOKEN),
    allowedChats: ALLOWED.length,
  });
}
