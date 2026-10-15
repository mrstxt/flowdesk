/**
 * FlowDesk Ovozli va Matnli Rejalarni Tahlil Qilish (AI Task & Routine Parser)
 *
 * Foydalanuvchi og'zaki yoki matn shaklida ertangi ishlarini aytganda,
 * ularni vaqtlari, deadlinelari bilan ajratib olib DB ga saqlaydi.
 */

import { db } from "@/db";
import { tasks, routines } from "@/db/schema";

export type ParsedPlan = {
  time?: string;
  startTime?: string;
  endTime?: string;
  title: string;
  isRoutine?: boolean;
};

/**
 * Matndan sana (bugun yoki ertaga) ekanligini aniqlash.
 * Qat'iy qoida:
 * 1. Agar "bugun" deb aytilsa — soat 00:00 dan 23:59 gacha qat'iy ravishda BUGUN (todayISO).
 * 2. Agar "ertaga" deb aytilsa — qat'iy ravishda ERTAGA (tomorrowISO).
 * 3. Agar sana aytilmasa — Toshkent vaqti bilan 00:00 dan 20:00 gacha bugun, 20:00 dan keyin ertaga.
 */
export function detectPlanDate(
  input: string,
  currentHour?: number
): { dateType: "today" | "tomorrow"; isExplicit: boolean } {
  const lower = input.toLowerCase();
  if (/(bugun|bugungi|bugunga)/i.test(lower)) {
    return { dateType: "today", isExplicit: true };
  }
  if (/(ertag|ertangi|ertaga)/i.test(lower)) {
    return { dateType: "tomorrow", isExplicit: true };
  }

  // Toshkent vaqti bo'yicha soatni aniqlash
  let hour = currentHour;
  if (hour === undefined) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tashkent",
      hour: "numeric",
      hour12: false,
    });
    hour = parseInt(formatter.format(now), 10) || 0;
  }

  // 00:00 dan 19:59 gacha bugun, faqat kechki 20:00 dan 23:59 gacha ertaga deb qabul qilinadi
  const defaultTomorrow = hour >= 20;
  return { dateType: defaultTomorrow ? "tomorrow" : "today", isExplicit: false };
}

function normalizeTimeString(raw?: string): string | undefined {
  if (!raw) return undefined;
  let clean = raw.replace(".", ":").replace("-", ":").trim();
  if (!clean.includes(":")) {
    const h = parseInt(clean, 10);
    if (!isNaN(h) && h >= 0 && h <= 24) {
      return `${String(h).padStart(2, "0")}:00`;
    }
    return undefined;
  }
  const [h, m] = clean.split(":");
  return `${h.padStart(2, "0")}:${(m || "00").padStart(2, "0")}`;
}

/**
 * Matndan yoki transkripsiyadan o'zbekcha vaqt va vazifalarni ajratish.
 * MUHIM: Faqat haqiqiy rejalarni (vaqti bor yoki aniq reja strukturasi) oladi.
 * Oddiy gap, savol yoki suhbatni reja deb qabul qilmaydi!
 */
