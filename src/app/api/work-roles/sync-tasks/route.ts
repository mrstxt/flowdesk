import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, workRoles } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

function taskLines(raw: string | null): string[] {
  return String(raw || "")
    .split("\n")
    .map((line) => line.replace(/^[-•*\d.\s]+/, "").trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  const body = await req.json();
  const roleId = Number(body.roleId);
  const date = String(body.date || todayISO());
  if (!roleId) {
    return NextResponse.json({ error: "roleId kerak" }, { status: 400 });
  }

  const [role] = await db
    .select()
    .from(workRoles)
    .where(eq(workRoles.id, roleId))
    .limit(1);
  if (!role) {
    return NextResponse.json({ error: "Ish bo'limi topilmadi" }, { status: 404 });
  }

  const lines = taskLines(role.tasksText);
  if (lines.length === 0) {
    return NextResponse.json(
      { error: "Avval qilinadigan ishlarni yozing" },
      { status: 400 }
    );
  }

  let created = 0;
  for (const line of lines) {
    const title = `${role.name}: ${line}`;
    const [existing] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.date, date), eq(tasks.title, title)))
      .limit(1);
    if (existing) continue;
    await db.insert(tasks).values({
      title,
      date,
      completed: false,
      category: "work",
    });
    created += 1;
  }

  return NextResponse.json({
    ok: true,
    roleId,
    date,
    created,
    skipped: lines.length - created,
  });
}
