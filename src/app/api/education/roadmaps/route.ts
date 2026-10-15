import { NextResponse } from "next/server";
import { db } from "@/db";
import { studyRoadmaps } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const DEFAULT_ROADMAPS = [
  {
    title: "AI Agentlar va LLM Integratsiyalari",
    category: "AI & ML",
    priority: "high",
    status: "in_progress",
    progress: 70,
    targetDate: "2026-11-30",
    resources: "Gemini 2.5 API Docs, LangChain, Vercel AI SDK, DeepLearning.AI kurslari",
    notes: "GramJS Telegram bot, FlowDesk AI avtomatlashtirish va shaxsiy ovozli yordamchi.",
  },
  {
    title: "IELTS 7.5+ Tayyorgarligi",
    category: "Til o'rganish",
    priority: "high",
    status: "in_progress",
    progress: 55,
    targetDate: "2026-12-15",
    resources: "Cambridge IELTS 16-19, British Council Podcasts, Write & Improve",
    notes: "Har kuni 30 daqiqa listening va 1 ta essay yozish tartibi.",
  },
  {
    title: "Data Structures & Algorithms (ICPC & LeetCode)",
    category: "Dasturlash",
    priority: "medium",
    status: "in_progress",
    progress: 40,
    targetDate: "2027-02-01",
    resources: "LeetCode Top 150, NeetCode Roadmap, ICPC saralash masalalari",
    notes: "Graf algoritmlari, DP (Dynamic Programming) va Binary Search.",
  },
  {
    title: "Generativ Media & AI Video Prodyuserlik",
    category: "Media & Kontent",
    priority: "medium",
    status: "completed",
    progress: 100,
    targetDate: "2026-10-10",
    resources: "Midjourney v6.1, Flux.1, Kling AI, HeyGen, CapCut Pro",
    notes: "Face-swap, reels kadrlar ketma-ketligi va hook/CTA yozish mahorati.",
  },
];

export async function GET() {
  try {
    let all = await db
      .select()
      .from(studyRoadmaps)
      .orderBy(desc(studyRoadmaps.createdAt));

    if (all.length === 0) {
      for (const item of DEFAULT_ROADMAPS) {
        await db.insert(studyRoadmaps).values(item);
      }
      all = await db
        .select()
        .from(studyRoadmaps)
        .orderBy(desc(studyRoadmaps.createdAt));
    }

    return NextResponse.json({ success: true, data: all });
  } catch (error: any) {
    console.error("GET roadmaps error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, category, priority, status, progress, targetDate, resources, notes } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: "Sarlavha majburiy" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(studyRoadmaps)
      .values({
        title,
        category: category || "Dasturlash",
        priority: priority || "medium",
        status: status || "in_progress",
        progress: Number(progress) || 0,
        targetDate: targetDate || null,
        resources: resources || null,
        notes: notes || null,
      })
      .returning();

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    console.error("POST roadmap error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID majburiy" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(studyRoadmaps)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(studyRoadmaps.id, Number(id)))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("PUT roadmap error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
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

    await db.delete(studyRoadmaps).where(eq(studyRoadmaps.id, Number(id)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE roadmap error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

