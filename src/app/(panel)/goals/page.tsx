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
} from "lucide-react";
import { formatCurrency, parseMoneyInput } from "@/lib/utils";
import { Modal } from "@/components/Modal";

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
  const [modal, setModal] = useState(false);
  const [addFundsGoal, setAddFundsGoal] = useState<Goal | null>(null);
  const [cardModal, setCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  async function load() {
    const [g, c] = await Promise.all([
      fetch("/api/goals").then((r) => r.json()),
      fetch("/api/cards").then((r) => r.json()),
    ]);
    setGoals(g);
    setCards(c);
  }

  useEffect(() => {
    load();
  }, []);

  function cardName(id: number | null | undefined): string {
    if (!id) return "—";
    return cards.find((c) => c.id === id)?.name || "—";
  }
  function cardColor(id: number | null | undefined): string {
    if (!id) return "#94a3b8";
    return cards.find((c) => c.id === id)?.color || "#94a3b8";
  }

  async function createGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const cardIdRaw = fd.get("cardId") as string;
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title"),
        targetAmount: String(parseMoneyInput(fd.get("targetAmount"))),
        autoPercent: Number(fd.get("autoPercent")) || 0,
        cardId: cardIdRaw ? Number(cardIdRaw) : null,
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
    const amt = parseMoneyInput(fd.get("amount"));
    const cardIdRaw = fd.get("cardId") as string;
    const newSaved = parseMoneyInput(addFundsGoal.savedAmount) + amt;
    await fetch("/api/goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: addFundsGoal.id,
        savedAmount: String(newSaved),
        cardId: cardIdRaw ? Number(cardIdRaw) : addFundsGoal.cardId,
      }),
    });
    // Kirim sifatida ham yozamiz
    await fetch("/api/incomes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Maqsadga qo'shish: ${addFundsGoal.title}`,
        amount: String(amt),
        source: "goal",
        date: new Date().toISOString().slice(0, 10),
        paymentType: "cash",
        cardId: cardIdRaw ? Number(cardIdRaw) : addFundsGoal.cardId,
      }),
    });
    setAddFundsGoal(null);
    e.currentTarget.reset();
    load();
  }

  async function saveCard(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name"),
      bank: fd.get("bank") || null,
      last4: fd.get("last4") || null,
      color: fd.get("color") || "#0a84ff",
    };
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
    e.currentTarget.reset();
    load();
  }

  async function deleteCard(id: number) {
    if (!confirm("Kartani o'chirmoqchimisiz?")) return;
    await fetch(`/api/cards?id=${id}`, { method: "DELETE" });
    load();
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
            Jamg'arma, avtomatik ajratmalar va karta boshqaruvi
          </p>
        </div>
        <div className="flex gap-2">
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
            onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover"
          >
            <Plus className="w-4 h-4" /> Yangi maqsad
          </button>
        </div>
      </div>

      {/* Cards section */}
      {cards.length > 0 && (
        <div className="bg-white rounded-3xl border border-black/[0.06] p-6 mb-6">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Kartalarim ({cards.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map((c) => (
              <div
                key={c.id}
                className="p-4 border-2 border-slate-100 rounded-2xl group relative"
                style={{ borderLeftColor: c.color, borderLeftWidth: 4 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-7 rounded-md"
                    style={{ background: c.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-900 truncate">
                      {c.name}
                    </div>
                    {c.bank && (
                      <div className="text-xs text-slate-500">
                        {c.bank}
                        {c.last4 ? ` •••• ${c.last4}` : ""}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => {
                        setEditingCard(c);
                        setCardModal(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-accent rounded-full"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteCard(c.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-full"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-black/[0.06] p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-full bg-accent-soft text-accent">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm text-slate-500">Jami jamg'arma</div>
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
                    <div className="font-semibold text-slate-900">{g.title}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                      {Number(g.autoPercent) > 0 && (
                        <span className="text-accent">
                          Avtomatik {g.autoPercent}% sof foydadan
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
                className="w-full mt-3 py-2 text-sm text-accent hover:bg-accent-soft rounded-full font-medium transition-colors"
              >
                + Pul qo'shish
              </button>
            </div>
          );
        })}
      </div>

      {/* Goal modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
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
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Qaysi kartaga to'planadi
            </label>
            <select
              name="cardId"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900"
            >
              <option value="">Tanlanmagan</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  💳 {c.name}
                  {c.last4 ? ` •••• ${c.last4}` : ""}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-500">
            * Avtomatik foiz sof foydadan (Kirim − Chiqim, shu oyda)
            har bir yangi tasdiqlangan buyurtmadan ajratiladi.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModal(false)}
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
              placeholder="Masalan: Asosiy karta, Jamg'arma, ..."
            />
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
                placeholder="Uzcard, Humo, Sber..."
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
        <form onSubmit={addFunds} className="space-y-3">
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
              Qaysi kartadan
            </label>
            <select
              name="cardId"
              defaultValue={addFundsGoal?.cardId || ""}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900"
            >
              <option value="">💵 Naqd</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  💳 {c.name}
                  {c.last4 ? ` •••• ${c.last4}` : ""}
                </option>
              ))}
            </select>
          </div>
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
    </div>
  );
}
