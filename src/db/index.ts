import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

// Hosted databases (Vercel Postgres, Neon, Supabase...) require SSL.
const isLocal = databaseUrl ? /localhost|127\.0\.0\.1/.test(databaseUrl) : false;

export const pool =
  databaseUrl
    ? globalForDb.__arenaNextJsPostgresqlPool ??
      new Pool({
        connectionString: databaseUrl,
        ssl: isLocal ? undefined : { rejectUnauthorized: false },
        max: 5,
      })
    : undefined;

if (pool && process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

function missingDatabaseUrl(): never {
  throw new Error("DATABASE_URL is required");
}

type Database = ReturnType<typeof drizzle>;

export const db: Database = pool
  ? drizzle(pool)
  : (new Proxy(
      {},
      {
        get: missingDatabaseUrl,
      }
    ) as Database);
