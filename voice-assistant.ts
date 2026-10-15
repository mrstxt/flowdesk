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
  cardTransactions,
  goals,
  contentItems,
  socialProfiles,
  uploadedFiles,
} from "./src/db/schema";
import { eq, desc, asc, sql, and, ilike, or, isNull } from "drizzle-orm";
import { getCardAvailableBalance, getPrimaryCard } from "./src/lib/cardActions";
import { confirmOrder } from "./src/lib/orderActions";
import {
  askBrain,
  isBrainEnabled,
  transcribeAudio,
  type BrainAction,
  type BrainResult,
} from "./src/lib/assistantBrain";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as http from "http";

const DESIGNS_DIR = path.join(process.cwd(), "public", "uploads", "designs");
try {
  if (!fs.existsSync(DESIGNS_DIR)) {
    fs.mkdirSync(DESIGNS_DIR, { recursive: true });
  }
} catch {}

type PendingDesignItem = {
  id: string;
  fileName: string;
  webPath: string;
  title: string;
  amount: number;
  date: string;
};

const pendingDesigns = new Map<string, PendingDesignItem[]>();

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

function parseExpenseInput(text: string): { amount: number; title: string } | null {
  const q = text.toLowerCase().trim();

  // Exclude inquiries and orders
  if (/(karta.*qancha|balans.*qancha|qancha pul|qancha bor|bormi\?)/i.test(q)) return null;
  if (/(buyurtma|zakaz|mijoz|klient)/i.test(q) && /(narx|so'?m|\$|deadline)/i.test(q)) return null;

  // Expense indicators
  const hasExpenseWord = /\b(chiqim|harajat|xarajat|sarf|sarfladim|sarflab|ishlatdim|berdim|to'?ladim|to‘ladim|toladim|ketdi|oldim|oldi|yechildi|harid|xarid)\b/i.test(q);
  const hasItemWord = /\b(tushlik|ovqat|taksi|bozor|yo'?lkira|kafe|choyxona|benzin|zapravka|dorixona|aptek|dori|narsa|kiyim|mahsulot)\b/i.test(q);

  if (!hasExpenseWord && !hasItemWord) return null;

  // Match amount: e.g. "50 ming", "50 minga", "50k", "50000", "1.5 mln"
  const amtRegex = /\b(\d+(?:[\s.,]\d{3})*(?:[.,]\d+)?|\b\d+)\s*(ming(?:ga|a)?|mln(?:ga)?|million(?:ga)?|\bk\b)?\s*(?:so'?m|sum)?/i;
  const match = text.match(amtRegex);
  if (!match) return null;

  let rawNum = match[1].replace(/[\s_]/g, "");
  if (/\d+[.,]\d{3}$/.test(rawNum)) {
    rawNum = rawNum.replace(/[.,]/g, "");
  } else {
    rawNum = rawNum.replace(",", ".");
  }
  let num = parseFloat(rawNum);
  if (isNaN(num) || num <= 0) return null;

  if (/:/.test(match[0])) return null;

  const unit = (match[2] || "").toLowerCase();
  if (unit.startsWith("ming") || unit === "k") {
    num *= 1000;
  } else if (unit.startsWith("mln") || unit.startsWith("million")) {
    num *= 1000000;
  }

  if (num < 500 && !unit && !/so'?m/i.test(match[0])) return null;

  let desc = text
    .replace(match[0], "")
    .replace(/\b(chiqim|harajat|xarajat|sarfladim|sarflab|sarf|ishlatdim|berdim|to'?ladim|to‘ladim|toladim|ketdi|oldim|oldi|yechildi|qildim|harid|xarid)\b/gi, "")
    .replace(/\b(man|men|biz|menga|manga|bugun|hozir|ertalab|kechqurun|uchun|bir|bitta)\b/gi, "")
    .replace(/[:;!?"'()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  desc = desc.replace(/(?:ga|ka|dan|da)\b/gi, "").trim();

  if (!desc || desc.length < 2) {
    if (/tushlik|ovqat|choyxona|kafe/i.test(text)) desc = "Tushlik / Ovqat";
    else if (/benzin|zapravka/i.test(text)) desc = "Benzin";
    else if (/taksi|yo'?lkira/i.test(text)) desc = "Taksi / Yo'lkira";
    else if (/bozor/i.test(text)) desc = "Bozorlik";
    else if (/dorixona|aptek|dori/i.test(text)) desc = "Dorixona";
    else if (/narsa/i.test(text)) desc = "Xarid";
    else desc = "Umumiy xarajat";
  } else {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  return { amount: num, title: desc };
}

function parseIncomeInput(text: string): { amount: number; title: string } | null {
  const q = text.toLowerCase().trim();

  // Exclude inquiries and expenses
  if (/(karta.*qancha|balans.*qancha|qancha pul|qancha bor|bormi\?)/i.test(q)) return null;
  if (/(chiqim|harajat|xarajat|sarf|ketdi|oldim)/i.test(q)) return null;

  // Income indicators
  const hasIncomeWord = /\b(kirim|daromad|foyda|tushum|tushdi|oylik|avans|gonorar|tushirildi)\b/i.test(q);
  if (!hasIncomeWord) return null;

  const amtRegex = /\b(\d+(?:[\s.,]\d{3})*(?:[.,]\d+)?|\b\d+)\s*(ming(?:ga|a)?|mln(?:ga)?|million(?:ga)?|\bk\b)?\s*(?:so'?m|sum)?/i;
  const match = text.match(amtRegex);
  if (!match) return null;

  let rawNum = match[1].replace(/[\s_]/g, "");
  if (/\d+[.,]\d{3}$/.test(rawNum)) {
    rawNum = rawNum.replace(/[.,]/g, "");
  } else {
    rawNum = rawNum.replace(",", ".");
  }
  let num = parseFloat(rawNum);
  if (isNaN(num) || num <= 0) return null;

  if (/:/.test(match[0])) return null;

  const unit = (match[2] || "").toLowerCase();
  if (unit.startsWith("ming") || unit === "k") {
    num *= 1000;
  } else if (unit.startsWith("mln") || unit.startsWith("million")) {
    num *= 1000000;
  }

  if (num < 500 && !unit && !/so'?m/i.test(match[0])) return null;

  let desc = text
    .replace(match[0], "")
    .replace(/\b(kirim|daromad|foyda|tushum|tushdi|tushirildi|bo'?ldi|qabul)\b/gi, "")
    .replace(/\b(man|men|biz|menga|manga|kartaga|kartamga|bugun|hozir|ertalab|kechqurun|uchun|bir|bitta)\b/gi, "")
    .replace(/[:;!?"'()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  desc = desc.replace(/(?:ga|ka|dan|da)\b/gi, "").trim();

  if (!desc || desc.length < 2) {
    if (/oylik/i.test(text)) desc = "Oylik maosh";
    else if (/avans/i.test(text)) desc = "Avans";
    else if (/mijoz|zakaz|buyurtma/i.test(text)) desc = "Mijozdan to'lov";
    else desc = "Daromad";
  } else {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  return { amount: num, title: desc };
}

function parseDesignCaption(caption: string, defaultIndex: number): { title: string; amount: number; isForwardedPost: boolean } {
  let title = "Dizayn #" + defaultIndex;
  let amount = 0;

  if (!caption) return { title, amount, isForwardedPost: false };

  // 1. Kanal posti, reklama yoki yangilik ekanligini aniqlash
  const isForwardedPost =
    caption.length > 70 ||
    caption.split("\n").length >= 3 ||
    /[#@]|https?:\/\/|icpc|tiktok|ro'yxatdan|talabalari|olimpiada|saralash|musobaqa|boshlandi|reklama|аккаунт|регистрация|telegram\s*\|\s*instagram/i.test(caption);

  // 2. Aniq narxni ajratib olish (yillar yoki vaqtlarni narx deb hisoblamaslik)
  const usdMatch = caption.match(/(\d+(?:[.,]\d+)?)\s*(?:\$|dollar|usd)\b/i);
  if (usdMatch) {
    amount = parseFloat(usdMatch[1].replace(",", ".")) * 12800;
  } else {
    const sumMatch =
      caption.match(/(\d+[\d\s.,]*)\s*(ming|mln|million|k)?\s*(?:so'?m|sum)\b/i) ||
      caption.match(/(\d+[\d\s.,]*)\s*(ming|mln|million)\b/i);
    if (sumMatch) {
      let num = parseFloat(sumMatch[1].replace(/[\s,]/g, ""));
      const unit = (sumMatch[2] || "").toLowerCase();
      if (unit.startsWith("ming") || unit === "k") num *= 1000;
      if (unit.startsWith("mln") || unit.startsWith("million")) num *= 1000000;
      const isYear = num >= 1990 && num <= 2099 && !unit;
      if (!isYear && num >= 500) amount = num;
    }
  }

  // 3. Nomini aniqlash
  if (isForwardedPost) {
    const firstLine = caption
      .split("\n")[0]
      .replace(/[*_#@~`]+/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .trim();
    if (firstLine.length >= 3 && firstLine.length <= 40) {
      title = firstLine;
    } else if (firstLine.length > 40) {
      title = firstLine.slice(0, 35).trim() + "...";
    }
  } else {
    let clean = caption
      .replace(/(\d+(?:[.,]\d+)?)\s*(?:\$|dollar|usd)/gi, "")
      .replace(/(\d+[\d\s.,]*)\s*(ming|mln|million|k)?\s*(?:so'?m|sum)?/gi, "")
      .replace(/\b(dizayni|dizayn|narxi|narx|summa|summasi|so'?m|sum|ming|uchun)\b/gi, "")
      .replace(/[:;!?"'()[\]-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (clean.length >= 2 && clean.length <= 45) {
      title = clean.charAt(0).toUpperCase() + clean.slice(1);
    }
  }

  return { title, amount, isForwardedPost };
}

function parseSettlementCommand(text: string, hasPendingDesigns = false): { isSettlement: boolean; clientName: string } | null {
  const q = text.toLowerCase().trim();

  // Exclude payments or general questions
  if (/(to'?lov|pulini\s*berdi|to'?ladi|toladi|tasdiqla)/i.test(q)) return null;

  // Salomlashish yoki minnatdorchilik bo'lsa
  if (/^(salom|assalom|qalaysan|qandaysan|tuzikmisan|rahmat|raxmat)$/i.test(q)) return null;

  const isExplicitSettlement =
    /(hisob\s*kitob|hisob-kitob)/i.test(q) ||
    (/(saqla|saqlagin)/i.test(q) && /(umumiy|narx|hisoblab|yozib\s*qo'?y|yozvor|yoz)/i.test(q)) ||
    (/(umumiy\s*narx.*hisoblab|hisoblab.*yoz)/i.test(q)) ||
    /(?:qo'?sh|qosh|qoʻsh|qo`sh|yozib\s*qo'?y|yoz|saqla|biriktir|kirit)\b/i.test(q) ||
    /\b([A-ZА-ЯЁa-zа-яё'`]+)(?:ga|ka|uchun)\b/i.test(q);

  if (!isExplicitSettlement && !hasPendingDesigns) return null;

  let clientName: string | null = null;

  // 1) "Akmal bilan hisob kitob"
  const withMatch = text.match(/([A-ZА-ЯЁa-zа-яё'`]+(?:\s+(?:aka|uka|opam?))?)\s*bilan\s*hisob/i);
  // 2) "Akmalga yozib qo'y" / "Akmalga qo'sh" / "Alisher akaga hisob kitob" / "Akmal uchun"
  const toMatch = text.match(/\b([A-ZА-ЯЁa-zа-яё'`]+(?:\s+(?:aka|uka|opam?))?)(?:ga|ka|uchun)\b/i);
  // 3) "mijoz: Akmal", "ism: Akmal", "hisoblab Akmalga", "qo'sh Akmalga"
  const prefixMatch = text.match(/(?:hisoblab|mijoz|ism|klient|qo'?sh|qosh|qoʻsh|qo`sh|saqla|biriktir)[:\s]+([A-ZА-ЯЁa-zа-яё'`]+(?:\s+(?:aka|uka|opam?))?)/i);

  if (prefixMatch) {
    clientName = prefixMatch[1].replace(/(?:ga|ka|uchun)$/i, "");
  } else if (withMatch) {
    clientName = withMatch[1];
  } else if (toMatch) {
    clientName = toMatch[1];
  } else if (hasPendingDesigns) {
    // Agar rasm kutib turgan bo'lsa va foydalanuvchi shunchaki ism yozsa: masalan "Akmal", "Sardor", "Farhod aka"
    const cleaned = text
      .replace(/(?:ga|ka|uchun|qo'?sh|qosh|qoʻsh|qo`sh|yoz|saqla|buni|shu|rasmni|rasmlarni|narxi|\d+[\d\s.,]*)/gi, "")
      .trim();
    if (cleaned.length >= 2 && cleaned.length <= 30 && !/\b(ha|yoq|ok|hop|haqida|nima)\b/i.test(cleaned)) {
      clientName = cleaned;
    }
  }

  if (clientName) {
    clientName = clientName
      .replace(/\b(shu|odam|odamga|rasmdi|rasmni|rasmlarni|narxini|umumiy|hisoblab|va|qilib|yangi|buni|uchun|dizayn)\b/gi, "")
      .trim();
    if (clientName) {
      clientName = clientName
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    }
  }

  if (!clientName && !hasPendingDesigns) return null;

  return { isSettlement: true, clientName: clientName || "Mijoz" };
}

function parsePaymentCommand(text: string): { isPayment: boolean; clientName: string | null } | null {
  const q = text.toLowerCase().trim();

  // Exclude simple balance/inquiry questions
  if (/(qancha|bormi\?|qilinganmi\?|qanchadan|balans)/i.test(q)) return null;

  const paymentRegex = /\b(to'?lov\s*(?:qildi|qilindi|olindi|qabul\s*qilindi|bo'?ldi|tushdi|yetib\s*keldi)|pulini\s*berdi|pul\s*berdi|to'?ladi|toladi|tasdiqla|tasdiqlandi|hisobni\s*yop)\b/i;
  if (!paymentRegex.test(q)) return null;

  let clientName: string | null = null;

  // 1) "Akmal to'lov qildi", "Sardor aka pul berdi", "Akmal to'ladi", "Akmal tasdiqlandi"
  const beforeMatch = text.match(/([A-ZА-ЯЁa-zа-яё'`]+(?:\s+(?:aka|uka|opam?))?)\s*(?:dan\s+)?(?:to'?lov|pulini|pul\s*berdi|to'?ladi|toladi|tasdiqla|tasdiqlandi)/i);

  // 2) "to'lov olindi: Akmal", "to'lov qabul qilindi Akmal", "tasdiqla Akmalni", "to'lov qildi Akmal"
  const afterMatch = text.match(/(?:to'?lov\s*(?:olindi|qabul\s*qilindi|qildi|bo'?ldi|tushdi)|tasdiqla(?:ndi)?)\s+(?:uchun\s+|mijoz\s+|ism\s+)?([A-ZА-ЯЁa-zа-яё'`]+(?:\s+(?:aka|uka|opam?))?)/i);

  if (beforeMatch && !/^(to'?lov|pul|bizga|menga|bugun|kecha)$/i.test(beforeMatch[1].trim())) {
    clientName = beforeMatch[1];
  } else if (afterMatch && !/^(to'?lov|pul|bizga|menga|bugun|kecha)$/i.test(afterMatch[1].trim())) {
    clientName = afterMatch[1];
  }

  if (clientName) {
    clientName = clientName
      .replace(/\b(to'?lov|pulini|pul|olindi|qildi|tasdiqla|tasdiqlandi|uchun|mijoz|aka|uka|dan)\b/gi, "")
      .trim();
    if (clientName) {
      clientName = clientName
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    }
  }

  return { isPayment: true, clientName: clientName && clientName.length >= 2 ? clientName : null };
}

function parseClientFromCaption(caption: string): string | null {
  if (!caption) return null;
  // "Akmalga", "Akmal uchun", "Akmalga yangi rasm", "mijoz: Akmal"
  const m1 = caption.match(/\b([A-ZА-ЯЁa-zа-яё'`]+(?:\s+(?:aka|uka))?)(?:ga|ka|uchun)\b/i);
  if (m1) {
    const raw = m1[1].replace(/\b(shu|yangi|dizayn|bitta|yana)\b/gi, "").trim();
    if (raw.length >= 2) {
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }
  }
  const m2 = caption.match(/(?:mijoz|klient|ism)[:\s]+([A-ZА-ЯЁa-zа-яё'`]+)/i);
  if (m2) {
    const raw = m2[1].trim();
    if (raw.length >= 2) {
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }
  }
  return null;
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
  // Foydalanuvchi talabi: Yordamchi ovozli xabar (golos) tashlamaydi, faqat matn yozadi.
  return;
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
  if (port && process.env.STANDALONE_WORKER === "true") {
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
  const targetEntity: any = await client.getEntity(target);
  const targetIdStr = targetEntity?.id ? targetEntity.id.toString() : "";
  console.log(`🔒 Yordamchi qat'iy ravishda faqat Sohibjon (@${targetEntity?.username || target}, ID: ${targetIdStr}) bilan ishlaydi.`);

  // 1. INCOMING MESSAGES (Ovozli va matnli xabarlarni eshitish va javob berish)
  client.addEventHandler(async (event) => {
    try {
      const msg = event.message;
      if (!msg || msg.out) return;

      // QAT'IY FILTR: Kanallar va guruhlardagi postlar mutlaqo e'tiborga olinmaydi!
      if (msg.isChannel || msg.isGroup) return;

      // QAT'IY FILTR: Faqat Sohibjon (@sulaymonovss) dan kelgan shaxsiy chat xabarlarigina olinadi!
      const senderId = msg.senderId ? msg.senderId.toString() : "";
      const chatId = msg.chatId ? msg.chatId.toString() : "";
      const peerUserId = msg.peerId && "userId" in msg.peerId ? (msg.peerId as any).userId.toString() : "";

      if (targetIdStr && senderId !== targetIdStr && chatId !== targetIdStr && peerUserId !== targetIdStr) {
        return; // Boshqa profillar, kanallar yoki begona chatlar mutlaqo o'tkazib yuboriladi!
      }

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

      // Agar rasm (foto) bo'lsa
      const isPhoto = Boolean(
        msg.photo ||
        (msg.media && (msg.media.className === "MessageMediaPhoto" || "photo" in msg.media))
      );

      if (isPhoto) {
        console.log("📸 Foydalanuvchidan dizayn rasmi keldi...");
        try {
          const mediaBuffer = await client.downloadMedia(msg);
          if (mediaBuffer && Buffer.isBuffer(mediaBuffer)) {
            const fileName = `design_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
            const fullPath = path.join(DESIGNS_DIR, fileName);
            fs.writeFileSync(fullPath, mediaBuffer);
            const webPath = `/uploads/designs/${fileName}`;

            // Neon PostgreSQL-ga ham doimiy saqlaymiz (server restart bo'lsa ham yo'qolmasligi uchun)
            try {
              await db.insert(uploadedFiles).values({
                fileName,
                mimeType: "image/jpeg",
                data: mediaBuffer.toString("base64"),
              });
            } catch (dbErr) {
              console.error("DB uploadedFiles save error:", dbErr);
            }

            const userKey = String(target);
            const currentList = pendingDesigns.get(userKey) || [];
            const { title, amount, isForwardedPost } = parseDesignCaption(receivedText, currentList.length + 1);

            currentList.push({
              id: String(Date.now()),
              fileName,
              webPath,
              title,
              amount,
              date: getTashkentTimeString().todayISO,
            });
            pendingDesigns.set(userKey, currentList);

            // Agar rasm izohida mijoz nomi bo'lsa va u bo'yicha ochiq hisob mavjud bo'lsa - darhol qo'shamiz
            const directClient = parseClientFromCaption(receivedText);
            if (directClient) {
              const [existingClientOrder] = await db
                .select()
                .from(orders)
                .where(
                  and(
                    sql`LOWER(${orders.clientName}) LIKE ${'%' + directClient.toLowerCase() + '%'}`,
                    sql`${orders.stage} != 'confirmed'`
                  )
                )
                .orderBy(desc(orders.createdAt))
                .limit(1);

              if (existingClientOrder) {
                const addAmt = amount;
                const newTotal = Number(existingClientOrder.amount) + addAmt;
                const newDesc =
                  (existingClientOrder.description ? existingClientOrder.description + "\n\n" : "") +
                  `🖼️ Yangi dizayn: ${title} — ${addAmt > 0 ? fmt(addAmt) : "Kelishilgan"}\n${webPath}`;

                await db
                  .update(orders)
                  .set({
                    amount: String(newTotal),
                    description: newDesc,
                    updatedAt: new Date(),
                  })
                  .where(eq(orders.id, existingClientOrder.id));

                pendingDesigns.delete(userKey);

                const rep =
                  `🖼️ <b>${existingClientOrder.clientName}</b> hisob-kitobiga yangi rasm muvaffaqiyatli qo'shildi!\n\n` +
                  `📌 <b>Dizayn:</b> ${title}\n` +
                  `💰 <b>Narxi:</b> ${addAmt > 0 ? `+${fmt(addAmt)}` : "Belgilanmagan"}\n` +
                  `📊 <b>Yangi umumiy summa:</b> <b>${fmt(newTotal)}</b>\n\n` +
                  `<i>Mijoz to'lov qilganda «${existingClientOrder.clientName} to'lov qildi» desangiz, darhol tasdiqlanib kartangizga tushadi! 🚀</i>`;

                await client.sendMessage(replyPeer, { message: rep, parseMode: "html" });
                return;
              }
            }

            // Agar bu kanal posti yoki reklama bo'lsa (masalan ICPC, yangiliklar yoki postlar)
            if (isForwardedPost) {
              const rep =
                `📰 <b>Kanal posti / ma'lumot qabul qilindi!</b>\n\n` +
                `📌 <b>Mavzu:</b> ${title}\n` +
                `🖼️ <b>Rasm:</b> Platformaga yuklandi.\n\n` +
                `<i>💡 <b>Buni qayerga saqlaymiz?</b>\n` +
                `• «Kontentga saqla» desangiz — Media ➔ Kontent bo'limiga g'oya sifatida kiritaman;\n` +
                `• «[Mijoz]ga qo'sh» (masalan: «Akmalga qo'sh») desangiz — Hisob-kitobga kiritaman! 🚀</i>`;

              await client.sendMessage(replyPeer, { message: rep, parseMode: "html" });
              return;
            }

            const totalSoFar = currentList.reduce((s, it) => s + it.amount, 0);
            const count = currentList.length;

            const rep =
              `🖼️ <b>Dizayn rasmi qabul qilindi!</b> (#${count})\n\n` +
              `📌 <b>Nomi:</b> ${title}\n` +
              `💰 <b>Narxi:</b> ${amount > 0 ? fmt(amount) : "Hali belgilanmadi"}\n` +
              (totalSoFar > 0 ? `📊 <b>Hozirgacha jami hisob:</b> <b>${fmt(totalSoFar)}</b>\n\n` : "\n") +
              `<i>💡 <b>Buni hisob-kitobga saqlash uchun:</b>\n` +
              `• Mijoz ismini yozing (masalan: «Akmal» yoki «Akmalga qo'sh»);\n` +
              `• Agar narxi bo'lsa: «50 ming» yoki «50000 Akmalga» deb yuboring! 🚀</i>`;

            await client.sendMessage(replyPeer, { message: rep, parseMode: "html" });
            return;
          }
        } catch (photoErr) {
          console.error("Rasm yuklab olishda xatolik:", photoErr);
        }
      }

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

      // A.-1) To'lov qabul qilish / tasdiqlash ("Akmal to'lov qildi", "to'lov olindi")
      const payment = parsePaymentCommand(clean);
      if (payment) {
        console.log(`💰 To'lov tasdiqlash buyrug'i: Mijoz "${payment.clientName ?? 'Nomaʼlum'}"`);
        let targetOrder: typeof orders.$inferSelect | null = null;

        if (payment.clientName) {
          const clientQ = payment.clientName.toLowerCase();
          const matchedOrders = await db
            .select()
            .from(orders)
            .where(
              and(
                sql`LOWER(${orders.clientName}) LIKE ${'%' + clientQ + '%'}`,
                sql`${orders.stage} != 'confirmed'`
              )
            )
            .orderBy(desc(orders.createdAt))
            .limit(1);

          if (matchedOrders.length > 0) {
            targetOrder = matchedOrders[0];
          } else {
            const matchedByText = await db
              .select()
              .from(orders)
              .where(
                and(
                  or(
                    sql`LOWER(${orders.title}) LIKE ${'%' + clientQ + '%'}`,
                    sql`LOWER(${orders.description}) LIKE ${'%' + clientQ + '%'}`
                  ),
                  sql`${orders.stage} != 'confirmed'`
                )
              )
              .orderBy(desc(orders.createdAt))
              .limit(1);
            if (matchedByText.length > 0) targetOrder = matchedByText[0];
          }
        } else {
          // Mijoz ismi aytilmagan bo'lsa (masalan "to'lov olindi"), oxirgi ochiq hisobni olamiz
          const latestUnconfirmed = await db
            .select()
            .from(orders)
            .where(sql`${orders.stage} != 'confirmed'`)
            .orderBy(desc(orders.createdAt))
            .limit(1);
          if (latestUnconfirmed.length > 0) targetOrder = latestUnconfirmed[0];
        }

        if (!targetOrder) {
          const notFoundRep = payment.clientName
            ? `❓ <b>${payment.clientName}</b> bo'yicha to'lov kutilayotgan ochiq hisob-kitob topilmadi.\n(Balki allaqachon to'langan yoki boshqa nomda saqlangan bo'lishi mumkin)`
            : `❓ Hozirda to'lov kutilayotgan ochiq hisob-kitob topilmadi.`;
          await client.sendMessage(replyPeer, { message: notFoundRep, parseMode: "html" });
          return;
        }

        // Tasdiqlash va avtomatik taqsimot (confirmOrder)
        const confirmRes = await confirmOrder(targetOrder.id);
        if (!confirmRes.ok) {
          await client.sendMessage(replyPeer, {
            message: `⚠️ <b>To'lovni tasdiqlashda xatolik:</b>\n${confirmRes.message}`,
            parseMode: "html",
          });
          return;
        }

        const primary = await getPrimaryCard();
        const primaryBal = primary ? await getCardAvailableBalance(primary.id) : 0;
        const amtNum = Number(targetOrder.amount) || 0;

        const successRep =
          `🎉 <b>To'lov qabul qilindi va Tasdiqlandi!</b>\n\n` +
          `👤 <b>Mijoz:</b> <b>${targetOrder.clientName || targetOrder.title}</b>\n` +
          `💰 <b>Summa:</b> <b>${fmt(amtNum)}</b>\n` +
          `💳 <b>Asosiy karta:</b> Pul qabul qilindi va balansga qo'shildi!\n` +
          `🎯 <b>Taqsimot:</b> Belgilangan maqsadlarga avtomatik foizlar ajratildi.\n` +
          (primary ? `📊 <b>Asosiy karta joriy balansi:</b> <b>${fmt(primaryBal)}</b>\n\n` : "\n") +
          `📂 Buyurtma <b>«Tasdiqlandi»</b> holatiga o'tkazildi va arxivlandi! 🚀`;

        await client.sendMessage(replyPeer, { message: successRep, parseMode: "html" });
        return;
      }

      // A.0) Hisob-kitob qilish va rasmlarni saqlash ("Shu rasmni saqla va umumiy narxini hisoblab Akmalga yozib qo'y", "Akmalga qo'sh", "Akmal")
      const userKey = String(target);
      const items = pendingDesigns.get(userKey) || [];
      const hasPending = items.length > 0;
      const settlement = parseSettlementCommand(clean, hasPending);
      if (settlement) {
        console.log(`💼 Hisob-kitob buyrug'i qabul qilindi: Mijoz "${settlement.clientName}"`);

        let totalAmount = items.reduce((s, it) => s + it.amount, 0);
        const { amount: extraAmt } = parseDesignCaption(clean, 0);
        if (extraAmt > 0) {
          if (items.length > 0 && items[items.length - 1].amount === 0) {
            items[items.length - 1].amount = extraAmt;
            totalAmount = items.reduce((s, it) => s + it.amount, 0);
          } else if (totalAmount === 0) {
            totalAmount = extraAmt;
          }
        }

        // Avval mavjud ochiq hisob-kitobni tekshiramiz
        const [existingClientOrder] = await db
          .select()
          .from(orders)
          .where(
            and(
              sql`LOWER(${orders.clientName}) LIKE ${'%' + settlement.clientName.toLowerCase() + '%'}`,
              sql`${orders.stage} != 'confirmed'`
            )
          )
          .orderBy(desc(orders.createdAt))
          .limit(1);

        if (existingClientOrder) {
          // Mavjud hisobga qo'shamiz (Append)
          const addAmt = totalAmount;
          let appendDesc = "";
          if (items.length > 0) {
            appendDesc += "\n\n🖼️ Yangi qo'shilgan dizaynlar:\n";
            items.forEach((it, i) => {
              appendDesc += `${i + 1}. ${it.title} — ${it.amount > 0 ? fmt(it.amount) : "Kelishilgan"}\n`;
              if (it.webPath) appendDesc += `${it.webPath}\n`;
            });
          } else {
            appendDesc += `\n\n+ Qo'shildi: ${clean} (${addAmt > 0 ? fmt(addAmt) : "kelishilgan"})`;
          }

          const newTotal = Number(existingClientOrder.amount) + addAmt;
          await db
            .update(orders)
            .set({
              amount: String(newTotal),
              description: (existingClientOrder.description || "") + appendDesc,
              updatedAt: new Date(),
            })
            .where(eq(orders.id, existingClientOrder.id));

          pendingDesigns.delete(userKey);

          let rep =
            `🖼️ <b>${existingClientOrder.clientName}</b> hisob-kitobiga ${items.length > 0 ? `${items.length} ta dizayn rasmi` : "yangi qo'shimcha"} muvaffaqiyatli qo'shildi!\n\n`;

          if (items.length > 0) {
            rep +=
              `📋 <b>Qo'shilganlar:</b>\n` +
              items.map((it, i) => `${i + 1}. ${it.title} — <b>${it.amount > 0 ? fmt(it.amount) : "Belgilanmagan"}</b>`).join("\n") +
              `\n\n`;
          }

          rep +=
            `💰 <b>Oldingi summa:</b> ${fmt(Number(existingClientOrder.amount))}\n` +
            `📊 <b>Yangi umumiy summa:</b> <b>${fmt(newTotal)}</b>\n\n` +
            `<i>Mijoz to'lov qilganda «${existingClientOrder.clientName} to'lov qildi» desangiz, darhol tasdiqlanib kartangizga tushadi! 🚀</i>`;

          await client.sendMessage(replyPeer, { message: rep, parseMode: "html" });
          return;
        }

        // Yangi hisob-kitob yaratamiz
        const descLines: string[] = [
          `📋 Hisob-kitob tafsilotlari:`,
          `👤 Mijoz: ${settlement.clientName}`,
          `📅 Sana: ${todayISO}`,
        ];

        if (items.length > 0) {
          descLines.push("");
          descLines.push("🖼️ Dizaynlar va narxlar:");
          items.forEach((it, i) => {
            descLines.push(`${i + 1}. ${it.title} — ${it.amount > 0 ? fmt(it.amount) : "Kelishilgan"}`);
            if (it.webPath) descLines.push(it.webPath);
          });
        } else {
          descLines.push("");
          descLines.push(`Izoh: ${clean}`);
        }

        descLines.push("");
        descLines.push(`💰 Jami summa: ${fmt(totalAmount)}`);
        descLines.push(`📌 Holat: Hisob-kitob (to'lov kutilmoqda)`);

        await db.insert(orders).values({
          title: items.length > 0 ? `Dizayn hisob-kitob (${items.length} ta)` : `Dizayn hisob-kitob`,
          clientName: settlement.clientName,
          amount: String(totalAmount),
          stage: "hisob_kitob",
          paymentType: "cash",
          description: descLines.join("\n"),
        });

        pendingDesigns.delete(userKey);

        let rep =
          `💼 <b>Hisob-kitob muvaffaqiyatli saqlandi!</b>\n\n` +
          `👤 <b>Mijoz:</b> <b>${settlement.clientName}</b>\n`;

        if (items.length > 0) {
          rep += `🖼️ <b>Saqlangan dizaynlar:</b> ${items.length} ta rasm\n\n` +
                 `📋 <b>Tafsilotlar:</b>\n` +
                 items.map((it, i) => `${i + 1}. ${it.title} — <b>${it.amount > 0 ? fmt(it.amount) : "Belgilanmagan"}</b>`).join("\n") +
                 `\n\n`;
        }

        rep +=
          `💰 <b>Umumiy hisob-kitob summasi:</b> <b>${fmt(totalAmount)}</b>\n` +
          `📂 <b>Bo'lim:</b> Hisob-kitob bo'limiga kiritildi!\n\n` +
          `<i>Mijoz to'lov qilganda «${settlement.clientName} to'lov qildi» deb yozsangiz, tushum avtomatik Asosiy kartangiz balansiga tushadi va maqsadlarga taqsimlanadi! 🚀</i>`;

        await client.sendMessage(replyPeer, { message: rep, parseMode: "html" });
        return;
      }

      // Agar oldingi rasmga narx kiritilayotgan bo'lsa
      const existingPending = pendingDesigns.get(userKey) || [];
      if (existingPending.length > 0) {
        const lastItem = existingPending[existingPending.length - 1];
        if (lastItem && lastItem.amount === 0) {
          const { title, amount } = parseDesignCaption(clean, existingPending.length);
          if (amount > 0) {
            lastItem.amount = amount;
            if (title && !title.startsWith("Dizayn #")) lastItem.title = title;
            const totalSoFar = existingPending.reduce((s, it) => s + it.amount, 0);

            const rep =
              `✅ <b>${lastItem.title}</b> uchun narx belgilandi: <b>${fmt(amount)}</b>\n\n` +
              `📊 <b>Hozirgacha jami:</b> <b>${fmt(totalSoFar)}</b>\n\n` +
              `<i>Yana rasm yuborishingiz yoki: «Shu rasmlarni saqla va [Mijoz]ga yozib qo'y» deb hisob-kitobni yakunlashingiz mumkin! 🚀</i>`;

            await client.sendMessage(replyPeer, { message: rep, parseMode: "html" });
            return;
          }
        }
      }

      // A.03) Kontent g'oyasi yoki rejasi ("Kontent: ...", "Kontent g'oya: ...")
      if (/^(kontent|post|reels)\s*(g'oya|reja|mavzu|yoz)?[:\s]/i.test(clean)) {
        const contentTitle = clean.replace(/^(kontent|post|reels)\s*(g'oya|reja|mavzu|yoz)?[:\s]+/i, "").trim();
        if (contentTitle) {
          let contentType = "post";
          if (/reels|video/i.test(clean)) contentType = "reels";
          else if (/karusel/i.test(clean)) contentType = "carousel";
          else if (/story/i.test(clean)) contentType = "story";

          await db.insert(contentItems).values({
            title: contentTitle,
            type: contentType,
            stage: "idea",
            notes: `Telegram orqali saqlangan (${todayISO})`,
          });

          const rep =
            `💡 <b>Yangi kontent g'oyasi saqlandi!</b>\n\n` +
            `📌 <b>Mavzu:</b> ${contentTitle}\n` +
            `📱 <b>Format:</b> ${contentType.toUpperCase()}\n` +
            `📂 <b>Bo'lim:</b> Media -> <b>«Kontent»</b> taxtasiga kiritildi! 🚀`;

          await client.sendMessage(replyPeer, { message: rep, parseMode: "html" });
          return;
        }
      }

      // A.05) Kutilayotgan hisob-kitoblar so'rovi ("hisob kitoblar qanday?", "qanday hisob kitob bor?")
      if (
        /(qanday|nima|kimdan|kimlar|ro'?yxat|bormi|qani)/i.test(q) &&
        /(hisob\s*kitob|hisob-kitob|qarzdor|olishim kerak|to'?lovlar)/i.test(q)
      ) {
        const pendingOrders = await db
          .select()
          .from(orders)
          .where(and(eq(orders.stage, "hisob_kitob"), eq(orders.archived, false)));

        if (pendingOrders.length === 0) {
          await client.sendMessage(replyPeer, {
            message: "💼 Hozircha kutilayotgan hisob-kitoblar yo'q, barcha mijozlar bilan hisob-kitob qilingan! 👍",
          });
          return;
        }
        let total = 0;
        const lines = pendingOrders.map((o, idx) => {
          const amt = Number(o.amount) || 0;
          total += amt;
          return `${idx + 1}. 👤 <b>${o.clientName || "Mijoz"}</b> — <b>${fmt(amt)}</b> <i>(${o.title})</i>`;
        });
        const rep = `💼 <b>Kutilayotgan hisob-kitoblar (${pendingOrders.length} ta):</b>\n\n${lines.join("\n")}\n\n💰 <b>Jami olinishi kerak:</b> <b>${fmt(total)}</b>`;
        await client.sendMessage(replyPeer, { message: rep, parseMode: "html" });
        return;
      }

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

      // A.25) Reja yoki vazifani o'chirish / tozalash ("rejalardi ochirib tur yangi tuzamiz", "ob tashla", "ochir", "bularni ob tashla")
      if (/(?:o'?chir|ob\s*tashla|olib\s*tashla|bekor\s*qil|tozala|tozalab\s*tashla|tozalab\s*tur|o'?chirib\s*tur)/i.test(q)) {
        console.log("🗑️ Rejani o'chirish / tozalash so'raldi...");

        const isTomorrow = /(ertag|ertangi)/i.test(q);
        const isToday = /(bugun|bugungi)/i.test(q);

        const isAll =
          /(barcha|hamma|barchasini|hammasini|bularni|bular|hammasi|tozala|tozalab|kerakmas|kerak\s*emas)/i.test(q) ||
          /(?:rejalarni|rejalardi|vazifalarni|vazifalardi)\s*(?:hammasini|barchasini|tozala|o'?chir|ob\s*tashla)/i.test(q) ||
          /(?:o'?chirib\s*tur|tozalab\s*tur|yangi\s*tuzamiz)/i.test(q) ||
          /(?:rejalarni|rejalardi|vazifalarni|vazifalardi)/i.test(q) ||
          /^(\s*o'?chir\s*|\s*ob\s*tashla\s*|\s*olib\s*tashla\s*|\s*o'?chirib\s*tashla\s*|\s*rejalardi\s*o'?chir\s*|\s*rejalarni\s*o'?chir\s*)$/i.test(clean);

        const wantsCall = /(tel\s*qil|telefon\s*qil|qo'?ng'?iroq\s*qil)/i.test(q);

        // Qaysi aniq vazifani o'chirish kerakligini aniqlash
        let targetWord = clean
          .replace(/(?:o'?chirib\s*tashla|ob\s*tashla|olib\s*tashla|o'?chirib\s*tur|tozalab\s*tur|o'?chir|bekor\s*qil|tozala|tashla)/gi, "")
          .replace(/(?:vazifasini|rejasini|vazifani|rejani|ishni|rejalarni|rejalardi|vazifalarni|vazifalardi)/gi, "")
          .replace(/(?:bugungi|ertangi|iltimos|menga|manga|shuni|yangi\s*tuzamiz|reja\s*tuzish\s*uchun|uchun|tel\s*qil|telefon\s*qil)/gi, "")
          .replace(/(?:ni|di)$/gi, "")
          .trim();

        // Agar umumiy tozalash bo'lsa yoki qolgan so'z qisqa bo'lsa -> butun rejalarni tozalash
        if (isAll || targetWord.length < 3) {
          let delCount = 0;
          let label = "";

          if (isTomorrow) {
            const delT = await db.delete(tasks).where(eq(tasks.date, tomorrowISO)).returning({ id: tasks.id });
            const delR = await db.delete(routines).where(eq(routines.targetDate, tomorrowISO)).returning({ id: routines.id });
            delCount = delT.length + delR.length;
            label = `Ertangi (${tomorrowISO})`;
          } else if (isToday) {
            const delT = await db.delete(tasks).where(eq(tasks.date, todayISO)).returning({ id: tasks.id });
            const delR = await db.delete(routines).where(eq(routines.targetDate, todayISO)).returning({ id: routines.id });
            delCount = delT.length + delR.length;
            label = `Bugungi (${todayISO})`;
          } else {
            // Kun aniq aytilmagan bo'lsa ("Rejalardi ochirib tur yangi tuzamiz") -> HAM bugungi, HAM ertangi kun rejalari
            const delT = await db.delete(tasks).where(or(eq(tasks.date, todayISO), eq(tasks.date, tomorrowISO))).returning({ id: tasks.id });
            const delR = await db.delete(routines).where(or(eq(routines.targetDate, todayISO), eq(routines.targetDate, tomorrowISO))).returning({ id: routines.id });
            delCount = delT.length + delR.length;
            label = "Barcha joriy va ertangi";
          }

          let rep = `🗑️ Tushundim Sohibjon! ${label} rejalarni tozalab tashladim (${delCount} ta reja o'chirildi).`;
          if (wantsCall) {
            rep += "\n\nYangi reja tuzishingiz uchun hozir telefon qilmoqdaman... 📲";
          } else {
            rep += " Ro'yxatingiz top-toza bo'ldi. Yangi reja tuzamizmi? 😊";
          }

          await client.sendMessage(replyPeer, { message: rep });
          sendVoiceNote(client, replyPeer, "Tushundim Sohibjon! Rejalarni tozalab tashladim.").catch(() => {});

          if (wantsCall) {
            await makeCallWithClient(client, entity, "Yangi reja tuzish uchun qo'ng'iroq");
          }
          return;
        }

        // Muayyan bitta vazifani o'chirish (masalan: "kitob o'qishni ob tashla")
        const pattern = `%${targetWord.replace(/['`]/g, "")}%`;
        const delT = await db.delete(tasks).where(ilike(tasks.title, pattern)).returning({ id: tasks.id });
        const delR = await db.delete(routines).where(ilike(routines.title, pattern)).returning({ id: routines.id });

        if (delT.length || delR.length) {
          const rep = `🗑️ Tushundim Sohibjon! <b>"${targetWord}"</b> rejangizni ro'yxatdan o'chirib tashladim.`;
          await client.sendMessage(replyPeer, { message: rep, parseMode: "html" });
          sendVoiceNote(client, replyPeer, `${targetWord} rejasini o'chirib tashladim.`).catch(() => {});
          if (wantsCall) {
            await makeCallWithClient(client, entity, "Foydalanuvchi so'ragan qo'ng'iroq");
          }
          return;
        } else {
          const rep = `🤔 Sohibjon, ro'yxatdan "${targetWord}" degan reja topilmadi. "Rejalar qanday" deb yozsangiz hozirgi rejalarni ko'rib olasiz!`;
          await client.sendMessage(replyPeer, { message: rep });
          sendVoiceNote(client, replyPeer, `Ro'yxatdan ${targetWord} degan reja topilmadi Sohibjon.`).catch(() => {});
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

    // A.5) Chiqim qo'shish ("50 minga narsa oldim", "Chiqim 50000", "Tushlikka 40000 ketdi")
    const expenseData = parseExpenseInput(clean);
    if (expenseData) {
      const { amount: amt, title: desc } = expenseData;
      console.log(`💸 Chiqim aniqlandi: ${amt} so'm, izoh: "${desc}"`);
      try {
        const allActiveCards = await db.select().from(cards).where(eq(cards.archived, false));
        let targetCard =
          allActiveCards.find((c) => c.type === "primary") ||
          allActiveCards.find((c) => /asosiy/i.test(c.name)) ||
          allActiveCards[0];

        if (!targetCard) {
          const [newCard] = await db
            .insert(cards)
            .values({
              name: "Asosiy",
              type: "primary",
              balance: "0",
            })
            .returning();
          targetCard = newCard;
        }

        // 1. Chiqimlar (expenses) ga saqlaymiz
        await db.insert(expenses).values({
          title: desc,
          amount: String(amt),
          date: todayISO,
          category: "other",
          cardId: targetCard.id,
        });

        // 2. Karta harakatlari (card_transactions) ga yozamiz
        await db.insert(cardTransactions).values({
          cardId: targetCard.id,
          date: todayISO,
          type: "out",
          amount: String(amt),
          description: desc,
        });

        // 3. Kartaning balance ustunini yangilaymiz
        const oldBal = Number(targetCard.balance) || 0;
        const newBal = Math.max(0, oldBal - amt);
        await db
          .update(cards)
          .set({ balance: String(newBal) })
          .where(eq(cards.id, targetCard.id));

        // 4. Haqiqiy qoldiqni hisoblaymiz
        const remBalance =
          targetCard.type === "primary"
            ? await getCardAvailableBalance(targetCard.id)
            : newBal;

        const reply =
          `💸 <b>Chiqim muvaffaqiyatli qayd etildi!</b>\n\n` +
          `🛒 <b>Xarajat:</b> ${desc}\n` +
          `➖ <b>Chiqim summasi:</b> -${fmt(amt)}\n` +
          `💳 <b>Karta:</b> ${targetCard.name} (${targetCard.type === "primary" ? "Asosiy" : "Karta"})\n` +
          `💰 <b>Kartadagi yangi qoldiq:</b> <b>${fmt(remBalance)}</b>\n\n` +
          `<i>Xarajat asosiy kartangiz hisobiga kiritildi, Sohibjon!</i>`;

        await client.sendMessage(replyPeer, { message: reply, parseMode: "html" });
        void sendVoiceNote(
          client,
          replyPeer,
          `Tushundim Sohibjon! ${desc} uchun ${fmt(amt)} chiqim asosiy kartangizdan yechildi. Hozirgi qoldiq ${fmt(remBalance)}.`
        );
        return;
      } catch (e) {
        console.error("Chiqim saqlash xatoligi:", e);
      }
    }

    // A.6) Kirim qo'shish ("Kirim 1000000 oylik", "Oylik tushdi 2000000", "Kartaga 200 ming tushdi")
    const incomeData = parseIncomeInput(clean);
    if (incomeData) {
      const { amount: amt, title: desc } = incomeData;
      console.log(`💰 Kirim aniqlandi: ${amt} so'm, izoh: "${desc}"`);
      try {
        const allActiveCards = await db.select().from(cards).where(eq(cards.archived, false));
        let targetCard =
          allActiveCards.find((c) => c.type === "primary") ||
          allActiveCards.find((c) => /asosiy/i.test(c.name)) ||
          allActiveCards[0];

        if (!targetCard) {
          const [newCard] = await db
            .insert(cards)
            .values({
              name: "Asosiy",
              type: "primary",
              balance: "0",
            })
            .returning();
          targetCard = newCard;
        }

        // 1. Daromadlar (incomes) jadvaliga saqlaymiz
        await db.insert(incomes).values({
          title: desc,
          amount: String(amt),
          date: todayISO,
          source: "other",
          cardId: targetCard.id,
        });

        // 2. Karta harakatlari (card_transactions) ga yozamiz
        await db.insert(cardTransactions).values({
          cardId: targetCard.id,
          date: todayISO,
          type: "in",
          amount: String(amt),
          description: desc,
        });

        // 3. Kartaning balance ustunini yangilaymiz
        const oldBal = Number(targetCard.balance) || 0;
        const newBal = oldBal + amt;
        await db
          .update(cards)
          .set({ balance: String(newBal) })
          .where(eq(cards.id, targetCard.id));

        // 4. Haqiqiy qoldiqni hisoblaymiz
        const remBalance =
          targetCard.type === "primary"
            ? await getCardAvailableBalance(targetCard.id)
            : newBal;

        const reply =
          `💰 <b>Kirim muvaffaqiyatli qayd etildi!</b>\n\n` +
          `📌 <b>Manba / Izoh:</b> ${desc}\n` +
          `➕ <b>Kirim summasi:</b> +${fmt(amt)}\n` +
          `💳 <b>Karta:</b> ${targetCard.name} (${targetCard.type === "primary" ? "Asosiy" : "Karta"})\n` +
          `💰 <b>Kartadagi yangi qoldiq:</b> <b>${fmt(remBalance)}</b>\n\n` +
          `<i>Mablag' kartangizga muvaffaqiyatli qabul qilindi, Sohibjon! 🚀</i>`;

        await client.sendMessage(replyPeer, { message: reply, parseMode: "html" });
        void sendVoiceNote(
          client,
          replyPeer,
          `Ajoyib Sohibjon! ${desc} uchun ${fmt(amt)} kirim asosiy kartangizga qo'shildi. Hozirgi qoldiq ${fmt(remBalance)}.`
        );
        return;
      } catch (e) {
        console.error("Kirim saqlash xatoligi:", e);
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
          const timeRange = r.startTime && r.endTime
            ? `${r.startTime} - ${r.endTime}`
            : r.time;
          lines.push(`${done ? "✅" : "⬜"} <b>${timeRange}</b> — ${r.title}${r.targetDate ? "" : " <i>(har kuni)</i>"}`);
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
        const timeDisplay = p.startTime && p.endTime
          ? `⏰ <b>${p.startTime} - ${p.endTime}</b>`
          : p.time ? `⏰ <b>${p.time}</b>` : "";
        reportMsg += `${i + 1}. ${timeDisplay ? `${timeDisplay} — ` : ""}${p.title}\n`;
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
  }, new NewMessage({ incoming: true, chats: [entity] }));

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

      // D) KONTENT REJASI BO'YICHA OGOHLANTIRISH (Hook, Body, CTA va 4 ta kadr bilan Telegramga yuborish)
      const scheduledContents = await db
        .select()
        .from(contentItems)
        .where(
          and(
            eq(contentItems.scheduledDate, todayISO),
            eq(contentItems.scheduledTime, timeStr),
            or(isNull(contentItems.notified), eq(contentItems.notified, false))
          )
        );

      for (const item of scheduledContents) {
        console.log(`📱 Kontent vaqti bo'ldi (${item.scheduledTime}): "${item.title}". Foydalanuvchiga yuborilmoqda...`);

        let framesList: string[] = [];
        if (item.frames) {
          try {
            const parsed = JSON.parse(item.frames);
            if (Array.isArray(parsed)) framesList = parsed;
          } catch {}
        }
        if (item.mediaUrls && framesList.length === 0) {
          framesList.push(item.mediaUrls);
        }

        const lines: string[] = [
          `🎬 <b>KONTENT CHIQARISH VAQTI BO'LDI!</b> (Soat ${item.scheduledTime || timeStr})`,
          ``,
          `📌 <b>Mavzu:</b> ${escapeHtml(item.title)}`,
          `📂 <b>Format:</b> ${item.type.toUpperCase()}`,
        ];

        if (item.hook) {
          lines.push(``, `🪝 <b>Hook (Ilmoq):</b>\n${escapeHtml(item.hook)}`);
        }
        if (item.body) {
          lines.push(``, `📖 <b>Body (Asosiy matn):</b>\n${escapeHtml(item.body)}`);
        }
        if (item.cta) {
          lines.push(``, `🎯 <b>CTA (Harakatga chaqiruv):</b>\n${escapeHtml(item.cta)}`);
        }
        if (item.caption) {
          lines.push(``, `📝 <b>To'liq Caption:</b>\n${escapeHtml(item.caption)}`);
        }
        if (framesList.length > 0) {
          lines.push(``, `🖼️ <b>Kadrlar (${framesList.length} ta):</b>`);
          framesList.forEach((f, idx) => {
            lines.push(`  ${idx + 1}-kadr: ${f}`);
          });
        }

        lines.push(``, `🚀 <i>Postni ijtimoiy tarmoqqa joylab, bosqichini "Chop etilgan" ga o'tkazishingiz mumkin!</i>`);

        await client.sendMessage(entity, { message: lines.join("\n"), parseMode: "html" });
        await makeCallWithClient(client, entity, `Kontent vaqti bo'ldi: ${item.title}`);

        await db
          .update(contentItems)
          .set({ notified: true })
          .where(eq(contentItems.id, item.id));
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
