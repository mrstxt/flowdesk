import { NextResponse } from "next/server";
import { db } from "@/db";
import { profileAssets } from "@/db/schema";
import { and, desc, eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const profileId = Number(searchParams.get("profileId"));
    if (!profileId) {
      return NextResponse.json(
        { error: "profileId parametri talab qilinadi" },
        { status: 400 }
      );
    }

    const type = searchParams.get("type"); // 'face', 'monthly', 'grid', 'highlight'
    const month = searchParams.get("month"); // e.g. '2026-10'

    const conditions = [eq(profileAssets.profileId, profileId)];
    if (type) {
      conditions.push(eq(profileAssets.type, type));
    }
    if (month) {
      conditions.push(eq(profileAssets.month, month));
    }

    const rows = await db
      .select()
      .from(profileAssets)
      .where(and(...conditions))
      .orderBy(asc(profileAssets.sortOrder), desc(profileAssets.createdAt));

    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("GET /api/profiles/assets error:", err);
    return NextResponse.json({ error: "Server xatosi (batafsil logda)" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const profileId = Number(body.profileId);
    const title = String(body.title || "").trim();
    const fileUrl = String(body.fileUrl || "").trim();

    if (!profileId || !title || !fileUrl) {
      return NextResponse.json(
        { error: "profileId, title va fileUrl talab qilinadi" },
        { status: 400 }
      );
    }

    const type = String(body.type || "face").trim();
    const month = body.month ? String(body.month).trim() : null;
    const fileType = String(body.fileType || "image").trim();
    const caption = body.caption ? String(body.caption).trim() : null;
    const sortOrder = Number(body.sortOrder) || 0;

    const [created] = await db
      .insert(profileAssets)
      .values({
        profileId,
        title,
        type,
        month,
        fileUrl,
        fileType,
        caption,
        sortOrder,
      })
      .returning();

    return NextResponse.json(created);
  } catch (err: any) {
    console.error("POST /api/profiles/assets error:", err);
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
    if (body.title !== undefined) payload.title = String(body.title).trim();
    if (body.caption !== undefined) payload.caption = body.caption ? String(body.caption).trim() : null;
    if (body.month !== undefined) payload.month = body.month ? String(body.month).trim() : null;
    if (body.type !== undefined) payload.type = String(body.type).trim();
    if (body.sortOrder !== undefined) payload.sortOrder = Number(body.sortOrder) || 0;
    if (body.fileUrl !== undefined) payload.fileUrl = String(body.fileUrl).trim();

    const [updated] = await db
      .update(profileAssets)
      .set(payload)
      .where(eq(profileAssets.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PUT /api/profiles/assets error:", err);
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

    await db.delete(profileAssets).where(eq(profileAssets.id, id));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/profiles/assets error:", err);
    return NextResponse.json({ error: "Server xatosi (batafsil logda)" }, { status: 500 });
  }
}

