"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Target,
  BookOpen,
  Clapperboard,
  CheckCircle2,
  Circle,
  Kanban,
  AlarmClock,
  Flame,
} from "lucide-react";
import { formatCurrency, monthStartISO, parseMoneyInput, todayISO } from "@/lib/utils";
import { Modal } from "@/components/Modal";

type Order = {
  id: number;
  title: string;
  amount: string;
  stage: string;
  deadline: string | null;
  archived: boolean | null;
};
type Task = { id: number; title: string; completed: boolean; date: string };
type Income = { id: number; amount: string; date: string };
type Expense = { id: number; amount: string; date: string };
type Goal = {
  id: number;
  title: string;
  targetAmount: string;
  savedAmount: string;
};
type Routine = {
  id: number;
  time: string;
  title: string;
  lastDoneDate: string | null;
  streak: number | null;
};
type Book = {
  id: number;
  title: string;
  author: string | null;
  totalPages: number;
  currentPage: number;
  status: string;
};

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [settings, setSettings] = useState({ wake: "04:30", sleep: "21:40" });

  const [orderModal, setOrderModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);

  async function load() {
    const [o, t, i, e, g, r, b, s] = await Promise.all([
      fetch("/api/orders").then((r) => r.json()),
      fetch(`/api/tasks?from=${todayISO()}&to=${todayISO()}`).then((r) =>
        r.json()
      ),
      fetch("/api/incomes").then((r) => r.json()),
      fetch("/api/expenses").then((r) => r.json()),
      fetch("/api/goals").then((r) => r.json()),
      fetch("/api/routines").then((r) => r.json()),
      fetch("/api/books").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    setOrders(o);
    setTasks(t);
    setIncomes(i);
    setExpenses(e);
    setGoals(g);
    setRoutines(r);
    setBooks(b);
    setSettings({
      wake: s.wake_time || "04:30",
      sleep: s.sleep_time || "21:40",
    });
  }

  useEffect(() => {
    load();
  }, []);

  const ms = monthStartISO();
  const totalIn = incomes
    .filter((i) => i.date >= ms)
    .reduce((s, i) => s + parseMoneyInput(i.amount), 0);
  const totalOut = expenses
    .filter((e) => e.date >= ms)
    .reduce((s, e) => s + parseMoneyInput(e.amount), 0);
  const net = totalIn - totalOut;
  const activeOrders = orders.filter(
    (o) => o.stage !== "confirmed" && !o.archived
  );

  const today = todayISO();
  const doneRoutines = routines.filter((r) => r.lastDoneDate === today).length;
  const readingBook = books.find((b) => b.status === "reading");

  async function toggleTask(id: number, completed: boolean) {
    await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed: !completed }),
    });
    setTasks((ts) =>
      ts.map((t) => (t.id === id ? { ...t, completed: !completed } : t))
    );
  }

  async function toggleRoutine(id: number, done: boolean) {
    const res = await fetch("/api/routines", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, done }),
    });
    const updated = await res.json();
    setRoutines((rs) => rs.map((r) => (r.id === id ? updated : r)));
  }

  async function addOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title"),
        amount: String(parseMoneyInput(fd.get("amount"))),
        deadline: fd.get("deadline") || null,
        clientName: fd.get("clientName") || null,
        description: fd.get("description") || null,
      }),
    });
    setOrderModal(false);
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
        date: todayISO(),
      }),
    });
    setExpenseModal(false);
    load();
  }

  return (
    <div className="p-8 max-w-7xl mx-auto fade-in">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-accent mb-1.5">
            {new Date().toLocaleDateString("uz-UZ", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Xush kelibsiz 👋
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5">
            Bugungi holat — qisqa va aniq.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setOrderModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all shadow-lg shadow-accent/25"
          >
            <Plus className="w-4 h-4" /> Yangi buyurtma
          </button>
          <button
            onClick={() => setExpenseModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-black/[0.07] dark:border-white/[0.09] rounded-full text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.97] transition-all"
          >
            <Plus className="w-4 h-4" /> Chiqim
          </button>
          <Link
            href="/kitoblar"
            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-black/[0.07] dark:border-white/[0.09] rounded-full text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.97] transition-all"
          >
            <BookOpen className="w-4 h-4 text-[#0a84ff]" /> Kitob
          </Link>
          <Link
            href="/rivojlanish"
            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-black/[0.07] dark:border-white/[0.09] rounded-full text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.97] transition-all"
          >
            <Clapperboard className="w-4 h-4 text-[#af52de]" /> Video
          </Link>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi
          label="Oylik kirim"
          value={formatCurrency(totalIn)}
          icon={ArrowUpRight}
          tone="green"
        />
        <Kpi
          label="Oylik chiqim"
          value={formatCurrency(totalOut)}
          icon={ArrowDownRight}
          tone="red"
        />
        <Kpi
          label="Sof foyda"
          value={formatCurrency(net)}
          icon={TrendingUp}
          tone="accent"
        />
        <Kpi
          label="Faol buyurtmalar"
          value={`${activeOrders.length} ta`}
          icon={Kanban}
          tone="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: intizom + vazifalar */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6 card-hover">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-full bg-accent-soft text-accent">
                  <AlarmClock className="w-4 h-4" />
                </div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  Bugungi intizom
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1.5 rounded-full">
                  Uyg'onish {settings.wake} · Uxlash {settings.sleep}
                </span>
                <Link
                  href="/intizom"
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Barchasi →
                </Link>
              </div>
            </div>
            {routines.length === 0 ? (
              <div className="text-sm text-slate-500 py-8 text-center border border-dashed border-black/[0.1] dark:border-white/[0.1] rounded-2xl">
                Intizom reja yo'q —{" "}
                <Link href="/intizom" className="text-accent font-semibold">
                  yarating
                </Link>
              </div>
            ) : (
              <>
                <div className="h-2 bg-black/[0.05] dark:bg-white/[0.07] rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-gradient-to-r from-[#ff6b8e] to-accent transition-all duration-500"
                    style={{
                      width: `${
                        routines.length
                          ? (doneRoutines / routines.length) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <ul className="space-y-1">
                  {routines.slice(0, 5).map((r) => {
                    const done = r.lastDoneDate === today;
                    return (
                      <li
                        key={r.id}
                        onClick={() => toggleRoutine(r.id, done)}
                        className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer transition-colors"
                      >
                        <span className="font-display text-xs font-bold text-slate-500 w-12 tabular-nums">
                          {r.time}
                        </span>
                        {done ? (
                          <CheckCircle2 className="w-5 h-5 text-[#34c759] shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0" />
                        )}
                        <span
                          className={
                            done
                              ? "line-through text-slate-400 text-sm"
                              : "text-slate-700 dark:text-slate-200 text-sm font-medium"
                          }
                        >
                          {r.title}
                        </span>
                        {Number(r.streak) > 1 && (
                          <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-[#ff9f0a]">
                            <Flame className="w-3.5 h-3.5" />
                            {r.streak} kun
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <section className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6 card-hover">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                Bugungi vazifalar
              </h2>
              <span className="text-xs text-slate-500">
                {tasks.filter((t) => t.completed).length}/{tasks.length}{" "}
                bajarildi
              </span>
            </div>
            {tasks.length === 0 ? (
              <div className="text-sm text-slate-500 py-8 text-center border border-dashed border-black/[0.1] dark:border-white/[0.1] rounded-2xl">
                Bugunga vazifa yo'q. Intizom bo'limidan qo'shing.
              </div>
            ) : (
              <ul className="space-y-1">
                {tasks.map((t) => (
                  <li
                    key={t.id}
                    onClick={() => toggleTask(t.id, t.completed)}
                    className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer transition-colors"
                  >
                    {t.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-[#34c759]" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                    )}
                    <span
                      className={
                        t.completed
                          ? "line-through text-slate-400 text-sm"
                          : "text-slate-700 dark:text-slate-200 text-sm font-medium"
                      }
                    >
                      {t.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right: goals + book + orders */}
        <div className="space-y-6">
          <section className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6 card-hover">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-2 rounded-full bg-accent-soft text-accent">
                <Target className="w-4 h-4" />
              </div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                Maqsadlar
              </h2>
            </div>
            {goals.length === 0 ? (
              <div className="text-sm text-slate-500 py-6 text-center border border-dashed border-black/[0.1] dark:border-white/[0.1] rounded-2xl">
                Maqsad yo'q
              </div>
            ) : (
              <ul className="space-y-4">
                {goals.slice(0, 3).map((g) => {
                  const saved = parseMoneyInput(g.savedAmount);
                  const target = parseMoneyInput(g.targetAmount);
                  const pct = Math.min(100, (saved / target) * 100);
                  return (
                    <li key={g.id}>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {g.title}
                        </span>
                        <span className="font-display text-xs font-bold text-accent tabular-nums">
                          {Math.round(pct)}%
                        </span>
                      </div>
                      <div className="h-2 bg-black/[0.05] dark:bg-white/[0.07] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#ff6b8e] to-accent transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Yana{" "}
                        <b>{formatCurrency(Math.max(0, target - saved))}</b>{" "}
                        kerak
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {readingBook && (
            <section className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6 card-hover">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-2 rounded-full bg-[#e7f1ff] dark:bg-[#0a84ff]/15 text-[#0a84ff]">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  Hozir o'qiyapman
                </h2>
              </div>
              <div className="font-display font-bold text-slate-900 dark:text-slate-100 mb-0.5">
                {readingBook.title}
              </div>
              <div className="text-xs text-slate-500 mb-3">
                {readingBook.author}
              </div>
              <div className="h-2 bg-black/[0.05] dark:bg-white/[0.07] rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-[#0a84ff] transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (readingBook.currentPage /
                        Math.max(1, readingBook.totalPages)) *
                        100
                    )}%`,
                  }}
                />
              </div>
              <Link
                href="/kitoblar"
                className="text-xs text-slate-500 hover:text-[#0a84ff] transition-colors"
              >
                {readingBook.currentPage}/{readingBook.totalPages} sahifa →
              </Link>
            </section>
          )}

          {activeOrders.length > 0 && (
            <section className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6 card-hover">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                Faol buyurtmalar
              </h2>
              <div className="space-y-2">
                {activeOrders.slice(0, 3).map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {o.title}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {o.deadline ? `Muddat: ${o.deadline}` : "Muddatsiz"}
                      </div>
                    </div>
                    <div className="font-display text-sm font-bold text-accent whitespace-nowrap ml-3">
                      {formatCurrency(o.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal
        open={orderModal}
        onClose={() => setOrderModal(false)}
        title="Yangi buyurtma"
      >
        <form onSubmit={addOrder} className="space-y-3">
          <Input label="Nomi" name="title" required placeholder="Masalan: Logo dizayn" />
          <Input label="Mijoz" name="clientName" placeholder="Mijoz ismi (ixtiyoriy)" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Summa (so'm)" name="amount" type="text" inputMode="decimal" placeholder="50.000" />
            <Input label="Deadline" name="deadline" type="date" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Tavsif
            </label>
            <input
              name="description"
              placeholder="Qo'shimcha ma'lumot..."
              className="w-full px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOrderModal(false)}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-full"
            >
              Bekor
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-semibold bg-accent text-white rounded-full hover:bg-accent-hover shadow-lg shadow-accent/25"
            >
              Saqlash
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={expenseModal}
        onClose={() => setExpenseModal(false)}
        title="Chiqim qo'shish"
      >
        <form onSubmit={addExpense} className="space-y-3">
          <Input label="Nomi" name="title" required placeholder="Masalan: Ijara" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Summa (so'm)" name="amount" type="text" inputMode="decimal" required placeholder="100.000" />
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Kategoriya
              </label>
              <select
                name="category"
                className="w-full px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                <option value="rent">Ijara</option>
                <option value="ads">Reklama</option>
                <option value="subscriptions">Abonent to'lovlar</option>
                <option value="personal">Shaxsiy</option>
                <option value="other">Boshqa</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setExpenseModal(false)}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-full"
            >
              Bekor
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-semibold bg-accent text-white rounded-full hover:bg-accent-hover shadow-lg shadow-accent/25"
            >
              Saqlash
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "green" | "red" | "accent" | "blue";
}) {
  const tones = {
    green: "text-[#34c759] bg-[#34c759]/10",
    red: "text-accent bg-accent-soft",
    accent: "text-accent bg-accent-soft",
    blue: "text-[#0a84ff] bg-[#0a84ff]/10",
  };
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-5 card-hover">
      <div className="flex items-start justify-between mb-4">
        <div className="text-[13px] font-medium text-slate-500">{label}</div>
        <div className={`p-2 rounded-full ${tones[tone]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="font-display text-[22px] font-extrabold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
        {value}
      </div>
    </div>
  );
}

function Input({
  label,
  name,
  type = "text",
  inputMode,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
        {label}
      </label>
      <input
        type={type}
        inputMode={inputMode}
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>
  );
}
