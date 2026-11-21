import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

// Single source of truth: the `dark` class on <html> (set before paint in index.html).
const listeners = new Set<() => void>();
const read = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light");
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read);
  const setTheme = useCallback((t: Theme) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    try {
      localStorage.setItem("educore-theme", t);
    } catch {
      /* storage unavailable */
    }
    listeners.forEach((l) => l());
  }, []);
  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}
