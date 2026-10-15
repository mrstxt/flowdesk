/**
 * FlowDesk Shaxsiy Profil Yordamchisi (Personal Userbot AI Assistant)
 *
 * Ushbu dastur ikkinchi shaxsiy profilingiz (sovo_adm) nomidan ishlaydi:
 * 1. Siz bu profilga xoh ovozli, xoh matnli xabar yozsangiz — darhol javob beradi.
 * 2. Ertangi rejalaringizni aytsangiz — bazaga vaqtlari bilan saqlaydi va ovoz bilan tasdiqlaydi.
 * 3. "Kartada qancha pul bor?" yoki "Ertaga nima vazifalar bor?" deb so'rasangiz — bazadan tekshirib aytib beradi.
 * 4. Belgilangan vaqtda (uyg'onish, rejalar) sizga avtomatik telefon qiladi (ringing).
 * 5. Agar telefonni ko'tarib uzsangiz va xabar yozmasangiz — javob berguningizcha har 5 daqiqada qayta telefon qilib uyg'otadi.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
import { generateUzbekSpeechAudio } from "./src/lib/callService";
import {
  parseSpokenPlans,
  saveParsedPlansToDb,
  detectPlanDate,
} from "./src/lib/planAiParser";
import { db } from "./src/db";
import {
  cards,
  tasks,
  routines,
  sleepLogs,
  settings,
  orders,
  videos,
  incomes,
  expenses,
} from "./src/db/schema";
import { eq, desc, asc, sql, and, ilike, or, isNull } from "drizzle-orm";
import { getCardAvailableBalance } from "./src/lib/cardActions";
import {
  askBrain,
  isBrainEnabled,
  transcribeAudio,
  type BrainAction,
  type BrainResult,
} from "./src/lib/assistantBrain";
import * as fs from "fs";
import * as crypto from "crypto";
import * as http from "http";

async function fetchYouTubeTitle(url: string): Promise<string> {
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    if (data && data.title) return data.title;
  } catch {}
  return "YouTube video";
}

function parseOrderDetails(input: string, todayISO: string, tomorrowISO: string): { title: string; clientName: string | null; amount: number; deadline: string | null } | null {
  // 1. Amount
  let amount = 0;
  const usdMatch = input.match(/(\d+(?:[.,]\d+)?)\s*(?:\$|dollar|usd)/i);
  if (usdMatch) {
    amount = parseFloat(usdMatch[1].replace(",", ".")) * 12800;
  } else {
    const sumMatch = input.match(/(\d+[\d\s.,]*)\s*(ming|mln|million)?\s*(?:so'?m|sum)?/i);
    if (sumMatch) {
      let num = parseFloat(sumMatch[1].replace(/[\s,]/g, ""));
      if (/ming/i.test(sumMatch[2] || "")) num *= 1000;
      if (/mln|million/i.test(sumMatch[2] || "")) num *= 1000000;
      if (num > 0) amount = num;
    }
  }

  // 2. Deadline
  let deadline: string | null = null;
  const monthNames: Record<string, string> = {
    yanvar: "01", fevral: "02", mart: "03", aprel: "04", may: "05", iyun: "06",
    iyul: "07", avgust: "08", sentabr: "09", oktyabr: "10", noyabr: "11", dekabr: "12",
  };
  const monthMatch = input.match(/(\d{1,2})[-. ]?(yanvar|fevral|mart|aprel|may|iyun|iyul|avgust|sentabr|oktyabr|noyabr|dekabr)/i);
  if (monthMatch) {
    const day = monthMatch[1].padStart(2, "0");
    const m = monthNames[monthMatch[2].toLowerCase()] || "10";
    const year = new Date().getFullYear();
    deadline = `${year}-${m}-${day}`;
  } else if (/ertag/i.test(input)) {
    deadline = tomorrowISO;
  } else if (/bugun/i.test(input)) {
    deadline = todayISO;
  }

  // 3. Client Name
  let clientName: string | null = null;
  const clientMatch = input.match(/(?:uchun|mijoz|ism|buyurtmachi|klient)\s+([A-ZА-ЯЁa-zа-яё']+)/i) ||
                      input.match(/([A-ZА-ЯЁ][a-zа-яё']+)\s+(?:uchun|ga)/i);
  if (clientMatch) {
    clientName = clientMatch[1].trim();
  }

  // 4. Title
  let title = input;
  title = title.replace(/(?:ish qiberish kerak|buyurtma|zakaz|mijoz|narxi|narx)/gi, "")
               .replace(/(\d+[\d\s.,]*)\s*(?:ming|mln|million)?\s*(?:so'?m|sum|\$|dollar|usd)?/gi, "")
               .replace(/(\d{1,2})[-. ]?(?:yanvar|fevral|mart|aprel|may|iyun|iyul|avgust|sentabr|oktyabr|noyabr|dekabr)(?:gacha|ga)?/gi, "")
               .replace(/(?:ertagacha|bugungacha|ertaga|bugun)/gi, "")
               .replace(/(?:uchun|ga|da|kerak|shunday qilish kerak|qilish kerak)/gi, "")
               .trim();
  if (clientName) title = title.replace(new RegExp(clientName, "gi"), "").trim();
  title = title.replace(/^[-:, ]+|[-:, ]+$/g, "");
  if (!title || title.length < 3) title = "Mijoz buyurtmasi";

  return { title, clientName, amount, deadline };
}

function getTashkentTimeString(): { timeStr: string; todayISO: string; tomorrowISO: string; minutes: number } {
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
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  const h = parseInt(get("hour"), 10) % 24;
  const m = parseInt(get("minute"), 10);
  const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const todayISO = `${get("year")}-${get("month")}-${get("day")}`;

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tParts = formatter.formatToParts(tomorrow);
  const tGet = (t: string) => tParts.find((p) => p.type === t)?.value || "00";
  const tomorrowISO = `${tGet("year")}-${tGet("month")}-${tGet("day")}`;

  return { timeStr, todayISO, tomorrowISO, minutes: h * 60 + m };
}

function fmt(n: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so'm";
}

function modPow(b: bigint, e: bigint, m: bigint): bigint {
  let res = BigInt(1);
  const zero = BigInt(0);
  const one = BigInt(1);
  const two = BigInt(2);
  b = b % m;
  while (e > zero) {
    if (e % two === one) res = (res * b) % m;
    e = e / two;
    b = (b * b) % m;
  }
  return res;
}

/**
 * Mavjud GramJS mijozi orqali uzilishsiz qo'ng'iroq chaqirish
 */