export function parseSpokenPlans(input: string): ParsedPlan[] {
  const results: ParsedPlan[] = [];
  const lines = input.split(/[\n,;]|\bva\b/gi);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.length < 3) continue;

    const lower = line.toLowerCase();

    // Savol, buyruq, o'chirish, telefon qilish yoki xizmat gaplarini darhol o'tkazib yuborish
    if (
      /^(alo|salom|assalom|ha|yoq|yo'q|rahmat|xop|xo'p|nima|nimalar|qanaqa|qalay|qalesiz)/i.test(lower) ||
      /(kartada|balans|pulim|hisobim|savol|bormi|qancha)/i.test(lower) ||
      /(o'?chir|ob\s*tashla|olib\s*tashla|bekor\s*qil|tozala|tozalab\s*tashla|yangi\s*tuzamiz)/i.test(lower) ||
      /(tel\s*qil|telefon\s*qil|manga\s*tel|menga\s*tel|qo'?ng'?iroq\s*qil|chaqir)/i.test(lower) ||
      /(ozgartir|o'zgartir|almashtir|yozishing\s*kerak\s*edi|eslab\s*qolyapti|nimaga|qob\s*ketgan|ochmagan|o'chmagan)/i.test(lower)
    ) {
      continue;
    }

    // Reklama / tijoriy e'lon bo'lsa o'tkazib yuborish
    if (/(sotiladi|ulgurji|zavoddan|kafolat|skidka|aksiya|narxlar|dona|metr|optom)/i.test(line)) {
      continue;
    }

    let parsedTime: string | undefined;
    let startTime: string | undefined;
    let endTime: string | undefined;
    let textWithoutTime = line;

    // 1. Vaqt oralig'i (Time range): masalan "12:00 dan 12:30 gacha", "soat 12 dan 13:00 gacha", "14:00 - 15:30"
    const rangeMatch = line.match(
      /(?:soat\s*)?([0-2]?[0-9](?::[0-5][0-9])?)\s*(?:dan|-|—)\s*(?:soat\s*)?([0-2]?[0-9](?::[0-5][0-9])?)\s*(?:gacha)?/i
    );

    if (rangeMatch) {
      startTime = normalizeTimeString(rangeMatch[1]);
      endTime = normalizeTimeString(rangeMatch[2]);
      parsedTime = startTime;
      textWithoutTime = textWithoutTime.replace(rangeMatch[0], "");
    } else {
      // 2. Yagona vaqt: 09:00, 9:00, 09.00, "soat 9 da", "soat 14 da", "14:30 da"
      const singleMatch =
        line.match(/(\b[0-2]?[0-9][:.-][0-5][0-9]\b)/) ||
        line.match(/soat\s*([0-2]?[0-9])(?::([0-5][0-9]))?/i) ||
        line.match(/\b([0-2]?[0-9])\s*(?:da|gacha|yarimda)\b/i);

      if (singleMatch) {
        let rawTime = singleMatch[1].replace(".", ":").replace("-", ":");
        if (!rawTime.includes(":")) {
          const hourNum = parseInt(rawTime, 10);
          if (!isNaN(hourNum) && hourNum >= 0 && hourNum <= 24) {
            const isHalf = line.toLowerCase().includes("yarim");
            const min = isHalf ? "30" : "00";
            rawTime = `${String(hourNum).padStart(2, "0")}:${min}`;
            parsedTime = rawTime;
          }
        } else {
          parsedTime = normalizeTimeString(rawTime);
        }
        startTime = parsedTime;
        textWithoutTime = textWithoutTime.replace(singleMatch[0], "");
      }
    }

    const hasExplicitPrefix = /^(?:reja|vazifa|ishim):\s*/i.test(line) || /^[0-9]+[.)]\s+/.test(line);

    // Agar aniq vaqti bo'lmasa VA aniq prefiks bo'lmasa -> o'tkazib yuborish
    if (!parsedTime && !hasExplicitPrefix) {
      continue;
    }

    // Title ni tozalash: ortiqcha to'ldiruvchi so'zlar va buyruq fe'llarini olib tashlaymiz
    let cleanTitle = textWithoutTime
      .replace(/\b(bugun|bugungi|bugunga|ertaga|ertangi)\b/gi, "")
      .replace(/\b(soat\s*[0-2]?[0-9](?::[0-5][0-9])?)\b/gi, "")
      .replace(/\b([0-2]?[0-9]\s*(?:yarim|yarimda|gacha|da|dan))\b/gi, "")
      .replace(/\b(dan|gacha|da|vaqtida|soat|ertalab|kechqurun|tushlikda)\b/gi, "")
      .replace(/\b(man|men|menga|manga|biz|bizga)\b/gi, "")
      .replace(/\b(kerakda|kerak|lozim|shart|kerak edi|bo'?lsin|bosin)\b/gi, "")
      .replace(
        /\b(yozib\s*(?:qo'?y|qoy|ber|yubor)|yozvor|yozib|yoz|kiritib\s*qo'?y|kirit|qo'?shib\s*qo'?y|qo'?sh|eslatib\s*(?:qo'?y|qoy|ber|yubor)|eslatvor|eslat)\b/gi,
        ""
      )
      .replace(/\b(di\b|ni\b)/gi, "")
      .replace(/(?:qilishdi|qilishni)\b/gi, "qilish")
      .replace(/(?:borishdi|borishni)\b/gi, "borish")
      .replace(/(?:o'?qishdi|o'?qishni)\b/gi, "o'qish")
      .replace(/(?:ko'?rishdi|ko'?rishni)\b/gi, "ko'rish")
      .replace(/^[-•*0-9.)\s~🔹✔️🌱💧📞%]+/, "")
      .replace(/[*_~`]+/g, "")
      .replace(/^(reja|vazifa|ishim):\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();

    // "qilishdi" yoki boshqa fe'l qo'shimchasi oxirida qolib ketgan bo'lsa
    cleanTitle = cleanTitle.replace(/(ish|sh)(?:di|ni)$/i, "$1");

    // Agar fe'l shakli bo'lsa (oqishim -> o'qish, borishim -> borish)
    cleanTitle = cleanTitle
      .replace(/\boqishim\b/gi, "kitob o'qish")
      .replace(/\bborishim\b/gi, "borish")
      .replace(/\bqilishim\b/gi, "qilish");

    // Vaqtsiz bo'lsa — kamida 2 ta so'zdan iborat va 4 belgidan uzun bo'lishi shart
    if (!parsedTime && cleanTitle.split(/\s+/).length < 2) {
      continue;
    }

    if (cleanTitle.length >= 3) {
      results.push({
        time: parsedTime,
        startTime,
        endTime,
        title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
        isRoutine: Boolean(parsedTime),
      });
    }
  }

  return results;
}

/**
 * Tahlil qilingan rejalarni ma'lumotlar bazasiga ertangi kun sanasi bilan saqlash
 */
export async function saveParsedPlansToDb(
  plans: ParsedPlan[],
  targetDateISO: string
): Promise<{ savedTasks: number; savedRoutines: number }> {
  let savedTasks = 0;
  let savedRoutines = 0;

  for (const item of plans) {
    // 1. Kunlik vazifalar (tasks) ga qo'shish
    await db.insert(tasks).values({
      title: item.title,
      date: targetDateISO,
      completed: false,
      category: "personal",
    });
    savedTasks++;

    // 2. Agar aniq vaqti bo'lsa, intizom/jadval (routines) ga ham qo'shish
    if (item.time) {
      await db.insert(routines).values({
        time: item.time,
        title: item.title,
        targetDate: targetDateISO,
        startTime: item.startTime || item.time,
        endTime: item.endTime || null,
        streak: 0,
      });
      savedRoutines++;
    }
  }

  return { savedTasks, savedRoutines };
}

/**
 * Telegram ovozli xabarini yuklab olib, Gemini orqali o'zbekcha matnga aylantirish (Transcribe)
 */
export async function transcribeTelegramVoice(fileId: string, botToken: string): Promise<string | null> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey || !botToken || !fileId) return null;

  try {
    // 1. Fayl yo'lini Telegram dan olish
    const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    if (!fileData.ok || !fileData.result?.file_path) return null;

    // 2. Audio faylni yuklab olish
    const audioRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`);
    const arrayBuffer = await audioRes.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    // 3. Gemini 2.5 Flash / 1.5 Flash ga yuborish
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiApiKey}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Sen o'zbek tilidagi audio xabarlarni juda aniq matnga aylantiruvchi yordamchisan. Ushbu ovozli xabarda aytilgan gaplarni aynan o'zbek tilida yozib ber. Hech qanday boshqa izoh, xulosa yoki belgi qo'shma, faqatgina aytilgan gaplarni matnini qaytar.",
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
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : null;
  } catch (err) {
    console.error("Gemini voice transcribe error:", err);
    return null;
  }
}

