import { NextRequest, NextResponse } from "next/server";
import { processAgentMessage } from "@/lib/aiAgent";
import { db } from "@/db";
import { tasks, books, videos, expenses, orders } from "@/db/schema";
import { createSummaryPdf } from "@/lib/pdfService";

export const dynamic = "force-dynamic";

/**
 * 3-Kanal: Tashqi Gemini va Webhook integratsiyasi.
 * Tashqaridan (Google Gemini chatidan, Google Sheets, Make/Zapier yoki Shortcuts-dan)
 * erkin matnli yoki strukturali ma'lumotlarni qabul qilib, FlowDesk bazasiga
 * (tasks, books, videos, expenses, orders) xavfsiz yozadi.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("authorization");
    const secret = body.secret || body.apiKey;

    // 1. Agar erkin matnli xabar berilgan bo'lsa (masalan: "Shuni sovodeskga saqla: ...")
    const freeText = body.message || body.text || body.prompt;
    if (freeText && typeof freeText === "string") {
      const agentRes = await processAgentMessage(freeText.trim(), {
        source: "external_sync",
        username: "sulaymonovss",
      });

      return NextResponse.json({
        success: true,
        type: "agent_processed",
        reply: agentRes.text,
        pdfUrl: agentRes.pdfUrl || null,
        actionTaken: agentRes.actionTaken || null,
      });
    }

    // 2. Agar strukturali ma'lumot berilgan bo'lsa (type: 'task' | 'book' | 'video' | 'expense' | 'order')
    const type = body.type;
    const data = body.data || body;
    const d = new Date();
    const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (type === "task" || body.taskTitle) {
      const title = data.title || body.taskTitle;
      const date = data.date || todayISO;
      const category = data.category || "personal";

      const [savedTask] = await db
        .insert(tasks)
        .values({
          title: String(title).trim(),
          date,
          category,
          completed: false,
        })
        .returning();

      return NextResponse.json({
        success: true,
        type: "task",
        message: "Vazifa FlowDesk bazasiga saqlandi!",
        task: savedTask,
      });
    }

    if (type === "video" || body.videoUrl) {
      const url = data.url || body.videoUrl;
      const title = data.title || body.videoTitle || "Yangi Video";
      const summary = data.summary || body.summary || "";

      let videoId = "";
      try {
        const u = new URL(url);
        if (u.hostname.includes("youtu.be")) videoId = u.pathname.slice(1);
        else if (u.searchParams.has("v")) videoId = u.searchParams.get("v") || "";
      } catch {}

      const [savedVideo] = await db
        .insert(videos)
        .values({
          title,
          url,
          videoId: videoId || `yt_${Date.now()}`,
          category: data.category || "rivojlanish",
          summary,
          watched: false,
        })
        .returning();

      return NextResponse.json({
        success: true,
        type: "video",
        message: "Video Rivojlanish bo'limiga kiritildi!",
        video: savedVideo,
      });
    }

    if (type === "book" || body.bookTitle) {
      const title = data.title || body.bookTitle || "Yangi Kitob";
      const summary = data.summary || body.content || body.summaryBookText || "";
      let pdfUrl = data.pdfUrl || null;

      if (!pdfUrl && summary && summary.length > 50) {
        try {
          pdfUrl = await createSummaryPdf(title, summary);
        } catch {}
      }

      const [savedBook] = await db
        .insert(books)
        .values({
          title,
          author: data.author || "Google Gemini / AI Konspekt",
          summary,
          pdfUrl,
          status: "rejalashtirilgan",
          totalPages: data.totalPages || 1,
          currentPage: 0,
        })
        .returning();

      return NextResponse.json({
        success: true,
        type: "book",
        message: "Kitob va uning PDF konspekti saqlandi!",
        book: savedBook,
        pdfUrl,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Yaroqsiz ma'lumot formati. 'message' yoki 'type' (task, video, book) kiriting.",
        example: {
          message: "YouTube havolasi: https://youtu.be/... shuni konspekt qilib kitoblarga saqla",
        },
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("API /api/external-sync error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Sinxronizatsiya xatosi." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const message = searchParams.get("message") || searchParams.get("prompt");

  if (!message) {
    return NextResponse.json({
      success: true,
      service: "FlowDesk External Sync Bridge",
      status: "online",
      description: "Google Gemini va tashqi webhooks orqali ma'lumotlarni qabul qiluvchi shlyuz.",
    });
  }

  const agentRes = await processAgentMessage(message, {
    source: "external_sync_get",
    username: "sulaymonovss",
  });

  return NextResponse.json({
    success: true,
    message,
    reply: agentRes.text,
    pdfUrl: agentRes.pdfUrl || null,
    actionTaken: agentRes.actionTaken || null,
  });
}
