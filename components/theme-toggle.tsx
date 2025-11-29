"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Initialize theme from saved preference or system preference
    const saved = window.localStorage.getItem("theme") as Theme | null;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial: Theme = saved ?? (systemPrefersDark ? "dark" : "light");
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const applyTheme = (next: Theme) => {
    const root = document.documentElement;
    if (next === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    window.localStorage.setItem("theme", next);
    applyTheme(next);
  };

  const isDark = theme === "dark";

  return (
    <button
      aria-label="Toggle theme"
      onClick={toggle}
      className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-full px-1 py-1 shadow-lg border border-[hsl(var(--border))] bg-card/80 backdrop-blur-sm transition"
    >
      <div className="text-sm font-medium px-3">
        {mounted ? (isDark ? "Dark" : "Light") : "Theme"}
      </div>
      <div
        className={`relative h-8 w-14 rounded-full transition ${
          isDark ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow flex items-center justify-center transition-transform ${
            isDark ? "translate-x-6" : "translate-x-1"
          }`}
        >
          {isDark ? (
            <Moon className="h-4 w-4 text-primary-foreground" />
          ) : (
            <Sun className="h-4 w-4 text-primary" />
          )}
        </span>
      </div>
    </button>
  );
}
