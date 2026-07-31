import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  routines,
  settings,
  botReminders,
  sleepLogs,
  tasks,
  dailyResults,
} from "@/db/schema";
import { asc, and, eq, gte, desc, sql } from "drizzle-orm";
import { todayDateISO } from "@/lib/orderActions";

export const dynamic = "force-dynamic";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

async function botSend(method: string, payload: Record<string, unknown>) {
  if (!TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("botSend error:", e);
  }
}

/**
 * Cron job: har 30 daqiqada yuradi.
 * - Uyg'onish vaqti: "Turingmi?" tugmasi
 * - Reja vaqti kelganda: eslatma
 * - 20:00: kunlik hisobot
 * - Uxlash vaqti: ertangi reja kiritish so'rovi + kunlik natija (ishlar, hisob)
 */
export async function GET(req: Request) {
  // Vercel Cron secret
  const headerSecret = req.headers.get("x-vercel-cron-secret");
  if (
    process.env.VERCEL_CRON_SECRET &&
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
  const today = todayDateISO();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const settingsData = await fetch("/api/settings").then((r) => r.json());
  const enable = settingsData.bot_enabled === "true";

  if (!enable) {
    return NextResponse.json({ ok: true, skipped: "bot disabled" });
  }

  const wakeTime = settingsData.wake_time || "04:30";
  const sleepTime = settingsData.sleep_time || "21:40";

  // Faqat bugungi targetDate ga tegishli yoki har kuni uchun rejalar
  const allRoutines = await db
    .select()
    .from(routines)
    .where(
      sql`${routines.targetDate} IS NULL OR ${routines.targetDate} = ${today}`
    )
    .orderBy(asc(routines.time));

  let messagesSent = 0;

  // ── Wake up reminder ──
  const [wh, wm] = wakeTime.split(":").map(Number);
  const wakeMin = wh * 60 + wm;
  if (nowMin >= wakeMin && nowMin < wakeMin + 35) {
    const exists = await db
      .select({ id: botReminders.id })
      .from(botReminders)
      .where(and(eq(botReminders.date, today), eq(botReminders.type, "wake_up")))
      .limit(1);

    if (exists.length === 0) {
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
      await db.insert(botReminders).values({
        routineId: null,
        date: today,
        type: "wake_up",
        sent: true,
      });
      messagesSent++;
    }
  }

  // ── Routine reminders ──
  for (const r of allRoutines) {
    const [rh, rm] = r.time.split(":").map(Number);
    const rMin = rh * 60 + rm;
    if (nowMin >= rMin && nowMin < rMin + 35) {
      const exists = await db
        .select({ id: botReminders.id })
        .from(botReminders)
        .where(
          and(eq(botReminders.date, today), eq(botReminders.routineId, r.id))
        )
        .limit(1);

      if (exists.length === 0) {
        const endInfo = r.endTime ? ` (deadline: ${r.endTime})` : "";
        await botSend("sendMessage", {
          chat_id: chatId,
          text: `⏰ <b>${r.time} — ${r.title}</b>${endInfo}\n\nVaqti keldi! Boshlang 💪`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Bajarildi", callback_data: `routine_yes_${r.id}` }],
              [{ text: "⏭ Hozircha emas", callback_data: `routine_no_${r.id}` }],
            ],
          },
        });
        await db.insert(botReminders).values({
          routineId: r.id,
          date: today,
          type: "routine",
          sent: true,
        });
        messagesSent++;
      }
    }
  }

  // ── 20:00 — bugungi natija + ertangi reja kiritish so'rovi ──
  if (nowMin === 20 * 60 || nowMin === 20 * 60 + 30) {
    const exists = await db
      .select({ id: botReminders.id })
      .from(botReminders)
      .where(and(eq(botReminders.date, today), eq(botReminders.type, "evening")))
      .limit(1);

    if (exists.length === 0) {
      // Bugungi natijalarni yig'amiz
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
        text: `🌆 <b>KUN YAKUNI (20:00)</b>\n\n` +
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
      await db.insert(botReminders).values({
        routineId: null,
        date: today,
        type: "evening",
        sent: true,
        responded: true,
      });
      messagesSent++;
    }
  }

  // ── Sleep reminder (uxlash vaqti) — kunlik natija savollari ──
  const [sh, sm] = sleepTime.split(":").map(Number);
  const sleepMin = sh * 60 + sm;
  if (nowMin >= sleepMin - 5 && nowMin < sleepMin + 35 && sleepMin > 18 * 60) {
    const exists = await db
      .select({ id: botReminders.id })
      .from(botReminders)
      .where(and(eq(botReminders.date, today), eq(botReminders.type, "sleep")))
      .limit(1);

    if (exists.length === 0) {
      // Avval ertangi rejalar haqida eslatma yuborish
      await botSend("sendMessage", {
        chat_id: chatId,
        text: `🌙 <b>Yotish vaqti: ${sleepTime}</b>\n\n` +
          `📝 <b>Ertangi kun uchun reja va ishlarni</b> yozib qo'ying. Kechqurun uxlamasdan kiritsangiz — ertalab ko'rasiz.\n\n` +
          `💡 Quyidagi tugmalar orqali qo'shing yoki "📋 Ertangi reja" deb yozing.`,
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
                text: "✅ Hammasi tayyor, yotaman",
                callback_data: "sleep_ack",
              },
            ],
          ],
        },
      });

      // 1 daqiqadan so'ng kunlik natija savolini yuborish
      setTimeout(() => {
        botSend("sendMessage", {
          chat_id: chatId,
          text:
            `📊 <b>Bugungi kun natijasi:</b>\n\n` +
            `1️⃣ Bugungi ishlarni bajardingizmi?\n` +
            `2️⃣ Bugungi kirim-chiqimni yozdingizmi?\n\n` +
            `👇 Javob bering:`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
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
            ],
          },
        });
      }, 60_000);

      await db.insert(botReminders).values({
        routineId: null,
        date: today,
        type: "sleep",
        sent: true,
      });
      messagesSent++;
    }
  }

  return NextResponse.json({ ok: true, messagesSent });
}
