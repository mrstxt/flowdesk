import { NextResponse } from "next/server";
import { db } from "@/db";
import { workReports } from "@/db/schema";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { todayISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function cleanAnswers(value: unknown): { question: string; answer: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      question: String(item?.question || "Savol").trim(),
      answer: String(item?.answer || "").trim(),
    }))
    .filter((item) => item.answer);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const roleId = Number(searchParams.get("roleId"));
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const filters = [];
  if (roleId) filters.push(eq(workReports.roleId, roleId));
  if (from) filters.push(gte(workReports.date, from));
  if (to) filters.push(lte(workReports.date, to));

  const rows = await db
    .select()
    .from(workReports)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(workReports.date), desc(workReports.createdAt))
    .limit(100);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const roleId = Number(body.roleId);
  if (!roleId) {
    return NextResponse.json({ error: "roleId kerak" }, { status: 400 });
  }
  const date = String(body.date || todayISO());
  if (!validDate(date)) {
    return NextResponse.json({ error: "Sana formati YYYY-MM-DD bo'lishi kerak" }, { status: 400 });
  }

  const answers = cleanAnswers(body.answers);
  const summary =
    String(body.summary || "").trim() ||
    answers
      .map((item) => item.answer)
      .filter(Boolean)
      .join(" • ");

  const [created] = await db
    .insert(workReports)
    .values({
      roleId,
      date,
      answers: JSON.stringify(answers),
      summary,
    })
    .returning();

  return NextResponse.json(created);
}
