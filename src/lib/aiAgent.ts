import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { db } from "@/db";
import { tasks, routines, videos, books, settings } from "@/db/schema";
import { eq, or, isNull, and } from "drizzle-orm";
import { createSummaryPdf } from "@/lib/pdfService";

export interface AgentResponse {
  text: string;
  pdfUrl?: string;
  actionTaken?: string;
}

// ─── 1. Tool Implementations ───

/**
 * a) Belgilangan sana bo'yicha tasks va routines jadvallaridan kungi rejalarni oladi
 */
export async function getCalendarSchedule(params: { date?: string }) {
  const d = new Date();
  const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const targetDate = params.date || todayISO;

  try {
    // 1. Tasks
    const dayTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.date, targetDate));

    // 2. Routines (shu sana uchun yoki har kuni takrorlanuvchi targetDate IS NULL)
    const dayRoutines = await db
      .select()
      .from(routines)
      .where(
        or(
          eq(routines.targetDate, targetDate),
          isNull(routines.targetDate)
        )
      );

    return {
      date: targetDate,
      tasks: dayTasks.map((t) => ({
        id: t.id,
        title: t.title,
        completed: !!t.completed,
        category: t.category,
      })),
      routines: dayRoutines.map((r) => ({
        id: r.id,
        time: r.time,
        startTime: r.startTime,
        endTime: r.endTime,
        title: r.title,
        done: r.lastDoneDate === targetDate,
        streak: r.streak || 0,
      })),
    };
  } catch (error: any) {
    console.error("getCalendarSchedule error:", error);
    return { error: error.message, date: targetDate, tasks: [], routines: [] };
  }
}

/**
 * b) tasks jadvaliga yangi vazifa yozadi
 */
export async function createTask(params: {
  title: string;
  date?: string;
  category?: string;
}) {
  const d = new Date();
  const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const targetDate = params.date || todayISO;
  const category = params.category || "personal";

  try {
    const [created] = await db
      .insert(tasks)
      .values({
        title: params.title.trim(),
        date: targetDate,
        category,
        completed: false,
      })
      .returning();

    return {
      success: true,
      message: `Vazifa muvaffaqiyatli saqlandi!`,
      task: created,
    };
  } catch (error: any) {
    console.error("createTask error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * c) Videoni videos jadvaliga kiritadi, createSummaryPdf orqali PDF kitob yaratib,
 * books jadvaliga saqlaydi
 */
export async function saveYouTubeAndBook(params: {
  youtubeUrl: string;
  title: string;
  summaryBookText: string;
}) {
  try {
    // 1. YouTube videoId ni aniqlash
    let videoId = "";
    try {
      const u = new URL(params.youtubeUrl);
      if (u.hostname.includes("youtu.be")) {
        videoId = u.pathname.slice(1);
      } else if (u.searchParams.has("v")) {
        videoId = u.searchParams.get("v") || "";
      }
    } catch {}

    // 2. videos jadvaliga kiritish
    const [savedVideo] = await db
      .insert(videos)
      .values({
        title: params.title.trim(),
        url: params.youtubeUrl,
        videoId: videoId || `yt_${Date.now()}`,
        category: "rivojlanish",
        summary: params.summaryBookText,
        watched: false,
      })
      .returning();

    // 3. PDF kitob hosil qilish (src/lib/pdfService.ts)
    const pdfUrl = await createSummaryPdf(
      params.title.trim(),
      params.summaryBookText
    );

    // 4. books jadvaliga kiritish
    const [savedBook] = await db
      .insert(books)
      .values({
        title: params.title.trim(),
        author: "AI Podkast Xulosasi",
        pdfUrl,
        summary: params.summaryBookText,
        status: "rejalashtirilgan",
        totalPages: 5,
        currentPage: 0,
      })
      .returning();

    return {
      success: true,
      message: "Video va PDF xulosa kitobchasi saqlandi!",
      videoId: savedVideo.id,
      bookId: savedBook.id,
      pdfUrl,
      title: params.title,
    };
  } catch (error: any) {
    console.error("saveYouTubeAndBook error:", error);
    return { success: false, error: error.message };
  }
}

// ─── 2. Gemini Function Declarations ───

const getCalendarScheduleDeclaration: FunctionDeclaration = {
  name: "getCalendarSchedule",
  description:
    "Foydalanuvchining taqvimidagi kunlik rejalari, intizom odatlari va vazifalarini DB dan olib beradi.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      date: {
        type: Type.STRING,
        description: "Rejalarni olish sanasi (YYYY-MM-DD formatida, masalan: 2026-10-15). Agar berilmasa bugungi sana olinadi.",
      },
    },
  },
};

const createTaskDeclaration: FunctionDeclaration = {
  name: "createTask",
  description:
    "Foydalanuvchining kunlik rejalari ro'yxatiga yangi vazifa (task) qo'shadi.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "Vazifaning aniq nomi yoki tavsifi.",
      },
      date: {
        type: Type.STRING,
        description: "Vazifa sanasi (YYYY-MM-DD formatida). Agar aytilmasa bugungi sana.",
      },
      category: {
        type: Type.STRING,
        description: "Kategoriya (masalan: personal, work, study). Standart: personal.",
      },
    },
    required: ["title"],
  },
};

