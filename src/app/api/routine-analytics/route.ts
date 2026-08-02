import { NextResponse } from "next/server";
import { db } from "@/db";
import { botReminders, routines } from "@/db/schema";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where =
    from && to
      ? and(
          gte(botReminders.date, from),
          lte(botReminders.date, to),
          inArray(botReminders.type, [
            "routine",
            "routine_start",
            "routine_deadline",
          ])
        )
      : inArray(botReminders.type, [
          "routine",
          "routine_start",
          "routine_deadline",
        ]);

  const reminders = await db
    .select()
    .from(botReminders)
    .where(where)
    .orderBy(asc(botReminders.date), asc(botReminders.id));

  const routineRows = await db.select().from(routines);
  const routineById = new Map(routineRows.map((r) => [r.id, r]));

  return NextResponse.json(
    reminders.map((reminder) => {
      const routine = reminder.routineId
        ? routineById.get(reminder.routineId)
        : null;
      return {
        ...reminder,
        routineTitle: routine?.title ?? null,
        routineTime: routine?.time ?? null,
        routineEndTime: routine?.endTime ?? null,
      };
    })
  );
}
