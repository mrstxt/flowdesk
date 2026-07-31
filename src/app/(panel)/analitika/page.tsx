"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Minus,
  Sunrise,
  Moon,
  Clock,
  CheckCircle2,
  XCircle,
  Video as VideoIcon,
  MessageSquare,
  Calendar,
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
type SleepLog = {
  id: number;
  date: string;
  expectedWake: string | null;
  actualWake: string | null;
  expectedSleep: string | null;
  actualSleep: string | null;
  overslept: boolean | null;
  wentLateSleep: boolean | null;
  reason: string | null;
};
type DailyResult = {
  id: number;
  date: string;
  tasksDone: boolean | null;
  financeRecorded: boolean | null;
  responseType: string | null;
  responseText: string | null;
  videoFileId: string | null;
  createdAt: string;
};

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

function dateKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function delta(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function timeDiffMinutes(expected: string | null, actual: string | null): number | null {
  if (!expected || !actual) return null;
  const [eh, em] = expected.split(":").map(Number);
  const [ah, am] = actual.split(":").map(Number);
  const expMin = (eh || 0) * 60 + (em || 0);
  const actMin = (ah || 0) * 60 + (am || 0);
  return actMin - expMin;
}

function fmtMin(min: number | null): string {
  if (min === null) return "—";
  if (min === 0) return "0 daq";
  if (min > 0) return `+${min} daq (kechikkan)`;
  return `${Math.abs(min)} daq (erta)`;
}

export default function AnalitikaPage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [dailyResults, setDailyResults] = useState<DailyResult[]>([]);
  const [wake, setWake] = useState("04:30");
  const [sleep, setSleep] = useState("21:40");

  useEffect(() => {
    Promise.all([
      fetch("/api/incomes").then((r) => r.json()),
      fetch("/api/expenses").then((r) => r.json()),
      fetch("/api/orders").then((r) => r.json()),
      fetch("/api/goals").then((r) => r.json()),
      fetch(`/api/sleep-logs?from=${dateKey(-30)}&to=${dateKey(0)}`).then((r) =>
        r.json()
      ),
      fetch(`/api/daily-results?from=${dateKey(-30)}&to=${dateKey(0)}`).then((r) =>
        r.json()
      ),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([i, e, o, g, sl, dr, s]) => {
      setIncomes(i);
      setExpenses(e);
      setOrders(o);
      setGoals(g);
      setSleepLogs(sl);
      setDailyResults(dr);
      setWake(s.wake_time || "04:30");
      setSleep(s.sleep_time || "21:40");
    });
  }, []);

  const curKey = monthKey(0);
  const prevKey = monthKey(-1);

  const sumIn = (key: string) =>
    incomes
      .filter((x) => x.date.startsWith(key) && x.source !== "goal")
      .reduce((s, x) => s + Number(x.amount), 0);
  const sumOut = (key: string) =>
    expenses
      .filter((x) => x.date.startsWith(key))
      .reduce((s, x) => s + Number(x.amount), 0);
  const sumGoalAlloc = (key: string) =>
    incomes
      .filter((x) => x.date.startsWith(key) && x.source === "goal")
      .reduce((s, x) => s + Number(x.amount), 0);
  const doneOrders = (key: string) =>
    orders.filter(
      (o) => o.stage === "confirmed" && o.updatedAt?.startsWith(key)
    ).length;

  const inCur = sumIn(curKey);
  const inPrev = sumIn(prevKey);
  const outCur = sumOut(curKey);
  const outPrev = sumOut(prevKey);
  const goalAllocCur = sumGoalAlloc(curKey);
  const goalAllocPrev = sumGoalAlloc(prevKey);
  // Sof foyda = sof kirim - chiqim (maqsadlarga ajratish alohida ko'rsatiladi)
  const netCur = inCur - outCur;
  const netPrev = inPrev - outPrev;
  // Sof qolgan pul = sof foyda - maqsadlarga ajratilgan
  const netRemainingCur = netCur - goalAllocCur;
  const netRemainingPrev = netPrev - goalAllocPrev;
  const ordCur = doneOrders(curKey);
  const ordPrev = doneOrders(prevKey);

  // 6 month chart
  const chart = Array.from({ length: 6 }, (_, i) => {
    const off = i - 5;
    const key = monthKey(off);
    const inn = sumIn(key);
    const out = sumOut(key);
    const goalAlloc = sumGoalAlloc(key);
    return {
      month: monthLabel(off).slice(0, 3),
      Kirim: inn,
      Chiqim: out,
      "Sof foyda": inn - out,
      "Maqsadlarga": goalAlloc,
    };
  });

  // Uyg'onish/uxlash samaradorligi (oxirgi 7 kun)
  const last7 = Array.from({ length: 7 }, (_, i) => dateKey(i - 6));
  const wakeStats = last7
    .map((d) => sleepLogs.find((s) => s.date === d))
    .filter(Boolean) as SleepLog[];
  const onTimeWake = wakeStats.filter(
    (s) => !s.overslept && s.actualWake
  ).length;
  const wakePct = wakeStats.length
    ? Math.round((onTimeWake / wakeStats.length) * 100)
    : 0;
  const avgWakeDelay = wakeStats.length
    ? Math.round(
        wakeStats.reduce(
          (sum, s) => sum + (timeDiffMinutes(s.expectedWake, s.actualWake) ?? 0),
          0
        ) / wakeStats.length
      )
    : 0;
  const onTimeSleep = wakeStats.filter(
    (s) => !s.wentLateSleep && s.actualSleep
  ).length;
  const sleepPct = wakeStats.length
    ? Math.round((onTimeSleep / wakeStats.length) * 100)
    : 0;
  const avgSleepDelay = wakeStats.length
    ? Math.round(
        wakeStats.reduce(
          (sum, s) =>
            sum + (timeDiffMinutes(s.expectedSleep, s.actualSleep) ?? 0),
          0
        ) / wakeStats.length
      )
    : 0;
  const oversleptDays = wakeStats.filter((s) => s.overslept);

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
  // Intizom bo'yicha insight
  if (wakeStats.length >= 3) {
    if (wakePct >= 80)
      insights.push({
        text: `Intizom a'lo darajada! So'nggi 7 kunda ${wakePct}% vaqtida o'z vaqtida uyg'ongansiz. Shu ruhda davom eting.`,
        good: true,
      });
    else if (wakePct < 50)
      insights.push({
        text: `Uyg'onish intizomi past (${wakePct}%). O'rtacha ${Math.abs(
          avgWakeDelay
        )} daqiqa kechikkan ekansiz. Kechqurun uxlash vaqtini 30 daqiqa oldinroq qiling.`,
        good: false,
      });
  }
  if (insights.length === 0)
    insights.push({
      text: "Hozircha ma'lumot kam — buyurtmalar va xarajatlarni kiritib boring, analitika o'zi tavsiyalar beradi.",
      good: null,
    });

  const cards = [
    { label: "Kirim", cur: inCur, prev: inPrev, money: true, goodUp: true },
    { label: "Chiqim", cur: outCur, prev: outPrev, money: true, goodUp: false },
    { label: "Sof foyda", cur: netCur, prev: netPrev, money: true, goodUp: true },
    {
      label: "Maqsadlarga ajratilgan",
      cur: goalAllocCur,
      prev: goalAllocPrev,
      money: true,
      goodUp: true,
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto fade-in">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900">
          Analitika
        </h1>
        <p className="text-slate-500 mt-1.5">
          {monthLabel(-1)} → {monthLabel(0)} taqoshlash va o'sish natijalari
        </p>
      </div>

      {/* Intizom samaradorligi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Uyg'onish samaradorligi */}
        <div className="bg-gradient-to-br from-[#ff9f0a]/8 to-white rounded-3xl border border-[#ff9f0a]/20 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sunrise className="w-5 h-5 text-[#ff9f0a]" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              Uyg'onish samaradorligi
            </h2>
            <span className="ml-auto text-xs text-slate-500">
              Oxirgi 7 kun
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <div className="text-[11px] text-slate-500 mb-1">O'z vaqtida</div>
              <div className="font-display text-2xl font-extrabold text-[#34c759]">
                {wakePct}%
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 mb-1">
                O'rtacha farq
              </div>
              <div
                className={`font-display text-2xl font-extrabold ${
                  avgWakeDelay > 5
                    ? "text-accent"
                    : avgWakeDelay < -5
                    ? "text-[#0a84ff]"
                    : "text-slate-700"
                }`}
              >
                {fmtMin(avgWakeDelay)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 mb-1">
                Kechikkan kun
              </div>
              <div className="font-display text-2xl font-extrabold text-slate-700">
                {wakeStats.length - onTimeWake}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Clock className="w-3 h-3" />
            Reja: {wake}
          </div>
          {oversleptDays.length > 0 && (
            <details className="mt-3">
              <summary className="text-[11px] text-accent cursor-pointer hover:underline">
                Kechikkan kunlarning sabablari ({oversleptDays.length})
              </summary>
              <ul className="mt-2 space-y-1.5">
                {oversleptDays.map((s) => (
                  <li
                    key={s.id}
                    className="text-[11px] p-2 rounded-xl bg-accent-soft/60 text-slate-700"
                  >
                    <span className="font-bold">
                      {new Date(s.date + "T00:00:00").toLocaleDateString(
                        "uz-UZ",
                        { day: "2-digit", month: "short" }
                      )}
                    </span>{" "}
                    — {s.reason || "Sabab ko'rsatilmagan"}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* Uxlash samaradorligi */}
        <div className="bg-gradient-to-br from-[#0a84ff]/8 to-white rounded-3xl border border-[#0a84ff]/20 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Moon className="w-5 h-5 text-[#0a84ff]" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              Uxlash samaradorligi
            </h2>
            <span className="ml-auto text-xs text-slate-500">
              Oxirgi 7 kun
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <div className="text-[11px] text-slate-500 mb-1">O'z vaqtida</div>
              <div className="font-display text-2xl font-extrabold text-[#34c759]">
                {sleepPct}%
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 mb-1">
                O'rtacha farq
              </div>
              <div
                className={`font-display text-2xl font-extrabold ${
                  avgSleepDelay > 5
                    ? "text-accent"
                    : avgSleepDelay < -5
                    ? "text-[#0a84ff]"
                    : "text-slate-700"
                }`}
              >
                {fmtMin(avgSleepDelay)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 mb-1">Kech yotgan</div>
              <div className="font-display text-2xl font-extrabold text-slate-700">
                {wakeStats.length - onTimeSleep}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Clock className="w-3 h-3" />
            Reja: {sleep}
          </div>
        </div>
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
              className="bg-white rounded-3xl border border-black/[0.06] p-5 card-hover"
            >
              <div className="text-[13px] font-medium text-slate-500 mb-3">
                {c.label}
              </div>
              <div className="font-display text-[22px] font-extrabold tracking-tight text-slate-900 tabular-nums">
                {c.money ? formatCurrency(c.cur) : `${c.cur} ta`}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                    flat
                      ? "bg-black/[0.05] text-slate-500"
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
        <div className="bg-white rounded-3xl border border-black/[0.06] p-6">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
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

        <div className="bg-white rounded-3xl border border-black/[0.06] p-6">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
            Sof foyda va maqsadlarga ajratish
          </h2>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0a84ff" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0a84ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gGoal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#af52de" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#af52de" stopOpacity={0} />
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
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Sof foyda"
                  stroke="#0a84ff"
                  strokeWidth={2.5}
                  fill="url(#gNet)"
                />
                <Area
                  type="monotone"
                  dataKey="Maqsadlarga"
                  stroke="#af52de"
                  strokeWidth={2.5}
                  fill="url(#gGoal)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Net foyda tafsilotlari */}
      <div className="bg-white rounded-3xl border border-black/[0.06] p-6 mb-6">
        <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
          💰 Sof foyda tafsilotlari (shu oy)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-4 bg-green-50 border border-green-200 rounded-2xl">
            <div className="text-xs text-green-700 mb-1">Kirim</div>
            <div className="font-display text-xl font-bold text-green-700">
              {formatCurrency(inCur)}
            </div>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
            <div className="text-xs text-red-700 mb-1">− Chiqim</div>
            <div className="font-display text-xl font-bold text-red-700">
              {formatCurrency(outCur)}
            </div>
          </div>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
            <div className="text-xs text-blue-700 mb-1">= Sof foyda</div>
            <div className="font-display text-xl font-bold text-blue-700">
              {formatCurrency(netCur)}
            </div>
          </div>
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
            <div className="text-xs text-purple-700 mb-1">− Maqsadlarga</div>
            <div className="font-display text-xl font-bold text-purple-700">
              {formatCurrency(goalAllocCur)}
            </div>
          </div>
        </div>
        <div className="mt-3 p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-600">Sof qo'lga tegadigan pul</div>
            <div className="font-display text-2xl font-bold text-slate-900">
              {formatCurrency(netRemainingCur)}
            </div>
          </div>
          <div className="text-xs text-slate-500 max-w-xs text-right">
            Sof foydadan maqsadlarga ajratilganidan keyin qolgan sof pul
          </div>
        </div>
      </div>

      {/* Kunlik natijalar */}
      <div className="bg-white rounded-3xl border border-black/[0.06] p-6 mb-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-full bg-[#af52de]/12 text-[#af52de]">
            <Calendar className="w-4 h-4" />
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Kunlik natijalar
          </h2>
          <span className="ml-auto text-xs text-slate-500">
            Kechqurun bot so'rovi
          </span>
        </div>

        {dailyResults.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center border border-dashed border-black/[0.1] rounded-2xl">
            Hali kunlik natija yo'q. Kechqurun uxlash vaqtida bot savollar beradi.
          </div>
        ) : (
          <ul className="space-y-2">
            {dailyResults.map((r) => {
              const dt = new Date(r.date + "T00:00:00");
              const label = dt.toLocaleDateString("uz-UZ", {
                day: "2-digit",
                month: "short",
                weekday: "short",
              });
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 p-3.5 rounded-2xl border border-black/[0.05] hover:border-accent/30 transition-colors"
                >
                  <div className="text-sm font-bold text-slate-700 w-24 shrink-0">
                    {label}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.tasksDone ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-[#34c759] bg-[#34c759]/12 px-2 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        Ishlar ✓
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-accent bg-accent-soft px-2 py-1 rounded-full">
                        <XCircle className="w-3 h-3" />
                        Ishlar ✗
                      </span>
                    )}
                    {r.financeRecorded ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-[#34c759] bg-[#34c759]/12 px-2 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        Hisob ✓
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-accent bg-accent-soft px-2 py-1 rounded-full">
                        <XCircle className="w-3 h-3" />
                        Hisob ✗
                      </span>
                    )}
                  </div>
                  {r.videoFileId && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-[#0a84ff] bg-[#0a84ff]/10 px-2 py-1 rounded-full">
                      <VideoIcon className="w-3 h-3" />
                      Video
                    </span>
                  )}
                  {r.responseText && (
                    <span className="flex-1 text-[12px] text-slate-600 truncate">
                      {r.responseText}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Insights */}
      <div className="bg-white rounded-3xl border border-black/[0.06] p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-full bg-[#ff9f0a]/12 text-[#ff9f0a]">
            <Lightbulb className="w-4 h-4" />
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900">
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
                  : "border-black/[0.05] bg-black/[0.02]"
              }`}
            >
              {ins.good === true ? (
                <TrendingUp className="w-5 h-5 text-[#34c759] shrink-0 mt-0.5" />
              ) : ins.good === false ? (
                <TrendingDown className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              ) : (
                <Lightbulb className="w-5 h-5 text-[#ff9f0a] shrink-0 mt-0.5" />
              )}
              <p className="text-sm font-medium text-slate-700 leading-relaxed">
                {ins.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
