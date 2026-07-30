import { NextResponse } from "next/server";
import { db } from "@/db";
import { books, bookNotes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(books).orderBy(desc(books.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [created] = await db
    .insert(books)
    .values({
      title: body.title,
      author: body.author || null,
      totalPages: Number(body.totalPages) || 0,
      currentPage: 0,
      status: body.status || "plan",
    })
    .returning();
  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Page progress with auto status transitions
  if (rest.currentPage !== undefined) {
    const [b] = await db.select().from(books).where(eq(books.id, id)).limit(1);
    if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });
    const total = Number(b.totalPages) || 0;
    let page = Math.max(0, Number(rest.currentPage));
    if (total > 0 && page >= total) {
      page = total;
      rest.status = "done";
    } else if (page > 0 && b.status === "plan") {
      rest.status = "reading";
    }
    rest.currentPage = page;
  }

  const [updated] = await db
    .update(books)
    .set(rest)
    .where(eq(books.id, id))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(bookNotes).where(eq(bookNotes.bookId, id));
  await db.delete(books).where(eq(books.id, id));
  return NextResponse.json({ ok: true });
}
