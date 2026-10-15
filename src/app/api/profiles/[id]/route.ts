import { NextResponse } from "next/server";
import { db } from "@/db";
import { socialProfiles, contentItems, profileAssets } from "@/db/schema";
import { eq, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "Noto'g'ri profil ID" }, { status: 400 });
    }

    const [profile] = await db
      .select()
      .from(socialProfiles)
      .where(eq(socialProfiles.id, id))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ error: "Profil topilmadi" }, { status: 404 });
    }

    // Statistikalarni hisoblaymiz
    const [contentCount] = await db
      .select({ value: count() })
      .from(contentItems)
      .where(eq(contentItems.profileId, id));

    const [assetsCount] = await db
      .select({ value: count() })
      .from(profileAssets)
      .where(eq(profileAssets.profileId, id));

    return NextResponse.json({
      ...profile,
      contentCount: contentCount?.value || 0,
      assetsCount: assetsCount?.value || 0,
    });
  } catch (err: any) {
    console.error("GET /api/profiles/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "Noto'g'ri profil ID" }, { status: 400 });
    }

    const body = await req.json();
    const payload: Record<string, unknown> = {};

    if (body.name !== undefined) payload.name = String(body.name).trim();
    if (body.platform !== undefined) payload.platform = String(body.platform).toLowerCase().trim();
    if (body.handle !== undefined) payload.handle = body.handle ? String(body.handle).trim() : null;
    if (body.url !== undefined) payload.url = body.url ? String(body.url).trim() : null;
    if (body.avatarUrl !== undefined) payload.avatarUrl = body.avatarUrl ? String(body.avatarUrl).trim() : null;
    if (body.followersCount !== undefined) payload.followersCount = Number(body.followersCount) || 0;
    if (body.category !== undefined) payload.category = body.category ? String(body.category).trim() : null;
    if (body.description !== undefined) payload.description = body.description ? String(body.description).trim() : null;
    if (body.status !== undefined) payload.status = String(body.status).trim();

    const [updated] = await db
      .update(socialProfiles)
      .set(payload)
      .where(eq(socialProfiles.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PUT /api/profiles/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "Noto'g'ri profil ID" }, { status: 400 });
    }

    // O'chirish
    await db.delete(profileAssets).where(eq(profileAssets.profileId, id));
    await db.delete(socialProfiles).where(eq(socialProfiles.id, id));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/profiles/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
