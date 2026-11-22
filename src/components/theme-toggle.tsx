"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const LABEL: Record<Theme, string> = { system: "Tema: sistema", light: "Tema: claro", dark: "Tema: oscuro" };
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

function apply(t: Theme) {
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("trapero-theme") as Theme | null;
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);
  return (
    <button
      type="button"
      className="rounded-md p-1.5 text-muted hover:bg-panel-2 hover:text-ink"
      title={LABEL[theme]}
      aria-label={LABEL[theme]}
      onClick={() => {
        const t = NEXT[theme];
        setTheme(t);
        apply(t);
        try {
          if (t === "system") localStorage.removeItem("trapero-theme");
          else localStorage.setItem("trapero-theme", t);
        } catch {
          /* almacenamiento no disponible */
        }
      }}
    >
      {theme === "light" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
      )}
    </button>
  );
}
