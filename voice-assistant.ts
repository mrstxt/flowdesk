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
import { eq, desc, asc, sql } from "drizzle-orm";
import { getCardAvailableBalance } from "./src/lib/cardActions";
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
  const h = parseInt(get("hour"), 10);
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
