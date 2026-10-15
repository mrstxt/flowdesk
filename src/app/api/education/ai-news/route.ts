import { NextResponse } from "next/server";
import { db } from "@/db";
import { aiDailyNews, settings } from "@/db/schema";
import { desc, eq, and, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const CURATED_AI_NEWS = [
  {
    title: "Google Gemini 2.5 Flash Thinking modeli taqdim etildi",
    summary:
      "Google DeepMind yangi avlod fikrlash (reasoning) qobiliyatiga ega bo'lgan Gemini 2.5 Flash Thinking modelini e'lon qildi. Model murakkab dasturlash, matematika va mantiqiy masalalarni bosqichma-bosqich yechishda rekord natijalarni ko'rsatmoqda.",
    keyTakeaway:
      "Dasturchilar va tadqiqotchilar uchun murakkab arxitekturalarni loyihalash va kod xatolarini chuqur tahlil qilish tezligi 2 barobar oshdi.",
    sourceName: "Google DeepMind Blog",
    sourceUrl: "https://deepmind.google/technologies/gemini/",
    category: "LLM & Modellar",
  },
  {
    title: "Anthropic Claude 3.5: Kompyuterni mustaqil boshqarish (Computer Use)",
    summary:
      "Anthropic o'zining yangilangan Claude 3.5 Sonnet modeliga ekranni ko'rish, sichqonchani harakatlantirish va tugmalarni bosish orqali odam kabi kompyuterdan foydalanish imkoniyatini taqdim etdi.",
    keyTakeaway:
      "Rutin operatsiyalar, ma'lumotlarni turli dasturlar o'rtasida ko'chirish va brauzer orqali bajariladigan vazifalar to'liq avtomatlashtirilmoqda.",
    sourceName: "Anthropic Research",
    sourceUrl: "https://www.anthropic.com/news/3-5-models-and-computer-use",
    category: "AI Agentlar",
  },
  {
    title: "OpenAI GPT-4o Canvas va Realtime Voice API yangilanishi",
    summary:
      "OpenAI kod yozish va matn tahrirlash uchun maxsus interaktiv interfeys Canvas'ni taqdim qildi hamda real vaqt rejimida suhbatlashuvchi Realtime WebRTC API narxlarini pasaytirdi.",
    keyTakeaway:
      "AI bilan suhbatlashish va hujjatlar ustida birgalikda ishlash yangi bosqichga chiqdi — dasturchilar kodni bevosita oynada tuzata oladi.",
    sourceName: "OpenAI News",
    sourceUrl: "https://openai.com/index/introducing-canvas/",
    category: "Interaktiv AI",
  },
  {
    title: "Kling AI 1.5 va Runway Gen-3: Fotorealistik video generatsiyasi",
    summary:
      "Sun'iy intellekt orqali video yaratish tizimlari 4K sifat, tabiiy fizika qonunlari va yuz mimikalarini to'liq saqlab qolgan holda 10 soniyagacha bo'lgan ssenariylarni hosil qilmoqda.",
    keyTakeaway:
      "Kontent yaratuvchilar va dizaynerlar uchun video ishlab chiqarish xarajatlari sezilarli darajada kamayib, g'oyalarni vizuallashtirish osonlashdi.",
    sourceName: "TechCrunch AI",
    sourceUrl: "https://techcrunch.com/category/artificial-intelligence/",
    category: "Generativ Video",
  },
  {
    title: "Meta Llama 3.3 70B: Ochiq kodli modellar yetakchilikni o'z qo'liga olmoqda",
    summary:
      "Meta 405B modelining quvvatini ancha yengil 70B arxitekturaga siqib, shaxsiy server va lokal kompyuterlarda ham GPT-4 darajasidagi samaradorlikni taqdim etdi.",
    keyTakeaway:
      "Kompaniyalar o'z maxfiy ma'lumotlarini tashqariga chiqarmasdan o'z serverlarida eng kuchli AI yechimlarini tekin ishga tushirish imkoniga ega bo'ldi.",
    sourceName: "Meta AI Research",
    sourceUrl: "https://ai.meta.com/blog/",
    category: "Open Source AI",
  },
];

async function fetchFromGemini(apiKey: string): Promise<any[] | null> {
  try {
    const prompt = `Bugungi kundagi (va shu haftadagi) sun'iy intellekt (AI), mashina o'rganishi, LLMlar va texnologiya sohasidagi eng muhim va dolzarb bo'lgan 5 ta yangilikni aniqlang.
Har bir yangilik bo'yicha quyidagi formatda sof JSON massiv qaytaring:
[
  {
    "title": "Yangilik sarlavhasi (o'zbek tilida, qiziqarli, aniq va professional)",
    "summary": "Yangilikning qisqacha mazmuni (2-3 ta lo'nda jumla: nima bo'ldi, texnologiya nima qiladi)",
    "keyTakeaway": "Amaliy xulosa (foydalanuvchi yoki dasturchiga qanday foydasi bor)",
    "sourceName": "Manba nomi (masalan: Google DeepMind, OpenAI, Anthropic, TechCrunch, MIT Tech Review)",
    "sourceUrl": "Rasmiy havola yoki manba sayti linki",
    "category": "Kategoriya (masalan: LLM & Modellar, Multimodal & Video, AI Agentlar, Chip & Uskunalar, AI Biznes)"
  }
]
Muhim talab: Faqat va faqat to'g'ridan-to'g'ri JSON massiv qaytaring. Hech qanday Markdown (masalan \`\`\`json) yoki boshqa so'z qo'shmang.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    if (!res.ok) {
      console.warn("Gemini API non-200 response:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    // Remove markdown codeblock wrapper if any
    text = text.trim();
    if (text.startsWith("```json")) {
      text = text.substring(7);
    }
    if (text.startsWith("```")) {
      text = text.substring(3);
    }
    if (text.endsWith("```")) {
      text = text.substring(0, text.length - 3);
    }
    text = text.trim();

    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 5);
    }
    return null;
  } catch (e) {
    console.warn("Gemini news generation error:", e);
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date") || getTodayString();
    const forceRefresh = searchParams.get("refresh") === "true";

    // 1. Agar refresh so'ralmagan bo'lsa, avval DB dan tekshiramiz
    if (!forceRefresh) {
      const existing = await db
        .select()
        .from(aiDailyNews)
        .where(eq(aiDailyNews.newsDate, dateParam))
        .orderBy(asc(aiDailyNews.sortOrder), desc(aiDailyNews.createdAt));

      if (existing.length >= 5) {
        return NextResponse.json({
          success: true,
          date: dateParam,
          data: existing,
          source: "database",
        });
      }
    }

    // 2. Yangi yangiliklarni olish: Gemini API kaliti bormi?
    const [geminiKeySetting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "gemini_api_key"));

    const apiKey =
      geminiKeySetting?.value || process.env.GEMINI_API_KEY || "";

    let freshNews: any[] | null = null;
    if (apiKey) {
      freshNews = await fetchFromGemini(apiKey);
    }

    // Fallback sifatida eng so'nggi saralangan 5 ta AI yangilik
    if (!freshNews || freshNews.length < 5) {
      freshNews = CURATED_AI_NEWS;
    }

    // DB ga yozish (agar avvalgilari bo'lsa yangilaymiz)
    if (forceRefresh) {
      await db.delete(aiDailyNews).where(eq(aiDailyNews.newsDate, dateParam));
    }

    const insertedList = [];
    let order = 1;
    for (const item of freshNews) {
      const [saved] = await db
        .insert(aiDailyNews)
        .values({
          newsDate: dateParam,
          title: item.title,
          summary: item.summary,
          keyTakeaway: item.keyTakeaway || null,
          sourceName: item.sourceName || "AI News",
          sourceUrl: item.sourceUrl || "https://news.google.com",
          category: item.category || "AI & Tech",
          sortOrder: order++,
        })
        .returning();
      insertedList.push(saved);
    }

    return NextResponse.json({
      success: true,
      date: dateParam,
      data: insertedList,
      source: apiKey ? "gemini" : "curated",
    });
  } catch (error: any) {
    console.error("GET ai-news error:", error);
    return NextResponse.json(
      { success: false, error: "Server xatosi (batafsil logda)" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, summary, keyTakeaway, sourceName, sourceUrl, category, newsDate } = body;

    if (!title || !summary) {
      return NextResponse.json(
        { success: false, error: "Sarlavha va mazmun majburiy" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(aiDailyNews)
      .values({
        newsDate: newsDate || getTodayString(),
        title,
        summary,
        keyTakeaway: keyTakeaway || null,
        sourceName: sourceName || null,
        sourceUrl: sourceUrl || null,
        category: category || "AI & Tech",
      })
      .returning();

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    console.error("POST ai-news error:", error);
    return NextResponse.json(
      { success: false, error: "Server xatosi (batafsil logda)" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID majburiy" },
        { status: 400 }
      );
    }

    await db.delete(aiDailyNews).where(eq(aiDailyNews.id, Number(id)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE ai-news error:", error);
    return NextResponse.json(
      { success: false, error: "Server xatosi (batafsil logda)" },
      { status: 500 }
    );
  }
}

