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
} from "lucide-react";
import { todayISO } from "@/lib/utils";
import { Modal } from "@/components/Modal";

type Routine = {
  id: number;
  time: string;
  title: string;
  lastDoneDate: string | null;
  streak: number | null;
};
type Task = {
  id: number;
  title: string;
  completed: boolean;
  date: string;
  category: string;
};

export default function IntizomPage() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [wake, setWake] = useState("06:30");
  const [sleep, setSleep] = useState("23:00");
  const [savedWake, setSavedWake] = useState("06:30");
  const [savedSleep, setSavedSleep] = useState("23:00");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle"
  );
  const [botEnabled, setBotEnabled] = useState(false);

  const today = todayISO();

  const load = useCallback(async () => {
    const [r, t, s] = await Promise.all([
      fetch("/api/routines").then((r) => r.json()),
      fetch(`/api/tasks?from=${today}&to=${today}`).then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    const wakeTime = s.wake_time || "06:30";
    const sleepTime = s.sleep_time || "23:00";
    setRoutines(r);
    setTasks(t);
    setWake(wakeTime);
    setSleep(sleepTime);
    setSavedWake(wakeTime);
    setSavedSleep(sleepTime);
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

  const timesChanged = wake !== savedWake || sleep !== savedSleep;

  async function saveTimes() {
    if (!wake || !sleep) {
      setSaveStatus("error");
      return;
    }

    setSaving(true);
    setSaveStatus("idle");

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: { wake_time: wake, sleep_time: sleep },
        }),
      });

      if (!response.ok) {
        throw new Error("Vaqtlarni saqlab bo'lmadi");
      }

      setSavedWake(wake);
      setSavedSleep(sleep);
      setSaveStatus("saved");
    } catch (error) {
      console.error("Vaqtlarni saqlashda xatolik:", error);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
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
    setRoutines((rs) => rs.filter((r) => r.id !== id));
  }

  async function addRoutine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ time: fd.get("time"), title: fd.get("title") }),
    });
    setModal(false);
    load();
  }

  async function addTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title"),
        date: today,
        category: fd.get("category") || "personal",
      }),
    });
    e.currentTarget.reset();
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
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Intizom
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5">
            Kun tartibi — uyg'onish, ishlar va uxlash
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all shadow-lg shadow-accent/25"
        >
          <Plus className="w-4 h-4" /> Reja qo'shish
        </button>
      </div>

      {/* Bot toggle */}
      <div className="mb-6 bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6 overflow-hidden relative">
        <div className={`absolute inset-0 opacity-[0.04] ${botEnabled ? "bg-accent" : ""}`} />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl transition-colors ${
              botEnabled ? "bg-accent text-white" : "bg-black/[0.05] dark:bg-white/[0.07] text-slate-400"
            }`}>
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="font-display font-bold text-slate-900 dark:text-slate-100 text-lg">
                Telegram Bot — Intizom nazoratchi
              </div>
              <div className="text-sm text-slate-500 mt-0.5">
                {botEnabled ? (
                  <span className="flex items-center gap-1.5 text-[#34c759]">
                    <Bell className="w-3.5 h-3.5" /> Eslatmalar yoqildi — ertalab, rejalarda va kechqurun xabar keladi
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <BellOff className="w-3.5 h-3.5" /> O'chirilgan — Telegram orqali eslatma kelmaydi
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
              botEnabled ? "bg-accent" : "bg-slate-300 dark:bg-slate-700"
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
          <div className="relative mt-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#ff9f0a]/[0.08]">
              <Sunrise className="w-4 h-4 text-[#ff9f0a] shrink-0" />
              <div>
                <div className="text-xs text-slate-500">Uyg'onishda</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  "Turingmi?" tugmasi keladi
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-accent-soft">
              <Zap className="w-4 h-4 text-accent shrink-0" />
              <div>
                <div className="text-xs text-slate-500">Har rejada</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Vaqti kelsa eslatma yuboriladi
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#34c759]/[0.08]">
              <CheckCircle2 className="w-4 h-4 text-[#34c759] shrink-0" />
              <div>
                <div className="text-xs text-slate-500">Kechqurun</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Kunlik hisobot yuboriladi
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wake / sleep hero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6">
          <div className="flex items-center gap-2 text-[#ff9f0a] mb-3">
            <Sunrise className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Uyg'onish
            </span>
          </div>
          <input
            type="time"
            value={wake}
            onChange={(e) => {
              setWake(e.target.value);
              setSaveStatus("idle");
            }}
            aria-label="Uyg'onish vaqti"
            className="font-display text-3xl font-extrabold text-slate-900 dark:text-slate-100 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ff9f0a]/30 rounded-xl tabular-nums w-full cursor-pointer"
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
            disabled={saving || !timesChanged}
            className="mt-3 flex items-center gap-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 px-3.5 py-1.5 rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Check className="w-3.5 h-3.5" />
            {saving
              ? "Saqlanmoqda..."
              : saveStatus === "saved"
                ? "Saqlandi"
                : timesChanged
                  ? "Vaqtlarni saqlash"
                  : "Vaqtlar saqlangan"}
          </button>
          {saveStatus === "error" && (
            <p className="mt-2 text-xs font-semibold text-white/90">
              Saqlashda xatolik. Qayta urinib ko'ring.
            </p>
          )}
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6">
          <div className="flex items-center gap-2 text-[#0a84ff] mb-3">
            <Moon className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Uxlash
            </span>
          </div>
          <input
            type="time"
            value={sleep}
            onChange={(e) => {
              setSleep(e.target.value);
              setSaveStatus("idle");
            }}
            aria-label="Uxlash vaqti"
            className="font-display text-3xl font-extrabold text-slate-900 dark:text-slate-100 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#0a84ff]/30 rounded-xl tabular-nums w-full cursor-pointer"
          />
        </div>
      </div>

      {/* Routine timeline */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            Kunlik rejalar
          </h2>
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-bold text-accent tabular-nums">
              {doneCount}/{routines.length}
            </span>
            <div className="w-28 h-2 bg-black/[0.05] dark:bg-white/[0.07] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#ff6b8e] to-accent transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {routines.length === 0 ? (
          <div className="text-sm text-slate-500 py-12 text-center border border-dashed border-black/[0.1] dark:border-white/[0.1] rounded-2xl">
            Reja yo'q. Masalan: 06:30 — Turish va suv ichish
          </div>
        ) : (
          <ul className="space-y-1.5">
            {routines.map((r) => {
              const done = r.lastDoneDate === today;
              return (
                <li
                  key={r.id}
                  className={`flex items-center gap-4 p-3.5 rounded-2xl border transition-all group ${
                    done
                      ? "border-[#34c759]/30 bg-[#34c759]/[0.06]"
                      : "border-black/[0.05] dark:border-white/[0.06] hover:border-accent/30"
                  }`}
                >
                  <span className="font-display text-sm font-extrabold text-slate-900 dark:text-slate-100 w-14 tabular-nums">
                    {r.time}
                  </span>
                  <button
                    onClick={() => toggleRoutine(r.id, done)}
                    className="shrink-0 transition-transform active:scale-90"
                  >
                    {done ? (
                      <CheckCircle2 className="w-6 h-6 text-[#34c759]" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-300 dark:text-slate-600 hover:text-accent" />
                    )}
                  </button>
                  <span
                    className={`flex-1 text-sm font-medium ${
                      done
                        ? "line-through text-slate-400"
                        : "text-slate-800 dark:text-slate-100"
                    }`}
                  >
                    {r.title}
                  </span>
                  {Number(r.streak) > 1 && (
                    <span className="flex items-center gap-1 text-xs font-bold text-[#ff9f0a] bg-[#ff9f0a]/10 px-2.5 py-1 rounded-full">
                      <Flame className="w-3.5 h-3.5" />
                      {r.streak} kun
                    </span>
                  )}
                  <button
                    onClick={() => deleteRoutine(r.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-accent transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Daily tasks */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 mb-5">
          Kunlik ishlar
        </h2>

        <form onSubmit={addTask} className="flex gap-2 mb-5">
          <input
            name="title"
            required
            placeholder="Yangi ish... masalan: Mijozga qo'ng'iroq qilish"
            className="flex-1 px-5 py-2.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <select
            name="category"
            className="px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-full text-sm text-slate-600 dark:text-slate-300 focus:outline-none"
          >
            <option value="personal">Shaxsiy</option>
            <option value="urgent">Shoshilinch</option>
            <option value="financial">Moliyaviy</option>
          </select>
          <button
            type="submit"
            className="px-5 py-2.5 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all shadow-lg shadow-accent/25"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>

        {tasks.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center border border-dashed border-black/[0.1] dark:border-white/[0.1] rounded-2xl">
            Bugun uchun ish yo'q
          </div>
        ) : (
          <ul className="space-y-1">
            {tasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] group transition-colors"
              >
                <button
                  onClick={() => toggleTask(t.id, t.completed)}
                  className="shrink-0 active:scale-90 transition-transform"
                >
                  {t.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-[#34c759]" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                  )}
                </button>
                <span
                  className={`flex-1 text-sm font-medium ${
                    t.completed
                      ? "line-through text-slate-400"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {t.title}
                </span>
                {t.category === "urgent" && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent-soft px-2 py-0.5 rounded-full">
                    Shoshilinch
                  </span>
                )}
                <button
                  onClick={() => deleteTask(t.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-accent transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Yangi kunlik reja">
        <form onSubmit={addRoutine} className="space-y-3">
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Vaqt
              </label>
              <input
                name="time"
                type="time"
                required
                defaultValue="07:00"
                className="w-full px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Nomi
              </label>
              <input
                name="title"
                required
                placeholder="Masalan: Sport bilan shug'ullanish"
                className="w-full px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModal(false)}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-full"
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
