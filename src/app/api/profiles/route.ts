import { NextResponse } from "next/server";
import { db } from "@/db";
import { socialProfiles } from "@/db/schema";
import { desc, eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(socialProfiles)
      .orderBy(asc(socialProfiles.id));
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("GET /api/profiles error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Nomi kiritilishi shart" }, { status: 400 });
    }

    const platform = String(body.platform || "instagram").toLowerCase().trim();
    const handle = body.handle ? String(body.handle).trim() : null;
    const url = body.url ? String(body.url).trim() : null;
    const avatarUrl = body.avatarUrl ? String(body.avatarUrl).trim() : null;
    const followersCount = Number(body.followersCount) || 0;
    const category = body.category ? String(body.category).trim() : "Dizayn";
    const description = body.description ? String(body.description).trim() : null;
    const status = body.status ? String(body.status).trim() : "active";

    const [created] = await db
      .insert(socialProfiles)
      .values({
        name,
        platform,
        handle,
        url,
        avatarUrl,
        followersCount,
        category,
        description,
        status,
      })
      .returning();

    return NextResponse.json(created);
  } catch (err: any) {
    console.error("POST /api/profiles error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
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
    if (rest.name !== undefined) payload.name = String(rest.name).trim();
    if (rest.platform !== undefined) payload.platform = String(rest.platform).toLowerCase().trim();
    if (rest.handle !== undefined) payload.handle = rest.handle ? String(rest.handle).trim() : null;
    if (rest.url !== undefined) payload.url = rest.url ? String(rest.url).trim() : null;
    if (rest.avatarUrl !== undefined) payload.avatarUrl = rest.avatarUrl ? String(rest.avatarUrl).trim() : null;
    if (rest.followersCount !== undefined) payload.followersCount = Number(rest.followersCount) || 0;
    if (rest.category !== undefined) payload.category = rest.category ? String(rest.category).trim() : null;
    if (rest.description !== undefined) payload.description = rest.description ? String(rest.description).trim() : null;
    if (rest.status !== undefined) payload.status = String(rest.status).trim();

    const [updated] = await db
      .update(socialProfiles)
      .set(payload)
      .where(eq(socialProfiles.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PUT /api/profiles error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ error: "ID talab qilinadi" }, { status: 400 });
    }

    await db.delete(socialProfiles).where(eq(socialProfiles.id, id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("DELETE /api/profiles error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