async function makeCallWithClient(client: TelegramClient, targetEntity: any, reason?: string) {
  try {
    const dh = (await client.invoke(
      new Api.messages.GetDhConfig({ version: 0, randomLength: 256 })
    )) as Api.messages.DhConfig;

    const p = BigInt("0x" + Buffer.from(dh.p).toString("hex"));
    const g = BigInt(dh.g);
    const aBytes = crypto.randomBytes(256);
    const a = BigInt("0x" + aBytes.toString("hex"));
    const g_a = modPow(g, a, p);

    let gAHex = g_a.toString(16);
    if (gAHex.length % 2 !== 0) gAHex = "0" + gAHex;
    const gABuffer = Buffer.from(gAHex, "hex");
    const gAHash = crypto.createHash("sha256").update(gABuffer).digest();

    await client.invoke(
      new Api.phone.RequestCall({
        userId: targetEntity,
        randomId: Math.floor(Math.random() * 10000000),
        gAHash: gAHash,
        protocol: new Api.PhoneCallProtocol({
          minLayer: 93,
          maxLayer: 93,
          udpP2p: true,
          udpReflector: true,
          libraryVersions: ["1.16.0"],
        }),
      })
    );
    console.log(`📲 [CALLER] Qo'ng'iroq muvaffaqiyatli amalga oshirildi: ${reason || ""}`);
  } catch (err) {
    console.error("makeCallWithClient xatolik:", err);
  }
}

async function sendVoiceNote(client: TelegramClient, peer: any, text: string) {
  try {
    const audioBuffer = await generateUzbekSpeechAudio(text);
    if (!audioBuffer) return;
    const tempFile = `temp_voice_${Date.now()}.mp3`;
    fs.writeFileSync(tempFile, audioBuffer);
    await client.sendFile(peer, {
      file: tempFile,
      voiceNote: true,
      caption: text.length > 200 ? text.slice(0, 197) + "..." : text,
    });
    try {
      fs.unlinkSync(tempFile);
    } catch {}
  } catch (err) {
    console.error("sendVoiceNote error:", err);
  }
}

async function transcribeWithGemini(audioBuffer: Buffer): Promise<string | null> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) return null;
  try {
    const base64Audio = audioBuffer.toString("base64");
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Sen o'zbek tilidagi audio xabarlarni aniq matnga aylantiruvchi yordamchisan. Ushbu ovozli xabarda nima deyilgan bo'lsa, aynan o'sha gaplarni o'zbek tilida yozib ber. Boshqa hech qanday ortiqcha so'z, izoh yoki belgi qo'shma.",
              },
              {
                inline_data: {
                  mime_type: "audio/ogg",
                  data: base64Audio,
                },
              },
            ],
          },
        ],
      }),
    });
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (e) {
    console.error("Gemini transcribe error:", e);
    return null;
  }
}

/* ───────────────────────── AI (Gemini) yordamchi funksiyalari ───────────────────────── */

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normTime(t?: string | null): string | undefined {
  if (!t) return undefined;
  const m = t.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return undefined;
  const v = `${m[1].padStart(2, "0")}:${m[2]}`;
  return TIME_RE.test(v) ? v : undefined;
}

function pickDate(d: string | null | undefined, todayISO: string, tomorrowISO: string): string {
  if (d && ISO_RE.test(d)) return d;
  const { minutes } = getTashkentTimeString();
  return minutes >= 20 * 60 ? tomorrowISO : todayISO;
}

function dayName(date: string, todayISO: string, tomorrowISO: string): string {
  if (date === todayISO) return "Bugungi";
  if (date === tomorrowISO) return "Ertangi";
  return date;
}

async function buildPlansMessage(date: string, todayISO: string, tomorrowISO: string): Promise<string> {
  const [dayTasks, dayRoutines] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.date, date)).orderBy(asc(tasks.id)),
    db
      .select()
      .from(routines)
      .where(or(isNull(routines.targetDate), eq(routines.targetDate, date)))
      .orderBy(asc(routines.time)),
  ]);
  const routineTitles = new Set(dayRoutines.map((r) => r.title.trim().toLowerCase()));
  const otherTasks = dayTasks.filter((t) => !routineTitles.has(t.title.trim().toLowerCase()));
  const label = dayName(date, todayISO, tomorrowISO);
  const total = dayRoutines.length + otherTasks.length;
  if (total === 0) return `📋 ${label} kun (${date}) uchun hali reja yo'q.`;

  const lines: string[] = [];
  if (dayRoutines.length) {
    lines.push("⏰ <b>Vaqtli rejalar:</b>");
    for (const r of dayRoutines) {
      const done = r.lastDoneDate && String(r.lastDoneDate).slice(0, 10) === date;
      lines.push(`${done ? "✅" : "⬜"} <b>${r.time}</b> — ${escapeHtml(r.title)}${r.targetDate ? "" : " <i>(har kuni)</i>"}`);
    }
  }
  if (otherTasks.length) {
    if (lines.length) lines.push("");
    lines.push("📋 <b>Vazifalar:</b>");
    for (const t of otherTasks) lines.push(`${t.completed ? "✅" : "⬜"} ${escapeHtml(t.title)}`);
  }
  return `📅 <b>${label} rejalar — ${date} (${total} ta):</b>\n\n${lines.join("\n")}`;
}

async function buildTodayPlansContext(todayISO: string): Promise<string> {
  try {
    const [dayTasks, dayRoutines] = await Promise.all([
      db.select().from(tasks).where(eq(tasks.date, todayISO)),
      db.select().from(routines).where(or(isNull(routines.targetDate), eq(routines.targetDate, todayISO))),
    ]);
    const lines = [
      ...dayRoutines.map((r) => `- ${r.time} ${r.title}`),
      ...dayTasks
        .filter((t) => !dayRoutines.some((r) => r.title === t.title))
        .map((t) => `- ${t.title}${t.completed ? " (bajarilgan)" : ""}`),
    ];
    return lines.slice(0, 30).join("\n");
  } catch {
    return "";
  }
}

async function buildBalanceMessage(): Promise<string> {
  const allCards = await db.select().from(cards).where(eq(cards.archived, false));
  if (!allCards.length) return "💳 Hozircha hech qanday karta kiritilmagan.";
  let total = 0;
  const lines: string[] = [];
  for (const c of allCards) {
    const bal = c.type === "primary" ? await getCardAvailableBalance(c.id) : Number(c.balance);
    total += bal;
    lines.push(`• <b>${escapeHtml(c.name)}</b> (${c.type === "primary" ? "Asosiy" : "Qo'shimcha"}): ${fmt(bal)}`);
  }
  return `💳 <b>Kartalaringiz:</b>\n\n${lines.join("\n")}\n\n💰 <b>Jami:</b> <b>${fmt(total)}</b>`;
}

