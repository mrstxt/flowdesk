import { NextResponse } from "next/server";
import { db } from "@/db";
import { incomes } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { parseMoneyInput } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(incomes).orderBy(desc(incomes.date));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [created] = await db
    .insert(incomes)
    .values({
      title: body.title,
      amount: String(parseMoneyInput(body.amount)),
      source: body.source || "other",
      date: body.date,
      paymentType: body.paymentType || "cash",
      cardId: body.cardId ? Number(body.cardId) : null,
    })
    .returning();
  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if ("amount" in rest) {
    rest.amount = String(parseMoneyInput(rest.amount));
  }
  if ("cardId" in rest) {
    rest.cardId = rest.cardId ? Number(rest.cardId) : null;
  }
  const [updated] = await db
    .update(incomes)
    .set(rest)
    .where(eq(incomes.id, id))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(incomes).where(eq(incomes.id, id));
  return NextResponse.json({ ok: true });
}
