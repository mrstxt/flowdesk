import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  routines,
  settings,
  botReminders,
  tasks,
} from "@/db/schema";
import { asc, and, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
// Vercel serverless funksiyada setTimeout ishlamasligi uchun
// barcha ishlar darhol bajariladi (60 soniya kutib bo'lmaydi)
export const maxDuration = 60;

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

async function botSend(method: string, payload: Record<string, unknown>) {
  if (!TOKEN) return { ok: false, error: "no token" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`botSend ${method} failed:`, res.status, text);
      return { ok: false, error: text };
    }
    return { ok: true };
  } catch (e) {
    console.error("botSend error:", e);
    return { ok: false, error: String(e) };
  }
}

function safeMinutes(time: string | null | undefined, fallback: number): number {
  if (!time || typeof time !== "string") return fallback;
  const parts = time.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return fallback;
  return h * 60 + m;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getTashkentTime() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  const year = get("year");
  const month = String(get("month")).padStart(2, "0");
  const day = String(get("day")).padStart(2, "0");
  let hour = get("hour");
  if (hour === 24) hour = 0;
  const minute = get("minute");
  return {
    today: `${year}-${month}-${day}`,
    nowMin: hour * 60 + minute,
  };
}

/**
 * REAL-TIME ogohlantirishlar (Toshkent vaqti bo'yicha)
 * ─────────────────────────────────────────────────────
 * Vercel Hobby rejasida cron kuniga 1 marta cheklangan, shuning uchun
 * asosiy "harakatlantiruvchi" sifatida bepul tashqi xizmat ishlatiladi:
 *
 *   cron-job.org  →  har 5 daqiqada  /api/cron/discipline?tick=SECRET
 *
 * Har bir chaqiruvda hozirgi Toshkent vaqti ANIQ belgilangan vaqtga
 * solishtiriladi (masalan uxlash 20:00 bo'lsa → 20:00 da yuboriladi).
 * 5 daqiqalik polling tufayli eslatma belgilangan vaqtga ±5 daqiqa
 * ichida real-time yuboriladi. Qo'shimcha +59 daqiqalik oyna — agar
 * bitta tick o'tkazib yuborilsa ham xabar yo'qolmaydi (masalan Vercel
 * cron backup sifatida ishlasa). `bot_reminders` jadvali kuniga faqat
 * 1 marta yuborilishini kafolatlaydi.
 *
 * Vercel'ning vercel.json dagi kundalik crons hali ham backup sifatida
 * qoladi — ular ham xuddi shu aniq-vaqt mantiqi bilan ishlaydi.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const force =
    searchParams.get("force") === "true" || searchParams.get("test") === "true";

  // ── Auth ──
  // 1) Vercel Cron: x-vercel-cron-secret header
  // 2) cron-job.org: ?tick=SECRET yoki x-cron-secret header
  // 3) Hech qanday secret konfiguratsiya qilinmagan bo'lsa — ochiq (dev rejim)
  // force ham auth'dan o'tishi shart — aks holda har kim spam yuborishi mumkin.
  const headerSecret = req.headers.get("x-vercel-cron-secret");
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const tickParam = searchParams.get("tick") || "";

  const hasVercelSecret = !!process.env.VERCEL_CRON_SECRET;
  const hasTickSecret = !!process.env.CRON_JOB_SECRET;
  const isVercelCron =
    hasVercelSecret && headerSecret === process.env.VERCEL_CRON_SECRET;
  const isTick =
    hasTickSecret &&
    (tickParam === process.env.CRON_JOB_SECRET ||
      cronSecretHeader === process.env.CRON_JOB_SECRET);
  const noSecrets = !hasVercelSecret && !hasTickSecret;
  const authorized = noSecrets || isVercelCron || isTick;
  if (!authorized) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!TOKEN) {
    return NextResponse.json({ ok: true, error: "no bot token" });
  }

  const chatIdStr = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatIdStr) {
    return NextResponse.json({ ok: true, error: "no chat id" });
  }
  const chatIds = chatIdStr
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (chatIds.length === 0) {
    return NextResponse.json({ ok: true, error: "invalid chat id" });
  }

  try {
    const { today, nowMin } = getTashkentTime();

    // ── Settings ni DB dan to'g'ridan-to'g'ri o'qish ──
    const settingsRows = await db.select().from(settings);
    const settingsMap: Record<string, string> = {};
    for (const r of settingsRows) settingsMap[r.key] = r.value ?? "";

    const enable = settingsMap.bot_enabled === "true";
    if (!enable && !force) {
      return NextResponse.json({ ok: true, skipped: "bot disabled" });
    }

    const wakeTime = settingsMap.wake_time || "04:30";
    const sleepTime = settingsMap.sleep_time || "21:40";

    // Bugungi targetDate ga tegishli yoki har kuni uchun rejalar
    const allRoutines = await db
      .select()
      .from(routines)
      .where(
        sql`${routines.targetDate} IS NULL OR ${routines.targetDate} = ${today}`
      )
      .orderBy(asc(routines.time));

    let messagesSent = 0;

    // Eslatma vaqti kelganini tekshirish:
    // - cron-job.org (tick): ANIQ vaqt oynasi (+59 daqiqa) — real-time (±5 daqiqa)
    // - Vercel cron (backup): vaqt o'tib ketgan bo'lsa ham yuboriladi (catch-up) —
    //   shunda cron-job.org ishlamay qolsa ham eslatmalar yo'qolmaydi
    // - force: hammasini yuboradi (test)
    const reminderDue = (targetMin: number): boolean => {
      if (force) return true;
      if (isVercelCron) return nowMin >= targetMin;
      return nowMin >= targetMin && nowMin <= targetMin + 59;
    };

    // ── Wake up reminder (ANIQ wakeTime da) ──
    const wakeMin = safeMinutes(wakeTime, 4 * 60 + 30);
    if (reminderDue(wakeMin)) {
      const exists = await db
        .select({ id: botReminders.id })
        .from(botReminders)
        .where(
          and(eq(botReminders.date, today), eq(botReminders.type, "wake_up"))
        )
        .limit(1);

      if (force || exists.length === 0) {
        let anyOk = false;
        for (const chatId of chatIds) {
          const sent = await botSend("sendMessage", {
            chat_id: chatId,
            text: `☀️ <b>SALOM! ${wakeTime} da turing!</b>\n\nYengillik bilan ko'zni oching, birinchi ishi suv iching 💧`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ Ha, turdim!", callback_data: "woke_yes" },
                  { text: "😴 Uxlab qoldim", callback_data: "woke_no" },
                ],
              ],
            },
          });
          if (sent.ok) anyOk = true;
          else console.error(`wake_up (${chatId}) yuborilmadi:`, sent.error);
        }
        // Xabar muvaffaqiyatli yuborilgandagina "sent" deb belgilaymiz.
        // Aks holda keyingi tick/cron da qayta uriniladi.
        if (anyOk) {
          if (exists.length === 0) {
            await db.insert(botReminders).values({
              routineId: null,
              date: today,
              type: "wake_up",
              sent: true,
            });
          }
          messagesSent++;
        }
      }
    }

    // ── Routine reminders (ANIQ r.time da) ──
    for (const r of allRoutines) {
      const rMin = safeMinutes(r.time, 0);
      if (reminderDue(rMin)) {
        const exists = await db
          .select({ id: botReminders.id })
          .from(botReminders)
          .where(
            and(eq(botReminders.date, today), eq(botReminders.routineId, r.id))
          )
          .limit(1);

        if (force || exists.length === 0) {
          const endInfo = r.endTime ? ` (deadline: ${escapeHtml(r.endTime)})` : "";
          let anyOk = false;
          for (const chatId of chatIds) {
            const sent = await botSend("sendMessage", {
              chat_id: chatId,
              text: `⏰ <b>${escapeHtml(r.time)} — ${escapeHtml(
                r.title
              )}</b>${endInfo}\n\nVaqti keldi! Boshlang 💪`,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "✅ Bajarildi", callback_data: `routine_yes_${r.id}` }],
                  [
                    {
                      text: "⏭ Hozircha emas",
                      callback_data: `routine_no_${r.id}`,
                    },
                  ],
                ],
              },
            });
            if (sent.ok) anyOk = true;
            else
              console.error(
                `routine ${r.id} (${chatId}) yuborilmadi:`,
                sent.error
              );
          }
          if (anyOk) {
            if (exists.length === 0) {
              await db.insert(botReminders).values({
                routineId: r.id,
                date: today,
                type: "routine",
                sent: true,
              });
            }
            messagesSent++;
          }
        }
      }
    }

    // ── 20:00 — bugungi natija + ertangi reja kiritish so'rovi ──
    if (reminderDue(20 * 60)) {
      const exists = await db
        .select({ id: botReminders.id })
        .from(botReminders)
        .where(
          and(eq(botReminders.date, today), eq(botReminders.type, "evening"))
        )
        .limit(1);

      if (force || exists.length === 0) {
        const todayTasks = await db
          .select()
          .from(tasks)
          .where(eq(tasks.date, today));
        const doneTasks = todayTasks.filter((t) => t.completed).length;
        const totalTasks = todayTasks.length;
        const doneRoutines = allRoutines.filter(
          (r) => r.lastDoneDate === today
        ).length;
        const totalRoutines = allRoutines.length;
        const taskPct = totalTasks
          ? Math.round((doneTasks / totalTasks) * 100)
          : 0;
        const routinePct = totalRoutines
          ? Math.round((doneRoutines / totalRoutines) * 100)
          : 0;

        const summary =
          taskPct === 100 && routinePct === 100
            ? "🏆 Mukammal kun! Barcha ish va rejalar bajarildi!"
            : taskPct >= 70
            ? "👏 Yaxshi kun! Asosiy qismi bajarildi."
            : "💪 Ertaga yanada kuchliroq bo'ling.";

        let anyOk = false;
        for (const chatId of chatIds) {
          const sent = await botSend("sendMessage", {
            chat_id: chatId,
            text:
              `🌆 <b>KUN YAKUNI (20:00)</b>\n\n` +
              `✅ Rejalar: <b>${doneRoutines}/${totalRoutines}</b> (${routinePct}%)\n` +
              `📋 Ishlar: <b>${doneTasks}/${totalTasks}</b> (${taskPct}%)\n\n` +
              `${summary}\n\n` +
              `📌 <b>Ertangi kun uchun reja va ishlarni</b> shu yerga yozib qo'ying — ertalab uyg'onganda ko'rasiz.\n\n` +
              `💡 Quyidagi tugmalar orqali qo'shing:`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "📋 Ertangi ish qo'shish",
                    callback_data: "tomorrow_task",
                  },
                  {
                    text: "🎯 Ertangi reja",
                    callback_data: "tomorrow_routine",
                  },
                ],
              ],
            },
          });
          if (sent.ok) anyOk = true;
          else
            console.error(`evening report (${chatId}) yuborilmadi:`, sent.error);
        }
        if (anyOk) {
          if (exists.length === 0) {
            await db.insert(botReminders).values({
              routineId: null,
              date: today,
              type: "evening",
              sent: true,
              responded: true,
            });
          }
          messagesSent++;
        }
      }
    }

    // ── Sleep reminder (ANIQ sleepTime da — user kiritgan vaqtda) ──
    const sleepMin = safeMinutes(sleepTime, 21 * 60 + 40);
    if (reminderDue(sleepMin)) {
      const exists = await db
        .select({ id: botReminders.id })
        .from(botReminders)
        .where(
          and(eq(botReminders.date, today), eq(botReminders.type, "sleep"))
        )
        .limit(1);

      if (force || exists.length === 0) {
        let anyOk = false;
        for (const chatId of chatIds) {
          const sent = await botSend("sendMessage", {
            chat_id: chatId,
            text:
              `🌙 <b>Yotish vaqti: ${sleepTime}</b>\n\n` +
              `📝 <b>Ertangi kun uchun</b> reja va ishlarni shu yerga yozib qo'ying — ertalab uyg'onganda ko'rasiz.\n\n` +
              `📊 <b>Bugungi natijani</b> ham belgilab qo'ying:\n` +
              `1️⃣ Bugungi ishlarni bajardingizmi?\n` +
              `2️⃣ Bugungi kirim-chiqimni yozdingizmi?`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "📋 Ertangi ish",
                    callback_data: "tomorrow_task",
                  },
                  {
                    text: "🎯 Ertangi reja",
                    callback_data: "tomorrow_routine",
                  },
                ],
                [
                  {
                    text: "✅ Ha, bajardim",
                    callback_data: "result_done_yes",
                  },
                  {
                    text: "❌ Yo'q",
                    callback_data: "result_done_no",
                  },
                ],
                [
                  {
                    text: "✅ Hisob yozdim",
                    callback_data: "result_finance_yes",
                  },
                  {
                    text: "❌ Yozmadim",
                    callback_data: "result_finance_no",
                  },
                ],
                [
                  {
                    text: "🌙 Hammasi tayyor, yotaman",
                    callback_data: "sleep_ack",
                  },
                ],
              ],
            },
          });
          if (sent.ok) anyOk = true;
          else console.error(`sleep (${chatId}) yuborilmadi:`, sent.error);
        }
        if (anyOk) {
          if (exists.length === 0) {
            await db.insert(botReminders).values({
              routineId: null,
              date: today,
              type: "sleep",
              sent: true,
            });
          }
          messagesSent++;
        }
      }
    }

    return NextResponse.json({ ok: true, messagesSent });
  } catch (e) {
    console.error("Cron discipline error:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
