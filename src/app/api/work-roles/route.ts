import { NextResponse } from "next/server";
import { db } from "@/db";
import { workRoles } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { parseMoneyInput } from "@/lib/utils";

export const dynamic = "force-dynamic";

function cleanQuestions(value: unknown): string {
  const lines = String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return JSON.stringify(
    lines.length
      ? lines
      : [
          "Bugun bu rolda nima ish qildingiz?",
          "Qaysi natija yoki raqam chiqdi?",
          "Ertaga nimani yaxshilaysiz?",
        ]
  );
}

export async function GET() {
  const rows = await db
    .select()
    .from(workRoles)
    .orderBy(desc(workRoles.active), desc(workRoles.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Ish roli nomi kerak" }, { status: 400 });
  }

  const [created] = await db
    .insert(workRoles)
    .values({
      name,
      description: body.description ? String(body.description).trim() : null,
      tasksText: body.tasksText ? String(body.tasksText).trim() : null,
      monthlySalary: String(parseMoneyInput(String(body.monthlySalary ?? ""))),
      dailySalary: String(parseMoneyInput(String(body.dailySalary ?? ""))),
      reportQuestions: cleanQuestions(body.reportQuestions),
      active: body.active === false ? false : true,
    })
    .returning();

  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "id kerak" }, { status: 400 });

  const updates: Partial<typeof workRoles.$inferInsert> = {};
  if ("name" in body) updates.name = String(body.name || "").trim();
  if ("description" in body) {
    updates.description = body.description
      ? String(body.description).trim()
      : null;
  }
  if ("tasksText" in body) {
    updates.tasksText = body.tasksText ? String(body.tasksText).trim() : null;
  }
  if ("monthlySalary" in body) {
    updates.monthlySalary = String(
      parseMoneyInput(String(body.monthlySalary ?? ""))
    );
  }
  if ("dailySalary" in body) {
    updates.dailySalary = String(parseMoneyInput(String(body.dailySalary ?? "")));
  }
  if ("reportQuestions" in body) {
    updates.reportQuestions = cleanQuestions(body.reportQuestions);
  }
  if ("active" in body) updates.active = Boolean(body.active);

  const [updated] = await db
    .update(workRoles)
    .set(updates)
    .where(eq(workRoles.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id kerak" }, { status: 400 });

  await db.update(workRoles).set({ active: false }).where(eq(workRoles.id, id));
  return NextResponse.json({ ok: true });
}
