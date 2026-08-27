import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  books,
  cardTransactions,
  cards,
  dailyResults,
  expenses,
  goals,
  incomes,
  orders,
  routines,
  sleepLogs,
  subscriptions,
  tasks,
  videos,
} from "@/db/schema";
import { count } from "drizzle-orm";

export const dynamic = "force-dynamic";

const tables = {
  orders,
  incomes,
  expenses,
  goals,
  cards,
  cardTransactions,
  tasks,
  routines,
  books,
  videos,
  sleepLogs,
  dailyResults,
  subscriptions,
};

async function tableCount(table: (typeof tables)[keyof typeof tables]) {
  const [row] = await db.select({ value: count() }).from(table);
  return row?.value ?? 0;
}

export async function GET() {
  try {
    const entries = await Promise.all(
      Object.entries(tables).map(async ([name, table]) => {
        try {
          return [name, await tableCount(table)] as const;
        } catch (error) {
          console.error(`DB status failed for ${name}:`, error);
          return [name, null] as const;
        }
      })
    );

    return NextResponse.json({
      ok: true,
      databaseUrlConfigured: Boolean(
        process.env.DATABASE_URL || process.env.POSTGRES_URL
      ),
      counts: Object.fromEntries(entries),
    });
  } catch (error) {
    console.error("DB status failed:", error);
    return NextResponse.json(
      {
        ok: false,
        databaseUrlConfigured: Boolean(
          process.env.DATABASE_URL || process.env.POSTGRES_URL
        ),
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
