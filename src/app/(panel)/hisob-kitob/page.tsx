"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Calendar,
  Trash2,
  CheckCircle2,
  Clock,
  User,
  Search,
  Image as ImageIcon,
  ExternalLink,
  X,
  FileText,
  CreditCard,
  Check,
} from "lucide-react";
import { formatCurrency, parseMoneyInput } from "@/lib/utils";
import { Modal } from "@/components/Modal";

type Order = {
  id: number;
  title: string;
  description: string | null;
  stage: string;
  amount: string;
  deadline: string | null;
  clientName: string | null;
  paymentType: string;
  archived: boolean | null;
  createdAt: string;
  updatedAt: string;
};

export default function HisobKitobPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed">("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  async function load() {
    try {
      const rows = await fetch("/api/orders").then((r) => r.json());
      if (Array.isArray(rows)) setOrders(rows);
    } catch (error) {
      console.error("Failed to load hisob-kitob orders:", error);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Filter hisob-kitob orders: either stage === 'hisob_kitob' or clientName exists
  const hisobOrders = useMemo(() => {
    return orders.filter(
      (o) => o.stage === "hisob_kitob" || (o.clientName && !o.archived)
    );
  }, [orders]);

  const stats = useMemo(() => {
    let pendingSum = 0;
    let confirmedSum = 0;
    const clients = new Set<string>();
    let designCount = 0;

    for (const o of hisobOrders) {
      const amt = parseMoneyInput(o.amount);
      if (o.stage === "confirmed") {
        confirmedSum += amt;
      } else {
        pendingSum += amt;
      }
      if (o.clientName?.trim()) clients.add(o.clientName.trim());
      if (o.description) {
        const matches = o.description.match(/\/uploads\/designs\/[^\s\)\"\']+/g);
        if (matches) designCount += matches.length;
      }
    }

    return {
      pendingSum,
      confirmedSum,
      clientCount: clients.size,
      designCount,
    };
  }, [hisobOrders]);

  const filteredOrders = useMemo(() => {
    return hisobOrders.filter((o) => {
      // 1. Tab filter
      if (filter === "pending" && o.stage === "confirmed") return false;
      if (filter === "confirmed" && o.stage !== "confirmed") return false;

      // 2. Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const client = (o.clientName || "").toLowerCase();
        const title = (o.title || "").toLowerCase();
        const desc = (o.description || "").toLowerCase();
        return client.includes(q) || title.includes(q) || desc.includes(q);
      }

      return true;
    });
  }, [hisobOrders, filter, search]);

  async function markAsPaid(order: Order) {
    if (!confirm(`«${order.clientName || order.title}» uchun to'lov qabul qilinganligini tasdiqlaysizmi? Mablag' Asosiy kartangizga kirim qilinadi.`)) {
      return;
    }
    setConfirmingId(order.id);
    try {
      const res = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: order.id,
          stage: "confirmed",
          _oldStage: order.stage,
        }),
      });
      if (res.ok) {
        await load();
      } else {
        const data = await res.json();
        alert(data.error || "Xatolik yuz berdi");
      }
    } catch (e) {
      console.error(e);
      alert("Xatolik yuz berdi");
    } finally {
      setConfirmingId(null);
    }
  }

  async function deleteOrder(id: number) {
    if (!confirm("Ushbu hisob-kitobni ro'yxatdan o'chirmoqchimisiz?")) return;
    try {
      const res = await fetch(`/api/orders?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await load();
      } else {
        const data = await res.json();
        alert(data.error || "O'chirishda xatolik");
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function createSettlement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fd.get("title") || "Dizayn hisob-kitob",
          clientName: fd.get("clientName"),
          amount: String(parseMoneyInput(fd.get("amount"))),
          deadline: fd.get("deadline") || null,
          description: fd.get("description") || null,
          stage: "hisob_kitob",
        }),
      });
      setModal(false);
      form.reset();
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  function formatDate(iso?: string | null): string {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return new Intl.DateTimeFormat("uz-UZ", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return iso;
    }
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-3">
            Hisob-kitob
            <span className="text-xs px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold rounded-full border border-purple-500/20">
              Mijozlar balansi
            </span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm">
            Mijozlar bilan dizayn va xizmatlar hisob-kitoblari, saqlangan rasmlar va to'lov muddatlari
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all"
          >
            <Plus className="w-4 h-4" /> Yangi hisob-kitob
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Kutilayotgan tushum</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
            {formatCurrency(stats.pendingSum)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">To'lov kutilayotgan hisoblar</div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Mijozlar soni</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {stats.clientCount} ta
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Hisob-kitob qilingan mijozlar</div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Saqlangan dizaynlar</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {stats.designCount} ta
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Serverga yuklangan rasmlar</div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>To'langan hisoblar</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(stats.confirmedSum)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Kassaga qabul qilingan</div>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-full border border-slate-200 dark:border-slate-800 w-full sm:w-auto">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
              filter === "all"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Barchasi ({hisobOrders.length})
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
              filter === "pending"
                ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Kutilmoqda ({hisobOrders.filter((o) => o.stage !== "confirmed").length})
          </button>
          <button
            onClick={() => setFilter("confirmed")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
              filter === "confirmed"
                ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            To'langan ({hisobOrders.filter((o) => o.stage === "confirmed").length})
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mijoz ismi yoki ish bo'yicha qidirish..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>
      </div>

      {/* List / Cards */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <div className="text-base font-semibold text-slate-700 dark:text-slate-300">
            Hozircha hisob-kitoblar topilmadi
          </div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Telegram orqali dizayn rasmlarini yuboring va «Shu rasmlarni saqla va [Mijoz]ga yozib qo'y» deng, tizim avtomatik kiritadi!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredOrders.map((o) => {
            const isConfirmed = o.stage === "confirmed";
            const imgMatches = o.description
              ? o.description.match(/\/uploads\/designs\/[^\s\)\"\']+/g) || []
              : [];
            const textLines = o.description
              ? o.description
                  .replace(/\/uploads\/designs\/[^\s\)\"\']+/g, "")
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean)
              : [];

            return (
              <div
                key={o.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Client & Status */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-base">
                        {o.clientName ? o.clientName.charAt(0).toUpperCase() : "M"}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 leading-tight">
                          {o.clientName || "Mijoz ko'rsatilmagan"}
                        </h3>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {o.title}
                        </div>
                      </div>
                    </div>

                    <div>
                      {isConfirmed ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-500/20">
                          <Check className="w-3.5 h-3.5" /> To'landi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-500/20">
                          <Clock className="w-3.5 h-3.5" /> Kutilmoqda
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dates (Saved Date & Deadline) */}
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 mb-4 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-2xl">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Saqlangan: <b>{formatDate(o.createdAt)}</b></span>
                    </div>
                    {o.deadline && (
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Muddati: <b>{o.deadline}</b></span>
                      </div>
                    )}
                  </div>

                  {/* Image Gallery */}
                  {imgMatches.length > 0 && (
                    <div className="mb-4">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                        <ImageIcon className="w-3 h-3" />
                        Dizayn rasmlari ({imgMatches.length} ta)
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {imgMatches.map((src, idx) => (
                          <div
                            key={idx}
                            onClick={() => setPreviewImage(src)}
                            className="relative group/img cursor-pointer shrink-0 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 w-20 h-20 bg-slate-100 dark:bg-slate-800 hover:scale-105 transition-all shadow-sm"
                          >
                            <img
                              src={src}
                              alt={`Dizayn ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <ExternalLink className="w-4 h-4" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Itemized details */}
                  {textLines.length > 0 && (
                    <div className="mb-4 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      {textLines.slice(0, 5).map((line, i) => (
                        <div key={i} className="leading-relaxed">
                          {line}
                        </div>
                      ))}
                      {textLines.length > 5 && (
                        <div className="text-[11px] text-slate-400 italic">
                          +{textLines.length - 5} ta qator...
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer: Amount & Actions */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 mt-2">
                  <div>
                    <div className="text-[11px] text-slate-400">Umumiy hisob:</div>
                    <div className="text-xl font-black text-purple-600 dark:text-purple-400">
                      {formatCurrency(o.amount)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isConfirmed && (
                      <button
                        onClick={() => markAsPaid(o)}
                        disabled={confirmingId === o.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-bold transition-all shadow-sm hover:shadow"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {confirmingId === o.id ? "Saqlanmoqda..." : "To'lov qabul qilindi"}
                      </button>
                    )}
                    <button
                      onClick={() => deleteOrder(o.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors"
                      title="O'chirish"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Dizayn to'liq ko'rinish"
              className="max-w-full max-h-[85vh] object-contain mx-auto"
            />
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Yangi hisob-kitob qo'shish"
      >
        <form onSubmit={createSettlement} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Mijoz ismi
            </label>
            <input
              name="clientName"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              placeholder="Masalan: Akmal aka"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Buyurtma / Ish nomi
            </label>
            <input
              name="title"
              defaultValue="Dizayn hisob-kitob"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              placeholder="Masalan: Brending va logo dizayn"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Jami summa (so'm)
              </label>
              <input
                name="amount"
                type="text"
                inputMode="decimal"
                defaultValue="0"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                To'lov muddati (Deadline)
              </label>
              <input
                name="deadline"
                type="date"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Xizmatlar va dizaynlar tafsiloti
            </label>
            <textarea
              name="description"
              rows={4}
              placeholder="1. Logo dizayn — 500 000 so'm&#10;2. Banner — 200 000 so'm"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-accent text-white rounded-full hover:bg-accent-hover shadow-md shadow-accent/20"
            >
              Saqlash
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
