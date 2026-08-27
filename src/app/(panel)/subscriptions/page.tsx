"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  CreditCard,
  PauseCircle,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { formatCurrency, formatDateDisplay, parseMoneyInput } from "@/lib/utils";

type Subscription = {
  id: number;
  name: string;
  amount: string;
  dueDay: number;
  cycle: string;
  category: string | null;
  active: boolean | null;
  lastPaidAt: string | null;
  notes: string | null;
  createdAt: string;
};

function dueLabel(day: number): string {
  return `Har oy ${day}-sana`;
}

function paidThisMonth(date: string | null): boolean {
  if (!date) return false;
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return date.startsWith(key);
}

export default function SubscriptionsPage() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [modal, setModal] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);

  async function load() {
    const rows = await fetch("/api/subscriptions").then((r) => r.json());
    setItems(rows);
  }

  useEffect(() => {
    load();
  }, []);

  const activeItems = items.filter((i) => i.active !== false);
  const monthlyTotal = useMemo(
    () => activeItems.reduce((sum, i) => sum + parseMoneyInput(i.amount), 0),
    [activeItems]
  );
  const unpaidThisMonth = activeItems.filter((i) => !paidThisMonth(i.lastPaidAt));

  async function createSubscription(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        amount: fd.get("amount"),
        dueDay: fd.get("dueDay"),
        notes: fd.get("notes"),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Obuna qo'shishda xatolik");
      return;
    }
    setModal(false);
    form.reset();
    load();
  }

  async function paySubscription(sub: Subscription) {
    if (!confirm(`«${sub.name}» uchun ${formatCurrency(sub.amount)} to'lov qilinsinmi?`)) {
      return;
    }
    setPayingId(sub.id);
    const res = await fetch("/api/subscriptions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sub.id, action: "pay" }),
    });
    const data = await res.json();
    setPayingId(null);
    if (!res.ok) {
      alert(data.error || "To'lovda xatolik");
      return;
    }
    alert(`✅ ${formatCurrency(sub.amount)} asosiy kartadan yechildi`);
    load();
  }

  async function toggleActive(sub: Subscription) {
    const res = await fetch("/api/subscriptions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sub.id, active: sub.active === false }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Holatni o'zgartirishda xatolik");
      return;
    }
    load();
  }

  async function deleteSubscription(id: number) {
    if (!confirm("Obunani o'chirmoqchimisiz?")) return;
    const res = await fetch(`/api/subscriptions?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "O'chirishda xatolik");
      return;
    }
    load();
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900">
            Oylik obunalar
          </h1>
          <p className="text-slate-500 mt-1.5">
            Har oy takrorlanadigan servislar va avtomatik chiqim nazorati
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover"
        >
          <Plus className="w-4 h-4" /> Obuna qo'shish
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-3xl border border-black/[0.06] p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
            Oylik jami
          </div>
          <div className="font-display text-3xl font-extrabold text-slate-900 mt-2">
            {formatCurrency(monthlyTotal)}
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-black/[0.06] p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
            Faol obunalar
          </div>
          <div className="font-display text-3xl font-extrabold text-slate-900 mt-2">
            {activeItems.length}
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-black/[0.06] p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
            Bu oy to'lanmagan
          </div>
          <div className="font-display text-3xl font-extrabold text-slate-900 mt-2">
            {unpaidThisMonth.length}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
          <ReceiptText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <div className="text-slate-700 font-semibold mb-1">Obuna yo'q</div>
          <div className="text-sm text-slate-500">
            Netflix, hosting, AI servislar yoki boshqa oylik to'lovlarni qo'shing.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((sub) => {
            const active = sub.active !== false;
            const paid = paidThisMonth(sub.lastPaidAt);
            return (
              <div
                key={sub.id}
                className={`bg-white rounded-3xl border p-6 card-hover ${
                  active ? "border-black/[0.06]" : "border-slate-200 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                      <ReceiptText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {sub.name}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {dueLabel(sub.dueDay)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteSubscription(sub.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-full"
                    title="O'chirish"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500">To'lov summasi</div>
                    <div className="font-display text-2xl font-extrabold text-slate-900">
                      {formatCurrency(sub.amount)}
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      paid
                        ? "bg-green-50 text-green-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {paid ? "Bu oy to'langan" : "To'lov kutilmoqda"}
                  </span>
                </div>

                {sub.notes && (
                  <div className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-2xl px-3 py-2">
                    {sub.notes}
                  </div>
                )}

                <div className="mt-4 text-xs text-slate-500">
                  Oxirgi to'lov:{" "}
                  <b>{sub.lastPaidAt ? formatDateDisplay(sub.lastPaidAt) : "hali yo'q"}</b>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    onClick={() => paySubscription(sub)}
                    disabled={!active || payingId === sub.id}
                    className="py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    {payingId === sub.id ? "Yechilyapti..." : "To'lov qilindi"}
                  </button>
                  <button
                    onClick={() => toggleActive(sub)}
                    className="py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center gap-1.5"
                  >
                    {active ? (
                      <>
                        <PauseCircle className="w-3.5 h-3.5" /> Pauza
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Faollashtirish
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Yangi obuna">
        <form onSubmit={createSubscription} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Obuna nomi
            </label>
            <input
              name="name"
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Masalan: ChatGPT, Vercel, Netflix"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Summa
              </label>
              <input
                name="amount"
                type="text"
                inputMode="decimal"
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="100000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                To'lov kuni
              </label>
              <input
                name="dueDay"
                type="number"
                min="1"
                max="31"
                defaultValue="1"
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Izoh
            </label>
            <input
              name="notes"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Masalan: karta orqali har oy yechiladi"
            />
          </div>
          <p className="text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded-xl p-2.5">
            To'lov qilindi bosilganda summa asosiy kartadan yechiladi va
            Hisob-kitob bo'limidagi chiqim/tranzaksiyalarda ko'rinadi.
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
              Saqlash
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
