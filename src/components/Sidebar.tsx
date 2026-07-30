"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Kanban,
  Wallet,
  Target,
  AlarmClock,
  BookOpen,
  Clapperboard,
  BarChart3,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

const groups = [
  {
    label: "Boshqaruv",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/orders", label: "Buyurtmalar", icon: Kanban },
      { href: "/finance", label: "Hisob-kitob", icon: Wallet },
      { href: "/goals", label: "Maqsadlar", icon: Target },
    ],
  },
  {
    label: "Rivojlanish",
    items: [
      { href: "/intizom", label: "Intizom", icon: AlarmClock },
      { href: "/kitoblar", label: "Kitoblar", icon: BookOpen },
      { href: "/rivojlanish", label: "Videolar", icon: Clapperboard },
      { href: "/analitika", label: "Analitika", icon: BarChart3 },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <aside className="w-64 shrink-0 border-r border-black/[0.06] dark:border-white/[0.08] glass h-screen sticky top-0 flex flex-col">
      <div className="px-6 py-6 flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-[#ff6b8e] to-accent flex items-center justify-center text-white shadow-lg shadow-accent/25">
          <span className="font-display text-lg font-extrabold tracking-tight">
            F
          </span>
        </div>
        <div>
          <div className="font-display font-extrabold text-slate-900 dark:text-slate-100 text-[15px] tracking-tight">
            FlowDesk
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500">
            Shaxsiy panel
          </div>
        </div>
      </div>

      <nav className="px-3 py-2 flex-1 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.label} className="mb-4">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3.5 py-2 font-semibold">
              {g.label}
            </div>
            {g.items.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-full text-sm font-medium mb-0.5 transition-all",
                    active
                      ? "bg-accent-soft text-accent-ink dark:text-slate-100 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-[18px] h-[18px] transition-colors",
                      active && "text-accent"
                    )}
                  />
                  {item.label}
                  {active && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 space-y-1 border-t border-black/[0.06] dark:border-white/[0.08]">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
        >
          {theme === "dark" ? (
            <Sun className="w-[18px] h-[18px]" />
          ) : (
            <Moon className="w-[18px] h-[18px]" />
          )}
          {theme === "dark" ? "Kunduzgi rejim" : "Tungi rejim"}
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-accent-soft hover:text-accent-ink transition-colors"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Chiqish
        </button>
      </div>
    </aside>
  );
}
