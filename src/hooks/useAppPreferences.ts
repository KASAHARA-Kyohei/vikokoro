import { useEffect, useState } from "react";

export type ThemeName = "dark" | "light" | "ivory" | "tokyoNight";
export type AppLanguage = "ja" | "en";

function loadThemeFromStorage(): ThemeName {
  const raw = localStorage.getItem("vikokoro.theme");
  if (raw === "dark" || raw === "light" || raw === "ivory" || raw === "tokyoNight") return raw;
  return "dark";
}

function loadLanguageFromStorage(): AppLanguage {
  const raw = localStorage.getItem("vikokoro.language");
  if (raw === "en") return "en";
  return "ja";
}

export function useAppPreferences() {
  const [theme, setTheme] = useState<ThemeName>(() => loadThemeFromStorage());
  const [language, setLanguage] = useState<AppLanguage>(() => loadLanguageFromStorage());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("vikokoro.theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("vikokoro.language", language);
  }, [language]);

  return {
    theme,
    setTheme,
    language,
    setLanguage,
  };
}
