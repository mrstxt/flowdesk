"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  BookOpen,
  CheckCircle2,
  Trash2,
  MessageSquare,
  Play,
} from "lucide-react";
import { Modal } from "@/components/Modal";

type Book = {
  id: number;
  title: string;
  author: string | null;
  totalPages: number;
  currentPage: number;
  status: string;
};
type Note = { id: number; content: string; page: number | null; createdAt: string };

const STATUS: Record<string, { label: string; color: string; soft: string }> = {
  plan: { label: "Rejada", color: "#0a84ff", soft: "rgba(10,132,255,0.12)" },
  reading: { label: "O'qilmoqda", color: "#ff9f0a", soft: "rgba(255,159,10,0.14)" },
  done: { label: "O'qilgan", color: "#34c759", soft: "rgba(52,199,89,0.14)" },
};

export default function KitoblarPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [filter, setFilter] = useState<"all" | "plan" | "reading" | "done">(
    "all"
  );
  const [modal, setModal] = useState(false);
  const [notesBook, setNotesBook] = useState<Book | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState("");
  const [notePage, setNotePage] = useState("");

  async function load() {
    const rows = await fetch("/api/books").then((r) => r.json());
    setBooks(rows);
  }

  useEffect(() => {
    load();
  }, []);

  async function openNotes(book: Book) {
    setNotesBook(book);
    setNoteText("");
    setNotePage("");
    const rows = await fetch(`/api/books/notes?bookId=${book.id}`).then((r) =>
      r.json()
    );
    setNotes(rows);
  }

  async function addNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!notesBook || !noteText.trim()) return;
    await fetch("/api/books/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId: notesBook.id,
        content: noteText.trim(),
        page: notePage || null,
      }),
    });
    openNotes(notesBook);
  }

  async function deleteNote(id: number) {
    if (!notesBook) return;
    await fetch(`/api/books/notes?id=${id}`, { method: "DELETE" });
    openNotes(notesBook);
  }

  async function addBook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title"),
        author: fd.get("author") || null,
        totalPages: Number(fd.get("totalPages")) || 0,
      }),
    });
    setModal(false);
    load();
  }

  async function updateBook(id: number, patch: Record<string, unknown>) {
    const res = await fetch("/api/books", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const updated = await res.json();
    setBooks((bs) => bs.map((b) => (b.id === id ? updated : b)));
  }

  async function deleteBook(id: number) {
    if (!confirm("Kitob va uning sharhlari o'chiriladi. Davom etasizmi?")) return;
    await fetch(`/api/books?id=${id}`, { method: "DELETE" });
    setBooks((bs) => bs.filter((b) => b.id !== id));
  }

  const filtered = filter === "all" ? books : books.filter((b) => b.status === filter);
  const readingCount = books.filter((b) => b.status === "reading").length;
  const doneCount = books.filter((b) => b.status === "done").length;
  const pagesRead = books.reduce(
    (s, b) => s + (b.status === "done" ? b.totalPages : b.currentPage),
    0
  );

  return (
    <div className="p-8 max-w-6xl mx-auto fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Kitoblar
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5">
            O'qish, miyani rivojlantirish va sharhlash
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all shadow-lg shadow-accent/25"
        >
          <Plus className="w-4 h-4" /> Kitob qo'shish
        </button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-2.5 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
            filter === "all"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-black/[0.06] dark:border-white/[0.08]"
          }`}
        >
          Hammasi · {books.length}
        </button>
        {(["reading", "plan", "done"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              filter === s
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-black/[0.06] dark:border-white/[0.08]"
            }`}
          >
            {STATUS[s].label} · {books.filter((b) => b.status === s).length}
          </button>
        ))}
        <span className="ml-auto px-4 py-2 rounded-full text-sm font-semibold bg-[#0a84ff]/10 text-[#0a84ff]">
          {pagesRead.toLocaleString()} sahifa o'qildi
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-black/[0.12] dark:border-white/[0.12] p-16 text-center">
          <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <div className="font-display font-bold text-slate-600 dark:text-slate-300 mb-1">
            Kitob topilmadi
          </div>
          <div className="text-sm text-slate-500">
            Birinchi kitobingizni qo'shing va o'qishni boshlang
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((b) => {
            const st = STATUS[b.status] || STATUS.plan;
            const pct = b.totalPages
              ? Math.min(100, (b.currentPage / b.totalPages) * 100)
              : 0;
            return (
              <div
                key={b.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6 card-hover relative overflow-hidden group"
              >
                {/* Spine */}
                <div
                  className="absolute left-0 top-6 bottom-6 w-1.5 rounded-r-full"
                  style={{ background: st.color }}
                />
                <div className="flex items-start justify-between gap-3 mb-3 pl-3">
                  <div className="min-w-0">
                    <div className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
                      {b.title}
                    </div>
                    {b.author && (
                      <div className="text-sm text-slate-500 mt-0.5">
                        {b.author}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                      style={{ background: st.soft, color: st.color }}
                    >
                      {st.label}
                    </span>
                    <button
                      onClick={() => deleteBook(b.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-accent transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pl-3">
                  {b.totalPages > 0 && (
                    <>
                      <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                        <span className="tabular-nums">
                          {b.currentPage}/{b.totalPages} sahifa
                        </span>
                        <span className="font-display font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                          {Math.round(pct)}%
                        </span>
                      </div>
                      <div className="h-2 bg-black/[0.05] dark:bg-white/[0.07] rounded-full overflow-hidden mb-4">
                        <div
                          className="h-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: st.color }}
                        />
                      </div>
                    </>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {b.status === "plan" && (
                      <button
                        onClick={() => updateBook(b.id, { status: "reading" })}
                        className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#0a84ff] hover:opacity-90 px-3.5 py-2 rounded-full transition-all active:scale-95"
                      >
                        <Play className="w-3 h-3" /> O'qishni boshlash
                      </button>
                    )}
                    {b.status === "reading" && (
                      <>
                        <button
                          onClick={() =>
                            updateBook(b.id, {
                              currentPage: Math.min(
                                b.totalPages || b.currentPage + 10,
                                b.currentPage + 10
                              ),
                            })
                          }
                          className="text-xs font-bold text-[#ff9f0a] bg-[#ff9f0a]/12 hover:bg-[#ff9f0a]/20 px-3.5 py-2 rounded-full transition-all active:scale-95"
                        >
                          +10 sahifa
                        </button>
                        <button
                          onClick={() =>
                            updateBook(b.id, {
                              currentPage: b.totalPages || b.currentPage,
                              status: "done",
                            })
                          }
                          className="flex items-center gap-1.5 text-xs font-bold text-[#34c759] bg-[#34c759]/12 hover:bg-[#34c759]/20 px-3.5 py-2 rounded-full transition-all active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Yakunlash
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => openNotes(b)}
                      className="ml-auto flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] px-3.5 py-2 rounded-full transition-all active:scale-95"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Sharhlar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add book modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Yangi kitob">
        <form onSubmit={addBook} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Kitob nomi
            </label>
            <input
              name="title"
              required
              placeholder="Masalan: Atomic Habits"
              className="w-full px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Muallif
              </label>
              <input
                name="author"
                placeholder="James Clear"
                className="w-full px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Sahifalar soni
              </label>
              <input
                name="totalPages"
                type="number"
                placeholder="320"
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

      {/* Notes modal */}
      <Modal
        open={!!notesBook}
        onClose={() => setNotesBook(null)}
        title={`Sharhlar — ${notesBook?.title || ""}`}
      >
        <div className="space-y-4">
          <form onSubmit={addNote} className="space-y-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              required
              placeholder="Nima tushundingiz? Qanday fikr uyg'otdi?..."
              className="w-full px-4 py-3 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-2xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
            />
            <div className="flex items-center gap-2">
              <input
                value={notePage}
                onChange={(e) => setNotePage(e.target.value)}
                type="number"
                placeholder="Sahifa (ixtiyoriy)"
                className="w-36 px-4 py-2 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none"
              />
              <button
                type="submit"
                className="ml-auto px-5 py-2 text-sm font-semibold bg-accent text-white rounded-full hover:bg-accent-hover shadow-lg shadow-accent/25"
              >
                Sharh yozish
              </button>
            </div>
          </form>

          <div className="max-h-72 overflow-y-auto space-y-2.5">
            {notes.length === 0 && (
              <div className="text-sm text-slate-500 text-center py-8 border border-dashed border-black/[0.1] dark:border-white/[0.1] rounded-2xl">
                Hali sharh yo'q — birinchi bo'lib yozing
              </div>
            )}
            {notes.map((n) => (
              <div
                key={n.id}
                className="group p-3.5 bg-black/[0.02] dark:bg-white/[0.04] rounded-2xl border border-black/[0.04] dark:border-white/[0.06]"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {n.page && (
                    <span className="text-[10px] font-bold text-[#0a84ff] bg-[#0a84ff]/10 px-2 py-0.5 rounded-full">
                      {n.page}-sahifa
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 ml-auto">
                    {new Date(n.createdAt).toLocaleDateString("uz-UZ")}
                  </span>
                  <button
                    onClick={() => deleteNote(n.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-accent transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                  {n.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
