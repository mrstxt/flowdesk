"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// Light mode only — dark mode o'chirilgan.
// Provider saqlanib qolgan, lekin hech qachon dark klass qo'shmaydi.
type Theme = "light";

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
}>({ theme: "light", toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Har doim light klassini o'rnatamiz
    const root = document.documentElement;
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    localStorage.setItem("theme", "light");
    setMounted(true);
  }, []);

  // toggleTheme endi hech narsa qilmaydi (dark mode yo'q)
  const toggleTheme = () => {};

  return (
    <ThemeContext.Provider value={{ theme: "light", toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
