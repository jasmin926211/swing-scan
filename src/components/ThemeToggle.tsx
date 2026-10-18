"use client";

import { Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "@/lib/theme";

/** Sun / moon button. The icon follows data-theme in CSS, so it is right before React hydrates. */
export function ThemeToggle() {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTheme(next, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-ink-2 transition-colors hover:bg-wash hover:text-ink"
    >
      <Sun className="absolute h-[18px] w-[18px] rotate-90 scale-0 opacity-0 transition-all duration-500 dark:rotate-0 dark:scale-100 dark:opacity-100" />
      <Moon className="absolute h-[18px] w-[18px] rotate-0 scale-100 opacity-100 transition-all duration-500 dark:-rotate-90 dark:scale-0 dark:opacity-0" />
    </button>
  );
}
