import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function errorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("DATABASE_URL is required")) return "database_not_configured";
  if (message.includes("relation") && message.includes("does not exist")) {
    return "database_schema_missing";
  }
  if (
    message.includes("password authentication failed") ||
    message.includes("Tenant or user not found") ||
    message.includes("ENOTFOUND") ||
    message.includes("ECONNREFUSED")
  ) {
    return "database_connection_failed";
  }
  return "database_error";
}

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, database: "connected" });
  } catch (error) {
    console.error("Health check failed:", error);
    return Response.json(
      { ok: false, code: errorCode(error) },
      { status: 500 }
    );
  }
}
