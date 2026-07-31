import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { confirmOrder } from "@/lib/orderActions";
import { parseMoneyInput } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [created] = await db
    .insert(orders)
    .values({
      title: body.title,
      description: body.description || null,
      stage: body.stage || "new",
      amount: String(parseMoneyInput(body.amount ?? "0")),
      deadline: body.deadline || null,
      clientName: body.clientName || null,
      paymentType: body.paymentType || "cash",
      archived: false,
    })
    .returning();
  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const oldStage = rest._oldStage;
  const payload: Record<string, unknown> = { ...rest };
  delete payload._oldStage;
  payload.updatedAt = new Date();

  // Automation: move to confirmed -> income + goals allocation + archive
  if (oldStage && oldStage !== "confirmed" && payload.stage === "confirmed") {
    const cardId = payload.cardId ? Number(payload.cardId) : null;
    const result = await confirmOrder(
      id,
      String(payload.paymentType || "cash"),
      cardId
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    const [updated] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id));
    return NextResponse.json({
      ...updated,
      _distributed: result.netDistributed,
    });
  }

  const [updated] = await db
    .update(orders)
    .set(payload)
    .where(eq(orders.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(orders).where(eq(orders.id, id));
  return NextResponse.json({ ok: true });
}
