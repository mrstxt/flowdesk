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
  settings,
} from "@/db/schema";
import { desc, eq, gte, and, asc, isNull, sql, desc as descOrd } from "drizzle-orm";
import { confirmOrder, todayDateISO } from "@/lib/orderActions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ALLOWED = (process.env.TELEGRAM_ADMIN_CHAT_ID || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/* ── Helpers ── */

async function sendMessage(chatId: number, text: string) {
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
      }),
    });
  } catch (e) {
    console.error("sendMessage:", e);
  }
}

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
    await sendMessage(chatId, text);
  } catch (e) {
    console.error("answerCallback:", e);
  }
}

function fmt(n: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so'm";
}

function parseAmount(raw: string): number {
  return Number(String(raw).replace(/[\s'`']/g, "").replace(",", ".")) || 0;
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

function setupErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
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
    return "❌ Database ulanishida xatolik. Vercel'dagi DATABASE_URL qiymatini tekshiring.";
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

/* ── Callback handlers (inline buttons from cron) ── */

async function handleCallback(chatId: number, callbackId: string, data: string) {
  const today = todayDateISO();

  if (data === "woke_yes") {
    await db
      .update(botReminders)
      .set({ responded: true, responseText: "✅ Turdim" })
      .where(
        and(eq(botReminders.date, today), eq(botReminders.type, "wake_up"))
      );
    await db.insert(sleepLogs).values({
      date: today,
      expectedWake: (await fetch("/api/settings").then((r) => r.json())).wake_time || "06:30",
      actualWake: new Date().toTimeString().slice(0, 5),
      overslept: false,
    });
    await answerCallback(chatId, callbackId, "✅ Ajoyib! Kun rejalaringiz oldinda. Kuchli boshlang! 💪");

    // Send today's first routine info
    const routinesToday = await db
      .select()
      .from(routines)
      .where(isNull(routines.lastDoneDate))
      .orderBy(asc(routines.time));
    if (routinesToday.length > 0) {
      const next = routinesToday[0];
      const elapsed = Math.floor((Date.now() % 86400000) / 60000);
      const [nh, nm] = next.time.split(":").map(Number);
      const targetMin = nh * 60 + nm;
      const diff = Math.max(0, targetMin - elapsed);
      await sendMessage(
        chatId,
        `📋 <b>Kelgasi reja:</b>\n⏰ ${next.time} — ${next.title}\n⏳ ${diff} daqiqa qoldi`
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
    await answerCallback(
      chatId,
      callbackId,
      "😴 Nima uchun uxlab qoldingiz? Sababini yozing — sababni bilish = kelgisi safar o'zgartirish!\n\nMasalan: kech yotdim, ertalab kech turdim..."
    );
    return;
  }

  if (data === "sleep_ack") {
    await db
      .update(botReminders)
      .set({ responded: true, responseText: "👍 OK" })
      .where(
        and(eq(botReminders.date, today), eq(botReminders.type, "sleep"))
      );
    await answerCallback(
      chatId,
      callbackId,
      "🌙 Yaxshi! Telefonni qo'ying, ertaga kuchli kun sizni kutmoqda! 💤"
    );
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

/* ── Text command handlers ── */

async function handleCommand(chatId: number, text: string) {
  const [cmdRaw, ...rest] = text.split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase();
  const args = rest.join(" ");

  try {
    if (cmd === "/start" || cmd === "/yordam" || cmd === "/help") {
      await sendMessage(chatId, HELP);
      return;
    }

    // ── Bot toggle ──
    if (cmd === "/bot_yoq") {
      await db
        .insert(settings)
        .values({ key: "bot_enabled", value: "true" })
        .onConflictDoUpdate({ target: settings.key, set: { value: "true" } });
      await sendMessage(
        chatId,
        "✅ <b>Bot yoqildi!</b>\n\nErtalab uyg'onish vaqtida xabar keladi. Har bir reja vaqtida eslatma yuboriladi. Kechqurun kunlik hisobot olasaniz."
      );
      return;
    }
    if (cmd === "/bot_och") {
      await db
        .insert(settings)
        .values({ key: "bot_enabled", value: "false" })
        .onConflictDoUpdate({ target: settings.key, set: { value: "false" } });
      await sendMessage(chatId, "🔇 Bot o'chirildi. Es-latmalar to'xtatildi.");
      return;
    }

    // ── Check if responding to "uxlab qoldim" ──
    const today = todayDateISO();
    const wakeReminder = await db
      .select()
      .from(botReminders)
      .where(
        and(
          eq(botReminders.date, today),
          eq(botReminders.type, "wake_up"),
          eq(botReminders.responded, false)
        )
      )
      .limit(1);

    if (wakeReminder.length > 0 && cmd !== "/") {
      const wakeTime =
        (await fetch("/api/settings").then((r) => r.json())).wake_time ||
        "06:30";
      await db.insert(sleepLogs).values({
        date: today,
        expectedWake: wakeTime,
        actualWake: new Date().toTimeString().slice(0, 5),
        overslept: true,
        reason: text,
      });
      await db
        .update(botReminders)
        .set({ responded: true, responseText: text })
        .where(eq(botReminders.id, wakeReminder[0].id));
      await sendMessage(
        chatId,
        `📝 Sabab saqlandi: "${text}"\n\n⚠️ Kecha kech yotdingizmi? Ertaga ${
          (await fetch("/api/settings").then((r) => r.json())).sleep_time ||
          "23:00"
        } da yotishga harakat qiling. Sifatli uxlash = sifatli ish! 💪`
      );
      return;
    }

    if (cmd === "/rejalarni") {
      const allRoutines = await db
        .select()
        .from(routines)
        .orderBy(asc(routines.time));
      if (allRoutines.length === 0) {
        await sendMessage(chatId, "📋 Bugungi reja yo'q. Intizom bo'limidan qo'shing.");
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
        )}`
      );
      return;
    }

    if (cmd === "/buyurtma") {
      const p = splitParts(args);
      if (p.length < 1) {
        await sendMessage(
          chatId,
          "Format: /buyurtma Nomi, summa, deadline(YYYY-MM-DD), mijoz"
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
        }${p[3] ? `\n👤 ${p[3]}` : ""}`
      );
      return;
    }

    if (cmd === "/chiqim") {
      const p = splitParts(args);
      if (p.length < 2) {
        await sendMessage(chatId, "Format: /chiqim Nomi, summa, kategoriya");
        return;
      }
      const cat = EXPENSE_CAT[(p[2] || "").toLowerCase()] || "other";
      const amount = String(parseAmount(p[1]));
      await db
        .insert(expenses)
        .values({ title: p[0], amount, category: cat, date: todayDateISO() });
      await sendMessage(
        chatId,
        `<b>📉 Chiqim qo'shildi:</b>\n${p[0]}\n💸 ${fmt(Number(amount))}`
      );
      return;
    }

    if (cmd === "/kirim") {
      const p = splitParts(args);
      if (p.length < 2) {
        await sendMessage(
          chatId,
          "Format: /kirim Nomi, summa, naqd yoki karta"
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
        }`
      );
      return;
    }

    if (cmd === "/vazifa") {
      const p = splitParts(args);
      if (p.length < 1) {
        await sendMessage(
          chatId,
          "Format: /vazifa Matn, sana(YYYY-MM-DD), kategoriya"
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
        `<b>📋 Vazifa qo'shildi:</b>\n${p[0]}\n📅 ${date}`
      );
      return;
    }

    if (cmd === "/maqsad") {
      const p = splitParts(args);
      if (p.length < 2) {
        await sendMessage(
          chatId,
          "Format: /maqsad Nomi, summa, avtomatik foiz"
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
        }`
      );
      return;
    }

    if (cmd === "/kitob") {
      const p = splitParts(args);
      if (p.length < 1) {
        await sendMessage(chatId, "Format: /kitob Nomi, muallif, sahifalar soni");
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
        }`
      );
      return;
    }

    if (cmd === "/video") {
      const p = splitParts(args);
      const videoId = parseYouTubeId(p[0] || "");
      if (!videoId) {
        await sendMessage(
          chatId,
          "Format: /video YouTube_havola, nomi, kategoriya"
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
        `<b>🎬 Video qo'shildi:</b>\n${p[1] || "YouTube video"}\nPaneldagi Videolar bo'limida ko'rasiz.`
      );
      return;
    }

    if (cmd === "/tolov") {
      const id = parseAmount(args);
      if (!id) {
        await sendMessage(
          chatId,
          "Format: /tolov ID\nMisol: /tolov 12\n(ID ni /buyurtmalar dan ko'ring)"
        );
        return;
      }
      const result = await confirmOrder(id, "cash");
      if (!result.ok) {
        await sendMessage(chatId, result.message);
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
        )}\n\nMablag' Kirimlarga yozildi va maqsadlar ulushi avtomatik ajratildi.`
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
        await sendMessage(chatId, "Faol buyurtmalar yo'q.");
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
        )}\n\n💰 Tasdiqlash: /tolov ID`
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
        await sendMessage(chatId, "Bugunga vazifa yo'q.");
        return;
      }
      const lines = rows.map(
        (t) => `${t.completed ? "✅" : "⬜"} ${t.title}`
      );
      const done = rows.filter((t) => t.completed).length;
      await sendMessage(
        chatId,
        `<b>Bugungi vazifalar (${done}/${rows.length}):</b>\n${lines.join("\n")}`
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
        ].join("\n")
      );
      return;
    }

    await sendMessage(chatId, "Noma'lum buyruq.\n\n" + HELP);
  } catch (e) {
    console.error("Bot command error:", e);
    await sendMessage(chatId, setupErrorMessage(e));
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

    // ── Text message ──
    const msg = update?.message;
    if (!msg?.text) return NextResponse.json({ ok: true });

    const chatId: number = msg.chat.id;
    if (!TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN not set");
      return NextResponse.json({ ok: true });
    }

    if (ALLOWED.length > 0 && !ALLOWED.includes(String(chatId))) {
      await sendMessage(chatId, "Ruxsat yo'q. Bu bot faqat administrator uchun.");
      return NextResponse.json({ ok: true });
    }

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
