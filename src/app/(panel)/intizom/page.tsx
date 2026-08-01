"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Sunrise,
  Moon,
  Timer,
  Flame,
  CheckCircle2,
  Circle,
  Trash2,
  Check,
  Bot,
  Bell,
  BellOff,
  Zap,
  Clock,
  CalendarDays,
  AlertCircle,
} from "lucide-react";
import { todayISO } from "@/lib/utils";
import { Modal } from "@/components/Modal";

type Routine = {
  id: number;
  time: string;
  title: string;
  lastDoneDate: string | null;
  streak: number | null;
  targetDate: string | null;
  startTime: string | null;
  endTime: string | null;
};
type Task = {
  id: number;
  title: string;
  completed: boolean;
  date: string;
  category: string;
};

function tomorrowISO(): string {
  // toISOString UTC ga asoslanadi — Toshkent vaqti bilan hisoblaymiz
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayHuman(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  });
}

export default function IntizomPage() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [tomorrowRoutines, setTomorrowRoutines] = useState<Routine[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [wake, setWake] = useState("04:30");
  const [sleep, setSleep] = useState("21:40");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [botEnabled, setBotEnabled] = useState(false);

  const today = todayISO();
  const tomorrow = tomorrowISO();

  const load = useCallback(async () => {
    const [rToday, rTomorrow, t, s] = await Promise.all([
      fetch("/api/routines?filter=today").then((r) => r.json()),
      fetch("/api/routines?filter=tomorrow").then((r) => r.json()),
      fetch(`/api/tasks?from=${today}&to=${today}`).then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    setRoutines(rToday);
    setTomorrowRoutines(rTomorrow);
    setTasks(t);
    setWake(s.wake_time || "04:30");
    setSleep(s.sleep_time || "21:40");
    setBotEnabled(s.bot_enabled === "true");
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  function minutesOf(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  const awakeMin = (minutesOf(sleep) - minutesOf(wake) + 1440) % 1440;
  const awakeLabel = `${Math.floor(awakeMin / 60)} soat${
    awakeMin % 60 ? ` ${awakeMin % 60} daqiqa` : ""
  }`;

  const doneCount = routines.filter((r) => r.lastDoneDate === today).length;
  const pct = routines.length ? (doneCount / routines.length) * 100 : 0;

  async function saveTimes() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "wake_time", value: wake }),
    });
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "sleep_time", value: sleep }),
    });
    setSaving(false);
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

  async function deleteRoutine(id: number) {
    if (!confirm("O'chirmoqchimisiz?")) return;
    await fetch(`/api/routines?id=${id}`, { method: "DELETE" });
    load();
  }

  async function addRoutine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const time = fd.get("time") as string;
    const targetDate = fd.get("targetDate") as string;
    const endTimeRaw = fd.get("endTime") as string;
    const targetDateISO = targetDate === "today" ? today : tomorrow;
    const now = new Date();
    const [hh, mm] = time.split(":").map(Number);
    const target = new Date(targetDateISO + "T00:00:00");
    target.setHours(hh, mm, 0, 0);
    if (targetDateISO === today && target.getTime() <= now.getTime()) {
      alert(
        "⚠️ Bu vaqt allaqachon o'tib ketgan. Ertangi kun uchun reja qo'shing yoki boshqa vaqt tanlang."
      );
      return;
    }
    const body: Record<string, unknown> = {
      time,
      title: fd.get("title"),
      targetDate: targetDateISO,
      startTime: time,
    };
    if (endTimeRaw) body.endTime = endTimeRaw;
    await fetch("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setModal(false);
    load();
  }

  async function addTask(e: React.FormEvent<HTMLFormElement>, date: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title"),
        date,
        category: fd.get("category") || "personal",
      }),
    });
    form.reset();
    load();
  }

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

  async function deleteTask(id: number) {
    await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
    setTasks((ts) => ts.filter((t) => t.id !== id));
  }

  return (
    <div className="p-8 max-w-5xl mx-auto fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900">
            Intizom
          </h1>
          <p className="text-slate-500 mt-1.5">
            Kun tartibi — uyg'onish, ishlar va uxlash
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all shadow-lg shadow-accent/25"
        >
          <Plus className="w-4 h-4" /> Yangi reja qo'shish
        </button>
      </div>

      {/* Bot toggle */}
      <div className="mb-6 bg-white rounded-3xl border border-black/[0.06] p-6 overflow-hidden relative">
        <div
          className={`absolute inset-0 opacity-[0.04] ${
            botEnabled ? "bg-accent" : ""
          }`}
        />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-2xl transition-colors ${
                botEnabled
                  ? "bg-accent text-white"
                  : "bg-black/[0.05] text-slate-400"
              }`}
            >
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="font-display font-bold text-slate-900 text-lg">
                Telegram Bot — Intizom nazoratchi
              </div>
              <div className="text-sm text-slate-500 mt-0.5">
                {botEnabled ? (
                  <span className="flex items-center gap-1.5 text-[#34c759]">
                    <Bell className="w-3.5 h-3.5" /> Eslatmalar yoqildi —
                    ertalab, rejalarda va kechqurun xabar keladi
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <BellOff className="w-3.5 h-3.5" /> O'chirilgan — Telegram
                    orqali eslatma kelmaydi
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={async () => {
              const val = !botEnabled;
              setBotEnabled(val);
              await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: "bot_enabled", value: String(val) }),
              });
            }}
            className={`shrink-0 w-14 h-8 rounded-full transition-all relative ${
              botEnabled ? "bg-accent" : "bg-slate-300"
            }`}
          >
            <div
              className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all ${
                botEnabled ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>
        {botEnabled && (
          <div className="relative mt-4 pt-4 border-t border-black/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#ff9f0a]/[0.08]">
              <Sunrise className="w-4 h-4 text-[#ff9f0a] shrink-0" />
              <div>
                <div className="text-xs text-slate-500">Uyg'onishda</div>
                <div className="text-sm font-semibold text-slate-800">
                  "{wake}" da "Turingmi?" tugmasi keladi
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-accent-soft">
              <Zap className="w-4 h-4 text-accent shrink-0" />
              <div>
                <div className="text-xs text-slate-500">Har rejada</div>
                <div className="text-sm font-semibold text-slate-800">
                  Vaqti kelsa eslatma yuboriladi
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#34c759]/[0.08]">
              <CheckCircle2 className="w-4 h-4 text-[#34c759] shrink-0" />
              <div>
                <div className="text-xs text-slate-500">Kechqurun</div>
                <div className="text-sm font-semibold text-slate-800">
                  "{sleep}" da kun yakuni va ertangi so'raladi
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wake / sleep hero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-3xl border border-black/[0.06] p-6">
          <div className="flex items-center gap-2 text-[#ff9f0a] mb-3">
            <Sunrise className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Uyg'onish
            </span>
          </div>
          <input
            type="time"
            value={wake}
            onChange={(e) => setWake(e.target.value)}
            className="font-display text-3xl font-extrabold text-slate-900 bg-transparent focus:outline-none tabular-nums w-full"
          />
        </div>
        <div className="bg-gradient-to-br from-accent to-[#c21240] rounded-3xl p-6 text-white shadow-xl shadow-accent/25">
          <div className="flex items-center gap-2 mb-3 text-white/80">
            <Timer className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Kun davomiyligi
            </span>
          </div>
          <div className="font-display text-3xl font-extrabold tracking-tight">
            {awakeLabel}
          </div>
          <button
            onClick={saveTimes}
            disabled={saving}
            className="mt-3 flex items-center gap-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 px-3.5 py-1.5 rounded-full transition-colors disabled:opacity-60"
          >
            <Check className="w-3.5 h-3.5" />
            {saving ? "Saqlanmoqda..." : "Vaqt saqlandi"}
          </button>
        </div>
        <div className="bg-white rounded-3xl border border-black/[0.06] p-6">
          <div className="flex items-center gap-2 text-[#0a84ff] mb-3">
            <Moon className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Uxlash
            </span>
          </div>
          <input
            type="time"
            value={sleep}
            onChange={(e) => setSleep(e.target.value)}
            className="font-display text-3xl font-extrabold text-slate-900 bg-transparent focus:outline-none tabular-nums w-full"
          />
        </div>
      </div>

      {/* 1️⃣ BUGUNGI KUN — Rejalar + Ishlar (yonma-yon) */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-full bg-accent-soft text-accent">
            <Clock className="w-5 h-5" />
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-900">
            Bugungi kun — {todayHuman(today)}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bugungi rejalar */}
          <div className="bg-white rounded-3xl border border-black/[0.06] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-bold text-slate-900">
                Rejalar
              </h3>
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-accent tabular-nums">
                  {doneCount}/{routines.length}
                </span>
                <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#ff6b8e] to-accent transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>

            {routines.length === 0 ? (
              <div className="text-sm text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-2xl">
                Bugungi reja yo'q. "Yangi reja" tugmasidan qo'shing.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {routines.map((r) => {
                  const done = r.lastDoneDate === today;
                  return (
                    <li
                      key={r.id}
                      className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all group ${
                        done
                          ? "border-[#34c759]/30 bg-[#34c759]/[0.06]"
                          : "border-slate-100 hover:border-accent/30"
                      }`}
                    >
                      <span className="font-display text-sm font-extrabold text-slate-900 w-12 tabular-nums">
                        {r.time}
                      </span>
                      {r.endTime && (
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          → {r.endTime}
                        </span>
                      )}
                      <button
                        onClick={() => toggleRoutine(r.id, done)}
                        className="shrink-0 transition-transform active:scale-90"
                      >
                        {done ? (
                          <CheckCircle2 className="w-5 h-5 text-[#34c759]" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300 hover:text-accent" />
                        )}
                      </button>
                      <span
                        className={`flex-1 text-sm font-medium ${
                          done
                            ? "line-through text-slate-400"
                            : "text-slate-800"
                        }`}
                      >
                        {r.title}
                      </span>
                      {Number(r.streak) > 1 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-[#ff9f0a] bg-[#ff9f0a]/10 px-2 py-0.5 rounded-full">
                          <Flame className="w-3 h-3" />
                          {r.streak}
                        </span>
                      )}
                      <button
                        onClick={() => deleteRoutine(r.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-accent transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Bugungi ishlar */}
          <div className="bg-white rounded-3xl border border-black/[0.06] p-6">
            <h3 className="font-display text-base font-bold text-slate-900 mb-4">
              Ishlar
            </h3>
            <form
              onSubmit={(e) => addTask(e, today)}
              className="flex gap-2 mb-4"
            >
              <input
                name="title"
                required
                placeholder="Bugungi ish... masalan: Mijozga qo'ng'iroq qilish"
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-100 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all shadow-lg shadow-accent/25"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            {tasks.length === 0 ? (
              <div className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-2xl">
                Bugungi ishlar yo'q
              </div>
            ) : (
              <ul className="space-y-1">
                {tasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-2.5 p-2 rounded-2xl hover:bg-slate-50 group transition-colors"
                  >
                    <button
                      onClick={() => toggleTask(t.id, t.completed)}
                      className="shrink-0 active:scale-90 transition-transform"
                    >
                      {t.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-[#34c759]" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300" />
                      )}
                    </button>
                    <span
                      className={`flex-1 text-sm font-medium ${
                        t.completed
                          ? "line-through text-slate-400"
                          : "text-slate-700"
                      }`}
                    >
                      {t.title}
                    </span>
                    {t.category === "urgent" && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-accent bg-accent-soft px-1.5 py-0.5 rounded-full">
                        ⚡ Shoshilinch
                      </span>
                    )}
                    <button
                      onClick={() => deleteTask(t.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-accent transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* 2️⃣ ERTANGI KUN — Rejalar */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-full bg-blue-100 text-[#0a84ff]">
            <CalendarDays className="w-5 h-5" />
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-900">
            Ertangi kun — {todayHuman(tomorrow)}
          </h2>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-white rounded-3xl border border-blue-200 p-6">
          {tomorrowRoutines.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center border border-dashed border-blue-200 rounded-2xl">
              Ertangi kun uchun reja yo'q. "Yangi reja" tugmasidan ertangi
              kun uchun qo'shing.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {tomorrowRoutines.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-white hover:border-accent/30 transition-all group"
                >
                  <span className="font-display text-sm font-extrabold text-slate-900 w-12 tabular-nums">
                    {r.time}
                  </span>
                  {r.endTime && (
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      → {r.endTime}
                    </span>
                  )}
                  <span className="flex-1 text-sm font-medium text-slate-700">
                    {r.title}
                  </span>
                  {Number(r.streak) > 1 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-[#ff9f0a] bg-[#ff9f0a]/10 px-2 py-0.5 rounded-full">
                      <Flame className="w-3 h-3" />
                      {r.streak}
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    📅 ertangi
                  </span>
                  <button
                    onClick={() => deleteRoutine(r.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-accent transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Reja qo'shish modali */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Yangi reja"
      >
        <form onSubmit={addRoutine} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Qaysi kun uchun
            </label>
            <select
              name="targetDate"
              defaultValue="tomorrow"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="tomorrow">
                📅 Ertangi kun ({todayHuman(tomorrow)})
              </option>
              <option value="today">📌 Bugun ({todayHuman(today)})</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Boshlanish vaqti
              </label>
              <input
                name="time"
                type="time"
                required
                defaultValue="07:00"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Deadline (ixtiyoriy)
              </label>
              <input
                name="endTime"
                type="time"
                placeholder="09:00"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Reja nomi
            </label>
            <input
              name="title"
              required
              placeholder="Masalan: Sport bilan shug'ullanish"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModal(false)}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-full"
            >
              Bekor
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-semibold bg-accent text-white rounded-full hover:bg-accent-hover shadow-lg shadow-accent/25"
            >
              Qo'shish
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
