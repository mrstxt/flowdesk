"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  MessageSquare,
  Clapperboard,
  Link2,
  X,
} from "lucide-react";

type Video = {
  id: number;
  title: string;
  url: string;
  videoId: string;
  category: string;
  watched: boolean | null;
};
type Note = { id: number; content: string; createdAt: string };

const CATEGORIES: Record<string, string> = {
  business: "Biznes",
  coding: "Dasturlash",
  psychology: "Psixologiya",
  motivation: "Motivatsiya",
  finance: "Moliya",
  other: "Boshqa",
};

const CAT_COLORS: Record<string, string> = {
  business: "#ff9f0a",
  coding: "#0a84ff",
  psychology: "#af52de",
  motivation: "#ff2d5d",
  finance: "#34c759",
  other: "#8e8e93",
};

export default function RivojlanishPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [filter, setFilter] = useState<"all" | "unwatched" | "watched">("all");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("business");
  const [error, setError] = useState("");
  const [openNotes, setOpenNotes] = useState<number | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState("");

  async function load() {
    const rows = await fetch("/api/videos").then((r) => r.json());
    setVideos(rows);
  }

  useEffect(() => {
    load();
  }, []);

  async function addVideo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, title, category }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Xatolik yuz berdi");
      return;
    }
    setUrl("");
    setTitle("");
    load();
  }

  async function toggleWatched(v: Video) {
    const res = await fetch("/api/videos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, watched: !v.watched }),
    });
    const updated = await res.json();
    setVideos((vs) => vs.map((x) => (x.id === v.id ? updated : x)));
  }

  async function deleteVideo(id: number) {
    if (!confirm("Video va fikrlar o'chiriladi. Davom etasizmi?")) return;
    await fetch(`/api/videos?id=${id}`, { method: "DELETE" });
    setVideos((vs) => vs.filter((v) => v.id !== id));
  }

  async function toggleNotes(v: Video) {
    if (openNotes === v.id) {
      setOpenNotes(null);
      return;
    }
    setOpenNotes(v.id);
    setNoteText("");
    const rows = await fetch(`/api/videos/notes?videoId=${v.id}`).then((r) =>
      r.json()
    );
    setNotes(rows);
  }

  async function addNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!openNotes || !noteText.trim()) return;
    await fetch("/api/videos/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: openNotes, content: noteText.trim() }),
    });
    const rows = await fetch(`/api/videos/notes?videoId=${openNotes}`).then(
      (r) => r.json()
    );
    setNotes(rows);
    setNoteText("");
  }

  async function deleteNote(id: number) {
    if (!openNotes) return;
    await fetch(`/api/videos/notes?id=${id}`, { method: "DELETE" });
    const rows = await fetch(`/api/videos/notes?videoId=${openNotes}`).then(
      (r) => r.json()
    );
    setNotes(rows);
  }

  const filtered = videos.filter((v) =>
    filter === "all" ? true : filter === "watched" ? v.watched : !v.watched
  );
  const watchedCount = videos.filter((v) => v.watched).length;

  return (
    <div className="p-8 max-w-6xl mx-auto fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Videolar
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5">
            O'z ustida ishlash — ko'ring, fikr bildiring, sharhlang
          </p>
        </div>
        <span className="px-4 py-2 rounded-full text-sm font-semibold bg-[#af52de]/10 text-[#af52de]">
          {watchedCount}/{videos.length} ko'rildi
        </span>
      </div>

      {/* Add video */}
      <form
        onSubmit={addVideo}
        className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-5 mb-6"
      >
        <div className="flex flex-wrap gap-2.5">
          <div className="relative flex-1 min-w-[240px]">
            <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="YouTube havolani tashlang... (youtube.com/watch?v=...)"
              className="w-full pl-11 pr-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Video nomi"
            className="flex-1 min-w-[160px] px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-full text-sm text-slate-600 dark:text-slate-300 focus:outline-none"
          >
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all shadow-lg shadow-accent/25"
          >
            <Plus className="w-4 h-4" /> Qo'shish
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm font-medium text-accent-ink bg-accent-soft px-4 py-2.5 rounded-full fade-in">
            <X className="w-4 h-4" /> {error}
          </div>
        )}
      </form>

      {/* Filter */}
      <div className="flex gap-2.5 mb-6">
        {(
          [
            ["all", "Hammasi"],
            ["unwatched", "Ko'rilmagan"],
            ["watched", "Ko'rilgan"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              filter === k
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-black/[0.06] dark:border-white/[0.08]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-black/[0.12] dark:border-white/[0.12] p-16 text-center">
          <Clapperboard className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <div className="font-display font-bold text-slate-600 dark:text-slate-300 mb-1">
            Video yo'q
          </div>
          <div className="text-sm text-slate-500">
            YouTube havolani yuqoridagi maydonga tashlang — video shu yerda
            ochiladi
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((v) => (
            <div
              key={v.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden card-hover"
            >
              <div className="relative aspect-video bg-black">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${v.videoId}`}
                  title={v.title}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="font-display font-bold text-slate-900 dark:text-slate-100 leading-snug">
                    {v.title}
                  </div>
                  <span
                    className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{
                      background: `${CAT_COLORS[v.category] || "#8e8e93"}1f`,
                      color: CAT_COLORS[v.category] || "#8e8e93",
                    }}
                  >
                    {CATEGORIES[v.category] || "Boshqa"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleWatched(v)}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full transition-all active:scale-95 ${
                      v.watched
                        ? "text-[#34c759] bg-[#34c759]/12 hover:bg-[#34c759]/20"
                        : "text-slate-600 dark:text-slate-300 bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]"
                    }`}
                  >
                    {v.watched ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ko'rildi
                      </>
                    ) : (
                      <>
                        <Circle className="w-3.5 h-3.5" /> Ko'rilmadi
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => toggleNotes(v)}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full transition-all active:scale-95 ${
                      openNotes === v.id
                        ? "text-accent bg-accent-soft"
                        : "text-slate-600 dark:text-slate-300 bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Fikrlar
                  </button>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-slate-400 hover:text-accent transition-colors ml-auto"
                  >
                    YouTube ↗
                  </a>
                  <button
                    onClick={() => deleteVideo(v.id)}
                    className="p-1.5 text-slate-400 hover:text-accent transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {openNotes === v.id && (
                  <div className="mt-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] fade-in">
                    <form onSubmit={addNote} className="flex gap-2 mb-3">
                      <input
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        required
                        placeholder="Fikringiz... nimani o'rgandingiz?"
                        className="flex-1 px-4 py-2 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover active:scale-95 transition-all"
                      >
                        Yozish
                      </button>
                    </form>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {notes.length === 0 && (
                        <div className="text-xs text-slate-500 text-center py-4">
                          Hali fikr yozilmagan
                        </div>
                      )}
                      {notes.map((n) => (
                        <div
                          key={n.id}
                          className="group flex items-start gap-2 p-3 bg-black/[0.02] dark:bg-white/[0.04] rounded-2xl"
                        >
                          <p className="flex-1 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                            {n.content}
                          </p>
                          <button
                            onClick={() => deleteNote(n.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-accent transition-all shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
