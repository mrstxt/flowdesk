import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { db } from "@/db";
import { tasks, routines, videos, books, settings } from "@/db/schema";
import { eq, or, isNull, and, ilike } from "drizzle-orm";
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
 * c) Vazifani bajarildi deb belgilash
 */
export async function completeTask(params: { taskId?: number; title?: string }) {
  const d = new Date();
  const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  try {
    if (params.taskId) {
      const numId = Number(params.taskId);
      const [updatedTask] = await db
        .update(tasks)
        .set({ completed: true })
        .where(eq(tasks.id, numId))
        .returning();

      if (updatedTask) {
        return {
          success: true,
          message: `"${updatedTask.title}" vazifasi bajarildi deb belgilandi! 🎉`,
          task: updatedTask,
        };
      }

      const [updatedRoutine] = await db
        .update(routines)
        .set({ lastDoneDate: todayISO })
        .where(eq(routines.id, numId))
        .returning();

      if (updatedRoutine) {
        return {
          success: true,
          message: `"${updatedRoutine.title}" odati bajarildi deb belgilandi! 🎉`,
          routine: updatedRoutine,
        };
      }
    }

    if (params.title) {
      const pattern = `%${params.title.trim().toLowerCase()}%`;
      const updatedTasks = await db
        .update(tasks)
        .set({ completed: true })
        .where(ilike(tasks.title, pattern))
        .returning();

      const updatedRoutines = await db
        .update(routines)
        .set({ lastDoneDate: todayISO })
        .where(ilike(routines.title, pattern))
        .returning();

      if (updatedTasks.length > 0 || updatedRoutines.length > 0) {
        const name = updatedTasks[0]?.title || updatedRoutines[0]?.title || params.title;
        return {
          success: true,
          message: `"${name}" vazifasi muvaffaqiyatli bajarildi deb belgilandi! 🎉`,
        };
      }
    }

    return { success: false, message: "Mos keluvchi ochiq vazifa topilmadi." };
  } catch (error: any) {
    console.error("completeTask error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * d) Deadlineni yoki vaqtni surish
 */
export async function rescheduleTask(params: {
  taskId?: number;
  title?: string;
  newTimeOrDate?: string;
}) {
  const d = new Date();
  const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  let targetDate: string | undefined = undefined;
  let targetTime: string | undefined = undefined;

  if (params.newTimeOrDate) {
    const val = params.newTimeOrDate.trim();
    if (/^\d{1,2}:\d{2}$/.test(val)) {
      targetTime = val.padStart(5, "0");
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      targetDate = val;
    } else if (/ertaga/i.test(val)) {
      const tm = new Date(d);
      tm.setDate(tm.getDate() + 1);
      targetDate = `${tm.getFullYear()}-${String(tm.getMonth() + 1).padStart(2, "0")}-${String(tm.getDate()).padStart(2, "0")}`;
    }
  }

  if (!targetDate && !targetTime) {
    const tm = new Date(d);
    tm.setDate(tm.getDate() + 1);
    targetDate = `${tm.getFullYear()}-${String(tm.getMonth() + 1).padStart(2, "0")}-${String(tm.getDate()).padStart(2, "0")}`;
  }

  try {
    if (params.taskId) {
      const numId = Number(params.taskId);
      if (targetDate) {
        await db.update(tasks).set({ date: targetDate }).where(eq(tasks.id, numId));
      }
      if (targetTime || targetDate) {
        await db
          .update(routines)
          .set({
            ...(targetTime ? { startTime: targetTime, time: targetTime } : {}),
            ...(targetDate ? { targetDate } : {}),
          })
          .where(eq(routines.id, numId));
      }
      return {
        success: true,
        message: `Vazifa yangi vaqtga (${targetDate || ""} ${targetTime || ""}) muvaffaqiyatli surildi! ⏱️`,
      };
    }

    if (params.title) {
      const pattern = `%${params.title.trim().toLowerCase()}%`;
      if (targetDate) {
        await db.update(tasks).set({ date: targetDate }).where(ilike(tasks.title, pattern));
      }
      if (targetTime || targetDate) {
        await db
          .update(routines)
          .set({
            ...(targetTime ? { startTime: targetTime, time: targetTime } : {}),
            ...(targetDate ? { targetDate } : {}),
          })
          .where(ilike(routines.title, pattern));
      }
      return {
        success: true,
        message: `"${params.title}" vazifasi yangi vaqtga (${targetDate || ""} ${targetTime || ""}) surildi! ⏱️`,
      };
    }

    return { success: false, message: "Vazifa topilmadi." };
  } catch (error: any) {
    console.error("rescheduleTask error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * e) Videoni videos jadvaliga kiritadi, createSummaryPdf orqali PDF kitob yaratib,
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

const completeTaskDeclaration: FunctionDeclaration = {
  name: "completeTask",
  description: "Bajarilgan vazifa yoki odatni tugallandi (bajarildi) deb belgilaydi.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: { type: Type.INTEGER, description: "Vazifaning ID raqami (agar ma'lum bo'lsa)" },
      title: { type: Type.STRING, description: "Bajarilgan vazifa nomi (masalan: 'kitob o'qish' yoki 'dizayn tayyorlash')" },
    },
  },
};

const rescheduleTaskDeclaration: FunctionDeclaration = {
  name: "rescheduleTask",
  description: "Vazifaning muddatini (deadline yoki soatini) yangi vaqtga yoki ertangi kunga suradi.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: { type: Type.INTEGER, description: "Vazifa ID raqami" },
      title: { type: Type.STRING, description: "Vazifa nomi" },
      newTimeOrDate: { type: Type.STRING, description: "Yangi sana yoki soat (masalan: '17:00' yoki '2026-10-16' yoki 'ertaga')" },
    },
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

      const systemInstruction = `Siz FlowDesk loyihasining shaxsiy aqlli boshqaruv kotibi va intizom kuratorisiz (Madina).
Foydalanuvchingiz: Sulaymonov Sohibjon (@sulaymonovss, ID: 6724823030).
Bugungi sana: ${todayISO}.

Muloqot qoidalari va xarakteringiz:
1. Siz shunchaki bot emassiz — tirik insondek, do'stona, g'amxo'r, tirishqoq va intizomli shaxsiy yordamchisiz.
2. Sohibjonga doimo samimiy, hurmatli o'zbek tilida murojaat qiling ("Sohibjon", "Bajarildi Sohibjon!", "Tushundim").
3. Sizda quyidagi amaliy vositalar (tools) mavjud:
   - getCalendarSchedule: Sohibjonning taqvimidagi kunlik rejalari yoki vazifalarini ko'rish.
   - createTask: yangi reja yoki vazifa kiritish.
   - completeTask: Sohibjon "bitirdim", "bajarildi", "tugatdim" deganda vazifani yopish.
   - rescheduleTask: Sohibjon "ulgurmadim", "yana vaqt kerak", "surib qo'y" deganda muddatni yangi soatga yoki ertaga surish.
   - saveYouTubeAndBook: YouTube havolasini qabul qilib, chuqur tahliliy xulosa hosil qilib, uni 'videos' va 'books' (PDF kitob) ga saqlash.
4. Agar Sohibjon YouTube video yoki havola bersa, videoning mazmunli konspektini o'zingiz chiroyli tuzib berib, uni 'saveYouTubeAndBook' vositasi orqali bazaga va PDF kitobga saqlang!
5. Agar taqvim yoki rejalar so'ralsa, 'getCalendarSchedule' orqali olib, tartibli ro'yxat ko'rinishida taqdim eting.
6. Javoblaringiz aniq, qisqa va qat'iy intizomni ushlashga undovchi bo'lsin.`;

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
                completeTaskDeclaration,
                rescheduleTaskDeclaration,
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
          } else if (call.name === "completeTask") {
            result = await completeTask(args);
          } else if (call.name === "rescheduleTask") {
            result = await rescheduleTask(args);
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

  // B. Vazifani tugatish / bitirdim
  if (/bitirdim|bajarildi|tugatdim|yopib qo'?y|bajardim/i.test(clean)) {
    const taskName = clean.replace(/bitirdim|bajarildi|tugatdim|yopib qo'?y|bajardim|vazifani/gi, "").trim();
    const res = await completeTask({ title: taskName || undefined });
    return {
      text: res.message || "Ajoyib, Sohibjon! Vazifa bajarildi deb belgilandi! 🎉",
      actionTaken: "completeTask",
    };
  }

  // C. Vaqtni surish / yana vaqt kerak
  if (/yana.*vaqt kerak|surib qo'?y|kechroq|keyinga sur/i.test(clean)) {
    const res = await rescheduleTask({ title: clean, newTimeOrDate: "ertaga" });
    return {
      text: res.message || "Tushundim Sohibjon, vazifangiz vaqti surildi! ⏱️",
      actionTaken: "rescheduleTask",
    };
  }

  // D. Taqvim / Rejalar so'ralsa
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

  // E. Yangi vazifa qo'shish so'ralsa
  if (/vazifa|qo'?sh|yozib qo'?y|kirit/i.test(clean) && !/rasm|hisob|mijoz/i.test(clean)) {
    const title = clean.replace(/vazifa|qo'?sh|yozib qo'?y|kirit|bugun|ertaga/gi, "").trim() || "Yangi vazifa";
    const res = await createTask({ title, date: todayISO });
    return {
      text: `✅ <b>Vazifa taqvimga kiritildi, Sohibjon!</b>\n\n📋 <b>Ish:</b> ${title}\n📅 <b>Sana:</b> ${todayISO}`,
      actionTaken: "createTask",
    };
  }

  return {
    text: `Tushundim Sohibjon! 😊 Sizga taqvimingizni ko'rsatishim, yangi vazifa kiritishim, bitirilgan ishlarni belgilashim yoki YouTube videolarni xulosa qilib PDF kitob yaratib berishim mumkin. Qanday buyruq bajaramiz? 🚀`,
  };
}
