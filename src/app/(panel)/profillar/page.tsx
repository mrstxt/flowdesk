"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Globe,
  ExternalLink,
  Users,
  Sparkles,
  Trash2,
  Edit2,
  Share2,
  CheckCircle2,
  Clock,
  Layers,
  ArrowUpRight,
  ArrowRight,
  TrendingUp,
  Camera,
  Send,
  Video,
  Monitor,
} from "lucide-react";
import { Modal } from "@/components/Modal";

type SocialProfile = {
  id: number;
  name: string;
  platform: string;
  handle: string | null;
  url: string | null;
  avatarUrl: string | null;
  followersCount: number | null;
  category: string | null;
  description: string | null;
  status: string | null;
  createdAt: string;
};

const PLATFORMS: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: any }
> = {
  instagram: {
    label: "Instagram",
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-gradient-to-tr from-amber-500/10 via-rose-500/10 to-purple-500/10",
    border: "border-rose-500/20",
    icon: Camera,
  },
  telegram: {
    label: "Telegram",
    color: "text-sky-500 dark:text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    icon: Send,
  },
  youtube: {
    label: "YouTube",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    icon: Video,
  },
  tiktok: {
    label: "TikTok",
    color: "text-slate-900 dark:text-slate-100",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
    icon: Video,
  },
  behance: {
    label: "Behance",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    icon: Monitor,
  },
  facebook: {
    label: "Facebook",
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    icon: Globe,
  },
  website: {
    label: "Veb-sayt",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    icon: Globe,
  },
  other: {
    label: "Boshqa",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    icon: Globe,
  },
};

