"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-[26px] w-[26px]" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md text-[var(--ink-muted)] transition hover:bg-black/[0.04] hover:text-[var(--ink)]"
    >
      {isDark ? <Sun className="h-[14px] w-[14px]" strokeWidth={1.4} /> : <Moon className="h-[14px] w-[14px]" strokeWidth={1.4} />}
    </button>
  );
}
