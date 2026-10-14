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
  title: string;
  isRoutine?: boolean;
};

/**
 * Matndan yoki transkripsiyadan o'zbekcha vaqt va vazifalarni ajratish
 */
export function parseSpokenPlans(input: string): ParsedPlan[] {
  const results: ParsedPlan[] = [];
  const lines = input.split(/[\n,;]|\bva\b/gi);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.length < 3) continue;

    // 09:00 yoki 9:00 yoki "soat 9 da" yoki "14:30 da" formatlarini qidirish
    const timeMatch =
      line.match(/(\b[0-2]?[0-9][:.]?[0-5][0-9]\b)/) ||
      line.match(/soat\s*([0-2]?[0-9])(?::([0-5][0-9]))?/i);

    let parsedTime: string | undefined;
    let cleanTitle = line;

    if (timeMatch) {
      let rawTime = timeMatch[1].replace(".", ":");
      if (!rawTime.includes(":")) {
        const min = timeMatch[2] || "00";
        rawTime = `${rawTime.padStart(2, "0")}:${min}`;
      } else if (rawTime.length === 4) {
        rawTime = `0${rawTime}`;
      }
      parsedTime = rawTime;
      cleanTitle = line.replace(timeMatch[0], "").replace(/\b(da|gacha|vaqtida|soat)\b/gi, "").trim();
    }

    cleanTitle = cleanTitle
      .replace(/^[-•*0-9.)\s]+/, "")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanTitle.length >= 2) {
      results.push({
        time: parsedTime,
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
        startTime: item.time,
        streak: 0,
      });
      savedRoutines++;
    }
  }

  return { savedTasks, savedRoutines };
}