/**
 * Gemini qaytargan actionlarni bajaradi va natijani bitta tartibli xabar qilib yuboradi.
 */
async function handleBrainResult(
  client: TelegramClient,
  peer: any,
  callTarget: any,
  result: BrainResult,
  todayISO: string,
  tomorrowISO: string
) {
  const sections: string[] = [];
  let wantsCall = false;

  // 1) Rejalarni sana bo'yicha guruhlab saqlaymiz
  const planActions = result.actions.filter((a) => a.type === "add_plan" && a.title?.trim());
  const byDate = new Map<string, { time?: string; title: string; isRoutine: boolean }[]>();
  for (const a of planActions) {
    const date = pickDate(a.date, todayISO, tomorrowISO);
    const time = normTime(a.time);
    const title = a.title!.trim().slice(0, 250);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push({ time, title, isRoutine: Boolean(time) });
  }
  for (const [date, plans] of byDate) {
    plans.sort((x, y) => (x.time || "99:99").localeCompare(y.time || "99:99"));
    await saveParsedPlansToDb(plans, date);
    const lines = plans.map((p, i) => `${i + 1}. ${p.time ? `⏰ <b>${p.time}</b> — ` : ""}${escapeHtml(p.title)}`);
    sections.push(`📝 <b>${dayName(date, todayISO, tomorrowISO)} kunga qo'shildi (${date}):</b>\n${lines.join("\n")}`);
  }

  // 2) Qolgan actionlar
  for (const a of result.actions) {
    try {
      switch (a.type) {
        case "list_plans": {
          sections.push(await buildPlansMessage(pickDate(a.date, todayISO, tomorrowISO), todayISO, tomorrowISO));
          break;
        }
        case "complete_plan": {
          if (!a.title?.trim()) break;
          const date = pickDate(a.date, todayISO, tomorrowISO);
          const pattern = `%${a.title.trim().split(/\s+/).slice(0, 2).join("%")}%`;
          const doneTasks = await db
            .update(tasks)
            .set({ completed: true })
            .where(and(eq(tasks.date, date), ilike(tasks.title, pattern)))
            .returning({ id: tasks.id });
          const doneRoutines = await db
            .update(routines)
            .set({ lastDoneDate: date })
            .where(and(or(isNull(routines.targetDate), eq(routines.targetDate, date)), ilike(routines.title, pattern)))
            .returning({ id: routines.id });
          sections.push(
            doneTasks.length || doneRoutines.length
              ? `✅ <b>Bajarildi deb belgilandi:</b> ${escapeHtml(a.title)}`
              : `🤔 "${escapeHtml(a.title)}" degan reja topilmadi.`
          );
          break;
        }
        case "clear_plans": {
          const date = pickDate(a.date, todayISO, tomorrowISO);
          const delT = await db.delete(tasks).where(eq(tasks.date, date)).returning({ id: tasks.id });
          const delR = await db.delete(routines).where(eq(routines.targetDate, date)).returning({ id: routines.id });
          sections.push(`🗑 ${dayName(date, todayISO, tomorrowISO)} kun (${date}) rejalari o'chirildi: ${Math.max(delT.length, delR.length)} ta.`);
          break;
        }
        case "call":
          wantsCall = true;
          break;
        case "add_order": {
          const amount = Number(a.amount) || 0;
          const deadline = a.deadline && ISO_RE.test(a.deadline) ? a.deadline : null;
          const title = a.title?.trim() || "Mijoz buyurtmasi";
          await db.insert(orders).values({
            title: title.slice(0, 250),
            clientName: a.client_name?.trim() || null,
            amount: String(amount),
            deadline,
            stage: "new",
            paymentType: "cash",
          });
          sections.push(
            `💼 <b>Buyurtma saqlandi:</b>\n👤 Mijoz: ${escapeHtml(a.client_name || "ko'rsatilmagan")}\n📌 Ish: ${escapeHtml(title)}\n💰 Narxi: ${fmt(amount)}${deadline ? `\n📅 Muddat: ${deadline}` : ""}`
          );
          break;
        }
        case "add_expense":
        case "add_income": {
          const amount = Number(a.amount) || 0;
          if (amount <= 0) break;
          const title = (a.title?.trim() || (a.type === "add_expense" ? "Xarajat" : "Daromad")).slice(0, 250);
          const date = a.date && ISO_RE.test(a.date) ? a.date : todayISO;
          if (a.type === "add_expense") {
            await db.insert(expenses).values({ title, amount: String(amount), date, category: "other" });
            sections.push(`💸 <b>Chiqim:</b> ${fmt(amount)} — ${escapeHtml(title)}`);
          } else {
            await db.insert(incomes).values({ title, amount: String(amount), date, source: "other" });
            sections.push(`💰 <b>Kirim:</b> ${fmt(amount)} — ${escapeHtml(title)}`);
          }
          break;
        }
        case "balance":
          sections.push(await buildBalanceMessage());
          break;
        case "set_wake": {
          const wt = normTime(a.time);
          if (!wt) break;
          await db
            .insert(settings)
            .values({ key: "wake_time", value: wt })
            .onConflictDoUpdate({ target: settings.key, set: { value: wt } });
          sections.push(`⏰ Uyg'onish vaqti: <b>${wt}</b>. Shu vaqtda telefon qilaman.`);
          break;
        }
        case "save_video": {
          if (!a.url) break;
          const url = a.url.startsWith("http") ? a.url : `https://${a.url}`;
          const idMatch = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{6,})/);
          const videoTitle = await fetchYouTubeTitle(url);
          const date = pickDate(a.date, todayISO, tomorrowISO);
          await db.insert(videos).values({
            title: videoTitle.slice(0, 250),
            url,
            videoId: idMatch?.[1] || "",
            category: "other",
            watched: false,
          });
          await db.insert(tasks).values({ title: `🎬 Video ko'rish: ${videoTitle}`.slice(0, 250), date, category: "development" });
          sections.push(`🎬 <b>Video saqlandi:</b> ${escapeHtml(videoTitle)}\n⏰ ${dayName(date, todayISO, tomorrowISO)} kun (${date}) bo'sh vaqtga qo'shildi.`);
          break;
        }
      }
    } catch (err) {
      console.error(`Action xatolik (${a.type}):`, err);
      sections.push(`⚠️ "${a.type}" amalini bajarishda xatolik bo'ldi.`);
    }
  }

  const text = [escapeHtml(result.reply.trim()), ...sections].filter(Boolean).join("\n\n");
  if (text) await client.sendMessage(peer, { message: text, parseMode: "html" });
  if (result.reply.trim()) void sendVoiceNote(client, peer, result.reply.trim());
  if (wantsCall) await makeCallWithClient(client, callTarget, "Foydalanuvchi so'ragan qo'ng'iroq");
}

