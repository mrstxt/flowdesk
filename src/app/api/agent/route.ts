import { NextRequest, NextResponse } from "next/server";
import { processAgentMessage } from "@/lib/aiAgent";

export const dynamic = "force-dynamic";

/**
 * Tashqi Google Gemini, Shortcuts, webhook yoki skriptlar orqali FlowDesk (Sovodesk)
 * AI Agentiga buyruq yuborish va bazaga saqlash endpointi.
 *
 * Ishlatish:
 * POST /api/agent
 * Body: { "message": "Bugun 50000 som tushlik qildim sovodeskga saqla" }
 *
 * Yoki GET:
 * GET /api/agent?message=bugungi+rejalarimni+korsat
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = body.message || body.text || body.prompt;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Xabar (message) matni kiritilmagan.",
          usage: 'POST body: { "message": "Vazifani yozib qo\'y: Yangi loyiha dizayni" }',
        },
        { status: 400 }
      );
    }

    const response = await processAgentMessage(message, {
      source: body.source || "external_api",
    });

    return NextResponse.json({
      success: true,
      message,
      reply: response.text,
      pdfUrl: response.pdfUrl || null,
      actionTaken: response.actionTaken || null,
    });
  } catch (error: any) {
    console.error("API /api/agent error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Agent xatoligi yuz berdi.",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const message = searchParams.get("message") || searchParams.get("text");

  if (!message) {
    return NextResponse.json({
      success: true,
      status: "FlowDesk AI Agent API faol holatda",
      description: "Gemini yoki Google orqali xabar yuborib Sovodeskga saqlashingiz mumkin.",
      samplePost: {
        url: "/api/agent",
        method: "POST",
        body: { message: "Ertaga soat 10:00 da yangi mijoz bilan uchrashuv rejasini tuz" },
      },
    });
  }

  const response = await processAgentMessage(message, {
    source: "external_get_api",
  });

  return NextResponse.json({
    success: true,
    message,
    reply: response.text,
    pdfUrl: response.pdfUrl || null,
    actionTaken: response.actionTaken || null,
  });
}
