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
import { formatCurrency, monthStartISO, parseMoneyInput, todayISO } from "@/lib/utils";
import { Modal } from "@/components/Modal";

type Income = {
  id: number;
  title: string;
  amount: string;
  source: string;
  date: string;
  paymentType: string;
  cardId: number | null;
};
type Expense = {
  id: number;
  title: string;
  amount: string;
  category: string;
  date: string;
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
};

const EXPENSE_CATS: Record<string, string> = {
  rent: "Ijara",
  ads: "Reklama",
  subscriptions: "Abonent to'lovlar",
  personal: "Shaxsiy",
  other: "Boshqa",
};

export default function FinancePage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [tab, setTab] = useState<"incomes" | "expenses" | "report">("report");
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

  const ms = monthStartISO();
  const monthIncomes = incomes.filter((i) => i.date >= ms);
  const monthExpenses = expenses.filter((e) => e.date >= ms);
  const totalIn = monthIncomes.reduce((s, i) => s + parseMoneyInput(i.amount), 0);
  const totalOut = monthExpenses.reduce((s, e) => s + parseMoneyInput(e.amount), 0);
  const net = totalIn - totalOut;

  // Build monthly chart data (last 6 months)
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    const inSum = incomes
      .filter((x) => x.date.startsWith(key))
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
    const cardIdRaw = fd.get("cardId") as string;
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title"),
        amount: String(parseMoneyInput(fd.get("amount"))),
        category: fd.get("category"),
        date: fd.get("date") || todayISO(),
        cardId: cardIdRaw && cardIdRaw !== "cash" ? Number(cardIdRaw) : null,
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
          label="Sof foyda"
          value={formatCurrency(net)}
          icon={TrendingUp}
          tone={net >= 0 ? "green" : "red"}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full p-1 w-fit">
        {[
          { id: "report", label: "Hisobot" },
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
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Kartalar bo'yicha taqsimot (shu oy)
            </h2>
            {cards.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-8">
                Kartalar yo'q. Maqsadlar sahifasidan karta qo'shing.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {cards.map((c) => {
                  const cardIn = monthIncomes
                    .filter((i) => i.cardId === c.id)
                    .reduce((s, i) => s + parseMoneyInput(i.amount), 0);
                  const cardOut = monthExpenses
                    .filter((e) => e.cardId === c.id)
                    .reduce((s, e) => s + parseMoneyInput(e.amount), 0);
                  const cardNet = cardIn - cardOut;
                  return (
                    <div
                      key={c.id}
                      className="p-4 border-2 border-slate-100 rounded-2xl"
                      style={{ borderLeftColor: c.color, borderLeftWidth: 4 }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-8 h-6 rounded"
                          style={{ background: c.color }}
                        />
                        <div>
                          <div className="font-semibold text-sm text-slate-900">
                            {c.name}
                          </div>
                          {c.bank && (
                            <div className="text-[11px] text-slate-500">
                              {c.bank}
                              {c.last4 ? ` •••• ${c.last4}` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-slate-500">Kirim</div>
                          <div className="font-bold text-green-600">
                            {formatCurrency(cardIn)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Chiqim</div>
                          <div className="font-bold text-red-600">
                            {formatCurrency(cardOut)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Sof</div>
                          <div
                            className={`font-bold ${
                              cardNet >= 0 ? "text-slate-900" : "text-red-600"
                            }`}
                          >
                            {formatCurrency(cardNet)}
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
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {incomes.length === 0 && (
              <div className="p-12 text-center text-sm text-slate-500">
                Kirimlar yo'q
              </div>
            )}
            {incomes.map((i) => (
              <div
                key={i.id}
                className="px-6 py-3 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {i.title}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                    <span>{i.date}</span>
                    <span>·</span>
                    <span>{i.source === "order" ? "Buyurtma" : i.source === "goal" ? "Maqsadga" : i.source === "bonus" ? "Bonus" : "Boshqa"}</span>
                    {i.cardId && (
                      <>
                        <span>·</span>
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{
                            background: `${cardColor(i.cardId)}20`,
                            color: cardColor(i.cardId),
                          }}
                        >
                          💳 {cardName(i.cardId)}
                        </span>
                      </>
                    )}
                    {!i.cardId && (
                      <span className="text-[10px] text-slate-400">💵 Naqd</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-sm font-semibold text-green-600">
                    +{formatCurrency(i.amount)}
                  </div>
                  <button
                    onClick={() => deleteIncome(i.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "expenses" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Chiqimlar ({expenses.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {expenses.length === 0 && (
              <div className="p-12 text-center text-sm text-slate-500">
                Chiqimlar yo'q
              </div>
            )}
            {expenses.map((e) => (
              <div
                key={e.id}
                className="px-6 py-3 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {e.title}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                    <span>{e.date}</span>
                    <span>·</span>
                    <span>{EXPENSE_CATS[e.category] || e.category}</span>
                    {e.cardId && (
                      <>
                        <span>·</span>
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{
                            background: `${cardColor(e.cardId)}20`,
                            color: cardColor(e.cardId),
                          }}
                        >
                          💳 {cardName(e.cardId)}
                        </span>
                      </>
                    )}
                    {!e.cardId && (
                      <span className="text-[10px] text-slate-400">💵 Naqd</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-sm font-semibold text-red-600">
                    -{formatCurrency(e.amount)}
                  </div>
                  <button
                    onClick={() => deleteExpense(e.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
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
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="cash">💵 Naqd pul</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    💳 {c.name}
                    {c.last4 ? ` •••• ${c.last4}` : ""}
                  </option>
                ))}
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
          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Qaysi kartadan
              </label>
              <select
                name="cardId"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="cash">💵 Naqd pul</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    💳 {c.name}
                    {c.last4 ? ` •••• ${c.last4}` : ""}
                  </option>
                ))}
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

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "green" | "red" | "blue";
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
    </div>
  );
}
