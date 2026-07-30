import { NextResponse } from "next/server";
import { db } from "@/db";
import { routines, settings, botReminders } from "@/db/schema";
import { asc, and, eq, gte } from "drizzle-orm";
import {
  DEFAULT_SLEEP_TIME,
  DEFAULT_WAKE_TIME,
  getSettingsMap,
} from "@/lib/appSettings";
import { dateTimeInAppTimeZone } from "@/lib/dateTime";

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

function isInMinuteWindow(
  currentMinute: number,
  startMinute: number,
  duration: number
): boolean {
  const normalizedStart = (startMinute + 1440) % 1440;
  const elapsed = (currentMinute - normalizedStart + 1440) % 1440;
  return elapsed < duration;
}

/**
 * Cron job: har 30 daqiqada yuradi.
 * Bugungi barcha routine vaqt bilan taqqoslaydi.
 */
export async function GET(req: Request) {
  // Vercel Cron odatda Authorization: Bearer <secret> yuboradi.
  // Eski x-vercel-cron-secret formatini ham qo'llab-quvvatlaymiz.
  const cronSecret =
    process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || "";
  const authorized =
    req.headers.get("authorization") === `Bearer ${cronSecret}` ||
    req.headers.get("x-vercel-cron-secret") === cronSecret;
  if (cronSecret && !authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!TOKEN) {
    return NextResponse.json({ ok: true, error: "no bot token" });
  }

  const chatIdStr = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatIdStr) {
    return NextResponse.json({ ok: true, error: "no chat id" });
  }

  const chatId = Number(chatIdStr.split(",")[0]);
  const now = dateTimeInAppTimeZone();
  const today = now.date;
  const nowMin = now.totalMinutes;
  const appSettings = await getSettingsMap();
  const enable = appSettings.bot_enabled === "true";

  if (!enable) {
    return NextResponse.json({ ok: true, skipped: "bot disabled" });
  }

  const allRoutines = await db
    .select()
    .from(routines)
    .orderBy(asc(routines.time));

  const wakeTime = appSettings.wake_time || DEFAULT_WAKE_TIME;
  const sleepTime = appSettings.sleep_time || DEFAULT_SLEEP_TIME;

  let messagesSent = 0;

  // ── Wake up reminder ──
  const [wh, wm] = wakeTime.split(":").map(Number);
  const wakeMin = wh * 60 + wm;
  if (isInMinuteWindow(nowMin, wakeMin, 35)) {
    const key = "wake_up";
    const exists = await db
      .select({ id: botReminders.id })
      .from(botReminders)
      .where(
        and(eq(botReminders.date, today), eq(botReminders.type, key))
      )
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
    if (isInMinuteWindow(nowMin, rMin, 35)) {
      const exists = await db
        .select({ id: botReminders.id })
        .from(botReminders)
        .where(
          and(
            eq(botReminders.date, today),
            eq(botReminders.routineId, r.id)
          )
        )
        .limit(1);

      if (exists.length === 0) {
        await botSend("sendMessage", {
          chat_id: chatId,
          text: `⏰ <b>${r.time} — ${r.title}</b>\n\nVaqti keldi! Boshlang 💪`,
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

  // ── Evening summary (20:00) ──
  if (nowMin === 20 * 60 || nowMin === 20 * 60 + 30) {
    const exists = await db
      .select({ id: botReminders.id })
      .from(botReminders)
      .where(and(eq(botReminders.date, today), eq(botReminders.type, "evening")))
      .limit(1);

    if (exists.length === 0) {
      const todayReminders = await db
        .select()
        .from(botReminders)
        .where(
          and(
            eq(botReminders.date, today),
            gte(botReminders.type, ""),
            eq(botReminders.sent, true)
          )
        );
      const done = todayReminders.filter(
        (r) => r.responded && r.responseText?.startsWith("✅")
      ).length;
      const total = allRoutines.length;

        const emoji = done === total ? "🏆" : done >= total * 0.7 ? "👏" : done >= total * 0.5 ? "💪" : "📌";
        const summary = done === total
          ? "Ajoyib! Barcha rejalar bajardi! 🎉"
          : done >= total * 0.7
          ? "Yaxshi natija! Yana 1-2 qadamda mukammal!"
          : "Ertaga yanada kuchli bo'ling. Asosiy — to'xtamaslik!";
        await botSend("sendMessage", {
          chat_id: chatId,
          text: `${emoji} <b>KUNLIK HISOBOT</b>\n\n📅 Bugungi kun:\n✅ ${done}/${total} reja bajarildi\n\n${summary}`,
          parse_mode: "HTML",
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

  // ── Sleep reminder ──
  const [sh, sm] = sleepTime.split(":").map(Number);
  const sleepMin = sh * 60 + sm;
  if (isInMinuteWindow(nowMin, sleepMin - 30, 65)) {
    const exists = await db
      .select({ id: botReminders.id })
      .from(botReminders)
      .where(and(eq(botReminders.date, today), eq(botReminders.type, "sleep")))
      .limit(1);

    if (exists.length === 0) {
      await botSend("sendMessage", {
        chat_id: chatId,
        text: `🌙 <b>Yotish vaqti yaqinlashmoqda!</b>\n\n🕐 ${sleepTime} da yotish rejalashtirilgan.\nTelefonni qo'ying, ertaga kuchli turish uchun 💤`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "👍 Ma'lum bo'ldi", callback_data: "sleep_ack" }],
          ],
        },
      });
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
