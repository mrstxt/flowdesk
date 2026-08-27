import { type ClassValue } from "clsx";

export function cn(...inputs: (string | undefined | false | null)[]) {
  return inputs.filter(Boolean).join(" ");
}

export function formatCurrency(amount: number | string): string {
  const n = typeof amount === "string" ? parseMoneyInput(amount) : amount;
  if (isNaN(n)) return "0 so'm";
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so'm";
}

export function formatShortCurrency(amount: number | string): string {
  const n = typeof amount === "string" ? parseMoneyInput(amount) : amount;
  if (isNaN(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return Math.round(n).toString();
}

export function parseMoneyInput(value: FormDataEntryValue | number | null | undefined): number {
  if (typeof value === "number") return value;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const compact = raw.replace(/[\s'`_]/g, "");
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(compact)) {
    return Number(compact.replace(/[.,]/g, ""));
  }

  const lastDot = compact.lastIndexOf(".");
  const lastComma = compact.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? "." : ",";
    const thousandsSeparator = decimalSeparator === "." ? "," : ".";
    return (
      Number(
        compact
          .replaceAll(thousandsSeparator, "")
          .replace(decimalSeparator, ".")
      ) || 0
    );
  }

  if (lastComma >= 0) return Number(compact.replace(",", ".")) || 0;
  return Number(compact) || 0;
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthStartISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/**
 * Umumiy (kumulyativ) foyda — barcha davrlar bo'yicha:
 * real kirimlar (source != "goal", ichki transferlar kirmaydi) minus chiqimlar.
 * Shu pul asosiy kartada to'planadi.
 */
export function totalProfit(
  incomes: { amount: string; source: string }[],
  expenses: { amount: string; category?: string | null }[]
): number {
  const totalIn = incomes
    .filter((i) => i.source !== "goal")
    .reduce((s, i) => s + parseMoneyInput(i.amount), 0);
  const totalOut = expenses
    .filter((e) => e.category !== "goal")
    .reduce((s, e) => s + parseMoneyInput(e.amount), 0);
  return totalIn - totalOut;
}

export function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