async function runWorker() {
  const target = process.env.TELEGRAM_TARGET_USER || "@sulaymonovss";

  console.log("==========================================================");
  console.log("🤖 FLOWDESK PROFIL YORDAMCHISI (USERBOT AI ASSISTANT)");
  console.log(`🎯 Aloqa profilingiz: ${target}`);
  console.log("==========================================================\n");

  const port = process.env.PORT;
  if (port) {
    const healthServer = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("FlowDesk Telegram Userbot Assistant is running 24/7\n");
    });
    healthServer.listen(parseInt(port, 10), "0.0.0.0", () => {
      console.log(`🌐 Web/Healthcheck server listening on 0.0.0.0:${port}`);
    });
  }

  const apiIdStr = process.env.TELEGRAM_CALLER_API_ID;
  const apiHash = process.env.TELEGRAM_CALLER_API_HASH;
  const sessionStr = process.env.TELEGRAM_CALLER_SESSION;

  if (!apiIdStr || !apiHash || !sessionStr) {
    console.error("❌ Xatolik: .env.local da TELEGRAM_CALLER ma'lumotlari to'liq emas!");
    process.exit(1);
  }

  const apiId = parseInt(apiIdStr, 10);
  const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
    connectionRetries: 10,
    autoReconnect: true,
  });

  console.log("📲 Telegramga ulanilmoqda...");
  await client.connect();

  const me = await client.getMe();
  console.log(`✅ Ulandi: ${me.firstName} (@${me.username || "profil"})`);
  console.log("👂 Sizdan xabar va ovozlar kutilmoqda...\n");

  const entity = await client.getInputEntity(target);

  // 1. INCOMING MESSAGES (Ovozli va matnli xabarlarni eshitish va javob berish)
  client.addEventHandler(async (event) => {
    try {
      const msg = event.message;
      if (!msg || msg.out) return;

      let receivedText = msg.text || msg.message || "";
      let isVoice = false;

      // Agar ovozli xabar bo'lsa
      if (msg.voice || msg.audio) {
        isVoice = true;
        console.log("🎙️ Foydalanuvchidan ovozli xabar keldi...");
        try {
          const mediaBuffer = await client.downloadMedia(msg);
          if (mediaBuffer && Buffer.isBuffer(mediaBuffer)) {
            const transcribed = await transcribeWithGemini(mediaBuffer);
            if (transcribed) {
              console.log(`🗣️ Transkripsiya (Gemini): "${transcribed}"`);
              receivedText = transcribed;
            }
          }
        } catch (err) {
          console.error("Ovozni yuklab olishda xatolik:", err);
        }
      }

      const clean = receivedText.trim();
      const replyPeer = entity;

      if (!clean) {
        if (isVoice) {
          const replyText = "🎙️ Ovozli xabaringiz qabul qilindi, lekin ovozni aniqlab bo'lmadi. Iltimos, rejalaringizni aniqroq ayting yoki matn qilib yozing!";
          await client.sendMessage(replyPeer, { message: replyText });
          sendVoiceNote(client, replyPeer, replyText).catch(() => {});
        }
        return;
      }

      console.log(`📥 Kelgan xabar: "${clean}"`);

      // Foydalanuvchi javob yozdi -> bugungi uyg'onish holatini qayd etamiz
      const { todayISO, tomorrowISO } = getTashkentTimeString();
      try {
        const [existingSleep] = await db.select().from(sleepLogs).where(eq(sleepLogs.date, todayISO)).limit(1);
        if (existingSleep && !existingSleep.actualWake) {
          await db.update(sleepLogs).set({ actualWake: getTashkentTimeString().timeStr }).where(eq(sleepLogs.id, existingSleep.id));
        }
      } catch {}

      const q = clean.toLowerCase();

      // A) Qo'ng'iroq qilish buyrug'i ("tel qil", "telefon qil", "qo'ng'iroq qil", "manga tel qil")
      if (/(tel\s*qil|telefon\s*qil|qo'?ng'?iroq\s*qil|chaqir|manga\s*tel|menga\s*tel)/i.test(q)) {
        console.log("📲 Foydalanuvchi qo'ng'iroq so'radi...");
        await client.sendMessage(replyPeer, { message: "📲 Hozir telefon qilaman, Sohibjon..." });
        await makeCallWithClient(client, entity, "Foydalanuvchi so'ragan qo'ng'iroq");
        sendVoiceNote(client, replyPeer, "Hozir telefon qilmoqdaman, Sohibjon!").catch(() => {});
        return;
      }

      // A.1) Minnatdorchilik ("raxmat", "rahmat", "katta rahmat", "spasibo", "tashakkur")
      if (/(rahmat|raxmat|tashakkur|barakalla|katta rahmat|spasibo|gap yo'?q|zo'?r)/i.test(q)) {
        console.log("🙏 Minnatdorchilik qabul qilindi...");
        const reply = "Arzimaydi, Sohibjon! 😊 Sizga yordam berishdan doim mamnunman. Biror reja yoki savolingiz bo'lsa bemalol aytavering!";
        await client.sendMessage(replyPeer, { message: reply });
        sendVoiceNote(client, replyPeer, "Arzimaydi Sohibjon! Sizga yordam berishdan doim xursandman.").catch(() => {});
        return;
      }

      // A.2) Aloqa tekshiruvi, nuqta yoki qisqa tasdiq (".", "..", "alo", "ha", "ok", "shu yerdamisan")
      if (
        /^(\.|\.\.|\.\.\.|alo|qani|ok|hop|xo'?p|ha|ha bo'?ldi|yaxshi|tushundim)$/i.test(q) ||
        /(shu yerdamisan|ishlayapsanmi|eshtyapsanmi|eshityapsanmi|nima gap)/i.test(q)
      ) {
        console.log("💬 Muloqot / tekshiruv qabul qilindi...");
        const reply = "Eshitaman Sohibjon! Men 24/7 siz bilanmanki, buyrug'ingizga tayyorman. Biror vazifa belgilaymizmi yoki telefon qilaymi? 😊";
        await client.sendMessage(replyPeer, { message: reply });
        sendVoiceNote(client, replyPeer, "Eshitaman Sohibjon, men tayyorman! Qanday yordam bera olaman?").catch(() => {});
        return;
      }

      // A.25) Reja yoki vazifani o'chirish ("ob tashla", "ochir", "bularni ob tashla", "schoolga borishni ob tashla")
      if (/(?:o'?chir|ob\s*tashla|olib\s*tashla|bekor\s*qil|tozala|tozalab\s*tashla)/i.test(q)) {
        console.log("🗑️ Rejani o'chirish so'raldi...");
        const isAll = /(barcha|hamma|barchasini|hammasini|bularni|bular|hammasi|tozala|kerakmas|kerak\s*emas)/i.test(q) ||
                      /^(\s*o'?chir\s*|\s*ob\s*tashla\s*|\s*olib\s*tashla\s*|\s*o'?chirib\s*tashla\s*)$/i.test(clean);

        if (isAll) {
          await db.delete(tasks).where(eq(tasks.date, todayISO));
          await db.delete(routines).where(eq(routines.targetDate, todayISO));
          const rep = "🗑️ Tushundim Sohibjon! Bugungi barcha rejalarni o'chirib tashladim, ro'yxatingiz top-toza bo'ldi. Yangi reja tuzamizmi? 😊";
          await client.sendMessage(replyPeer, { message: rep });
          sendVoiceNote(client, replyPeer, "Tushundim Sohibjon! Bugungi barcha rejalarni o'chirib tashladim.").catch(() => {});
          return;
        }

        // Qaysi aniq vazifani o'chirish kerakligini aniqlash
        let targetWord = clean
          .replace(/(?:o'?chirib\s*tashla|ob\s*tashla|olib\s*tashla|o'?chir|bekor\s*qil|tashla)/gi, "")
          .replace(/(?:vazifasini|rejasini|vazifani|rejani|ishni)/gi, "")
          .replace(/(?:bugungi|ertangi|iltimos|menga|manga|shuni)/gi, "")
          .replace(/(?:ni|di)$/gi, "")
          .trim();

        if (targetWord.length >= 2) {
          const pattern = `%${targetWord.replace(/['`]/g, "")}%`;
          const delT = await db.delete(tasks).where(ilike(tasks.title, pattern)).returning({ id: tasks.id });
          const delR = await db.delete(routines).where(ilike(routines.title, pattern)).returning({ id: routines.id });

          if (delT.length || delR.length) {
            const rep = `🗑️ Tushundim Sohibjon! <b>"${targetWord}"</b> rejangizni ro'yxatdan o'chirib tashladim.`;
            await client.sendMessage(replyPeer, { message: rep, parseMode: "html" });
            sendVoiceNote(client, replyPeer, `${targetWord} rejasini o'chirib tashladim.`).catch(() => {});
            return;
          } else {
            const rep = `🤔 Sohibjon, ro'yxatdan "${targetWord}" degan reja topilmadi. "Rejalar qanday" deb yozsangiz hozirgi rejalarni ko'rib olasiz!`;
            await client.sendMessage(replyPeer, { message: rep });
            sendVoiceNote(client, replyPeer, `Ro'yxatdan ${targetWord} degan reja topilmadi Sohibjon.`).catch(() => {});
            return;
          }
        } else {
          // Aniq biror so'z aytilmagan bo'lsa -> hammasini tozalash
          await db.delete(tasks).where(eq(tasks.date, todayISO));
          await db.delete(routines).where(eq(routines.targetDate, todayISO));
          const rep = "🗑️ Tushundim Sohibjon! Bugungi rejalarni tozalab tashladim. Qanday yangi rejalaringiz bor?";
          await client.sendMessage(replyPeer, { message: rep });
          sendVoiceNote(client, replyPeer, "Bugungi rejalarni tozalab tashladim Sohibjon.").catch(() => {});
          return;
        }
      }

    // A.3) YouTube Video havolasi
    const ytMatch = clean.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/i);
    if (ytMatch) {
      console.log("🎬 YouTube video aniqlandi...");
      const videoId = ytMatch[1];
      const fullUrl = ytMatch[0].startsWith("http") ? ytMatch[0] : `https://${ytMatch[0]}`;
      const videoTitle = await fetchYouTubeTitle(fullUrl);

      const tashkentMinutes = getTashkentTimeString().minutes;
      const tashkentH = Math.floor(tashkentMinutes / 60);
      const isTomorrowPreferred = /(ertag|ertangi)/i.test(q) || tashkentH >= 20;
      const targetDate = isTomorrowPreferred ? tomorrowISO : todayISO;
      const dateLabel = isTomorrowPreferred ? "Ertangi kun" : "Bugungi kun";

      try {
        await db.insert(videos).values({
          title: videoTitle,
          url: fullUrl,
          videoId,
          category: "other",
          watched: false,
        });

        await db.insert(tasks).values({
          title: `🎬 Video ko'rish: ${videoTitle}`,
          date: targetDate,
          category: "development",
        });

        const reply = `🎬 <b>YouTube video Rivojlanishga saqlandi!</b>\n\n📌 <b>${videoTitle}</b>\n🔗 <a href="${fullUrl}">Videoni ochish</a>\n\n⏰ <b>Rejaga qo'shildi:</b> ${dateLabel} (<b>${targetDate}</b>) bo'sh vaqtingizga kiritildi! 🚀`;
        await client.sendMessage(replyPeer, { message: reply, parseMode: "html" });
        void sendVoiceNote(client, replyPeer, `Sohibjon, YouTube videoni saqlab qo'ydim. Uni ${dateLabel.toLowerCase()} bo'sh vaqtingizda ko'rish uchun rejalarga qo'shdim.`);
      } catch (e) {
        console.error("Video saqlash xatoligi:", e);
      }
      return;
    }

    // A.4) Buyurtma / Mijoz ishlari
    if (/(buyurtma|zakaz|mijoz|ish qiberish|proyekt|klient|uchun logo|uchun sayt|uchun dizayn)/i.test(q) && /(narx|so'?m|\$|dollar|ming|sum|mln|gacha|deadline|\d)/i.test(q)) {
      console.log("💼 Yangi buyurtma aniqlandi...");
      const order = parseOrderDetails(clean, todayISO, tomorrowISO);
      if (order && (order.amount > 0 || order.clientName)) {
        try {
          await db.insert(orders).values({
            title: order.title,
            clientName: order.clientName,
            amount: String(order.amount),
            deadline: order.deadline,
            stage: "new",
            paymentType: "cash",
            description: clean,
          });

          const reply = `💼 <b>Yangi buyurtma qabul qilindi va saqlandi!</b>\n\n👤 <b>Mijoz:</b> ${order.clientName || "Ko'rsatilmagan"}\n📌 <b>Buyurtma:</b> ${order.title}\n💰 <b>Narxi:</b> ${fmt(order.amount)}${order.deadline ? `\n📅 <b>Muddati (Deadline):</b> ${order.deadline}` : ""}\n\nDashboard Buyurtmalar bo'limida ko'rishingiz mumkin! 🚀`;
          await client.sendMessage(replyPeer, { message: reply, parseMode: "html" });
          void sendVoiceNote(client, replyPeer, `Tushundim Sohibjon! Yangi buyurtmani tizimga saqlab qo'ydim.`);
          return;
        } catch (e) {
          console.error("Buyurtma saqlash xatoligi:", e);
        }
      }
    }

    // A.5) Chiqim qo'shish ("Chiqim 50000 tushlik", "Tushlikka 30000 ketdi")
    const expenseMatch = clean.match(/(?:chiqim|harajat|xarajat)\s*(\d[\d\s.,]*)\s*(?:so'?m|sum)?\s*(.*)/i) ||
                         clean.match(/(\d[\d\s.,]*)\s*(?:so'?m|sum)?\s*(?:tushlik|taksi|bozor|yo'?lkira|ovqat|choyxona|kafe|benzin|dorixona|aptek)/i);
    if (expenseMatch) {
      const amtStr = expenseMatch[1].replace(/[\s,]/g, "");
      let amt = parseFloat(amtStr);
      if (/ming/i.test(clean)) amt *= 1000;
      if (amt > 0) {
        const desc = expenseMatch[2]?.trim() || clean.replace(/\d+/g, "").trim() || "Xarajat";
        try {
          await db.insert(expenses).values({
            title: desc,
            amount: String(amt),
            date: todayISO,
            category: "other",
          });
          const reply = `💸 <b>Chiqim saqlandi:</b> ${fmt(amt)}\n📝 <b>Izoh:</b> ${desc}`;
          await client.sendMessage(replyPeer, { message: reply, parseMode: "html" });
          void sendVoiceNote(client, replyPeer, `${fmt(amt)} chiqim bazaga kiritildi.`);
          return;
        } catch (e) {
          console.error("Chiqim saqlash xatoligi:", e);
        }
      }
    }

    // A.6) Kirim qo'shish ("Kirim 1000000 oylik", "Oylik tushdi 2000000")
    const incomeMatch = clean.match(/(?:kirim|daromad|foyda|tushum)\s*(\d[\d\s.,]*)\s*(?:so'?m|sum)?\s*(.*)/i);
    if (incomeMatch) {
      const amtStr = incomeMatch[1].replace(/[\s,]/g, "");
      let amt = parseFloat(amtStr);
      if (/ming/i.test(clean)) amt *= 1000;
      if (amt > 0) {
        const desc = incomeMatch[2]?.trim() || "Daromad";
        try {
          await db.insert(incomes).values({
            title: desc,
            amount: String(amt),
            date: todayISO,
            source: "other",
          });
          const reply = `💰 <b>Kirim saqlandi:</b> ${fmt(amt)}\n📝 <b>Izoh:</b> ${desc}`;
          await client.sendMessage(replyPeer, { message: reply, parseMode: "html" });
          void sendVoiceNote(client, replyPeer, `${fmt(amt)} daromad qabul qilindi.`);
          return;
        } catch (e) {
          console.error("Kirim saqlash xatoligi:", e);
        }
      }
    }

    // B) Uyg'onish vaqtini o'zgartirish ("5:30 da turishim kerak", "soat 6 da uyg'ot")
    const wakeMatch =
      clean.match(/(\b[0-2]?[0-9][:.]?[0-5][0-9]\b)\s*(?:da|gacha)?\s*(?:turish|uygon|uyg'on)/i) ||
      clean.match(/(?:turish|uygon|uyg'on)\S*\s*(?:vaqti\s*)?(\b[0-2]?[0-9][:.]?[0-5][0-9]\b)/i) ||
      clean.match(/(?:soat\s*)?(\b[0-2]?[0-9][:.]?[0-5][0-9]\b)\s*(?:da|gacha)?\s*(?:uyg'ot|uygot)/i);

    if (wakeMatch) {
      let wt = wakeMatch[1].replace(".", ":");
      if (!wt.includes(":")) wt = `${wt.padStart(2, "0")}:00`;
      else {
        const [h, m] = wt.split(":");
        wt = `${h.padStart(2, "0")}:${(m || "00").padStart(2, "0")}`;
      }
      console.log(`⏰ Uyg'onish vaqti yangilandi: ${wt}`);
      await db.insert(settings).values({ key: "wake_time", value: wt }).onConflictDoUpdate({ target: settings.key, set: { value: wt } });
      const wakeReply = `⏰ Tushundim Sohibjon! Uyg'onish vaqti soat <b>${wt}</b> ga belgilandi. Shu vaqtda o'zim sizga telefon qilaman va uyg'otaman! 🚀`;
      await client.sendMessage(replyPeer, { message: wakeReply, parseMode: "html" });
      void sendVoiceNote(client, replyPeer, `Tushundim Sohibjon! Uyg'onish vaqtini soat ${wt} ga belgilab qo'ydim.`);
      return;
    }

    // C) Bugungi kunga o'zgartirish yoki tuzatish
    if (/(ozgartir|o'zgartir|bugunga otkaz|bugunga o'tkaz|bugungi kunga)/i.test(q)) {
      console.log("🔄 Oxirgi vazifalarni bugungi kunga o'tkazish...");
      const recentTasks = await db.select().from(tasks).orderBy(desc(tasks.id)).limit(5);
      for (const t of recentTasks) {
        await db.update(tasks).set({ date: todayISO }).where(eq(tasks.id, t.id));
      }
      const reply = `✅ Oxirgi kiritilgan vazifalar bugungi kun (<b>${todayISO}</b>) ga o'zgartirildi!`;
      await client.sendMessage(replyPeer, { message: reply, parseMode: "html" });
      void sendVoiceNote(client, replyPeer, "Barcha kiritilgan vazifalar bugungi kunga o'tkazildi Sohibjon!");
      return;
    }

    // D) Salomlashish yoki umumiy murojaat
    if (/(salom|assalom|alo|qalaysan|qandaysan|tuzikmisan|qalesiz)/i.test(q)) {
      console.log("👋 Salomlashish qabul qilindi...");
      const greeting = `👋 <b>Assalomu alaykum Sohibjon!</b>\n\nMen sizning shaxsiy yordamchingizman. Menga bemalol:\n• Rejalaringizni ayting (masalan: <i>"Bugun soat 18:00 da kitob o'qish"</i>);\n• "Kartada qancha pul bor?" deb so'rang;\n• "Nimalar bor?" deb vazifalaringizni so'rang;\n• "5:30 da turishim kerak" deb uyg'onish vaqtini ayting!\n\nVaqti kelganda esa o'zim sizga telefon qilib eslataman!`;
      await client.sendMessage(replyPeer, { message: greeting, parseMode: "html" });
      void sendVoiceNote(client, replyPeer, "Assalomu alaykum Sohibjon! Eshitaman, sizga qanday yordam bera olaman?");
      return;
    }

    // E) Karta / Pul / Balans savollari
    if (/(karta|pul|balans|moliya|hisob|hisobimda|qancha pul|qancha bor)/i.test(q)) {
      console.log("💳 Karta balansi so'raldi...");
      const allCards = await db.select().from(cards).where(eq(cards.archived, false));
      if (allCards.length === 0) {
        const textReply = "💳 Hozircha hech qanday karta kiritilmagan.";
        await client.sendMessage(replyPeer, { message: textReply });
        void sendVoiceNote(client, replyPeer, "Sohibjon, platformada hozircha birorta ham karta mavjud emas.");
        return;
      }
      let total = 0;
      const lines: string[] = [];
      for (const c of allCards) {
        const bal = c.type === "primary" ? await getCardAvailableBalance(c.id) : Number(c.balance);
        total += bal;
        lines.push(`• <b>${c.name}</b> (${c.type === "primary" ? "Asosiy" : "Qo'shimcha"}): ${fmt(bal)}`);
      }
      const textReply = `💳 <b>Sizning kartalaringiz:</b>\n\n${lines.join("\n")}\n\n💰 <b>Jami balans:</b> <b>${fmt(total)}</b>`;
      await client.sendMessage(replyPeer, { message: textReply, parseMode: "html" });
      void sendVoiceNote(client, replyPeer, `Sohibjon, barcha kartalaringizdagi jami balans ${fmt(total)} so'mni tashkil qilmoqda.`);
      return;
    }

    // F) Vazifalar / Rejalar / Ishlar ro'yxati savoli ("rejalar qanday", "bugun nimalar bor", "ertangi rejalar")
    const wordCount = q.split(/\s+/).filter(Boolean).length;
    const hasPlanTopic = /(reja|vazifa|ishlar|ishim|eslat|nima\s*(bor|ish|qilish)|nimalar|ro'?yxat|jadval|kun\s*tartib)/i.test(q);
    const hasAskWord = /(qanday|qanaqa|qaysi|nima|bor\b|bormi|ko'?rsat|korsat|ayt|jo'?nat|jonat|yubor|tashla|\?|qani|kerak)/i.test(q);
    if (hasPlanTopic && (hasAskWord || wordCount <= 3) && !/\d/.test(q)) {
      console.log("📋 Rejalar ro'yxati so'raldi...");
      const isTomorrow = /(ertag|ertangi)/i.test(q);
      const targetDate = isTomorrow ? tomorrowISO : todayISO;
      const dayLabel = isTomorrow ? "Ertangi" : "Bugungi";

      const [dayTasks, dayRoutines] = await Promise.all([
        db.select().from(tasks).where(eq(tasks.date, targetDate)).orderBy(asc(tasks.id)),
        db.select().from(routines).where(sql`${routines.targetDate} IS NULL OR ${routines.targetDate} = ${targetDate}`).orderBy(asc(routines.time)),
      ]);

      // Vaqtli rejalar tasks jadvalida ham bor — takrorlanmasligi uchun ajratamiz
      const routineTitles = new Set(dayRoutines.map((r) => r.title.trim().toLowerCase()));
      const otherTasks = dayTasks.filter((t) => !routineTitles.has(t.title.trim().toLowerCase()));

      const totalCount = dayRoutines.length + otherTasks.length;
      if (totalCount === 0) {
        const reply = `📋 ${dayLabel} kun (${targetDate}) uchun hali hech qanday reja yo'q. Rejalaringizni aytib bering, yozib qo'yaman! 😊`;
        await client.sendMessage(replyPeer, { message: reply });
        void sendVoiceNote(client, replyPeer, `Sohibjon, ${dayLabel.toLowerCase()} kun uchun hali reja yo'q.`);
        return;
      }

      const lines: string[] = [];
      if (dayRoutines.length > 0) {
        lines.push("⏰ <b>Vaqtli rejalar:</b>");
        dayRoutines.forEach((r) => {
          const done = r.lastDoneDate && String(r.lastDoneDate).slice(0, 10) === targetDate;
          lines.push(`${done ? "✅" : "⬜"} <b>${r.time}</b> — ${r.title}${r.targetDate ? "" : " <i>(har kuni)</i>"}`);
        });
      }
      if (otherTasks.length > 0) {
        if (lines.length > 0) lines.push("");
        lines.push("📋 <b>Vazifalar:</b>");
        otherTasks.forEach((t) => {
          lines.push(`${t.completed ? "✅" : "⬜"} ${t.title}`);
        });
      }

      const textReply = `📅 <b>${dayLabel} rejalaringiz — ${targetDate} (${totalCount} ta):</b>\n\n${lines.join("\n")}`;
      await client.sendMessage(replyPeer, { message: textReply, parseMode: "html" });
      void sendVoiceNote(client, replyPeer, `Sohibjon, ${dayLabel.toLowerCase()} kunga ${totalCount} ta reja bor. Hammasini chatga yubordim.`);
      return;
    }

    // G) Rejalarni saqlash (Erkin aytilgan yoki yozilgan rejalar)
    const tashkentHour = Math.floor(getTashkentTimeString().minutes / 60);
    const { dateType } = detectPlanDate(clean, tashkentHour);
    const isToday = dateType === "today";
    const targetDate = isToday ? todayISO : tomorrowISO;
    const dateLabel = isToday ? "Bugungi kun" : "Ertangi kun";

    const plans = parseSpokenPlans(clean);
    if (plans.length > 0) {
      console.log(`💾 Aniqlangan vazifalar: ${plans.length} ta (${dateLabel}: ${targetDate}). Bazaga saqlanmoqda...`);
      const { savedTasks, savedRoutines } = await saveParsedPlansToDb(plans, targetDate);

      let reportMsg = `✅ <b>Qabul qilindi Sohibjon!</b>\n\n${dateLabel} (<b>${targetDate}</b>) uchun saqlandi:\n\n`;
      plans.forEach((p, i) => {
        reportMsg += `${i + 1}. ${p.time ? `⏰ <b>${p.time}</b> — ` : ""}${p.title}\n`;
      });
      reportMsg += `\n📊 ${savedTasks} ta vazifa, ${savedRoutines} ta intizom rejasi kiritildi. Vaqti kelganda o'zim telefon qilib eslatib turaman! 🚀`;

      await client.sendMessage(replyPeer, { message: reportMsg, parseMode: "html" });
      void sendVoiceNote(client, replyPeer, `Tushundim Sohibjon! ${savedTasks} ta vazifani ${dateLabel.toLowerCase()} uchun platformaga yozib qo'ydim.`);
      return;
    }

    // Noma'lum xabar bo'lsa
    const fallback = `Eshitdim Sohibjon! 😊 Agar bu yangi rejangiz bo'lsa (masalan: <i>"Bugun 18:00 da kitob o'qish"</i>), aytib yuborsangiz saqlab qo'yaman. Qo'ng'iroq qilishimni xohlasangiz <i>"Tel qil"</i> deb yozing! 🚀`;
    await client.sendMessage(replyPeer, { message: fallback, parseMode: "html" });
    } catch (handlerErr) {
      console.error("❌ Xabarni qayta ishlashda xatolik:", handlerErr);
      try {
        await client.sendMessage(entity, { message: "⚠️ Kechirasiz Sohibjon, kichik xatolik bo'ldi. Iltimos, qaytadan yozib yuboring." });
      } catch {}
    }
  }, new NewMessage({ incoming: true }));

  // 2. BACKGROUND ALARM & REMINDER LOOP (Har 30 soniyada tekshirish)
  console.log("⏰ Ogohlantirish va uyg'otish vaqtlari tekshiruvi ishga tushdi...");

  let lastWakeCallMinute = -1;
  let lastSleepCallMinute = -1;
  const calledRoutinesToday = new Set<string>();

  setInterval(async () => {
    try {
      const { timeStr, todayISO, tomorrowISO, minutes } = getTashkentTimeString();

      // Baza sozlamalarini o'qish
      const settingsRows = await db.select().from(settings);
      const settingsMap: Record<string, string> = {};
      for (const r of settingsRows) settingsMap[r.key] = r.value ?? "";

      const wakeTime = settingsMap.wake_time || "04:30";
      const sleepTime = settingsMap.sleep_time || "21:40";

      const [wh, wm] = wakeTime.split(":").map(Number);
      const wakeMinutes = (wh || 4) * 60 + (wm || 30);

      const [sh, sm] = sleepTime.split(":").map(Number);
      const sleepMinutes = (sh || 21) * 60 + (sm || 40);

      // A) UYG'OTISH TEKSHIRUVI (wake_time dan boshlab 60 daqiqa davomida, foydalanuvchi javob bermaguncha har 5 daqiqada tel qilish)
      if (minutes >= wakeMinutes && minutes <= wakeMinutes + 60) {
        const [sleepRow] = await db.select().from(sleepLogs).where(eq(sleepLogs.date, todayISO)).limit(1);
        const isAwake = Boolean(sleepRow?.actualWake);

        if (!isAwake) {
          if (minutes !== lastWakeCallMinute && (minutes - wakeMinutes) % 5 === 0) {
            lastWakeCallMinute = minutes;
            console.log(`🔔 Uyg'otish qo'ng'irog'i amalga oshirilmoqda (${timeStr})...`);
            await makeCallWithClient(client, entity, `Uyg'onish vaqti: ${wakeTime}`);
            const wakeMsg = `☀️ <b>SOAT ${wakeTime} BO'LDI, UYG'ONISH VAQTI!</b>\n\nYengillik bilan o'rningizdan turing va suv iching 💧. Menga xabar yozing!`;
            await client.sendMessage(entity, { message: wakeMsg, parseMode: "html" });
            void sendVoiceNote(client, entity, `Assalomu alaykum Sohibjon! Soat ${wakeTime} bo'ldi, o'rningizdan turing!`);
          }
        }
      }

      // B) KECHQURUN ERTANGI REJALARNI SO'RASH
      if (minutes >= sleepMinutes - 20 && minutes <= sleepMinutes + 30) {
        const tomorrowTasks = await db.select().from(tasks).where(eq(tasks.date, tomorrowISO)).limit(1);
        if (tomorrowTasks.length === 0) {
          if (minutes !== lastSleepCallMinute && (minutes - sleepMinutes) % 10 === 0) {
            lastSleepCallMinute = minutes;
            console.log(`🌙 Ertangi rejalar bo'sh! Qo'ng'iroq qilinmoqda (${timeStr})...`);
            await makeCallWithClient(client, entity, "Ertangi rejalar kiritilmagan");
            const sleepMsg = `🌙 <b>Ertangi rejalaringizni ayting!</b>\n\nSohibjon, ertangi kun (${tomorrowISO}) uchun hali birorta vazifa kiritilmadi. Iltimos, nimalar qilmoqchi ekanligingizni ovozli xabar orqali menga aytib bering!`;
            await client.sendMessage(entity, { message: sleepMsg, parseMode: "html" });
            void sendVoiceNote(client, entity, "Sohibjon, ertangi kun uchun rejalaringizni ovozli xabar qilib aytib bering!");
          }
        }
      }

      // C) VAQTLI REJALAR BO'YICHA QO'NG'IROQ QILISH (soat kelganda avtomatik tel qilish)
      const activeRoutines = await db
        .select()
        .from(routines)
        .where(or(isNull(routines.targetDate), eq(routines.targetDate, todayISO)));

      for (const r of activeRoutines) {
        if (r.time === timeStr) {
          const callKey = `${todayISO}_${r.id}_${r.time}`;
          if (!calledRoutinesToday.has(callKey)) {
            calledRoutinesToday.add(callKey);
            console.log(`⏰ Reja vaqti bo'ldi (${r.time}): "${r.title}". Foydalanuvchiga qo'ng'iroq qilinmoqda...`);
            await makeCallWithClient(client, entity, `Reja vaqti: ${r.time} — ${r.title}`);
            const msg = `⏰ <b>SOAT ${r.time} BO'LDI!</b>\n\n📌 <b>${escapeHtml(r.title)}</b>\n\nSohibjon, rejalashtirilgan ish vaqti keldi. Boshlaymizmi? 🚀`;
            await client.sendMessage(entity, { message: msg, parseMode: "html" });
            void sendVoiceNote(client, entity, `Sohibjon, soat ${r.time} bo'ldi! ${r.title} vaqti keldi, ishni boshlaymiz!`);
          }
        }
      }

      // Har kuni yarim kechada tozalash
      if (minutes === 0) {
        calledRoutinesToday.clear();
      }
    } catch (err) {
      console.error("Interval loop error:", err);
    }
  }, 30000);

  // Connection uzilmasligi uchun kutish
  await new Promise(() => {});
}

async function start() {
  while (true) {
    try {
      await runWorker();
    } catch (e) {
      console.error("Worker xatosi, 5 soniyadan keyin qayta ulanadi:", e);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

start();
