import { useEffect, useState } from "react";

export type ThemeName = "dark" | "light" | "tokyoNight";

function cycleTheme(theme: ThemeName): ThemeName {
  if (theme === "dark") return "light";
  if (theme === "light") return "tokyoNight";
  return "dark";
}

function loadThemeFromStorage(): ThemeName {
  const raw = localStorage.getItem("vikokoro.theme");
  if (raw === "dark" || raw === "light" || raw === "tokyoNight") return raw;
  return "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>(() => loadThemeFromStorage());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("vikokoro.theme", theme);
  }, [theme]);

  return {
    theme,
    setTheme,
    cycleTheme: () => setTheme((t) => cycleTheme(t)),
  };
}

