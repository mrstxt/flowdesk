"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: fd.get("username"),
        password: fd.get("password"),
      }),
    });
    if (res.ok) {
      router.replace("/");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Login yoki parol noto'g'ri");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#fbfbfd] dark:bg-[#0a0a0c]">
      {/* Glow blobs */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#ff2d5d]/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#0a84ff]/10 blur-3xl" />

      <div className="relative w-full max-w-md mx-4 fade-in">
        <div className="glass rounded-[32px] shadow-2xl shadow-black/[0.04] border border-black/[0.06] dark:border-white/[0.08] p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-[22px] bg-gradient-to-br from-[#ff6b8e] to-accent flex items-center justify-center text-white shadow-xl shadow-accent/30 mb-5">
              <span className="font-display text-2xl font-extrabold tracking-tight">F</span>
            </div>
            <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              FlowDesk
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Shaxsiy panelga xavfsiz kirish
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <User className="absolute left-4.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
              <input
                name="username"
                placeholder="Login"
                required
                autoComplete="username"
                className="w-full pl-12 pr-4 py-3.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-full text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
              <input
                name="password"
                type={showPass ? "text" : "password"}
                placeholder="Parol"
                required
                autoComplete="current-password"
                className="w-full pl-12 pr-12 py-3.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-full text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPass ? (
                  <EyeOff className="w-[18px] h-[18px]" />
                ) : (
                  <Eye className="w-[18px] h-[18px]" />
                )}
              </button>
            </div>

            {error && (
              <div className="text-sm text-accent-ink bg-accent-soft rounded-full px-4 py-2.5 text-center fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover active:scale-[0.98] transition-all shadow-lg shadow-accent/30 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Kirilmoqda..." : "Tizimga kirish"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          Tizimga kirish uchun <b>login</b> / <b>parol</b> kiriting
        </p>
      </div>
    </div>
  );
}
