"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  formatCurrency,
  monthStartISO,
  parseMoneyInput,
  todayISO,
  totalProfit,
} from "@/lib/utils";
import { Modal } from "@/components/Modal";

type Income = {
  id: number;
  title: string;
  amount: string;
  source: string;
  date: string;
  paymentType: string;
  cardId: number | null;
  createdAt: string;
};
type Expense = {
  id: number;
  title: string;
  amount: string;
  category: string;
  date: string;
  cardId: number | null;
  createdAt: string;
};
type Tx = {
  id: number;
  title: string;
  amount: string;
  kind: "in" | "out";
  date: string;
  createdAt: string;
  source: string;
  category: string;
  cardId: number | null;
};
type Goal = {
  id: number;
  title: string;
  targetAmount: string;
  savedAmount: string;
  autoPercent: number | null;
  cardId: number | null;
};
type Card = {
  id: number;
  name: string;
  bank: string | null;
  last4: string | null;
  color: string;
  type: string;
  balance: string;
  archived: boolean | null;
};

const EXPENSE_CATS: Record<string, string> = {
  rent: "Ijara",
  ads: "Reklama",
  subscriptions: "Abonent to'lovlar",
  personal: "Shaxsiy",
  other: "Boshqa",
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tashkent",
    });
  } catch {
    return "";
  }
}

type DayGroup<T> = {
  date: string;
  label: string;
  monthLabel: string;
  items: T[];
  total: number;
};

