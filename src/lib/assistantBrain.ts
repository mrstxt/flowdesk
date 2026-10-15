/**
 * FlowDesk yordamchisining "miyasi" (Gemini).
 *
 * Foydalanuvchining erkin yozgan (yoki ovozdan o'girilgan) gapini tushunadi:
 *  - oddiy suhbatga tabiiy, iliq javob qaytaradi;
 *  - gap ichidagi rejalar, buyurtmalar, kirim/chiqim va boshqa buyruqlarni
 *    tartiblab, strukturali "action"lar ro'yxatiga aylantiradi.
 *
 * Actionlarni bajarish (bazaga yozish, qo'ng'iroq qilish) voice-assistant.ts da.
 */

import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

export type BrainActionType =
  | "add_plan"
  | "list_plans"
  | "complete_plan"
  | "clear_plans"
  | "call"
  | "add_order"
  | "add_expense"
  | "add_income"
  | "balance"
  | "set_wake"
  | "save_video";

export interface BrainAction {
  type: BrainActionType;
  date?: string | null; // YYYY-MM-DD
  time?: string | null; // HH:MM
  title?: string | null;
  client_name?: string | null;
  amount?: number | null; // so'mda
  deadline?: string | null; // YYYY-MM-DD
  url?: string | null;
}

export interface BrainResult {
  reply: string;
  actions: BrainAction[];
}

export interface BrainContext {
  nowTime: string; // HH:MM (Toshkent)
  todayISO: string;
  tomorrowISO: string;
  weekday: string;
  todayPlansText: string; // bugungi rejalar qisqacha (kontekst uchun)
}

type Turn = { role: "user" | "assistant"; text: string };
const history: Turn[] = [];
const MAX_TURNS = 16;

export function rememberTurn(role: Turn["role"], text: string) {
  history.push({ role, text: text.slice(0, 1500) });
  while (history.length > MAX_TURNS) history.shift();
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

export function isBrainEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

function buildSystemInstruction(ctx: BrainContext): string {
  return `Sen Sohibjonning shaxsiy yordamchisisan. Telegramda u bilan o'zbek tilida (lotin yozuvida) do'stona, samimiy va tabiiy gaplashasan — xuddi yaqin, aqlli yordamchi odamdek. Robotdek emas.

HOZIRGI VAQT (Toshkent): ${ctx.nowTime}, ${ctx.weekday}.
BUGUN = ${ctx.todayISO}. ERTAGA = ${ctx.tomorrowISO}.

SANA QOIDALARI (juda muhim):
- "bugun" desa — har doim ${ctx.todayISO} (kun 23:59 gacha tugamaguncha bugun hisoblanadi).
- "ertaga" desa — har doim ${ctx.tomorrowISO}.
- "indinga" — ertadan keyingi kun. Hafta kunlari aytilsa — eng yaqin kelayotgan o'sha kun.
- Kun aytilmagan bo'lsa: soat 20:00 gacha bo'lsa bugun, 20:00 dan keyin ertaga.
- Vaqt: "8 da" ertalab bo'lsa 08:00; "kechki 8" yoki "kechqurun 8" = 20:00; "tushdan keyin 3" = 15:00. Aniq bo'lmasa mantiqan eng to'g'risini tanla (masalan "schoolga 8 da" = 08:00).

BUGUNGI REJALAR (kontekst uchun):
${ctx.todayPlansText || "(hozircha yo'q)"}

VAZIFANG:
1) Foydalanuvchi gapini to'liq tushun. U ko'pincha shoshib, xatolar bilan, aralash yozadi ("qiberish", "tel qil", "ochir", "disam") — ma'nosini tushun.
2) Gap ichidagi har bir aniq ishni alohida action qilib ajrat va tartibla:
   - add_plan: reja/eslatma/qilinadigan ish. title — qisqa, toza, tushunarli (masalan "Schoolga borish", "Kitob o'qish 30 daqiqa"). "eslatib qo'y", "yozib qo'y", "kerak" kabi so'zlarni title ga qo'shma. date va (bo'lsa) time ni to'ldir.
   - list_plans: rejalarni so'rasa ("rejalar qanday", "bugun nima bor", "nimalarni eslatishing kerak"). date ni to'ldir.
   - complete_plan: biror ishni bajarganini aytsa ("schoolga bordim", "kitobni o'qib bo'ldim"). title — qaysi reja.
   - clear_plans: rejalarni o'chirishni aniq so'rasa. date ni to'ldir.
   - call: "tel qil", "qo'ng'iroq qil", "chaqir" desa.
   - add_order: mijoz uchun ish/buyurtma (client_name, title, amount so'mda, deadline).
   - add_expense / add_income: pul sarflagani yoki pul tushgani (amount so'mda, title — nima uchun). "50 ming" = 50000, "1.5 mln" = 1500000, "$100" ≈ 100*12800.
   - balance: kartadagi pul / balansni so'rasa.
   - set_wake: uyg'onish vaqtini o'zgartirsa (time).
   - save_video: YouTube havola bersa (url, date — qachon ko'rish).
3) Hech qanday ish bo'lmasa (oddiy suhbat, "raxmat", ".", "qalaysan", hazil, maslahat so'rash) — actions bo'sh qoladi, faqat reply yoz.

REPLY QOIDALARI:
- Qisqa (1–3 gap), iliq, tabiiy. Sohibjon deb murojaat qilish mumkin, lekin har safar emas.
- Agar action bo'lsa, nima qilganingni qisqa tasdiqla (ro'yxatni to'liq takrorlama — tizim o'zi chiqaradi).
- list_plans yoki balance bo'lsa reply juda qisqa bo'lsin ("Mana bugungi rejalaring:" kabi).
- Tushunmasang — taxmin qilma, aniqlashtiruvchi savol ber.
- Emoji me'yorida (0–2 ta).`;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Foydalanuvchiga tabiiy o'zbekcha javob" },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [
              "add_plan",
              "list_plans",
              "complete_plan",
              "clear_plans",
              "call",
              "add_order",
              "add_expense",
              "add_income",
              "balance",
              "set_wake",
              "save_video",
            ],
          },
          date: { type: "string", nullable: true, description: "YYYY-MM-DD" },
          time: { type: "string", nullable: true, description: "HH:MM 24 soatlik" },
          title: { type: "string", nullable: true },
          client_name: { type: "string", nullable: true },
          amount: { type: "number", nullable: true },
          deadline: { type: "string", nullable: true, description: "YYYY-MM-DD" },
          url: { type: "string", nullable: true },
        },
        required: ["type"],
      },
    },
  },
  required: ["reply", "actions"],
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Gemini timeout")), ms)),
  ]);
}

