import { NextResponse } from "next/server";
import { db } from "@/db";
import { bookNotes } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookId = Number(searchParams.get("bookId"));
  if (!bookId) return NextResponse.json([]);
  const rows = await db
    .select()
    .from(bookNotes)
    .where(eq(bookNotes.bookId, bookId))
    .orderBy(asc(bookNotes.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [created] = await db
    .insert(bookNotes)
    .values({
      bookId: body.bookId,
      content: body.content,
      page: body.page ? Number(body.page) : null,
    })
    .returning();
  return NextResponse.json(created);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(bookNotes).where(eq(bookNotes.id, id));
  return NextResponse.json({ ok: true });
}
