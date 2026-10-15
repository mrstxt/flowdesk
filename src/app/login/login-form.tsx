"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Loader2, ArrowRight } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const notConfigured = searchParams.get("notconfigured") === "1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Kirishda xatolik yuz berdi.");
        setLoading(false);
        return;
      }
      const next = searchParams.get("next") || "/";
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Qaytadan urinib ko'ring.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[#fbfbfd]">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#ff6b8e] to-accent flex items-center justify-center text-white shadow-lg shadow-accent/25">
            <span className="font-display text-xl font-extrabold tracking-tight">
              F
            </span>
          </div>
          <div>
            <div className="font-display font-extrabold text-slate-900 text-lg tracking-tight">
              FlowDesk
            </div>
            <div className="text-xs text-slate-400">Shaxsiy panel</div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-black/[0.06] rounded-3xl p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-accent" />
            <h1 className="font-display font-bold text-slate-900 text-[15px]">
              Parolni kiriting
            </h1>
          </div>
          <p className="text-xs text-slate-400 mb-5">
            Panelga kirish uchun ADMIN_PASSWORD kerak.
          </p>

          {notConfigured && (
            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3 text-[12px] text-amber-800 leading-relaxed">
              Serverda <b>ADMIN_PASSWORD</b> (yoki <b>SESSION_SECRET</b> )
              o'rnatilmagan. Env qiymatini qo'shing va qayta deploy qiling.
            </div>
          )}

          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Parol"
            className="w-full rounded-full border border-black/10 bg-[#fbfbfd] px-4 py-3 text-sm outline-none focus:border-accent transition-colors"
          />

          {error && (
            <div className="mt-3 text-[12px] text-[#c21240]">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="mt-4 w-full rounded-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-semibold py-3 flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Kirish <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-400 mt-5">
          © FlowDesk — barcha ma'lumotlar shaxsiy.
        </p>
      </div>
    </main>
  );
}
