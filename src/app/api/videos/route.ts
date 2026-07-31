import { NextResponse } from "next/server";
import { db } from "@/db";
import { videos, videoNotes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export function parseYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/
  );
  return m ? m[1] : null;
}

export async function GET() {
  const rows = await db.select().from(videos).orderBy(desc(videos.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const videoId = parseYouTubeId(String(body.url || ""));
  if (!videoId) {
    return NextResponse.json(
      { error: "YouTube havolasi topilmadi. To'g'ri link kiriting." },
      { status: 400 }
    );
  }
  const [created] = await db
    .insert(videos)
    .values({
      title: body.title || "YouTube video",
      url: body.url,
      videoId,
      category: body.category || "other",
      watched: false,
    })
    .returning();
  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // watchedSeconds kelgan bo'lsa, lastWatchedAt ni avtomatik yangilash
  if (rest.watchedSeconds !== undefined) {
    rest.watchedSeconds = Math.max(0, Math.floor(Number(rest.watchedSeconds)));
    rest.lastWatchedAt = new Date();
  }

  const [updated] = await db
    .update(videos)
    .set(rest)
    .where(eq(videos.id, id))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(videoNotes).where(eq(videoNotes.videoId, id));
  await db.delete(videos).where(eq(videos.id, id));
  return NextResponse.json({ ok: true });
}
