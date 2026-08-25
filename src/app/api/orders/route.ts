import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { cancelOrderConfirmation, confirmOrder } from "@/lib/orderActions";
import { parseMoneyInput } from "@/lib/utils";

export const dynamic = "force-dynamic";
const ORDER_STAGES = new Set(["new", "in_progress", "review", "confirmed"]);

export async function GET() {
  const rows = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const title = String(body.title || "").trim();
  const amount = parseMoneyInput(body.amount ?? "0");
  const stage = ORDER_STAGES.has(body.stage) ? body.stage : "new";
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (amount < 0) {
    return NextResponse.json(
      { error: "Summa manfiy bo'lmasligi kerak" },
      { status: 400 }
    );
  }
  const [created] = await db
    .insert(orders)
    .values({
      title,
      description: body.description || null,
      stage,
      amount: String(amount),
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

  if (typeof payload.stage === "string" && payload.stage !== "confirmed") {
    payload.archived = false;
  }

  // Automation: move to confirmed -> income + goals allocation + archive
  if (oldStage && oldStage !== "confirmed" && payload.stage === "confirmed") {
    const result = await confirmOrder(id);
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

  // Automation: move out of confirmed/archive -> reverse order income/allocation
  if (oldStage === "confirmed" && payload.stage !== "confirmed") {
    const result = await cancelOrderConfirmation(id, String(payload.stage));
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    const [updated] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id));
    return NextResponse.json(updated);
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
  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.stage === "confirmed") {
    const result = await cancelOrderConfirmation(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
  }
  await db.delete(orders).where(eq(orders.id, id));
  return NextResponse.json({ ok: true });
}
