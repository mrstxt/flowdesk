"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Bot,
  Plus,
  ExternalLink,
  Star,
  Copy,
  Check,
  Trash2,
  Edit2,
  Sparkles,
  Search,
  Image as ImageIcon,
  Video,
  FileText,
  Mic,
  Smile,
  Globe,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { Modal } from "@/components/Modal";

type AiModel = {
  id: number;
  name: string;
  url: string;
  category: string;
  description: string | null;
  promptTemplate: string | null;
  notes: string | null;
  favorite: boolean | null;
  sortOrder: number | null;
  createdAt: string;
};

const CATEGORIES: Record<
  string,
  { label: string; icon: any; color: string; bg: string; border: string }
> = {
  image: {
    label: "Tasvir / Rasm",
    icon: ImageIcon,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
  video: {
    label: "Video Generatsiya",
    icon: Video,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
  text: {
    label: "Matn & Kopirayting",
    icon: FileText,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  voice: {
    label: "Ovoz & Musiqa",
    icon: Mic,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  face_swap: {
    label: "Feys & Avatar",
    icon: Smile,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
  },
  other: {
    label: "Boshqa vositalar",
    icon: Layers,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
};

export default function AiModellarPage() {
  const [models, setModels] = useState<AiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editingModel, setEditingModel] = useState<AiModel | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadModels() {
    try {
      setLoading(true);
      const res = await fetch("/api/ai-models");
      if (res.ok) {
        const data = await res.json();
        setModels(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadModels();
  }, []);

  const filtered = useMemo(() => {
    return models.filter((m) => {
      if (selectedCategory === "favorites" && !m.favorite) {
        return false;
      }
      if (
        selectedCategory !== "all" &&
        selectedCategory !== "favorites" &&
        m.category !== selectedCategory
      ) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const n = m.name.toLowerCase();
        const d = (m.description || "").toLowerCase();
        const p = (m.promptTemplate || "").toLowerCase();
        return n.includes(q) || d.includes(q) || p.includes(q);
      }
      return true;
    });
  }, [models, selectedCategory, search]);

  const stats = useMemo(() => {
    return {
      total: models.length,
      imageCount: models.filter((m) => m.category === "image").length,
      videoCount: models.filter((m) => m.category === "video").length,
      textCount: models.filter((m) => m.category === "text").length,
      favoritesCount: models.filter((m) => m.favorite).length,
    };
  }, [models]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const payload = {
      id: editingModel?.id,
      name: String(fd.get("name") || "").trim(),
      url: String(fd.get("url") || "").trim(),
      category: String(fd.get("category") || "image").trim(),
      description: String(fd.get("description") || "").trim() || null,
      promptTemplate: String(fd.get("promptTemplate") || "").trim() || null,
      notes: String(fd.get("notes") || "").trim() || null,
      favorite: fd.get("favorite") === "on",
    };

    try {
      const method = editingModel ? "PUT" : "POST";
      const res = await fetch("/api/ai-models", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setModal(false);
        setEditingModel(null);
        loadModels();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function toggleFavorite(m: AiModel) {
    try {
      const res = await fetch("/api/ai-models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, favorite: !m.favorite }),
      });
      if (res.ok) {
        setModels((prev) =>
          prev.map((item) =>
            item.id === m.id ? { ...item, favorite: !item.favorite } : item
          )
        );
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Haqiqatan ham bu modelni o'chirmoqchimisiz?")) return;
    try {
      const res = await fetch(`/api/ai-models?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        loadModels();
      }
    } catch (e) {
      console.error(e);
    }
  }

  function copyText(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Bot className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            AI Modellar & Vositalar Hubi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Siz foydalanadigan barcha sun'iy intellekt modellar, havolalar va prompt shablonlari
          </p>
        </div>

        <button
          onClick={() => {
            setEditingModel(null);
            setModal(true);
          }}
          className="px-5 py-2.5 rounded-full bg-accent text-white hover:bg-accent-hover text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" /> Yangi AI Model qo'shish
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass p-4 rounded-3xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 block mb-1">
            Barcha modellar
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {stats.total} ta
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Faol vositalar</div>
        </div>

        <div className="glass p-4 rounded-3xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 block mb-1">
            Tasvir / Rasm AI
          </span>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
            {stats.imageCount} ta
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Midjourney, Flux va b.</div>
        </div>

        <div className="glass p-4 rounded-3xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 block mb-1">
            Video & Avatar
          </span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {stats.videoCount} ta
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Kling, Runway, HeyGen</div>
        </div>

        <div className="glass p-4 rounded-3xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 block mb-1">
            Sevimli modellar
          </span>
          <div className="text-2xl font-black text-amber-500">
            {stats.favoritesCount} ta
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Asosiy ishchi vositalar</div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              selectedCategory === "all"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            Barchasi ({stats.total})
          </button>

          <button
            onClick={() => setSelectedCategory("favorites")}
            className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
              selectedCategory === "favorites"
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-current" /> Sevimlilar ({stats.favoritesCount})
          </button>

          {Object.entries(CATEGORIES).map(([key, cat]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all ${
                selectedCategory === key
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Model yoki prompt qidirish..."
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
        </div>
      </div>

      {/* Grid of AI Models */}
      {filtered.length === 0 ? (
        <div className="glass p-12 text-center rounded-3xl border border-black/[0.04] dark:border-white/[0.06]">
          <Bot className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 mb-1">
            Ushbu filtr bo'yicha modellar topilmadi
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            O'zingiz tez-tez ishlatadigan sun'iy intellekt xizmati nomini va havolasini kiriting!
          </p>
          <button
            onClick={() => {
              setEditingModel(null);
              setModal(true);
            }}
            className="px-5 py-2 bg-accent text-white text-xs font-bold rounded-full hover:bg-accent-hover shadow-sm"
          >
            + Model qo'shish
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => {
            const cat = CATEGORIES[item.category] || CATEGORIES.other;
            const CatIcon = cat.icon;

            return (
              <div
                key={item.id}
                className="glass rounded-3xl p-5 border border-black/[0.05] dark:border-white/[0.06] shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-2xl ${cat.bg} ${cat.color} flex items-center justify-center border ${cat.border} shrink-0 shadow-xs`}
                      >
                        <CatIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 leading-tight">
                          {item.name}
                        </h3>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {cat.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleFavorite(item)}
                        className={`p-1.5 rounded-full transition-colors ${
                          item.favorite
                            ? "text-amber-500 hover:text-amber-600"
                            : "text-slate-300 dark:text-slate-600 hover:text-amber-500"
                        }`}
                        title="Sevimli"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            item.favorite ? "fill-current" : ""
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => {
                          setEditingModel(item);
                          setModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Tahrirlash"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        title="O'chirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  {item.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  {/* Prompt Template Card */}
                  {item.promptTemplate && (
                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 p-2.5 rounded-2xl mb-3 relative group/prompt">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Prompt Shabloni:</span>
                        <button
                          onClick={() => copyText(`prompt_${item.id}`, item.promptTemplate!)}
                          className="text-[10px] text-accent hover:underline flex items-center gap-1 font-semibold"
                        >
                          {copiedId === `prompt_${item.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-500">Nusxalandi</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Prompt</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {item.promptTemplate}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 mt-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-all shadow-sm"
                  >
                    <span>Modelni ochish</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={() => copyText(`url_${item.id}`, item.url)}
                    className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Havolani nusxalash"
                  >
                    {copiedId === `url_${item.id}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add / Edit AI Model */}
      <Modal
        open={modal}
        onClose={() => {
          setModal(false);
          setEditingModel(null);
        }}
        title={editingModel ? "AI Modelni Tahrirlash" : "Yangi AI Model Qo'shish"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Model yoki Vosita Nomi *
            </label>
            <input
              name="name"
              required
              defaultValue={editingModel?.name || ""}
              placeholder="Masalan: Midjourney, Flux.1, Kling AI, ChatGPT"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Veb-sayt havolasi (URL) *
            </label>
            <input
              type="url"
              name="url"
              required
              defaultValue={editingModel?.url || ""}
              placeholder="https://..."
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Kategoriya
            </label>
            <select
              name="category"
              defaultValue={editingModel?.category || "image"}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
            >
              {Object.entries(CATEGORIES).map(([k, c]) => (
                <option key={k} value={k}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Tavsif / Foydalanish Maqsadi
            </label>
            <textarea
              name="description"
              rows={2}
              defaultValue={editingModel?.description || ""}
              placeholder="Qanday turdagi kontentlar yoki vazifalar uchun ishlatasiz..."
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Sevimli Prompt Shabloni (Ixtiyoriy)
            </label>
            <textarea
              name="promptTemplate"
              rows={2}
              defaultValue={editingModel?.promptTemplate || ""}
              placeholder="Masalan: photorealistic, cinematic lighting, 8k --v 6.1"
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="favorite"
              name="favorite"
              defaultChecked={editingModel ? Boolean(editingModel.favorite) : true}
              className="w-4 h-4 rounded text-accent focus:ring-accent/20"
            />
            <label htmlFor="favorite" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              ⭐ Sevimlilar safiga qo'shish (Yuqorida ko'rinadi)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setModal(false);
                setEditingModel(null);
              }}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors shadow-sm"
            >
              {editingModel ? "Saqlash" : "Qo'shish"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

