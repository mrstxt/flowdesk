import { NextResponse } from "next/server";
import { db } from "@/db";
import { aiModels } from "@/db/schema";
import { desc, eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const DEFAULT_MODELS = [
  {
    name: "Midjourney",
    url: "https://www.midjourney.com",
    category: "image",
    description: "Eng yuqori sifatli badiiy va dizayn tasvirlari generatsiyasi",
    promptTemplate: "--ar 16:9 --v 6.1 --style raw",
    favorite: true,
  },
  {
    name: "Flux.1",
    url: "https://replicate.com/black-forest-labs",
    category: "image",
    description: "Fotorealistik feys rasmlari, odam anatomiyasi va matnli tasvirlar",
    promptTemplate: "photorealistic portrait, 8k resolution, cinematic lighting",
    favorite: true,
  },
  {
    name: "ChatGPT (GPT-4o)",
    url: "https://chatgpt.com",
    category: "text",
    description: "Kopirayting, Hook va CTA yozish, g'oyalar va strategiya",
    promptTemplate: "Ijtimoiy tarmoq uchun 3 soniyalik kuchli Hook va CTA yozib ber...",
    favorite: true,
  },
  {
    name: "Claude 3.5 Sonnet",
    url: "https://claude.ai",
    category: "text",
    description: "Ssenariylar, chuqur tahlil va mantiqiy maqolalar yaratish",
    promptTemplate: "Professional karusel ssenariysi: 4 ta kadr...",
    favorite: true,
  },
  {
    name: "Kling AI",
    url: "https://klingai.com",
    category: "video",
    description: "Rasmdan video generatsiyasi va harakatlantirish",
    promptTemplate: "cinematic camera movement, high dynamism",
    favorite: true,
  },
  {
    name: "HeyGen",
    url: "https://www.heygen.com",
    category: "video",
    description: "AI video spiker, avatar yaratish va dublyaj",
    promptTemplate: "Realistic talking avatar, uzbek speech",
    favorite: true,
  },
  {
    name: "ElevenLabs",
    url: "https://elevenlabs.io",
    category: "voice",
    description: "Professional ovozlashtirish va ovoz klonlash (Voice cloning)",
    promptTemplate: "Natural, energetic, storytelling tone",
    favorite: false,
  },
  {
    name: "Leonardo.ai",
    url: "https://leonardo.ai",
    category: "image",
    description: "O'yin grafikasi, personajlar va feys rasmlari",
    promptTemplate: "consistent character, dynamic pose",
    favorite: false,
  },
];

export async function GET() {
  try {
    let rows = await db
      .select()
      .from(aiModels)
      .orderBy(desc(aiModels.favorite), asc(aiModels.sortOrder), asc(aiModels.id));

    // Agar baza bo'sh bo'lsa, foydalanuvchiga qulay bo'lishi uchun standart modellarni avtomatik joylaymiz
    if (rows.length === 0) {
      await db.insert(aiModels).values(DEFAULT_MODELS);
      rows = await db
        .select()
        .from(aiModels)
        .orderBy(desc(aiModels.favorite), asc(aiModels.sortOrder), asc(aiModels.id));
    }

    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("GET /api/ai-models error:", err);
    return NextResponse.json({ error: "Server xatosi (batafsil logda)" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const url = String(body.url || "").trim();

    if (!name || !url) {
      return NextResponse.json(
        { error: "Model nomi va havolasi (URL) kiritilishi shart" },
        { status: 400 }
      );
    }

    const category = String(body.category || "image").trim();
    const description = body.description ? String(body.description).trim() : null;
    const promptTemplate = body.promptTemplate ? String(body.promptTemplate).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;
    const favorite = body.favorite !== undefined ? Boolean(body.favorite) : true;
    const sortOrder = Number(body.sortOrder) || 0;

    const [created] = await db
      .insert(aiModels)
      .values({
        name,
        url,
        category,
        description,
        promptTemplate,
        notes,
        favorite,
        sortOrder,
      })
      .returning();

    return NextResponse.json(created);
  } catch (err: any) {
    console.error("POST /api/ai-models error:", err);
    return NextResponse.json({ error: "Server xatosi (batafsil logda)" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const id = Number(body.id);
    if (!id) {
      return NextResponse.json({ error: "ID talab qilinadi" }, { status: 400 });
    }

    const payload: Record<string, unknown> = {};
    if (body.name !== undefined) payload.name = String(body.name).trim();
    if (body.url !== undefined) payload.url = String(body.url).trim();
    if (body.category !== undefined) payload.category = String(body.category).trim();
    if (body.description !== undefined) payload.description = body.description ? String(body.description).trim() : null;
    if (body.promptTemplate !== undefined) payload.promptTemplate = body.promptTemplate ? String(body.promptTemplate).trim() : null;
    if (body.notes !== undefined) payload.notes = body.notes ? String(body.notes).trim() : null;
    if (body.favorite !== undefined) payload.favorite = Boolean(body.favorite);
    if (body.sortOrder !== undefined) payload.sortOrder = Number(body.sortOrder) || 0;

    const [updated] = await db
      .update(aiModels)
      .set(payload)
      .where(eq(aiModels.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PUT /api/ai-models error:", err);
    return NextResponse.json({ error: "Server xatosi (batafsil logda)" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ error: "ID talab qilinadi" }, { status: 400 });
    }

    await db.delete(aiModels).where(eq(aiModels.id, id));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/ai-models error:", err);
    return NextResponse.json({ error: "Server xatosi (batafsil logda)" }, { status: 500 });
  }
}

