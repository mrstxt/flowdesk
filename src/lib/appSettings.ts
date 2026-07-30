import { db } from "@/db";
import { settings } from "@/db/schema";

export const DEFAULT_WAKE_TIME = "06:30";
export const DEFAULT_SLEEP_TIME = "23:00";

export function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function getSettingsMap(): Promise<Record<string, string>> {
  const rows = await db.select().from(settings);
  const result: Record<string, string> = {};

  for (const row of rows) {
    result[row.key] = row.value ?? "";
  }

  return result;
}
