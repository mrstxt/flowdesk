import { NextResponse } from "next/server";
import { db } from "@/db";
import { videoNotes } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const videoId = Number(searchParams.get("videoId"));
  if (!videoId) return NextResponse.json([]);
  const rows = await db
    .select()
    .from(videoNotes)
    .where(eq(videoNotes.videoId, videoId))
    .orderBy(asc(videoNotes.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [created] = await db
    .insert(videoNotes)
    .values({ videoId: body.videoId, content: body.content })
    .returning();
  return NextResponse.json(created);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(videoNotes).where(eq(videoNotes.id, id));
  return NextResponse.json({ ok: true });
}
