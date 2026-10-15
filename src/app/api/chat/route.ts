import { NextRequest, NextResponse } from "next/server";
import { processAgentMessage } from "@/lib/aiAgent";
import { db } from "@/db";
import { chatMessages } from "@/db/schema";
import { asc } from "drizzle-orm";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * 1. GET: Madina (AI Kotib) suhbat tarixini bazadan yuklash
 */
export async function GET() {
  try {
    const list = await db
      .select()
      .from(chatMessages)
      .orderBy(asc(chatMessages.createdAt))
      .limit(100);

    return NextResponse.json({
      success: true,
      messages: list.map((m) => ({
        id: String(m.id),
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: new Date(m.createdAt).toLocaleTimeString("uz-UZ", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        actionTaken: m.actionTaken || undefined,
        pdfUrl: m.pdfUrl || undefined,
        source: m.source || "web_panel",
      })),
    });
  } catch (error: any) {
    console.error("GET /api/chat error:", error);
    return NextResponse.json({ success: false, error: "Server xatosi (batafsil logda)" }, { status: 500 });
  }
}

/**
 * 2. POST: Yangi xabar yuborish va suhbatni bazaga doimiy saqlash
 */
export async function POST(req: NextRequest) {
  // Daqiqada 15 ta xabar — AI hisobini himoya qiladi
  const limit = rateLimit(`chat:${clientIp(req)}`, 15, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

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

    const cleanMsg = message.trim();

    // 1. Foydalanuvchi xabarini DB ga yozamiz
    await db.insert(chatMessages).values({
      role: "user",
      content: cleanMsg,
      source: "web_panel",
    });

    // 2. Gemini orqali qayta ishlaymiz
    const response = await processAgentMessage(cleanMsg, {
      source: "web_panel",
      username: "sulaymonovss",
    });

    // 3. AI (Madina) javobini ham DB ga saqlaymiz
    const [savedAssistantMsg] = await db
      .insert(chatMessages)
      .values({
        role: "assistant",
        content: response.text,
        actionTaken: response.actionTaken || null,
        pdfUrl: response.pdfUrl || null,
        source: "web_panel",
      })
      .returning();

    return NextResponse.json({
      success: true,
      id: String(savedAssistantMsg?.id || Date.now()),
      reply: response.text,
      pdfUrl: response.pdfUrl || null,
      actionTaken: response.actionTaken || null,
      timestamp: new Date().toLocaleTimeString("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  } catch (error: any) {
    console.error("API /api/chat error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Server xatosi (batafsil logda)",
      },
      { status: 500 }
    );
  }
}

/**
 * 3. DELETE: Suhbat tarixini tozalash
 */
export async function DELETE() {
  try {
    await db.delete(chatMessages);
    return NextResponse.json({ success: true, message: "Chat tarixi tozalandi." });
  } catch (error: any) {
    console.error("DELETE /api/chat error:", error);
    return NextResponse.json({ success: false, error: "Server xatosi (batafsil logda)" }, { status: 500 });
  }
}
