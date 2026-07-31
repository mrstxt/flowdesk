import { NextResponse } from "next/server";
import { db } from "@/db";
import { cards, cardTransactions } from "@/db/schema";
import { eq, desc, asc, and, ne } from "drizzle-orm";
import { createCard, getPrimaryCard } from "@/lib/cardActions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("includeArchived") === "true";
  const primaryOnly = searchParams.get("primary") === "true";

  if (primaryOnly) {
    const primary = await getPrimaryCard();
    return NextResponse.json(primary ? [primary] : []);
  }

  let rows;
  if (includeArchived) {
    rows = await db.select().from(cards).orderBy(desc(cards.type), cards.id);
  } else {
    rows = await db
      .select()
      .from(cards)
      .where(eq(cards.archived, false))
      .orderBy(desc(cards.type), cards.id);
  }
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await createCard({
      name: body.name,
      bank: body.bank || null,
      last4: body.last4 || null,
      color: body.color || "#0a84ff",
      type: body.type === "primary" ? "primary" : "additional",
      initialBalance: body.initialBalance
        ? Number(body.initialBalance)
        : 0,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result.card);
  } catch (e) {
    console.error("POST /api/cards error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, ...rest } = body;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string") patch.name = body.name.trim();
    if (body.bank !== undefined) patch.bank = body.bank || null;
    if (body.last4 !== undefined) patch.last4 = body.last4 || null;
    if (body.color !== undefined) patch.color = body.color;
    if (body.type === "primary" || body.type === "additional") {
      patch.type = body.type;
    }
    if (typeof body.archived === "boolean") patch.archived = body.archived;

    // Agar primary ga o'tkazayotgan bo'lsa, boshqalarni additional qilamiz
    if (patch.type === "primary") {
      await db
        .update(cards)
        .set({ type: "additional" })
        .where(and(ne(cards.id, id), eq(cards.type, "primary")));
    }

    const [updated] = await db
      .update(cards)
      .set(patch)
      .where(eq(cards.id, id))
      .returning();
    return NextResponse.json(updated);
  } catch (e) {
    console.error("PUT /api/cards error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    // Primary kartani o'chirib bo'lmaydi
    const [c] = await db
      .select()
      .from(cards)
      .where(eq(cards.id, id))
      .limit(1);
    if (!c) {
      return NextResponse.json({ error: "Karta topilmadi" }, { status: 404 });
    }
    if (c.type === "primary") {
      return NextResponse.json(
        {
          error:
            "Asosiy kartani o'chirib bo'lmaydi. Avval boshqa kartani asosiy qiling.",
        },
        { status: 400 }
      );
    }
    // Soft delete
    await db.update(cards).set({ archived: true }).where(eq(cards.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/cards error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
