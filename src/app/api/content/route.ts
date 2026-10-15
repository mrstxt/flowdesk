import { NextResponse } from "next/server";
import { db } from "@/db";
import { contentItems, socialProfiles } from "@/db/schema";
import { desc, eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get("profileId");

    let query = db
      .select({
        id: contentItems.id,
        profileId: contentItems.profileId,
        title: contentItems.title,
        type: contentItems.type,
        stage: contentItems.stage,
        caption: contentItems.caption,
        mediaUrls: contentItems.mediaUrls,
        scheduledDate: contentItems.scheduledDate,
        scheduledTime: contentItems.scheduledTime,
        publishedAt: contentItems.publishedAt,
        notes: contentItems.notes,
        createdAt: contentItems.createdAt,
        updatedAt: contentItems.updatedAt,
        profileName: socialProfiles.name,
        profilePlatform: socialProfiles.platform,
        profileHandle: socialProfiles.handle,
      })
      .from(contentItems)
      .leftJoin(socialProfiles, eq(contentItems.profileId, socialProfiles.id))
      .orderBy(desc(contentItems.createdAt));

    const rows = await query;
    if (profileId) {
      return NextResponse.json(rows.filter((r) => r.profileId === Number(profileId)));
    }
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("GET /api/content error:", err);
    return NextResponse.json({ error: "Server xatosi (batafsil logda)" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = String(body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Sarlavha kiritilishi shart" }, { status: 400 });
    }

    const profileId = body.profileId ? Number(body.profileId) : null;
    const type = String(body.type || "post").toLowerCase().trim();
    const stage = String(body.stage || "idea").toLowerCase().trim();
    const caption = body.caption ? String(body.caption).trim() : null;
    const mediaUrls = body.mediaUrls ? String(body.mediaUrls).trim() : null;
    const scheduledDate = body.scheduledDate ? String(body.scheduledDate).trim() : null;
    const scheduledTime = body.scheduledTime ? String(body.scheduledTime).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;
    const publishedAt = stage === "published" ? new Date() : null;

    const hook = body.hook ? String(body.hook).trim() : null;
    const itemBody = body.body ? String(body.body).trim() : null;
    const cta = body.cta ? String(body.cta).trim() : null;
    const frames = body.frames ? (typeof body.frames === "string" ? body.frames : JSON.stringify(body.frames)) : null;

    const [created] = await db
      .insert(contentItems)
      .values({
        profileId,
        title,
        type,
        stage,
        caption,
        hook,
        body: itemBody,
        cta,
        frames,
        mediaUrls,
        scheduledDate,
        scheduledTime,
        publishedAt,
        notes,
      })
      .returning();

    return NextResponse.json(created);
  } catch (err: any) {
    console.error("POST /api/content error:", err);
    return NextResponse.json({ error: "Server xatosi (batafsil logda)" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, ...rest } = body;
    if (!id) {
      return NextResponse.json({ error: "ID talab qilinadi" }, { status: 400 });
    }

    const payload: Record<string, unknown> = {};
    if (rest.title !== undefined) payload.title = String(rest.title).trim();
    if (rest.profileId !== undefined) payload.profileId = rest.profileId ? Number(rest.profileId) : null;
    if (rest.type !== undefined) payload.type = String(rest.type).toLowerCase().trim();
    if (rest.stage !== undefined) {
      payload.stage = String(rest.stage).toLowerCase().trim();
      if (payload.stage === "published" && !rest.publishedAt) {
        payload.publishedAt = new Date();
      }
    }
    if (rest.caption !== undefined) payload.caption = rest.caption ? String(rest.caption).trim() : null;
    if (rest.hook !== undefined) payload.hook = rest.hook ? String(rest.hook).trim() : null;
    if (rest.body !== undefined) payload.body = rest.body ? String(rest.body).trim() : null;
    if (rest.cta !== undefined) payload.cta = rest.cta ? String(rest.cta).trim() : null;
    if (rest.frames !== undefined) {
      payload.frames = rest.frames ? (typeof rest.frames === "string" ? rest.frames : JSON.stringify(rest.frames)) : null;
    }
    if (rest.notified !== undefined) payload.notified = Boolean(rest.notified);
    if (rest.mediaUrls !== undefined) payload.mediaUrls = rest.mediaUrls ? String(rest.mediaUrls).trim() : null;
    if (rest.scheduledDate !== undefined) payload.scheduledDate = rest.scheduledDate ? String(rest.scheduledDate).trim() : null;
    if (rest.scheduledTime !== undefined) payload.scheduledTime = rest.scheduledTime ? String(rest.scheduledTime).trim() : null;
    if (rest.notes !== undefined) payload.notes = rest.notes ? String(rest.notes).trim() : null;
    if (rest.publishedAt !== undefined) payload.publishedAt = rest.publishedAt ? new Date(rest.publishedAt) : null;

    payload.updatedAt = new Date();

    const [updated] = await db
      .update(contentItems)
      .set(payload)
      .where(eq(contentItems.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PUT /api/content error:", err);
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

    await db.delete(contentItems).where(eq(contentItems.id, id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("DELETE /api/content error:", err);
    return NextResponse.json({ error: "Server xatosi (batafsil logda)" }, { status: 500 });
  }
}

