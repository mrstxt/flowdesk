import { NextRequest, NextResponse } from "next/server";
import { processAgentMessage } from "@/lib/aiAgent";

export const dynamic = "force-dynamic";

/**
 * Sovodesk Web Paneli uchun AI Chat (Madina) API yo'nalishi.
 * Sayt ichida turib matnli yoki ovozli xabarlarni qabul qiladi
 * va Gemini AI Agent orqali FlowDesk ma'lumotlar bazasini boshqaradi.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = body.message || body.text || body.prompt;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Xabar matni kiritilmadi.",
        },
        { status: 400 }
      );
    }

    const response = await processAgentMessage(message.trim(), {
      source: "web_panel",
      username: "sulaymonovss",
    });

    return NextResponse.json({
      success: true,
      reply: response.text,
      pdfUrl: response.pdfUrl || null,
      actionTaken: response.actionTaken || null,
    });
  } catch (error: any) {
    console.error("API /api/chat error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "AI Agent xatoligi yuz berdi.",
      },
      { status: 500 }
    );
  }
}
