import { NextResponse } from "next/server";
import { db } from "@/db";
import { goals } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { parseMoneyInput } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function autoPercentTotal(exceptId?: number): Promise<number> {
  const rows = await db.select().from(goals);
  return rows.reduce((sum, g) => {
    if (exceptId && g.id === exceptId) return sum;
    if (!g.cardId) return sum;
    const pct = Number(g.autoPercent ?? 0);
    return pct > 0 ? sum + pct : sum;
  }, 0);
}

function clampPercent(value: unknown): number {
  const n = Number(value) || 0;
  return Math.max(0, Math.min(100, Math.floor(n)));
}

export async function GET() {
  const rows = await db.select().from(goals).orderBy(desc(goals.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const title = String(body.title || "").trim();
  const targetAmount = parseMoneyInput(body.targetAmount);
  const autoPercent = clampPercent(body.autoPercent);
  const cardId = body.cardId ? Number(body.cardId) : null;
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (targetAmount <= 0) {
    return NextResponse.json(
      { error: "Maqsad summasi 0 dan katta bo'lishi kerak" },
      { status: 400 }
    );
  }
  if (cardId && (await autoPercentTotal()) + autoPercent > 100) {
    return NextResponse.json(
      { error: "Maqsadlarning jami avtomatik foizi 100% dan oshmasligi kerak" },
      { status: 400 }
    );
  }
  const [created] = await db
    .insert(goals)
    .values({
      title,
      targetAmount: String(targetAmount),
      savedAmount: String(parseMoneyInput(body.savedAmount ?? "0")),
      autoPercent,
      cardId,
    })
    .returning();
  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if ("targetAmount" in rest) {
    rest.targetAmount = String(parseMoneyInput(rest.targetAmount));
  }
  if ("savedAmount" in rest) {
    rest.savedAmount = String(parseMoneyInput(rest.savedAmount));
  }
  if ("cardId" in rest) {
    rest.cardId = rest.cardId ? Number(rest.cardId) : null;
  }
  if ("autoPercent" in rest) {
    rest.autoPercent = clampPercent(rest.autoPercent);
  }
  if ("autoPercent" in rest || "cardId" in rest) {
    const [existing] = await db
      .select()
      .from(goals)
      .where(eq(goals.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const nextCardId =
      "cardId" in rest ? (rest.cardId as number | null) : existing.cardId;
    const nextPercent =
      "autoPercent" in rest ? Number(rest.autoPercent) : Number(existing.autoPercent ?? 0);
    if (nextCardId && (await autoPercentTotal(id)) + nextPercent > 100) {
      return NextResponse.json(
        { error: "Maqsadlarning jami avtomatik foizi 100% dan oshmasligi kerak" },
        { status: 400 }
      );
    }
  }
  const [updated] = await db
    .update(goals)
    .set(rest)
    .where(eq(goals.id, id))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const [existing] = await db
    .select()
    .from(goals)
    .where(eq(goals.id, id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (parseMoneyInput(existing.savedAmount) > 0) {
    return NextResponse.json(
      {
        error:
          "Bu maqsadda yig'ilgan pul bor. Hisob buzilmasligi uchun avval pulni alohida qaytaring.",
      },
      { status: 400 }
    );
  }
  await db.delete(goals).where(eq(goals.id, id));
  return NextResponse.json({ ok: true });
}