export default function ProfillarPage() {
  const [profiles, setProfiles] = useState<SocialProfile[]>([]);
  const [modal, setModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<SocialProfile | null>(null);
  const [search, setSearch] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");

  async function load() {
    try {
      const res = await fetch("/api/profiles");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const totalAudience = profiles.reduce(
      (sum, p) => sum + (p.followersCount || 0),
      0
    );
    const activeCount = profiles.filter((p) => p.status !== "paused").length;
    const platformCount = new Set(profiles.map((p) => p.platform)).size;

    return {
      totalProfiles: profiles.length,
      totalAudience,
      activeCount,
      platformCount,
    };
  }, [profiles]);

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      if (selectedPlatform !== "all" && p.platform !== selectedPlatform) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const n = p.name.toLowerCase();
        const h = (p.handle || "").toLowerCase();
        const d = (p.description || "").toLowerCase();
        return n.includes(q) || h.includes(q) || d.includes(q);
      }
      return true;
    });
  }, [profiles, selectedPlatform, search]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const payload = {
      name: fd.get("name"),
      platform: fd.get("platform"),
      handle: fd.get("handle") || null,
      url: fd.get("url") || null,
      followersCount: Number(fd.get("followersCount")) || 0,
      category: fd.get("category") || "Dizayn",
      description: fd.get("description") || null,
      status: fd.get("status") || "active",
    };

    try {
      if (editingProfile) {
        await fetch("/api/profiles", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingProfile.id, ...payload }),
        });
      } else {
        await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setModal(false);
      setEditingProfile(null);
      form.reset();
      await load();
    } catch (e) {
      console.error(e);
      alert("Xatolik yuz berdi");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Ushbu profilni o'chirmoqchimisiz?")) return;
    try {
      const res = await fetch(`/api/profiles?id=${id}`, { method: "DELETE" });
      if (res.ok) await load();
    } catch (e) {
      console.error(e);
    }
  }

  function formatFollowers(count?: number | null) {
    if (!count) return "0";
    if (count >= 1000000) return (count / 1000000).toFixed(1) + "M";
    if (count >= 1000) return (count / 1000).toFixed(1) + "K";
    return count.toLocaleString("uz-UZ");
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 mb-2 border border-sky-500/20">
            <Globe className="w-3.5 h-3.5" /> Media va Ijtimoiy tarmoqlar
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Profillar
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Ijtimoiy tarmoq sahifalaringiz, kanallaringiz va brend profilingiz
          </p>
        </div>

        <button
          onClick={() => {
            setEditingProfile(null);
            setModal(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover transition-all shadow-md shadow-accent/20"
        >
          <Plus className="w-4 h-4" /> Yangi profil qo'shish
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-5 rounded-3xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Jami profillar
            </span>
            <div className="w-9 h-9 rounded-2xl bg-accent-soft flex items-center justify-center text-accent">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {stats.totalProfiles} ta
          </div>
          <div className="text-xs text-slate-400 mt-1">Barcha platformalarda</div>
        </div>

        <div className="glass p-5 rounded-3xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Jami auditoriya
            </span>
            <div className="w-9 h-9 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
            {formatFollowers(stats.totalAudience)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Jami obunachilar soni</div>
        </div>

        <div className="glass p-5 rounded-3xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Faol profillar
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.activeCount} ta
          </div>
          <div className="text-xs text-slate-400 mt-1">Muntazam yuritilayotgan</div>
        </div>

        <div className="glass p-5 rounded-3xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Platformalar
            </span>
            <div className="w-9 h-9 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
            {stats.platformCount} xil
          </div>
          <div className="text-xs text-slate-400 mt-1">Instagram, Telegram va b.</div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedPlatform("all")}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              selectedPlatform === "all"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            Barchasi
          </button>
          {Object.entries(PLATFORMS).map(([key, pl]) => (
            <button
              key={key}
              onClick={() => setSelectedPlatform(key)}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedPlatform === key
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              {pl.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Profil qidirish..."
            className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>

      {/* Profiles Grid */}
      {filtered.length === 0 ? (
        <div className="glass p-12 text-center rounded-3xl border border-black/[0.04] dark:border-white/[0.06]">
          <div className="w-14 h-14 mx-auto mb-4 rounded-3xl bg-sky-50 dark:bg-sky-950/40 text-sky-500 flex items-center justify-center">
            <Globe className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-1">
            Hozircha profillar yo'q
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            Instagram sahifangiz, Telegram kanalingiz yoki YouTube profilingizni kiritib, barcha media kontentini shu yerdan rejalashtiring!
          </p>
          <button
            onClick={() => {
              setEditingProfile(null);
              setModal(true);
            }}
            className="px-5 py-2 bg-accent text-white text-xs font-bold rounded-full hover:bg-accent-hover transition-colors shadow-sm"
          >
            + Birinchi profilni qo'shish
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => {
            const pl = PLATFORMS[p.platform] || PLATFORMS.other;
            const Icon = pl.icon;
            const isPaused = p.status === "paused";

            return (
              <div
                key={p.id}
                className="glass rounded-3xl p-6 border border-black/[0.05] dark:border-white/[0.06] shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <Link
                      href={`/profillar/${p.id}`}
                      className="flex items-center gap-3 group/title"
                    >
                      <div
                        className={`w-12 h-12 rounded-2xl ${pl.bg} ${pl.color} flex items-center justify-center border ${pl.border} shadow-sm shrink-0 group-hover/title:scale-105 transition-transform`}
                      >
                        {p.avatarUrl ? (
                          <img
                            src={p.avatarUrl}
                            alt={p.name}
                            className="w-full h-full object-cover rounded-2xl"
                          />
                        ) : (
                          <Icon className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 leading-tight group-hover/title:text-accent transition-colors flex items-center gap-1.5">
                          {p.name}
                          <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover/title:opacity-100 group-hover/title:translate-x-0 transition-all text-accent" />
                        </h3>
                        {p.handle && (
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            {p.handle.startsWith("@") ? p.handle : `@${p.handle}`}
                          </div>
                        )}
                      </div>
                    </Link>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingProfile(p);
                          setModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                        title="Tahrirlash"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full"
                        title="O'chirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Followers & Category badge */}
                  <div className="flex items-center justify-between gap-2 mb-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                    <div>
                      <div className="text-[11px] text-slate-400">Auditoriya</div>
                      <div className="text-lg font-black text-slate-900 dark:text-slate-100">
                        {formatFollowers(p.followersCount)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">Holati</div>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          isPaused
                            ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            : p.status === "growing"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        }`}
                      >
                        {isPaused
                          ? "Pauzada"
                          : p.status === "growing"
                          ? "Rivojlanmoqda"
                          : "Faol"}
                      </span>
                    </div>
                  </div>

                  {/* Description / Bio */}
                  {p.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 mb-4 leading-relaxed">
                      {p.description}
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 mt-2">
                  <Link
                    href={`/profillar/${p.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-all shadow-sm"
                  >
                    Profilni ochish <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <div className="flex items-center gap-2">
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Tashqi profil havolasi"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <Link
                      href={`/kontent?profileId=${p.id}`}
                      className="p-2 rounded-full text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors"
                      title="Umumiy kontent doskasiga o'tish"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modal}
        onClose={() => {
          setModal(false);
          setEditingProfile(null);
        }}
        title={editingProfile ? "Profilni tahrirlash" : "Yangi profil qo'shish"}
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Profil / Sahifa nomi
            </label>
            <input
              name="name"
              required
              defaultValue={editingProfile?.name || ""}
              placeholder="Masalan: Sovo Branding | Dizayn"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Platforma
              </label>
              <select
                name="platform"
                defaultValue={editingProfile?.platform || "instagram"}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="instagram">Instagram</option>
                <option value="telegram">Telegram</option>
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
                <option value="behance">Behance</option>
                <option value="facebook">Facebook</option>
                <option value="website">Veb-sayt</option>
                <option value="other">Boshqa</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Username / Handle
              </label>
              <input
                name="handle"
                defaultValue={editingProfile?.handle || ""}
                placeholder="@sovo_branding"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Obunachilar soni
              </label>
              <input
                name="followersCount"
                type="number"
                defaultValue={editingProfile?.followersCount ?? 0}
                placeholder="10000"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Holati
              </label>
              <select
                name="status"
                defaultValue={editingProfile?.status || "active"}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="active">Faol</option>
                <option value="growing">Rivojlanmoqda</option>
                <option value="paused">Pauzada</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Profil havolasi (URL)
            </label>
            <input
              name="url"
              defaultValue={editingProfile?.url || ""}
              placeholder="https://instagram.com/sovo_branding"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Kategoriya / Yo'nalish
            </label>
            <input
              name="category"
              defaultValue={editingProfile?.category || "Dizayn & Brending"}
              placeholder="Dizayn, SMM, Portfolio, Shaxsiy"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Bio / Tavsif
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={editingProfile?.description || ""}
              placeholder="Profil maqsadi va yo'nalishi haqida qisqacha..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setModal(false);
                setEditingProfile(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-accent text-white rounded-full hover:bg-accent-hover shadow-md shadow-accent/20"
            >
              {editingProfile ? "O'zgarishlarni saqlash" : "Qo'shish"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
