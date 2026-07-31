import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  routines,
  settings,
  botReminders,
  tasks,
} from "@/db/schema";
import { asc, and, eq, sql } from "drizzle-orm";
import { todayDateISO } from "@/lib/orderActions";

export const dynamic = "force-dynamic";
// Vercel serverless funksiyada setTimeout ishlamasligi uchun
// barcha ishlar darhol bajariladi (60 soniya kutub bo'lmaydi)
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
 * Cron job: har 30 daqiqada yuradi.
 * - Uyg'onish vaqti: "Turingmi?" tugmasi
 * - Reja vaqti kelganda: eslatma
 * - 20:00: kunlik hisobot
 * - Uxlash vaqti: ertangi reja kiritish + kunlik natija savollari
 *   (ikkalasi birlashtirilgan holda yuboriladi, chunki setTimeout
 *   Vercel serverless'da ishlamaydi)
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

    // ── Wake up reminder ──
    const wakeMin = safeMinutes(wakeTime, 4 * 60 + 30);
    if (force || nowMin >= wakeMin - 15) {
      const exists = await db
        .select({ id: botReminders.id })
        .from(botReminders)
        .where(
          and(eq(botReminders.date, today), eq(botReminders.type, "wake_up"))
        )
        .limit(1);

      if (force || exists.length === 0) {
        await botSend("sendMessage", {
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

    // ── Routine reminders ──
    for (const r of allRoutines) {
      const rMin = safeMinutes(r.time, 0);
      if (force || nowMin >= rMin - 15) {
        const exists = await db
          .select({ id: botReminders.id })
          .from(botReminders)
          .where(
            and(eq(botReminders.date, today), eq(botReminders.routineId, r.id))
          )
          .limit(1);

        if (force || exists.length === 0) {
          const endInfo = r.endTime ? ` (deadline: ${r.endTime})` : "";
          await botSend("sendMessage", {
            chat_id: chatId,
            text: `⏰ <b>${r.time} — ${r.title}</b>${endInfo}\n\nVaqti keldi! Boshlang 💪`,
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

    // ── 20:00 — bugungi natija + ertangi reja kiritish so'rovi ──
    if (force || nowMin >= 20 * 60 - 15) {
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

        await botSend("sendMessage", {
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

    // ── Sleep reminder (uxlash vaqti) ──
    const sleepMin = safeMinutes(sleepTime, 21 * 60 + 40);
    if (force || (nowMin >= sleepMin - 15 && nowMin >= 18 * 60)) {
      const exists = await db
        .select({ id: botReminders.id })
        .from(botReminders)
        .where(
          and(eq(botReminders.date, today), eq(botReminders.type, "sleep"))
        )
        .limit(1);

      if (force || exists.length === 0) {
        await botSend("sendMessage", {
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

    return NextResponse.json({ ok: true, messagesSent });
  } catch (e) {
    console.error("Cron discipline error:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
