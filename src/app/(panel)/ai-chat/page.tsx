"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  FileText,
  Download,
  Volume2,
  Calendar,
  Wallet,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  actionTaken?: string;
  pdfUrl?: string;
}

export default function AiChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Assalomu alaykum, Sohibjon! Men sizning shaxsiy boshqaruv kotibingiz — Madinaman. 🌸\n\nMen FlowDesk bazangizga to'liq ulanganman: taqvimingizni ko'rsatishim, yangi reja va vazifalar kiritishim, xarajat yoki daromadlarni yozishim, mijoz buyurtmalarini qayd etishim yoki YouTube videolardan PDF kitob tayyorlab berishim mumkin.\n\nBugun nimalarni bajaramiz?",
      timestamp: "Hozir",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Web Speech API ovozni matnga o'girish (STT)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = "uz-UZ";
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setIsRecording(false);
        };

        recognition.onerror = () => {
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Brauzeringizda ovozli kiritish (Speech Recognition) qo'llab-quvvatlanmaydi.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const speakText = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      // HTML teglarni tozalash
      const clean = text.replace(/<[^>]*>?/gm, "").replace(/[*_#`]/g, "");
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = "uz-UZ";
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      if (data.success) {
        const assistantMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: data.reply || "Buyrug'ingiz bajarildi, Sohibjon!",
          timestamp: new Date().toLocaleTimeString("uz-UZ", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          actionTaken: data.actionTaken,
          pdfUrl: data.pdfUrl,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: "assistant",
            content: `⚠️ Kechirasiz Sohibjon: ${data.error || "Xatolik yuz berdi"}`,
            timestamp: new Date().toLocaleTimeString("uz-UZ", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: `⚠️ Tarmoq xatosi: ${err.message}`,
          timestamp: new Date().toLocaleTimeString("uz-UZ", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    {
      label: "Bugungi rejalarim",
      icon: Calendar,
      text: "Bugungi taqvimimdagi barcha reja va vazifalarni tartibli qilib ko'rsat",
    },
    {
      label: "Hisob & Balans",
      icon: Wallet,
      text: "Hozirgi kartalarimdagi jami balans va oxirgi chiqimlarni aytib ber",
    },
    {
      label: "Vazifani yopish",
      icon: CheckCircle2,
      text: "Bugungi asosiy vazifani bajarildi deb belgilab qo'y",
    },
    {
      label: "Ertaga yangi reja",
      icon: Clock,
      text: "Ertaga soat 10:00 da yangi mijoz bilan brifing rejasini kirit",
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-5xl mx-auto px-4 py-4">
      {/* ── Sarlavha ── */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#ff6b8e] to-[#0a84ff] flex items-center justify-center text-white shadow-md shadow-accent/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
                Madina — AI Kotib
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent-soft text-accent-ink">
                Gemini 2.5 Flash
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              FlowDesk ma&apos;lumotlar bazasiga to&apos;liq ulangan shaxsiy yordamchi
            </p>
          </div>
        </div>

        <button
          onClick={() =>
            setMessages([
              {
                id: "welcome",
                role: "assistant",
                content: "Suhbat yangilandi! Sizga qanday yordam berishim mumkin, Sohibjon?",
                timestamp: "Hozir",
              },
            ])
          }
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Tozalash
        </button>
      </div>

      {/* ── Xabarlar hududi ── */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-accent to-[#ff6b8e] flex items-center justify-center text-white shrink-0 mt-1 shadow-sm">
                  <Bot className="w-5 h-5" />
                </div>
              )}

              <div
                className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                  isUser
                    ? "bg-accent text-white rounded-tr-none"
                    : "bg-white dark:bg-slate-900/80 border border-black/[0.06] dark:border-white/[0.08] text-slate-800 dark:text-slate-200 rounded-tl-none backdrop-blur-md"
                }`}
              >
                {/* Amal nishoni */}
                {m.actionTaken && (
                  <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    Bajarilgan amal: {m.actionTaken}
                  </div>
                )}

                {/* Xabar matni */}
                <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {m.content}
                </div>

                {/* PDF kitobcha yuklab olish tugmasi */}
                {m.pdfUrl && (
                  <div className="mt-3 pt-2 border-t border-black/[0.08] dark:border-white/[0.1]">
                    <a
                      href={m.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#0a84ff] hover:bg-[#0071e3] text-white text-xs font-semibold shadow-sm transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF Kitobni yuklab olish
                    </a>
                  </div>
                )}

                {/* Vaqt va ovozli o'qish tugmasi */}
                <div
                  className={`mt-2 flex items-center justify-between text-[10px] ${
                    isUser ? "text-white/70" : "text-slate-400"
                  }`}
                >
                  <span>{m.timestamp}</span>
                  {!isUser && (
                    <button
                      onClick={() => speakText(m.content)}
                      title="Ovozli eshitish"
                      className="p-1 hover:text-accent transition rounded"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {isUser && (
                <div className="w-9 h-9 rounded-xl bg-slate-800 dark:bg-slate-700 flex items-center justify-center text-white shrink-0 mt-1 shadow-sm">
                  <User className="w-5 h-5" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 justify-start items-center">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-accent to-[#ff6b8e] flex items-center justify-center text-white shrink-0 animate-pulse">
              <Bot className="w-5 h-5" />
            </div>
            <div className="bg-white dark:bg-slate-900/80 border border-black/[0.06] dark:border-white/[0.08] px-4 py-2.5 rounded-2xl text-xs text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              Madina o&apos;ylamoqda va FlowDesk bilan bog&apos;lanmoqda...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Tezkor takliflar (Quick Prompts) ── */}
      <div className="py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {quickPrompts.map((q, idx) => {
          const Icon = q.icon;
          return (
            <button
              key={idx}
              onClick={() => handleSend(q.text)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/70 dark:bg-slate-900/70 hover:bg-white dark:hover:bg-slate-800 border border-black/[0.06] dark:border-white/[0.08] text-slate-700 dark:text-slate-300 shrink-0 transition shadow-sm"
            >
              <Icon className="w-3.5 h-3.5 text-accent" />
              <span>{q.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Pastki kiritish paneli ── */}
      <div className="pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 bg-white dark:bg-slate-900/90 border border-black/[0.08] dark:border-white/[0.12] rounded-2xl p-2 shadow-lg backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={toggleRecording}
            className={`p-2.5 rounded-xl transition ${
              isRecording
                ? "bg-red-500 text-white animate-pulse"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            }`}
            title={isRecording ? "Yozishni to'xtatish" : "Ovoz orqali aytish"}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Madinaga buyruq bering (masalan: 'Bugun 100 ming xarajat qildim' yoki 'YouTube linkini saqla')..."
            className="flex-1 bg-transparent px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white disabled:opacity-40 transition shadow-md shadow-accent/25"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

