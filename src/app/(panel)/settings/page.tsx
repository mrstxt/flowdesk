"use client";

import { useEffect, useState } from "react";
import {
  Database,
  CheckCircle2,
  RefreshCw,
  Server,
  Bot,
  Sliders,
  Layers,
} from "lucide-react";

type DbStatus = {
  ok: boolean;
  databaseUrlConfigured: boolean;
  counts?: Record<string, number | null>;
  error?: string;
};

export default function SettingsPage() {
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/db-status");
      const data = await res.json();
      setDbStatus(data);
    } catch (e) {
      setDbStatus({
        ok: false,
        databaseUrlConfigured: false,
        error: String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto fade-in">
      <div className="flex items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Sozlanmalar
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5">
            Tizim, baza holati va umumiy boshqaruv
          </p>
        </div>
        <button
          onClick={loadStatus}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-black/[0.07] dark:border-white/[0.09] bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Yangilash
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tizim holati */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100">
                Tizim holati
              </h2>
              <p className="text-xs text-slate-500">FlowDesk Platform</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-black/[0.04] dark:border-white/[0.04]">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Kirish himoyasi
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Ochiq (Parolsiz)
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-black/[0.04] dark:border-white/[0.04]">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Baza konfiguratsiyasi
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  dbStatus?.databaseUrlConfigured
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {dbStatus?.databaseUrlConfigured ? "Ulangan" : "Ulanmagan"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-black/[0.04] dark:border-white/[0.04]">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Framework
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Next.js 16 + React 19
              </span>
            </div>
          </div>
        </section>

        {/* Telegram Bot */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100">
                Telegram Bot
              </h2>
              <p className="text-xs text-slate-500">Intizom va eslatmalar</p>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            Telegram bot orqali kunlik odatlar, uyg&apos;onish vaqtlari, kitob
            o&apos;qish va kechki hisobotlar to&apos;g&apos;ridan-to&apos;g&apos;ri bazaga
            yoziladi.
          </p>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-black/[0.04] dark:border-white/[0.04] text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div className="font-semibold text-slate-700 dark:text-slate-200">
              Webhook:
            </div>
            <code className="block text-[11px] bg-slate-200 dark:bg-slate-800 p-1.5 rounded-lg break-all">
              /api/bot
            </code>
          </div>
        </section>

        {/* Neon Baza Statistikasi */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-6 shadow-sm lg:col-span-3">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100">
                Ma&apos;lumotlar bazasi (Neon PostgreSQL)
              </h2>
              <p className="text-xs text-slate-500">
                Jadvallardagi yozuvlar soni
              </p>
            </div>
          </div>

          {dbStatus?.counts ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {Object.entries(dbStatus.counts).map(([name, count]) => (
                <div
                  key={name}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-black/[0.04] dark:border-white/[0.04]"
                >
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold truncate">
                    {name}
                  </div>
                  <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {count ?? 0}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500 py-4">
              {loading ? "Yuklanmoqda..." : "Baza ma'lumotlari mavjud emas."}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
