import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
  return [error.message, cause ? errorText(cause) : ""].filter(Boolean).join("\n");
}

function errorCode(error: unknown): string {
  const message = errorText(error);
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
    await db.execute(sql`select 1 from settings limit 1`);
    return Response.json({ ok: true, database: "connected", schema: "ready" });
  } catch (error) {
    console.error("Health check failed:", error);
    return Response.json(
      { ok: false, code: errorCode(error) },
      { status: 500 }
    );
  }
}