const saveYouTubeAndBookDeclaration: FunctionDeclaration = {
  name: "saveYouTubeAndBook",
  description:
    "YouTube video yoki podkast havolasini qabul qilib, uni 'videos' (Rivojlanish) bo'limiga kiritadi va matnli xulosasidan PDF kitobcha yaratib, 'books' (Kitoblar) bo'limiga saqlaydi.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      youtubeUrl: {
        type: Type.STRING,
        description: "YouTube video yoki podkast havolasi (URL).",
      },
      title: {
        type: Type.STRING,
        description: "Video / Kitobning to'liq va jozibali sarlavhasi.",
      },
      summaryBookText: {
        type: Type.STRING,
        description:
          "Videoning batafsil, professional va tizimli xulosasi (Kirish, Asosiy g'oyalar, Muhim saboqlar, Amaliy tavsiyalar va Yakuniy xulosa). Ushbu matn to'g'ridan-to'g'ri PDF kitobga kiritiladi.",
      },
    },
    required: ["youtubeUrl", "title", "summaryBookText"],
  },
};

// ─── 3. Main Agent Processor ───

export async function processAgentMessage(
  userText: string,
  context?: { senderId?: string; username?: string }
): Promise<AgentResponse> {
  const clean = userText.trim();
  if (!clean) {
    return { text: "Assalomu alaykum Sohibjon! Sizga qanday yordam bera olaman?" };
  }

  // 1. API kalitini aniqlash (DB yoki env)
  let apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    try {
      const [k] = await db
        .select()
        .from(settings)
        .where(eq(settings.key, "gemini_api_key"));
      if (k?.value) apiKey = k.value;
    } catch {}
  }

  const d = new Date();
  const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // Agar Gemini API kaliti mavjud bo'lsa — to'liq Function Calling agentini ishlatamiz
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const systemInstruction = `Siz FlowDesk loyihasining shaxsiy aqlli boshqaruv AI Agentisiz.
Sizning xo'jayiningiz va foydalanuvchingiz: Sulaymonov Sohibjon (@sulaymonovss, ID: 6724823030).
Bugungi sana: ${todayISO}.

Muloqot qoidalari:
1. Sohibjonga samimiy, hurmatli, muloyim va professional o'zbek tilida murojaat qiling ("Sohibjon", "Bajarildi Sohibjon!", "Tushundim").
2. Sizda quyidagi amaliy vositalar (tools) mavjud:
   - getCalendarSchedule: Sohibjonning taqvimidagi kunlik rejalari yoki vazifalarini ko'rish.
   - createTask: yangi reja yoki vazifa kiritish.
   - saveYouTubeAndBook: YouTube havolasini qabul qilib, chuqur tahliliy xulosa hosil qilib, uni 'videos' va 'books' (PDF kitob) ga saqlash.
3. Agar Sohibjon YouTube video yoki havola bersa, videoning mazmunli konspektini o'zingiz chiroyli tuzib berib, uni 'saveYouTubeAndBook' vositasi orqali bazaga va PDF kitobga saqlang!
4. Agar taqvim yoki rejalar so'ralsa, 'getCalendarSchedule' orqali olib, tartibli ro'yxat ko'rinishida taqdim eting.
5. Har bir vazifani aniq va lo'nda yakunlang.`;

      // 1-bosqich: Modelga foydalanuvchi so'rovini yuboramiz
      const chatResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: clean,
        config: {
          systemInstruction,
          tools: [
            {
              functionDeclarations: [
                getCalendarScheduleDeclaration,
                createTaskDeclaration,
                saveYouTubeAndBookDeclaration,
              ],
            },
          ],
        },
      });

      const functionCalls = chatResponse.functionCalls;

      // Agar model tool chaqirgan bo'lsa
      if (functionCalls && functionCalls.length > 0) {
        let lastPdfUrl: string | undefined = undefined;
        const toolResponses: any[] = [];

        for (const call of functionCalls) {
          const args = (call.args as any) || {};
          let result: any = null;

          if (call.name === "getCalendarSchedule") {
            result = await getCalendarSchedule(args);
          } else if (call.name === "createTask") {
            result = await createTask(args);
          } else if (call.name === "saveYouTubeAndBook") {
            result = await saveYouTubeAndBook(args);
            if (result.pdfUrl) lastPdfUrl = result.pdfUrl;
          }

          toolResponses.push({
            name: call.name,
            response: result,
          });
        }

        // 2-bosqich: Natijalarni modelga qaytarib, yakuniy o'zbekcha chiroyli javob olamiz
        const finalResponse = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [
            { role: "user", parts: [{ text: clean }] },
            {
              role: "model",
              parts: functionCalls.map((fc) => ({
                functionCall: { name: fc.name, args: fc.args },
              })),
            },
            {
              role: "user",
              parts: toolResponses.map((tr) => ({
                functionResponse: {
                  name: tr.name,
                  response: tr.response,
                },
              })),
            },
          ],
          config: {
            systemInstruction,
          },
        });

        const replyText = finalResponse.text || "Barcha buyruqlar muvaffaqiyatli bajarildi, Sohibjon!";
        return {
          text: replyText,
          pdfUrl: lastPdfUrl,
          actionTaken: functionCalls.map((c) => c.name).join(", "),
        };
      }

      // Agar oddiy suhbat bo'lsa
      if (chatResponse.text) {
        return { text: chatResponse.text };
      }
    } catch (err) {
      console.error("Gemini Agent runtime error:", err);
    }
  }

  // ─── 4. Fallback (Agar API kalit bo'lmasa yoki vaqtincha xatolik bo'lsa) ───

  // A. YouTube link aniqlansa
  const ytMatch = clean.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s]+/i);
  if (ytMatch) {
    const url = ytMatch[0];
    const defaultTitle = clean.replace(url, "").trim() || "Foydali YouTube Podkasti";
    const summary =
      `# ${defaultTitle}\n\n` +
      `📌 Manba havolasi: ${url}\n\n` +
      `💡 Asosiy g'oyalar:\n` +
      `- Ushbu video FlowDesk orqali shaxsiy rivojlanish va kitoblar xulosasi bazasiga kiritildi.\n` +
      `- Doimiy intizom va yangi bilimlar o'zlashtirish uchun tavsiya etiladi.\n\n` +
      `🚀 Amaliy tavsiya:\n` +
      `- Asosiy tushunchalarni FlowDesk taqvimi bo'yicha amalda sinab ko'ring.`;

    const res = await saveYouTubeAndBook({
      youtubeUrl: url,
      title: defaultTitle,
      summaryBookText: summary,
    });

    return {
      text:
        `📹 <b>Video va PDF xulosa muvaffaqiyatli saqlandi, Sohibjon!</b>\n\n` +
        `📌 <b>Nomi:</b> ${defaultTitle}\n` +
        `📂 <b>Videolar:</b> Rivojlanish bo'limiga kiritildi\n` +
        `📚 <b>Kitoblar:</b> Yangi PDF kitobcha shakllantirildi\n` +
        (res.pdfUrl ? `🔗 <b>PDF havolasi:</b> ${res.pdfUrl}\n` : "") +
        `\nFlowDesk platformangizda bemalol o'qishingiz mumkin! 🚀`,
      pdfUrl: res.pdfUrl,
      actionTaken: "saveYouTubeAndBook",
    };
  }

  // B. Taqvim / Rejalar so'ralsa
  if (/reja|taqvim|jadval|bugun nima|ertaga nima/i.test(clean)) {
    const isTomorrow = /ertaga/i.test(clean);
    const tmDate = new Date(d);
    if (isTomorrow) tmDate.setDate(tmDate.getDate() + 1);
    const qDate = `${tmDate.getFullYear()}-${String(tmDate.getMonth() + 1).padStart(2, "0")}-${String(tmDate.getDate()).padStart(2, "0")}`;

    const sched = await getCalendarSchedule({ date: qDate });
    let text = `📅 <b>${isTomorrow ? "Ertangi" : "Bugungi"} rejalaringiz (${sched.date}):</b>\n\n`;

    if (sched.routines.length > 0) {
      text += `⏰ <b>Intizom & Tartib:</b>\n`;
      sched.routines.forEach((r) => {
        text += `${r.done ? "✅" : "⚪"} ${r.time} — ${r.title}\n`;
      });
      text += `\n`;
    }

    if (sched.tasks.length > 0) {
      text += `📋 <b>Vazifalar:</b>\n`;
      sched.tasks.forEach((t) => {
        text += `${t.completed ? "✅" : "⬜"} ${t.title}\n`;
      });
    } else {
      text += `Hozircha qo'shimcha vazifalar kiritilmagan.`;
    }

    return { text, actionTaken: "getCalendarSchedule" };
  }

  // C. Yangi vazifa qo'shish so'ralsa
  if (/vazifa|qo'?sh|yozib qo'?y|kirit/i.test(clean) && !/rasm|hisob|mijoz/i.test(clean)) {
    const title = clean.replace(/vazifa|qo'?sh|yozib qo'?y|kirit|bugun|ertaga/gi, "").trim() || "Yangi vazifa";
    const res = await createTask({ title, date: todayISO });
    return {
      text: `✅ <b>Vazifa taqvimga kiritildi, Sohibjon!</b>\n\n📋 <b>Ish:</b> ${title}\n📅 <b>Sana:</b> ${todayISO}`,
      actionTaken: "createTask",
    };
  }

  return {
    text: `Tushundim Sohibjon! 😊 Sizga taqvimingizni ko'rsatishim, yangi vazifa kiritishim yoki YouTube videolarni xulosa qilib PDF kitob yaratib berishim mumkin. Qanday buyruq bajaramiz? 🚀`,
  };
}
