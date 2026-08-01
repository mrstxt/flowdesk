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
 * Cron job: vercel.json dagi bir nechta kunlik schedule'lar orqali ishlaydi
 * (Hobby planda 10 daqiqalik interval ishlamaydi — kunga 1 marta cheklangan).
 *
 * Schedule'lar (UTC -> Toshkent):
 * - 23:30 UTC -> 04:30 Toshkent: uyg'onish eslatmasi
 * - 05:00 UTC -> 10:00 Toshkent: kechikkan uyg'onish uchun qayta urinish
 * - 15:00 UTC -> 20:00 Toshkent: kunlik hisobot
 * - 16:40 UTC -> 21:40 Toshkent: uxlash eslatmasi
 * - 18:00 UTC -> 23:00 Toshkent: kechikkan uxlash uchun qayta urinish
 *
 * Har bir cron yuganda barcha shartlar tekshiriladi; `bot_reminders`
 * jadvali orqali xabar kuniga faqat 1 marta yuboriladi.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const force =
    searchParams.get("force") === "true" || searchParams.get("test") === "true";

  // Vercel Cron secret (agar force test bo'lmasa va header berilsa tekshiramiz)
  const headerSecret = req.headers.get("x-vercel-cron-secret");
  if (
    !force &&
    process.env.VERCEL_CRON_SECRET &&
    headerSecret &&
    headerSecret !== process.env.VERCEL_CRON_SECRET
  ) {
    return NextResponse.json({ ok: true });
  }

  if (!TOKEN) {
    return NextResponse.json({ ok: true, error: "no bot token" });
  }

  const chatIdStr = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatIdStr) {
    return NextResponse.json({ ok: true, error: "no chat id" });
  }
  const chatId = Number(chatIdStr.split(",")[0]);
  if (!chatId) {
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

    // ── Wake up reminder (eng yaqin ertalabki cron da) ──
    const wakeMin = safeMinutes(wakeTime, 4 * 60 + 30);
    // Vercel Hobby: kuniga 2 ta ertalabki cron bor (04:30 va 10:00 Toshkent).
    // Uyg'onish vaqtiga eng yaqin cron tanlanadi — aks holda 06:00-09:00 gacha
    // bo'lgan uyg'onishlar 4+ soat kechikib yuborilardi.
    const WAKE_CRON_EARLY = 4 * 60 + 30; // 04:30 Toshkent
    const WAKE_CRON_LATE = 10 * 60; // 10:00 Toshkent
    const wakeCronMin =
      wakeMin <= WAKE_CRON_EARLY + (WAKE_CRON_LATE - WAKE_CRON_EARLY) / 2
        ? WAKE_CRON_EARLY
        : WAKE_CRON_LATE;
    // ±59: Vercel Hobby cronni soat oralig'ida ishga tushiradi
    const inWakeWindow =
      nowMin >= wakeCronMin - 59 && nowMin <= wakeCronMin + 59;
    if (force || inWakeWindow) {
      const exists = await db
        .select({ id: botReminders.id })
        .from(botReminders)
        .where(
          and(eq(botReminders.date, today), eq(botReminders.type, "wake_up"))
        )
        .limit(1);

      if (force || exists.length === 0) {
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
        // Xabar muvaffaqiyatli yuborilgandagina "sent" deb belgilaymiz.
        // Aks holda keyingi cron da qayta uriniladi.
        if (sent.ok) {
          if (exists.length === 0) {
            await db.insert(botReminders).values({
              routineId: null,
              date: today,
              type: "wake_up",
              sent: true,
            });
          }
          messagesSent++;
        } else {
          console.error("wake_up reminder yuborilmadi:", sent.error);
        }
      }
    }

    // ── Routine reminders ──
    for (const r of allRoutines) {
      const rMin = safeMinutes(r.time, 0);
      if (force || nowMin >= rMin) {
        const exists = await db
          .select({ id: botReminders.id })
          .from(botReminders)
          .where(
            and(eq(botReminders.date, today), eq(botReminders.routineId, r.id))
          )
          .limit(1);

        if (force || exists.length === 0) {
          const endInfo = r.endTime ? ` (deadline: ${escapeHtml(r.endTime)})` : "";
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
          if (sent.ok) {
            if (exists.length === 0) {
              await db.insert(botReminders).values({
                routineId: r.id,
                date: today,
                type: "routine",
                sent: true,
              });
            }
            messagesSent++;
          } else {
            console.error(`routine ${r.id} reminder yuborilmadi:`, sent.error);
          }
        }
      }
    }

    // ── 20:00 — bugungi natija + ertangi reja kiritish so'rovi ──
    if (force || (nowMin >= 20 * 60 - 45 && nowMin < 24 * 60)) {
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
        if (sent.ok) {
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
        } else {
          console.error("evening report yuborilmadi:", sent.error);
        }
      }
    }

    // ── Sleep reminder (uxlash vaqti, faqat kechqurun) ──
    const sleepMin = safeMinutes(sleepTime, 21 * 60 + 40);
    if (force || (nowMin >= sleepMin - 45 && nowMin >= 18 * 60)) {
      const exists = await db
        .select({ id: botReminders.id })
        .from(botReminders)
        .where(
          and(eq(botReminders.date, today), eq(botReminders.type, "sleep"))
        )
        .limit(1);

      if (force || exists.length === 0) {
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
        if (sent.ok) {
          if (exists.length === 0) {
            await db.insert(botReminders).values({
              routineId: null,
              date: today,
              type: "sleep",
              sent: true,
            });
          }
          messagesSent++;
        } else {
          console.error("sleep reminder yuborilmadi:", sent.error);
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
