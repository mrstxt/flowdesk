"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Sparkles,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  Copy,
  Check,
  Image as ImageIcon,
  ExternalLink,
  X,
  Upload,
  Globe,
  Filter,
  Layers,
  ArrowRight,
  Share2,
  Send,
  Video,
} from "lucide-react";
import { Modal } from "@/components/Modal";

type SocialProfile = {
  id: number;
  name: string;
  platform: string;
  handle: string | null;
};

type ContentItem = {
  id: number;
  profileId: number | null;
  title: string;
  type: string;
  stage: string;
  caption: string | null;
  mediaUrls: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  publishedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  profileName?: string | null;
  profilePlatform?: string | null;
  profileHandle?: string | null;
};

const STAGES = [
  { id: "idea", label: "G'oyalar", color: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  { id: "draft", label: "Qoralama", color: "bg-purple-500", text: "text-purple-600 dark:text-purple-400" },
  { id: "in_progress", label: "Jarayonda", color: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  { id: "ready", label: "Tayyor", color: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  { id: "published", label: "E'lon qilindi", color: "bg-sky-500", text: "text-sky-600 dark:text-sky-400" },
];

const CONTENT_TYPES: Record<string, { label: string; badge: string }> = {
  post: { label: "Post", badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  reels: { label: "Reels / Video", badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
  carousel: { label: "Karusel", badge: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" },
  story: { label: "Story", badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  portfolio: { label: "Portfolio / Keys", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
};

function KontentContent() {
  const searchParams = useSearchParams();
  const initialProfileId = searchParams.get("profileId");

  const [items, setItems] = useState<ContentItem[]>([]);
  const [profiles, setProfiles] = useState<SocialProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    initialProfileId || "all"
  );
  const [selectedType, setSelectedType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Modal form states
  const [formMediaUrls, setFormMediaUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  async function load() {
    try {
      const [itemsRes, profRes] = await Promise.all([
        fetch("/api/content"),
        fetch("/api/profiles"),
      ]);
      if (itemsRes.ok) setItems(await itemsRes.json());
      if (profRes.ok) setProfiles(await profRes.json());
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    let ideas = 0;
    let inProgress = 0;
    let ready = 0;
    let published = 0;

    for (const item of items) {
      if (item.stage === "idea") ideas++;
      else if (item.stage === "draft" || item.stage === "in_progress") inProgress++;
      else if (item.stage === "ready") ready++;
      else if (item.stage === "published") published++;
    }

    return {
      total: items.length,
      ideas,
      inProgress,
      ready,
      published,
    };
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (selectedProfileId !== "all" && String(item.profileId) !== selectedProfileId) {
        return false;
      }
      if (selectedType !== "all" && item.type !== selectedType) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const t = item.title.toLowerCase();
        const c = (item.caption || "").toLowerCase();
        const p = (item.profileName || "").toLowerCase();
        return t.includes(q) || c.includes(q) || p.includes(q);
      }
      return true;
    });
  }, [items, selectedProfileId, selectedType, search]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        setFormMediaUrls((prev) => [...prev, data.url]);
      }
    } catch (err) {
      console.error(err);
      alert("Rasm yuklashda xatolik");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const payload = {
      title: fd.get("title"),
      profileId: fd.get("profileId") ? Number(fd.get("profileId")) : null,
      type: fd.get("type"),
      stage: fd.get("stage"),
      caption: fd.get("caption") || null,
      mediaUrls: formMediaUrls.length > 0 ? formMediaUrls.join("\n") : null,
      scheduledDate: fd.get("scheduledDate") || null,
      scheduledTime: fd.get("scheduledTime") || null,
      notes: fd.get("notes") || null,
    };

    try {
      if (editingItem) {
        await fetch("/api/content", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingItem.id, ...payload }),
        });
      } else {
        await fetch("/api/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setModal(false);
      setEditingItem(null);
      setFormMediaUrls([]);
      form.reset();
      await load();
    } catch (e) {
      console.error(e);
      alert("Xatolik yuz berdi");
    }
  }

  async function handleStageChange(id: number, newStage: string) {
    try {
      await fetch("/api/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stage: newStage }),
      });
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Ushbu kontentni o'chirmoqchimisiz?")) return;
    try {
      const res = await fetch(`/api/content?id=${id}`, { method: "DELETE" });
      if (res.ok) await load();
    } catch (e) {
      console.error(e);
    }
  }

  function copyCaption(id: number, caption: string | null) {
    if (!caption) return;
    navigator.clipboard.writeText(caption);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function openEdit(item: ContentItem) {
    setEditingItem(item);
    if (item.mediaUrls) {
      setFormMediaUrls(
        item.mediaUrls.split("\n").map((u) => u.trim()).filter(Boolean)
      );
    } else {
      setFormMediaUrls([]);
    }
    setModal(true);
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 mb-2 border border-purple-500/20">
            <Sparkles className="w-3.5 h-3.5" /> Media va Kontent boshqaruvi
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Kontent
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Ijtimoiy tarmoqlar uchun postlar, reels, karusel va dizayn g'oyalari rejasi
          </p>
        </div>

        <button
          onClick={() => {
            setEditingItem(null);
            setFormMediaUrls([]);
            setModal(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover transition-all shadow-md shadow-accent/20"
        >
          <Plus className="w-4 h-4" /> Yangi kontent qo'shish
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="glass p-4 rounded-3xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Jami kontent
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {stats.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Rejalar soni</div>
        </div>

        <div className="glass p-4 rounded-3xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-500 mb-1">
            G'oyalar
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {stats.ideas}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Yangi fikrlar</div>
        </div>

        <div className="glass p-4 rounded-3xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-500 mb-1">
            Jarayonda
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
            {stats.inProgress}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Dizayn / Montaj</div>
        </div>

        <div className="glass p-4 rounded-3xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500 mb-1">
            Tayyor
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.ready}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Nashrga shay</div>
        </div>

        <div className="glass p-4 rounded-3xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm col-span-2 lg:col-span-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-500 mb-1">
            E'lon qilindi
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
            {stats.published}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Chiqarilgan postlar</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {/* Profile Filter */}
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">Barcha profillar</option>
            {profiles.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name} ({p.platform})
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">Barcha formatlar</option>
            <option value="post">Post</option>
            <option value="reels">Reels / Video</option>
            <option value="carousel">Karusel</option>
            <option value="story">Story</option>
            <option value="portfolio">Portfolio</option>
          </select>
        </div>

        <div className="w-full md:w-64">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kontent qidirish..."
            className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {STAGES.map((st) => {
          const stageItems = filtered.filter((it) => it.stage === st.id);

          return (
            <div
              key={st.id}
              className="bg-slate-100/60 dark:bg-slate-900/40 rounded-3xl p-3 border border-slate-200/60 dark:border-slate-800 flex flex-col min-h-[500px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between p-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${st.color}`} />
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    {st.label}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200/60 dark:border-slate-700">
                  {stageItems.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {stageItems.map((item) => {
                  const typeInfo = CONTENT_TYPES[item.type] || CONTENT_TYPES.post;
                  const images = item.mediaUrls
                    ? item.mediaUrls.split("\n").map((u) => u.trim()).filter(Boolean)
                    : [];

                  return (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
                    >
                      <div>
                        {/* Top Profile & Type */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${typeInfo.badge}`}
                          >
                            {typeInfo.label}
                          </span>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(item)}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                              title="Tahrirlash"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded"
                              title="O'chirish"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {item.profileName && (
                          <div className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {item.profileName}
                          </div>
                        )}

                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-2 leading-snug">
                          {item.title}
                        </h4>

                        {/* Image Thumbnails */}
                        {images.length > 0 && (
                          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2 scrollbar-none">
                            {images.map((src, i) => (
                              <img
                                key={i}
                                src={src}
                                alt="Kontent dizayni"
                                onClick={() => setPreviewImage(src)}
                                className="w-14 h-14 object-cover rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:scale-105 transition-transform"
                              />
                            ))}
                          </div>
                        )}

                        {/* Caption snippet */}
                        {item.caption && (
                          <div className="relative mb-2">
                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-xl text-[11px] leading-relaxed">
                              {item.caption}
                            </p>
                            <button
                              onClick={() => copyCaption(item.id, item.caption)}
                              className="absolute top-1.5 right-1.5 p-1 bg-white dark:bg-slate-800 text-slate-400 hover:text-accent rounded-lg shadow-sm border border-slate-200 dark:border-slate-700"
                              title="Matnni nusxalash"
                            >
                              {copiedId === item.id ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Footer: Date & Move buttons */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 mt-2 flex items-center justify-between text-[11px] text-slate-400">
                        {item.scheduledDate ? (
                          <div className="flex items-center gap-1 font-medium">
                            <Calendar className="w-3 h-3" />
                            <span>{item.scheduledDate}</span>
                            {item.scheduledTime && <span>{item.scheduledTime}</span>}
                          </div>
                        ) : (
                          <span />
                        )}

                        <select
                          value={item.stage}
                          onChange={(e) => handleStageChange(item.id, e.target.value)}
                          className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full border-none focus:outline-none cursor-pointer"
                        >
                          <option value="idea">💡 G'oya</option>
                          <option value="draft">✍️ Qoralama</option>
                          <option value="in_progress">🎨 Jarayonda</option>
                          <option value="ready">✅ Tayyor</option>
                          <option value="published">🚀 E'lon qilindi</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

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

      {/* Create / Edit Content Modal */}
      <Modal
        open={modal}
        onClose={() => {
          setModal(false);
          setEditingItem(null);
          setFormMediaUrls([]);
        }}
        title={editingItem ? "Kontentni tahrirlash" : "Yangi kontent rejalashtirish"}
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Sarlavha / Mavzu
            </label>
            <input
              name="title"
              required
              defaultValue={editingItem?.title || ""}
              placeholder="Masalan: Logotip dizaynidagi 5 ta xato"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Profil / Sahifa
              </label>
              <select
                name="profileId"
                defaultValue={editingItem?.profileId || (selectedProfileId !== "all" ? selectedProfileId : "")}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="">Profilsiz (Umumiy)</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.platform})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Format
              </label>
              <select
                name="type"
                defaultValue={editingItem?.type || "post"}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="post">Post</option>
                <option value="reels">Reels / Video</option>
                <option value="carousel">Karusel</option>
                <option value="story">Story</option>
                <option value="portfolio">Portfolio</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Bosqich
              </label>
              <select
                name="stage"
                defaultValue={editingItem?.stage || "idea"}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="idea">💡 G'oya</option>
                <option value="draft">✍️ Qoralama</option>
                <option value="in_progress">🎨 Jarayonda</option>
                <option value="ready">✅ Tayyor</option>
                <option value="published">🚀 E'lon qilindi</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Sana (Reja)
              </label>
              <input
                name="scheduledDate"
                type="date"
                defaultValue={editingItem?.scheduledDate || ""}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Vaqt
              </label>
              <input
                name="scheduledTime"
                type="time"
                defaultValue={editingItem?.scheduledTime || "18:00"}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Matn / Post tavsifi (Caption)
            </label>
            <textarea
              name="caption"
              rows={4}
              defaultValue={editingItem?.caption || ""}
              placeholder="Post matni, ssenariy, hashtaglari..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
            />
          </div>

          {/* Media upload */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Dizayn / Media fayllari
            </label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                {isUploading ? "Yuklanmoqda..." : "Rasm tanlash"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-slate-400">
                {formMediaUrls.length} ta rasm yuklandi
              </span>
            </div>

            {formMediaUrls.length > 0 && (
              <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                {formMediaUrls.map((url, i) => (
                  <div key={i} className="relative group shrink-0">
                    <img
                      src={url}
                      alt="Yuklangan"
                      className="w-14 h-14 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormMediaUrls((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Izoh / Eslatma
            </label>
            <input
              name="notes"
              defaultValue={editingItem?.notes || ""}
              placeholder="Qo'shimcha reja yoki g'oya izohi..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setModal(false);
                setEditingItem(null);
                setFormMediaUrls([]);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-accent text-white rounded-full hover:bg-accent-hover shadow-md shadow-accent/20"
            >
              {editingItem ? "O'zgarishlarni saqlash" : "Saqlash"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function KontentPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 max-w-[1600px] mx-auto text-center text-xs text-slate-400">
          Yuklanmoqda...
        </div>
      }
    >
      <KontentContent />
    </Suspense>
  );
}