function groupByDay<T extends { date: string; amount: string; createdAt?: string | null }>(
  items: T[]
): DayGroup<T>[] {
  const today = todayISO();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(yesterday.getDate()).padStart(2, "0")}`;

  const sorted = [...items].sort((a, b) => {
    const dc = b.date.localeCompare(a.date);
    if (dc !== 0) return dc;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });

  const groups: DayGroup<T>[] = [];
  for (const it of sorted) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== it.date) {
      const d = new Date(it.date + "T00:00:00");
      let label: string;
      if (it.date === today) label = "Bugun";
      else if (it.date === yKey) label = "Kecha";
      else
        label = d.toLocaleDateString("uz-UZ", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
      const monthLabel = d.toLocaleDateString("uz-UZ", {
        month: "long",
        year: "numeric",
      });
      g = { date: it.date, label, monthLabel, items: [], total: 0 };
      groups.push(g);
    }
    g.items.push(it);
    g.total += parseMoneyInput(it.amount);
  }
  return groups;
}

export default function FinancePage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [tab, setTab] = useState<"incomes" | "expenses" | "report" | "transactions">(
  "report"
);
  const [modal, setModal] = useState<"income" | "expense" | null>(null);

  async function load() {
    const [i, e, g, c] = await Promise.all([
      fetch("/api/incomes").then((r) => r.json()),
      fetch("/api/expenses").then((r) => r.json()),
      fetch("/api/goals").then((r) => r.json()),
      fetch("/api/cards").then((r) => r.json()),
    ]);
    setIncomes(i);
    setExpenses(e);
    setGoals(g);
    setCards(c);
  }

  function cardName(id: number | null | undefined): string {
    if (!id) return "—";
    return cards.find((c) => c.id === id)?.name || "—";
  }
  function cardColor(id: number | null | undefined): string {
    if (!id) return "#94a3b8";
    return cards.find((c) => c.id === id)?.color || "#94a3b8";
  }

  useEffect(() => {
    load();
  }, []);

  const primaryCard = cards.find((c) => c.type === "primary") || cards[0];
  const ms = monthStartISO();
  // Barcha oy kirimlari (karta taqsimoti hisoboti uchun goal transferlar ham kerak)
  const monthIncomes = incomes.filter((i) => i.date >= ms);
  const monthExpenses = expenses.filter((e) => e.date >= ms);
  // source="goal" — ichki maqsad transferi, sof foydaga kirmaydi (analitika bilan mos)
  const totalIn = monthIncomes
    .filter((i) => i.source !== "goal")
    .reduce((s, i) => s + parseMoneyInput(i.amount), 0);
  const totalOut = monthExpenses.reduce((s, e) => s + parseMoneyInput(e.amount), 0);
  const net = totalIn - totalOut;
  // Umumiy foyda — BARCHA davrlar (o'tgan oy + bu oy + ...). Asosiy kartada
  // shu pul turadi, shuning uchun panelda ham ko'rinishi kerak.
  const totalProfitAll = totalProfit(incomes, expenses);

  const incomeGroups = groupByDay(incomes);
  const expenseGroups = groupByDay(expenses);
  const allTx: Tx[] = [
    ...incomes.map((i) => ({
      id: i.id,
      title: i.title,
      amount: i.amount,
      kind: "in" as const,
      date: i.date,
      createdAt: i.createdAt,
      source: i.source,
      category: "",
      cardId: i.cardId,
    })),
    ...expenses.map((e) => ({
      id: e.id,
      title: e.title,
      amount: e.amount,
      kind: "out" as const,
      date: e.date,
      createdAt: e.createdAt,
      source: "",
      category: e.category,
      cardId: e.cardId,
    })),
  ];
  const txGroups = groupByDay(allTx);

  // Build monthly chart data (last 6 months)
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    // source="goal" — ichki maqsad transferi, grafikda ham sof kirimga kirmaydi
    const inSum = incomes
      .filter((x) => x.date.startsWith(key) && x.source !== "goal")
      .reduce((s, x) => s + parseMoneyInput(x.amount), 0);
    const outSum = expenses
      .filter((x) => x.date.startsWith(key))
      .reduce((s, x) => s + parseMoneyInput(x.amount), 0);
    return {
      month: d.toLocaleDateString("uz-UZ", { month: "short" }),
      Kirim: inSum,
      Chiqim: outSum,
      Foyda: inSum - outSum,
    };
  });

  async function addIncome(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const cardIdRaw = fd.get("cardId") as string;
    await fetch("/api/incomes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title"),
        amount: String(parseMoneyInput(fd.get("amount"))),
        source: fd.get("source"),
        date: fd.get("date") || todayISO(),
        paymentType: fd.get("paymentType") || "cash",
        cardId: cardIdRaw && cardIdRaw !== "cash" ? Number(cardIdRaw) : null,
      }),
    });
    setModal(null);
    e.currentTarget.reset();
    load();
  }

  async function addExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title"),
        amount: String(parseMoneyInput(fd.get("amount"))),
        category: fd.get("category"),
        date: fd.get("date") || todayISO(),
      }),
    });
    setModal(null);
    e.currentTarget.reset();
    load();
  }

  async function deleteIncome(id: number) {
    if (!confirm("O'chirmoqchimisiz?")) return;
    await fetch(`/api/incomes?id=${id}`, { method: "DELETE" });
    load();
  }

  async function deleteExpense(id: number) {
    if (!confirm("O'chirmoqchimisiz?")) return;
    await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Hisob-kitob
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5">
            Tugatilgan buyurtmalar daromadi, xarajatlar va hisobot
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModal("income")}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-full text-sm font-medium hover:bg-green-700"
          >
            <Plus className="w-4 h-4" /> Kirim qo'shish
          </button>
          <button
            onClick={() => setModal("expense")}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-full text-sm font-medium hover:bg-red-700"
          >
            <Plus className="w-4 h-4" /> Chiqim qo'shish
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Shu oydagi kirim"
          value={formatCurrency(totalIn)}
          icon={ArrowUpRight}
          tone="green"
        />
        <StatCard
          label="Shu oydagi chiqim"
          value={formatCurrency(totalOut)}
          icon={ArrowDownRight}
          tone="red"
        />
        <StatCard
          label="Tugatilgan buyurtmalar (oy)"
          value={`${monthIncomes.filter((i) => i.source === "order").length} ta`}
          icon={TrendingUp}
          tone="blue"
        />
        <StatCard
          label="Sof foyda (oy)"
          value={formatCurrency(net)}
          icon={TrendingUp}
          tone={net >= 0 ? "green" : "red"}
          sub={`Umumiy: ${formatCurrency(totalProfitAll)}`}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full p-1 w-fit">
        {[
          { id: "report", label: "Hisobot" },
          { id: "transactions", label: "Transaksiyalar" },
          { id: "incomes", label: "Kirimlar" },
          { id: "expenses", label: "Chiqimlar" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
              tab === t.id
                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "report" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Kartalar bo'yicha taqsimot
              </h2>
              <span className="text-[11px] font-medium text-slate-500 bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-1 rounded-full">
                Shu oy + Umumiy
              </span>
            </div>
            {cards.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-8">
                Kartalar yo'q. Maqsadlar sahifasidan karta qo'shing.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {cards.map((c) => {
                  // Shu oy
                  const cardIn = monthIncomes
                    .filter((i) => i.cardId === c.id)
                    .reduce((s, i) => s + parseMoneyInput(i.amount), 0);
                  const cardOut = monthExpenses
                    .filter((e) => e.cardId === c.id)
                    .reduce((s, e) => s + parseMoneyInput(e.amount), 0);
                  const cardNet = cardIn - cardOut;
                  // Umumiy (barcha davrlar)
                  const allCardIn = incomes
                    .filter((i) => i.cardId === c.id)
                    .reduce((s, i) => s + parseMoneyInput(i.amount), 0);
                  const allCardOut = expenses
                    .filter((e) => e.cardId === c.id)
                    .reduce((s, e) => s + parseMoneyInput(e.amount), 0);
                  const allCardNet = allCardIn - allCardOut;
                  return (
                    <div
                      key={c.id}
                      className="p-4 border-2 border-slate-100 rounded-2xl"
                      style={{ borderLeftColor: c.color, borderLeftWidth: 4 }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-8 h-6 rounded"
                          style={{ background: c.color }}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-slate-900 truncate">
                            {c.name}
                          </div>
                          {c.bank && (
                            <div className="text-[11px] text-slate-500 truncate">
                              {c.bank}
                              {c.last4 ? ` •••• ${c.last4}` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-slate-400">Kirim (oy)</div>
                          <div className="font-bold text-green-600">
                            {formatCurrency(cardIn)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Chiqim (oy)</div>
                          <div className="font-bold text-red-600">
                            {formatCurrency(cardOut)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Sof (oy)</div>
                          <div
                            className={`font-bold ${
                              cardNet >= 0 ? "text-slate-900" : "text-red-600"
                            }`}
                          >
                            {formatCurrency(cardNet)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-dashed border-slate-200 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-slate-400">Kirim (umumiy)</div>
                          <div className="font-bold text-green-600">
                            {formatCurrency(allCardIn)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Chiqim (umumiy)</div>
                          <div className="font-bold text-red-600">
                            {formatCurrency(allCardOut)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Sof (umumiy)</div>
                          <div
                            className={`font-bold ${
                              allCardNet >= 0
                                ? "text-slate-900"
                                : "text-red-600"
                            }`}
                          >
                            {formatCurrency(allCardNet)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Oxirgi 6 oylik dinamika
            </h2>
            <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34c759" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#34c759" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff2d5d" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#ff2d5d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  className="dark:[stroke:#1e293b]"
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  stroke="#cbd5e1"
                  tickFormatter={(v) =>
                    v >= 1_000_000
                      ? (v / 1_000_000).toFixed(1) + "M"
                      : v >= 1000
                      ? (v / 1000).toFixed(0) + "K"
                      : v
                  }
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Kirim"
                  stroke="#34c759"
                  fill="url(#gIn)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Chiqim"
                  stroke="#ff2d5d"
                  fill="url(#gOut)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          </div>
        </div>
      )}

      {tab === "incomes" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Kirimlar ({incomes.length})
            </h2>
          </div>
          {incomeGroups.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Kirimlar yo'q
            </div>
          ) : (
            <DayGroupedList
              groups={incomeGroups}
              keyOf={(i) => `in-${i.id}`}
              tone="green"
              renderMeta={(i) => (
                <>
                  <span>
                    {i.source === "order"
                      ? "Buyurtma"
                      : i.source === "goal"
                      ? "Maqsadga"
                      : i.source === "bonus"
                      ? "Bonus"
                      : "Boshqa"}
                  </span>
                  {i.cardId ? (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{
                        background: `${cardColor(i.cardId)}20`,
                        color: cardColor(i.cardId),
                      }}
                    >
                      💳 {cardName(i.cardId)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">💵 Naqd</span>
                  )}
                </>
              )}
              renderAmount={(i) => (
                <span className="text-green-600">
                  +{formatCurrency(i.amount)}
                </span>
              )}
              onDelete={(i) => deleteIncome(i.id)}
            />
          )}
        </div>
      )}

      {tab === "expenses" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Chiqimlar ({expenses.length})
            </h2>
          </div>
          {expenseGroups.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Chiqimlar yo'q
            </div>
          ) : (
            <DayGroupedList
              groups={expenseGroups}
              keyOf={(e) => `out-${e.id}`}
              tone="red"
              renderMeta={(e) => (
                <>
                  <span>{EXPENSE_CATS[e.category] || e.category}</span>
                  {e.cardId ? (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{
                        background: `${cardColor(e.cardId)}20`,
                        color: cardColor(e.cardId),
                      }}
                    >
                      💳 {cardName(e.cardId)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">💵 Naqd</span>
                  )}
                </>
              )}
              renderAmount={(e) => (
                <span className="text-red-600">
                  -{formatCurrency(e.amount)}
                </span>
              )}
              onDelete={(e) => deleteExpense(e.id)}
            />
          )}
        </div>
      )}

      {tab === "transactions" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Transaksiyalar ({allTx.length})
            </h2>
          </div>
          {txGroups.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Transaksiyalar yo'q
            </div>
          ) : (
            <DayGroupedList
              groups={txGroups}
              keyOf={(t) => `${t.kind}-${t.id}`}
              tone="neutral"
              renderMeta={(t) => (
                <>
                  <span
                    className={
                      t.kind === "in" ? "text-green-600" : "text-red-600"
                    }
                  >
                    {t.kind === "in" ? "Kirim" : "Chiqim"}
                  </span>
                  <span>·</span>
                  <span>
                    {t.kind === "in"
                      ? t.source === "order"
                        ? "Buyurtma"
                        : t.source === "goal"
                        ? "Maqsadga"
                        : t.source === "bonus"
                        ? "Bonus"
                        : "Boshqa"
                      : EXPENSE_CATS[t.category] || t.category}
                  </span>
                  {t.cardId ? (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{
                        background: `${cardColor(t.cardId)}20`,
                        color: cardColor(t.cardId),
                      }}
                    >
                      💳 {cardName(t.cardId)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">💵 Naqd</span>
                  )}
                </>
              )}
              renderAmount={(t) =>
                t.kind === "in" ? (
                  <span className="text-green-600">
                    +{formatCurrency(t.amount)}
                  </span>
                ) : (
                  <span className="text-red-600">
                    -{formatCurrency(t.amount)}
                  </span>
                )
              }
              onDelete={(t) =>
                t.kind === "in" ? deleteIncome(t.id) : deleteExpense(t.id)
              }
            />
          )}
        </div>
      )}

      <Modal
        open={modal === "income"}
        onClose={() => setModal(null)}
        title="Kirim qo'shish"
      >
        <form onSubmit={addIncome} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Manba
            </label>
            <input
              name="title"
              required
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Masalan: Qo'shimcha daromad"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Summa
              </label>
              <input
                name="amount"
                type="text"
                inputMode="decimal"
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Sana
              </label>
              <input
                name="date"
                type="date"
                defaultValue={todayISO()}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Qaysi kartaga
              </label>
              <select
                name="cardId"
                defaultValue={primaryCard ? String(primaryCard.id) : "cash"}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100"
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    💳 {c.name} {c.type === "primary" ? "(Asosiy karta)" : ""}
                    {c.last4 ? ` •••• ${c.last4}` : ""}
                  </option>
                ))}
                <option value="cash">💵 Naqd pul</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Manba turi
              </label>
              <select
                name="source"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="other">Boshqa</option>
                <option value="order">Buyurtma</option>
                <option value="bonus">Bonus</option>
                <option value="goal">Maqsadga ajratish</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModal(null)}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
            >
              Bekor
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-full hover:bg-green-700"
            >
              Saqlash
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modal === "expense"}
        onClose={() => setModal(null)}
        title="Chiqim qo'shish"
      >
        <form onSubmit={addExpense} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Nomi
            </label>
            <input
              name="title"
              required
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Masalan: Ijara to'lovi"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Summa
              </label>
              <input
                name="amount"
                type="text"
                inputMode="decimal"
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Sana
              </label>
              <input
                name="date"
                type="date"
                defaultValue={todayISO()}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Kategoriya
            </label>
            <select
              name="category"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="rent">Ijara</option>
              <option value="ads">Reklama</option>
              <option value="subscriptions">Abonent to'lovlar</option>
              <option value="personal">Shaxsiy</option>
              <option value="other">Boshqa</option>
            </select>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-2.5">
            💡 Chiqim har doim <b>asosiy kartadan</b> yechiladi (
            {primaryCard ? primaryCard.name : "asosiy karta"}).
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModal(null)}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
            >
              Bekor
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-full hover:bg-red-700"
            >
              Saqlash
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function DayGroupedList<T extends {
  id: number;
  title: string;
  amount: string;
  createdAt?: string | null;
  cardId: number | null;
}>({
  groups,
  keyOf,
  tone,
  renderMeta,
  renderAmount,
  onDelete,
}: {
  groups: DayGroup<T>[];
  keyOf: (it: T) => string;
  tone: "green" | "red" | "neutral";
  renderMeta: (it: T) => React.ReactNode;
  renderAmount: (it: T) => React.ReactNode;
  onDelete: (it: T) => void;
}) {
  const toneCls =
    tone === "green"
      ? "text-green-600"
      : tone === "red"
      ? "text-red-600"
      : "text-slate-900 dark:text-slate-100";
  const totalText = (g: DayGroup<T>) => {
    if (tone === "green") return `+${formatCurrency(g.total)}`;
    if (tone === "red") return `-${formatCurrency(g.total)}`;
    const net = g.total;
    return net === 0
      ? formatCurrency(0)
      : `${net > 0 ? "+" : "-"}${formatCurrency(Math.abs(net))}`;
  };
  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {groups.map((g, gi) => {
        const prev = groups[gi - 1];
        const showMonth = !prev || prev.monthLabel !== g.monthLabel;
        return (
          <div key={g.date}>
            {showMonth && (
              <div className="px-6 pt-5 pb-1 text-[11px] font-bold uppercase tracking-wider text-accent">
                {g.monthLabel}
              </div>
            )}
            <div className="px-6 pt-3 pb-1 flex items-center justify-between">
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {g.label}
                {g.label !== "Bugun" && g.label !== "Kecha" && (
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {g.date}
                  </span>
                )}
              </div>
              <div className={`text-xs font-semibold ${toneCls}`}>
                {g.items.length} ta · {totalText(g)}
              </div>
            </div>
            {g.items.map((it) => (
              <div
                key={keyOf(it)}
                className="px-6 py-2.5 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-14 shrink-0 text-right font-mono text-[11px] text-slate-400 tabular-nums">
                    {formatTime(it.createdAt)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {it.title}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      {renderMeta(it)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-sm font-semibold">
                    {renderAmount(it)}
                  </div>
                  <button
                    onClick={() => onDelete(it)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "green" | "red" | "blue";
  sub?: string;
}) {
  const tones = {
    green: "text-green-600 bg-green-50 dark:bg-green-900/30",
    red: "text-red-600 bg-red-50 dark:bg-red-900/30",
    blue: "text-accent bg-accent-soft",
  };
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="text-sm text-slate-500">{label}</div>
        <div className={`p-2 rounded-full ${tones[tone]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        {value}
      </div>
      {sub && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {sub}
        </div>
      )}
    </div>
  );
}
