"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Target,
  Trash2,
  CreditCard,
  Edit2,
  Check,
  X,
  ArrowRightLeft,
  Wallet,
  TrendingUp,
  Lock,
  PiggyBank,
  Calendar,
} from "lucide-react";
import {
  formatCurrency,
  monthStartISO,
  parseMoneyInput,
  totalProfit,
} from "@/lib/utils";
import { Modal } from "@/components/Modal";

type Goal = {
  id: number;
  title: string;
  targetAmount: string;
  savedAmount: string;
  autoPercent: number | null;
  period: string;
  deadline: string | null;
  periodStartedAt: string | null;
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
type Income = {
  id: number;
  amount: string;
  date: string;
  source: string;
  cardId: number | null;
};
type Expense = {
  id: number;
  amount: string;
  date: string;
  cardId: number | null;
};

const CARD_COLORS = [
  "#0a84ff",
  "#34c759",
  "#ff9f0a",
  "#ff2d5d",
  "#af52de",
  "#5e5ce6",
  "#ff6482",
];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goalModal, setGoalModal] = useState(false);
  const [cardModal, setCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [addFundsGoal, setAddFundsGoal] = useState<Goal | null>(null);
  const [transferModal, setTransferModal] = useState(false);
  const [topUpModal, setTopUpModal] = useState<{
    cardId: number;
    cardName: string;
  } | null>(null);
  const [cardSpendingModal, setCardSpendingModal] = useState<{
    cardId: number;
    cardName: string;
  } | null>(null);

  async function load() {
    const [g, c, i, e] = await Promise.all([
      fetch("/api/goals").then((r) => r.json()),
      fetch("/api/cards?includeArchived=true").then((r) => r.json()),
      fetch("/api/incomes").then((r) => r.json()),
      fetch("/api/expenses").then((r) => r.json()),
    ]);
    setGoals(g);
    setCards(c);
    setIncomes(i);
    setExpenses(e);
  }

  useEffect(() => {
    load();
  }, []);

  const primaryCard = cards.find((c) => c.type === "primary" && !c.archived);
  const activeCards = cards.filter((c) => !c.archived);

  // Umumiy foyda — BARCHA davrlar (o'tgan oy + bu oy + ...).
  // Shu pul asosiy kartada to'planadi (ichki goal transferlar kirmaydi).
  const totalProfitAll = totalProfit(incomes, expenses);
  const ms = monthStartISO();
  const netIn = incomes
    .filter((i) => i.date >= ms && i.source !== "goal")
    .reduce((s, i) => s + parseMoneyInput(i.amount), 0);
  const netOut = expenses
    .filter((e) => e.date >= ms)
    .reduce((s, e) => s + parseMoneyInput(e.amount), 0);
  const net = netIn - netOut;
  // O'tgan oy sof foydasi
  const prevMonth = new Date();
  prevMonth.setDate(1);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevKey = `${prevMonth.getFullYear()}-${String(
    prevMonth.getMonth() + 1
  ).padStart(2, "0")}`;
  const prevIn = incomes
    .filter((i) => i.date.startsWith(prevKey) && i.source !== "goal")
    .reduce((s, i) => s + parseMoneyInput(i.amount), 0);
  const prevOut = expenses
    .filter((e) => e.date.startsWith(prevKey))
    .reduce((s, e) => s + parseMoneyInput(e.amount), 0);
  const prevNet = prevIn - prevOut;

  // Karta ko'rsatiladigan pul: asosiy karta uchun umumiy foyda (barcha davr),
  // qolgan kartalar uchun DB qoldiq.
  function cardDisplayBalance(c: (typeof cards)[number]): number {
    return c.type === "primary" ? totalProfitAll : parseMoneyInput(c.balance);
  }

  function cardName(id: number | null | undefined): string {
    if (!id) return "—";
    return cards.find((c) => c.id === id)?.name || "—";
  }
  function cardColor(id: number | null | undefined): string {
    if (!id) return "#94a3b8";
    return cards.find((c) => c.id === id)?.color || "#94a3b8";
  }

  function goalPeriodLabel(goal: Goal): string {
    if (goal.period === "monthly") {
      return goal.deadline ? `Oylik · ${goal.deadline} gacha` : "Oylik";
    }
    return goal.deadline ? `${goal.deadline} gacha` : "Bir martalik";
  }

  async function createGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const cardIdRaw = fd.get("cardId") as string;
    const period = String(fd.get("period") || "one_time");
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title"),
        targetAmount: String(parseMoneyInput(fd.get("targetAmount"))),
        autoPercent: Number(fd.get("autoPercent")) || 0,
        period,
        deadline: fd.get("deadline") || null,
        cardId: cardIdRaw ? Number(cardIdRaw) : null,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Maqsad yaratishda xatolik");
      return;
    }
    setGoalModal(false);
    form.reset();
    load();
  }

  async function deleteGoal(id: number) {
    if (!confirm("Maqsadni o'chirmoqchimisiz?")) return;
    const res = await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Maqsadni o'chirishda xatolik");
      return;
    }
    load();
  }

  async function addFundsToGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!addFundsGoal) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const amt = parseMoneyInput(fd.get("amount"));
    const source = String(fd.get("source") || "");
    const description = (fd.get("description") as string)?.trim() || undefined;
    try {
      const res = await fetch("/api/card-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "goal_fund",
          goalId: addFundsGoal.id,
          amount: amt,
          fromCardId: source === "extra" || !source ? null : Number(source),
          description,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Xatolik yuz berdi");
        return;
      }
      alert(
        `✅ ${formatCurrency(amt)} "${addFundsGoal.title}" maqsadi uchun o'tkazildi!\n` +
          (data.cardName &&
          data.targetCardName &&
          data.cardName !== data.targetCardName
            ? `«${data.cardName}» kartasidan yechildi va «${data.targetCardName}» kartasiga o'tkazildi.`
            : "Maqsad kartasiga qo'shildi.")
      );
      setAddFundsGoal(null);
      form.reset();
      load();
    } catch (e) {
      alert("Xatolik: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function saveCard(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body: Record<string, unknown> = {
      name: fd.get("name"),
      bank: fd.get("bank") || null,
      last4: fd.get("last4") || null,
      color: fd.get("color") || "#0a84ff",
      type: fd.get("type") || "additional",
    };
    if (fd.get("initialBalance")) {
      body.initialBalance = Number(fd.get("initialBalance"));
    }
    if (editingCard) {
      await fetch("/api/cards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingCard.id, ...body }),
      });
    } else {
      await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setCardModal(false);
    setEditingCard(null);
    form.reset();
    load();
  }

  async function deleteCard(id: number) {
    if (!confirm("Kartani o'chirishni xohlaysizmi? (arxivlanadi)")) return;
    const res = await fetch(`/api/cards?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Xatolik");
      return;
    }
    load();
  }

  async function topUpCard(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!topUpModal) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const amt = parseMoneyInput(fd.get("amount"));
    try {
      const res = await fetch("/api/card-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "income",
          cardId: topUpModal.cardId,
          amount: amt,
          description: (fd.get("description") as string) || "Qo'shimcha kirim",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Xatolik");
        return;
      }
      alert(`✅ ${formatCurrency(amt)} «${topUpModal.cardName}» kartasiga qo'shildi`);
      setTopUpModal(null);
      form.reset();
      load();
    } catch (e) {
      alert("Xatolik: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function cardSpending(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cardSpendingModal) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const amt = parseMoneyInput(fd.get("amount"));
    try {
      const res = await fetch("/api/card-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "expense",
          cardId: cardSpendingModal.cardId,
          amount: amt,
          description: (fd.get("description") as string) || "Karta chiqimi",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Xatolik");
        return;
      }
      alert(`✅ ${formatCurrency(amt)} «${cardSpendingModal.cardName}» kartasidan chiqarildi`);
      setCardSpendingModal(null);
      form.reset();
      load();
    } catch (e) {
      alert("Xatolik: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function transfer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const fromCardId = Number(fd.get("fromCardId"));
    const toCardId = Number(fd.get("toCardId"));
    const amount = parseMoneyInput(fd.get("amount"));
    try {
      const res = await fetch("/api/card-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transfer",
          fromCardId,
          toCardId,
          amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Xatolik");
        return;
      }
      alert("✅ Transfer amalga oshirildi");
      setTransferModal(false);
      form.reset();
      load();
    } catch (e) {
      alert("Xatolik: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  const totalSaved = goals.reduce(
    (s, g) => s + parseMoneyInput(g.savedAmount),
    0
  );
  const totalTarget = goals.reduce(
    (s, g) => s + parseMoneyInput(g.targetAmount),
    0
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900">
            Maqsadlar & Kartalar
          </h1>
          <p className="text-slate-500 mt-1.5">
            Kartalar boshqaruvi, transfer va maqsadlarga pul ajratish
          </p>
        </div>
        <div className="flex gap-2">
          {activeCards.length >= 2 && (
            <button
              onClick={() => setTransferModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-full text-sm font-medium hover:bg-slate-50"
            >
              <ArrowRightLeft className="w-4 h-4" /> Transfer
            </button>
          )}
          <button
            onClick={() => {
              setEditingCard(null);
              setCardModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-full text-sm font-medium hover:bg-slate-50"
          >
            <CreditCard className="w-4 h-4" /> Karta qo'shish
          </button>
          <button
            onClick={() => setGoalModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover"
          >
            <Plus className="w-4 h-4" /> Yangi maqsad
          </button>
        </div>
      </div>

      {/* Cards section */}
      <div className="bg-white rounded-3xl border border-black/[0.06] p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Kartalar ({activeCards.length})
          </h2>
          {primaryCard && (
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Lock className="w-3 h-3" /> Asosiy karta: {primaryCard.name}
            </span>
          )}
        </div>

        {activeCards.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-2xl">
            Hech qanday karta yo'q. "Karta qo'shish" tugmasi orqali birinchi
            asosiy kartani yarating.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeCards.map((c) => (
              <div
                key={c.id}
                className={`p-4 border-2 rounded-2xl group relative bg-gradient-to-br from-white to-slate-50 ${
                  c.type === "primary"
                    ? "border-blue-300"
                    : "border-slate-100"
                }`}
                style={{ borderLeftColor: c.color, borderLeftWidth: 4 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className="w-10 h-7 rounded-md shrink-0"
                      style={{ background: c.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-slate-900 truncate flex items-center gap-1">
                        {c.name}
                        {c.type === "primary" && (
                          <Lock className="w-3 h-3 text-blue-600 shrink-0" />
                        )}
                      </div>
                      {c.bank && (
                        <div className="text-[11px] text-slate-500 truncate">
                          {c.bank}
                          {c.last4 ? ` •••• ${c.last4}` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {c.type !== "primary" && (
                      <button
                        onClick={() => deleteCard(c.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-full"
                        title="O'chirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mb-3">
                  <div className="text-[11px] text-slate-500 mb-0.5">
                    {c.type === "primary" ? "Asosiy kartadagi pul" : "Qoldiq"}
                  </div>
                  <div className="font-display text-2xl font-extrabold text-slate-900 tabular-nums">
                    {formatCurrency(
                      c.type === "primary" ? totalProfitAll : c.balance
                    )}
                  </div>
                  {c.type === "primary" && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                        <TrendingUp className="w-3 h-3" />
                        Sof foyda (oy): {formatCurrency(net)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                        <Wallet className="w-3 h-3" />
                        O'tgan oy: {formatCurrency(prevNet)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() =>
                      setTopUpModal({ cardId: c.id, cardName: c.name })
                    }
                    className="flex-1 py-1.5 text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-full flex items-center justify-center gap-1"
                  >
                    <TrendingUp className="w-3 h-3" /> Pul kiritish
                  </button>
                  <button
                    onClick={() =>
                      setCardSpendingModal({ cardId: c.id, cardName: c.name })
                    }
                    className="flex-1 py-1.5 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center gap-1"
                  >
                    <Wallet className="w-3 h-3" /> Chiqarish
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-black/[0.06] p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-full bg-accent-soft text-accent">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm text-slate-500">Jami maqsad jamg'armasi</div>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(totalSaved)}{" "}
              <span className="text-sm font-normal text-slate-500">
                / {formatCurrency(totalTarget)}
              </span>
            </div>
          </div>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
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
          <div className="col-span-2 bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
            <Target className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <div className="text-slate-600 font-medium mb-1">Maqsad yo'q</div>
            <div className="text-sm text-slate-500">
              Birinchi maqsadingizni yarating
            </div>
          </div>
        )}
        {goals.map((g) => {
          const saved = parseMoneyInput(g.savedAmount);
          const target = parseMoneyInput(g.targetAmount);
          const pct = Math.min(100, (saved / target) * 100);
          const remaining = Math.max(0, target - saved);
          return (
            <div
              key={g.id}
              className="bg-white rounded-3xl border border-black/[0.06] p-6 card-hover group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">
                      {g.title}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                      {Number(g.autoPercent) > 0 && (
                        <span className="text-accent">
                          Avtomatik {g.autoPercent}% buyurtmadan
                        </span>
                      )}
                      {g.cardId && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{
                            background: `${cardColor(g.cardId)}20`,
                            color: cardColor(g.cardId),
                          }}
                        >
                          💳 {cardName(g.cardId)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                        <Calendar className="w-3 h-3" />
                        {goalPeriodLabel(g)}
                      </span>
                    </div>
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
                  <span className="text-slate-600">
                    {formatCurrency(saved)}
                  </span>
                  <span className="font-medium text-slate-900">
                    {Math.round(pct)}%
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#ff6b8e] to-accent transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Maqsad: {formatCurrency(target)} · Yana{" "}
                  <span className="font-medium text-slate-700">
                    {formatCurrency(remaining)}
                  </span>{" "}
                  kerak
                </div>
              </div>

              <button
                onClick={() => setAddFundsGoal(g)}
                disabled={!g.cardId}
                className="w-full mt-3 py-2 text-sm text-accent hover:bg-accent-soft rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <PiggyBank className="w-3.5 h-3.5" /> Pul qo'shish
              </button>
              {!g.cardId && (
                <div className="text-[10px] text-amber-600 mt-1 text-center">
                  Avval maqsadga karta biriktiring
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Goal modal */}
      <Modal
        open={goalModal}
        onClose={() => setGoalModal(false)}
        title="Yangi maqsad"
      >
        <form onSubmit={createGoal} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Maqsad nomi
            </label>
            <input
              name="title"
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Masalan: Yangi noutbuk"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Narxi (so'm)
              </label>
              <input
                name="targetAmount"
                type="text"
                inputMode="decimal"
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="5000000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Avtomatik foiz (%)
              </label>
              <input
                name="autoPercent"
                type="number"
                min="0"
                max="100"
                defaultValue="0"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Yig'ish turi
              </label>
              <select
                name="period"
                defaultValue="one_time"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900"
              >
                <option value="one_time">Bir martalik</option>
                <option value="monthly">Oylik</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Muddat
              </label>
              <input
                name="deadline"
                type="date"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Qaysi kartaga to'planadi (faqat kirim)
            </label>
            <select
              name="cardId"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900"
            >
              <option value="">Tanlanmagan</option>
              {activeCards.map((c) => (
                <option key={c.id} value={c.id}>
                  💳 {c.name} ({c.last4 ? `•••• ${c.last4}` : "?"}) —{" "}
                  {formatCurrency(cardDisplayBalance(c))}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-500">
            * Maqsadga faqat kirim bo'ladi. Avtomatik foiz tasdiqlangan
            buyurtmadan ajratiladi va shu kartaga tushadi.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setGoalModal(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-full"
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

      {/* Card modal */}
      <Modal
        open={cardModal}
        onClose={() => {
          setCardModal(false);
          setEditingCard(null);
        }}
        title={editingCard ? "Kartani tahrirlash" : "Yangi karta"}
      >
        <form onSubmit={saveCard} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Karta nomi
            </label>
            <input
              name="name"
              required
              defaultValue={editingCard?.name || ""}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Masalan: Asosiy karta, Qo'shimcha..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Karta turi
            </label>
            <select
              name="type"
              defaultValue={editingCard?.type || "additional"}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900"
            >
              <option value="primary">
                🔒 Asosiy karta (bitta bo'ladi, barcha buyurtma pullari shu yerga)
              </option>
              <option value="additional">
                ➕ Qo'shimcha karta (istalgancha qo'shish mumkin)
              </option>
            </select>
            {primaryCard && !editingCard && (
              <p className="text-[10px] text-amber-600 mt-1">
                ⚠️ Hozir «{primaryCard.name}» asosiy. Yangi asosiy karta
                yaratilsa, eski additional ga aylanadi.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Bank (ixtiyoriy)
              </label>
              <input
                name="bank"
                defaultValue={editingCard?.bank || ""}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="Uzcard, Humo..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Oxirgi 4 raqam
              </label>
              <input
                name="last4"
                maxLength={4}
                defaultValue={editingCard?.last4 || ""}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="1234"
              />
            </div>
          </div>
          {!editingCard && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Boshlang'ich qoldiq (so'm, ixtiyoriy)
              </label>
              <input
                name="initialBalance"
                type="text"
                inputMode="decimal"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="0"
              />
            </div>
          )}
          {editingCard && (
            <div className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl">
              Hozirgi qoldiq: <b>{formatCurrency(cardDisplayBalance(editingCard))}</b> —
              qoldiqni faqat "Pul kiritish" / "Chiqarish" tugmalari orqali
              o'zgartiring.
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Rang
            </label>
            <div className="flex gap-2 flex-wrap">
              {CARD_COLORS.map((c) => (
                <label key={c} className="cursor-pointer">
                  <input
                    type="radio"
                    name="color"
                    value={c}
                    defaultChecked={
                      editingCard?.color === c ||
                      (!editingCard && c === CARD_COLORS[0])
                    }
                    className="sr-only peer"
                  />
                  <div
                    className="w-9 h-7 rounded-md peer-checked:ring-2 peer-checked:ring-accent peer-checked:ring-offset-2"
                    style={{ background: c }}
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setCardModal(false);
                setEditingCard(null);
              }}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-full"
            >
              Bekor
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-accent text-white rounded-full hover:bg-accent-hover flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Saqlash
            </button>
          </div>
        </form>
      </Modal>

      {/* Add funds to goal */}
      <Modal
        open={!!addFundsGoal}
        onClose={() => setAddFundsGoal(null)}
        title={`Pul qo'shish: ${addFundsGoal?.title || ""}`}
      >
        <form onSubmit={addFundsToGoal} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Summa (so'm)
            </label>
            <input
              name="amount"
              type="text"
              inputMode="decimal"
              required
              autoFocus
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="100000"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Pul manbasi
            </label>
            <select
              name="source"
              required
              defaultValue={primaryCard?.id ? String(primaryCard.id) : "extra"}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900"
            >
              {activeCards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.last4 ? `•••• ${c.last4}` : "karta"}) —{" "}
                  {formatCurrency(cardDisplayBalance(c))}
                </option>
              ))}
              <option value="extra">Qo'shimcha kirim (kartadan yechilmaydi)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tavsif (izoh / description)
            </label>
            <input
              name="description"
              type="text"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder={`Masalan: Oylikdan ${addFundsGoal?.title || "maqsad"} uchun`}
            />
          </div>
          <p className="text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded-xl p-2.5">
            Maqsadga pul faqat <b>kirim</b> bo'ladi. Karta tanlansa pul o'sha
            kartadan yechilib maqsad kartasiga o'tadi; qo'shimcha kirim
            tanlansa kartadan yechilmaydi.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddFundsGoal(null)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-full"
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

      {/* Top up card */}
      <Modal
        open={!!topUpModal}
        onClose={() => setTopUpModal(null)}
        title={`«${topUpModal?.cardName}» kartasiga pul kiritish`}
      >
        <form onSubmit={topUpCard} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Summa (so'm)
            </label>
            <input
              name="amount"
              type="text"
              inputMode="decimal"
              required
              autoFocus
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="500000"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Izoh (ixtiyoriy)
            </label>
            <input
              name="description"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Masalan: Bankdan oldim"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setTopUpModal(null)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-full"
            >
              Bekor
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-full hover:bg-green-700"
            >
              Qo'shish
            </button>
          </div>
        </form>
      </Modal>

      {/* Card spending */}
      <Modal
        open={!!cardSpendingModal}
        onClose={() => setCardSpendingModal(null)}
        title={`«${cardSpendingModal?.cardName}» kartasidan chiqarish`}
      >
        <form onSubmit={cardSpending} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Summa (so'm)
            </label>
            <input
              name="amount"
              type="text"
              inputMode="decimal"
              required
              autoFocus
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="50000"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Izoh (ixtiyoriy)
            </label>
            <input
              name="description"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Masalan: Do'kondan oldim"
            />
          </div>
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
            ⚠️ Karta qoldig'ini tekshirib chiqaradi. Yetarli bo'lmasa
            xatolik beradi.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCardSpendingModal(null)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-full"
            >
              Bekor
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-full hover:bg-red-700"
            >
              Chiqarish
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer */}
      <Modal
        open={transferModal}
        onClose={() => setTransferModal(false)}
        title="Kartadan kartaga o'tkazish"
      >
        <form onSubmit={transfer} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Qaysi kartadan
            </label>
            <select
              name="fromCardId"
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900"
            >
              {activeCards.map((c) => (
                <option key={c.id} value={c.id}>
                  💳 {c.name} ({c.last4 ? `•••• ${c.last4}` : "?"}) —{" "}
                  {formatCurrency(cardDisplayBalance(c))}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Qaysi kartaga
            </label>
            <select
              name="toCardId"
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900"
            >
              {activeCards.map((c) => (
                <option key={c.id} value={c.id}>
                  💳 {c.name} ({c.last4 ? `•••• ${c.last4}` : "?"}) —{" "}
                  {formatCurrency(cardDisplayBalance(c))}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Summa (so'm)
            </label>
            <input
              name="amount"
              type="text"
              inputMode="decimal"
              required
              autoFocus
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="100000"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setTransferModal(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-full"
            >
              Bekor
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-accent text-white rounded-full hover:bg-accent-hover flex items-center gap-1.5"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" /> O'tkazish
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
