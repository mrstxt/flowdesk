"use client";

import { useEffect, useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Modal } from "@/components/Modal";

type Goal = {
  id: number;
  title: string;
  targetAmount: string;
  savedAmount: string;
  autoPercent: number | null;
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [modal, setModal] = useState(false);
  const [addFundsGoal, setAddFundsGoal] = useState<Goal | null>(null);

  async function load() {
    const rows = await fetch("/api/goals").then((r) => r.json());
    setGoals(rows);
  }

  useEffect(() => {
    load();
  }, []);

  async function createGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title"),
        targetAmount: fd.get("targetAmount"),
        autoPercent: Number(fd.get("autoPercent")) || 0,
      }),
    });
    setModal(false);
    e.currentTarget.reset();
    load();
  }

  async function deleteGoal(id: number) {
    if (!confirm("Maqsadni o'chirmoqchimisiz?")) return;
    await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
    load();
  }

  async function addFunds(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!addFundsGoal) return;
    const fd = new FormData(e.currentTarget);
    const amt = parseFloat(String(fd.get("amount") || 0));
    const newSaved = parseFloat(addFundsGoal.savedAmount) + amt;
    await fetch("/api/goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: addFundsGoal.id, savedAmount: String(newSaved) }),
    });
    setAddFundsGoal(null);
    e.currentTarget.reset();
    load();
  }

  const totalSaved = goals.reduce(
    (s, g) => s + parseFloat(g.savedAmount),
    0
  );
  const totalTarget = goals.reduce(
    (s, g) => s + parseFloat(g.targetAmount),
    0
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Maqsadlar
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Jamg'arma va avtomatik ajratmalar
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover"
        >
          <Plus className="w-4 h-4" /> Yangi maqsad
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-full bg-accent-soft text-accent">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm text-slate-500">Jami jamg'arma</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(totalSaved)}{" "}
              <span className="text-sm font-normal text-slate-500">
                / {formatCurrency(totalTarget)}
              </span>
            </div>
          </div>
        </div>
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#ff6b8e] to-accent transition-all"
            style={{
              width: totalTarget > 0 ? `${(totalSaved / totalTarget) * 100}%` : "0%",
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.length === 0 && (
          <div className="col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
            <Target className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <div className="text-slate-600 dark:text-slate-400 font-medium mb-1">
              Maqsad yo'q
            </div>
            <div className="text-sm text-slate-500">
              Birinchi maqsadingizni yarating
            </div>
          </div>
        )}
        {goals.map((g) => {
          const saved = parseFloat(g.savedAmount);
          const target = parseFloat(g.targetAmount);
          const pct = Math.min(100, (saved / target) * 100);
          const remaining = Math.max(0, target - saved);
          return (
            <div
              key={g.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 card-hover group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {g.title}
                    </div>
                    {Number(g.autoPercent) > 0 && (
                      <div className="text-xs text-accent">
                        Avtomatik {g.autoPercent}% har buyurtmadan
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteGoal(g.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 rounded-full"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-600 dark:text-slate-400">
                    {formatCurrency(saved)}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {Math.round(pct)}%
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#ff6b8e] to-accent transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Maqsad: {formatCurrency(target)} · Yana{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {formatCurrency(remaining)}
                  </span>{" "}
                  kerak
                </div>
              </div>

              <button
                onClick={() => setAddFundsGoal(g)}
                className="w-full mt-3 py-2 text-sm text-accent hover:bg-accent-soft rounded-full font-medium transition-colors"
              >
                + Pul qo'shish
              </button>
            </div>
          );
        })}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Yangi maqsad"
      >
        <form onSubmit={createGoal} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Maqsad nomi
            </label>
            <input
              name="title"
              required
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Masalan: Yangi noutbuk"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Narxi (so'm)
              </label>
              <input
                name="targetAmount"
                type="number"
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="5000000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Avtomatik foiz (%)
              </label>
              <input
                name="autoPercent"
                type="number"
                min="0"
                max="100"
                defaultValue="0"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            * Har bir buyurtma "Tasdiqlandi" holatiga o'tganda ushbu foiz avtomatik shu maqsadga o'tkaziladi.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModal(false)}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
            >
              Bekor
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-accent text-white rounded-full hover:bg-accent-hover"
            >
              Yaratish
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!addFundsGoal}
        onClose={() => setAddFundsGoal(null)}
        title={`Pul qo'shish: ${addFundsGoal?.title || ""}`}
      >
        <form onSubmit={addFunds} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Summa (so'm)
            </label>
            <input
              name="amount"
              type="number"
              required
              autoFocus
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="100000"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddFundsGoal(null)}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
            >
              Bekor
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-accent text-white rounded-full hover:bg-accent-hover"
            >
              Qo'shish
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
