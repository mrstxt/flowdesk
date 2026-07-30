"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

type Income = { id: number; amount: string; date: string; source: string | null };
type Expense = { id: number; amount: string; date: string; category: string };
type Order = { id: number; stage: string; updatedAt: string; archived: boolean | null };
type Goal = { id: number; title: string; autoPercent: number | null };

const EXPENSE_LABEL: Record<string, string> = {
  rent: "Ijara",
  ads: "Reklama",
  subscriptions: "Abonent to'lovlar",
  personal: "Shaxsiy",
  other: "Boshqa",
};

function monthKey(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString("uz-UZ", { month: "long" });
}

function delta(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export default function AnalitikaPage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/incomes").then((r) => r.json()),
      fetch("/api/expenses").then((r) => r.json()),
      fetch("/api/orders").then((r) => r.json()),
      fetch("/api/goals").then((r) => r.json()),
    ]).then(([i, e, o, g]) => {
      setIncomes(i);
      setExpenses(e);
      setOrders(o);
      setGoals(g);
    });
  }, []);

  const curKey = monthKey(0);
  const prevKey = monthKey(-1);

  const sumIn = (key: string) =>
    incomes.filter((x) => x.date.startsWith(key)).reduce((s, x) => s + Number(x.amount), 0);
  const sumOut = (key: string) =>
    expenses.filter((x) => x.date.startsWith(key)).reduce((s, x) => s + Number(x.amount), 0);
  const doneOrders = (key: string) =>
    orders.filter(
      (o) => o.stage === "confirmed" && o.updatedAt?.startsWith(key)
    ).length;

  const inCur = sumIn(curKey);
  const inPrev = sumIn(prevKey);
  const outCur = sumOut(curKey);
  const outPrev = sumOut(prevKey);
  const netCur = inCur - outCur;
  const netPrev = inPrev - outPrev;
  const ordCur = doneOrders(curKey);
  const ordPrev = doneOrders(prevKey);

  // 6 month chart
  const chart = Array.from({ length: 6 }, (_, i) => {
    const off = i - 5;
    const key = monthKey(off);
    const inn = sumIn(key);
    const out = sumOut(key);
    return {
      month: monthLabel(off).slice(0, 3),
      Kirim: inn,
      Chiqim: out,
      Foyda: inn - out,
    };
  });

  // Top expense category this month
  const byCat: Record<string, number> = {};
  expenses
    .filter((x) => x.date.startsWith(curKey))
    .forEach((x) => {
      byCat[x.category] = (byCat[x.category] || 0) + Number(x.amount);
    });
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  // Insights
  const insights: { text: string; good: boolean | null }[] = [];
  const inD = delta(inCur, inPrev);
  const outD = delta(outCur, outPrev);
  if (inD < -5)
    insights.push({
      text: `Kirim o'tgan oyga nisbatan ${Math.abs(Math.round(inD))}% ga kamaydi. Buyurtma oqimini oshiring: reklama, eski mijozlarga taklif, yangi xizmat qo'shing.`,
      good: false,
    });
  else if (inD >= 15)
    insights.push({
      text: `Kirim ${Math.round(inD)}% ga o'sdi — ajoyib natija! O'sishni saqlash uchun muvaffaqiyatli kanallarga ko'proq e'tibor bering.`,
      good: true,
    });
  if (outD > 10)
    insights.push({
      text: `Chiqimlar ${Math.round(outD)}% ga oshdi${
        topCat ? ` — eng katta qism: ${EXPENSE_LABEL[topCat[0]] || topCat[0]}` : ""
      }. Shu bo'limni qisqartirish yoki optimallashtirish mumkinligini ko'rib chiqing.`,
      good: false,
    });
  else if (outD < -5)
    insights.push({
      text: `Chiqimlar ${Math.abs(Math.round(outD))}% ga kamaydi — tejamkorlik yaxshi ishlayapti.`,
      good: true,
    });
  if (netCur > 0 && goals.some((g) => Number(g.autoPercent) === 0))
    insights.push({
      text: "Maqsadlaringiz bor, lekin avtomatik foiz belgilanmagan. Har buyurtmadan 5–10% ajratilsa, jamg'arma o'zi yig'iladi.",
      good: null,
    });
  if (ordCur >= 3 && inD < 10)
    insights.push({
      text: "Faol buyurtmalar yetarli — endi narxlarni oshirish yoki premium xizmat taklif qilish haqida o'ylang.",
      good: null,
    });
  if (netCur > netPrev && netCur > 0)
    insights.push({
      text: `Sof foyda o'sishda: ${formatCurrency(netPrev)} → ${formatCurrency(netCur)}. Ortiqcha qismni maqsadga yo'naltiring.`,
      good: true,
    });
  if (insights.length === 0)
    insights.push({
      text: "Hozircha ma'lumot kam — buyurtmalar va xarajatlarni kiritib boring, analitika o'zi tavsiyalar beradi.",
      good: null,
    });

  const cards = [
    {
      label: "Kirim",
      cur: inCur,
      prev: inPrev,
      money: true,
      goodUp: true,
    },
    {
      label: "Chiqim",
      cur: outCur,
      prev: outPrev,
      money: true,
      goodUp: false,
    },
    {
      label: "Sof foyda",
      cur: netCur,
      prev: netPrev,
      money: true,
      goodUp: true,
    },
    {
      label: "Yakunlangan buyurtmalar",
      cur: ordCur,
      prev: ordPrev,
      money: false,
      goodUp: true,
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto fade-in">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
          Analitika
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1.5">
          {monthLabel(-1)} → {monthLabel(0)} taqoshlash va o'sish natijalari
        </p>
      </div>

      {/* Comparison cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => {
          const d = delta(c.cur, c.prev);
          const up = d > 0.5;
          const down = d < -0.5;
          const flat = !up && !down;
          const positive = flat ? null : (up && c.goodUp) || (down && !c.goodUp);
          return (
            <div
              key={c.label}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-5 card-hover"
            >
              <div className="text-[13px] font-medium text-slate-500 mb-3">
                {c.label}
              </div>
              <div className="font-display text-[22px] font-extrabold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
                {c.money ? formatCurrency(c.cur) : `${c.cur} ta`}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                    flat
                      ? "bg-black/[0.05] dark:bg-white/[0.08] text-slate-500"
                      : positive
                      ? "bg-[#34c759]/12 text-[#34c759]"
                      : "bg-accent-soft text-accent"
                  }`}
                >
                  {flat ? (
                    <Minus className="w-3 h-3" />
                  ) : up ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {flat ? "0%" : `${Math.abs(Math.round(d))}%`}
                </span>
                <span className="text-[11px] text-slate-400">
                  o'tgan oy:{" "}
                  {c.money ? formatCurrency(c.prev) : `${c.prev} ta`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
            Kirim vs Chiqim — 6 oy
          </h2>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={chart} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1_000_000
                      ? (v / 1_000_000).toFixed(1) + "M"
                      : v >= 1000
                      ? (v / 1000).toFixed(0) + "K"
                      : String(v)
                  }
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 16,
                    fontSize: 13,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="Kirim" fill="#34c759" radius={[8, 8, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Chiqim" fill="#ff2d5d" radius={[8, 8, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
            Sof foyda dinamikasi
          </h2>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff2d5d" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#ff2d5d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1_000_000
                      ? (v / 1_000_000).toFixed(1) + "M"
                      : v >= 1000
                      ? (v / 1000).toFixed(0) + "K"
                      : String(v)
                  }
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 16,
                    fontSize: 13,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Foyda"
                  stroke="#ff2d5d"
                  strokeWidth={2.5}
                  fill="url(#gNet)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-full bg-[#ff9f0a]/12 text-[#ff9f0a]">
            <Lightbulb className="w-4 h-4" />
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            Nima qilsak bo'ladi?
          </h2>
        </div>
        <ul className="space-y-2.5">
          {insights.map((ins, i) => (
            <li
              key={i}
              className={`flex items-start gap-3 p-4 rounded-2xl border ${
                ins.good === true
                  ? "border-[#34c759]/25 bg-[#34c759]/[0.05]"
                  : ins.good === false
                  ? "border-accent/20 bg-accent-soft/60"
                  : "border-black/[0.05] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.03]"
              }`}
            >
              {ins.good === true ? (
                <TrendingUp className="w-5 h-5 text-[#34c759] shrink-0 mt-0.5" />
              ) : ins.good === false ? (
                <TrendingDown className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              ) : (
                <Lightbulb className="w-5 h-5 text-[#ff9f0a] shrink-0 mt-0.5" />
              )}
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed">
                {ins.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