/**
 * Xabarni tushunib, javob va actionlarni qaytaradi. Kalit bo'lmasa yoki xatolik bo'lsa null.
 */
export async function askBrain(message: string, ctx: BrainContext): Promise<BrainResult | null> {
  const ai = getClient();
  if (!ai) return null;

  const historyText = history
    .map((t) => `${t.role === "user" ? "Sohibjon" : "Yordamchi"}: ${t.text}`)
    .join("\n");

  const input = `${historyText ? `Oldingi suhbat:\n${historyText}\n\n` : ""}Sohibjonning yangi xabari:\n${message}`;

  try {
    const interaction: any = await withTimeout(
      ai.interactions.create({
        model: MODEL,
        input,
        system_instruction: buildSystemInstruction(ctx),
        store: false,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: RESPONSE_SCHEMA,
        },
      } as any),
      25000
    );

    const raw: string = interaction?.output_text ?? "";
    const parsed = JSON.parse(raw) as BrainResult;
    if (!parsed || typeof parsed.reply !== "string") return null;
    parsed.actions = Array.isArray(parsed.actions) ? parsed.actions : [];

    rememberTurn("user", message);
    rememberTurn("assistant", parsed.reply);
    return parsed;
  } catch (err) {
    console.error("🧠 Gemini xatolik:", (err as Error)?.message || err);
    return null;
  }
}

/**
 * Ovozli xabarni (ogg) o'zbekcha matnga o'giradi.
 */
export async function transcribeAudio(audio: Buffer, mimeType = "audio/ogg"): Promise<string | null> {
  const ai = getClient();
  if (!ai) return null;
  try {
    const interaction: any = await withTimeout(
      ai.interactions.create({
        model: MODEL,
        store: false,
        input: [
          {
            type: "text",
            text: "Bu o'zbek tilidagi ovozli xabar. Aytilgan gaplarni aynan o'zbekcha (lotin yozuvida) matn qilib yoz. Hech qanday izoh qo'shma.",
          },
          { type: "audio", data: audio.toString("base64"), mime_type: mimeType },
        ],
      } as any),
      30000
    );
    const text: string = (interaction?.output_text ?? "").trim();
    return text || null;
  } catch (err) {
    console.error("🎙️ Transkripsiya xatolik:", (err as Error)?.message || err);
    return null;
  }
}

