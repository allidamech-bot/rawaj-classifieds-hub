import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Language = "ar" | "en";
export type Theme = "light" | "dark";

const LANGUAGE_KEY = "rawaj-language";
const THEME_KEY = "rawaj-theme";

type UiPreferencesContextValue = {
  language: Language;
  direction: "rtl" | "ltr";
  isArabic: boolean;
  theme: Theme;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  text: (ar: string, en: string) => string;
};

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return "ar";
  return window.localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "ar";
}

function readStoredTheme(): Theme {
  return "light";
}

export function UiPreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ar");
  const [theme, setThemeState] = useState<Theme>("light");
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);

  useEffect(() => {
    setLanguageState(readStoredLanguage());
    setThemeState(readStoredTheme());
    setPreferencesHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!preferencesHydrated) return;
    const direction = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    document.body.dir = direction;
    window.localStorage.setItem(LANGUAGE_KEY, language);
  }, [language, preferencesHydrated]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.remove("dark");
    document.documentElement.dataset.theme = "light";
    window.localStorage.setItem(THEME_KEY, "light");
  }, [theme]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
  }, []);

  const setTheme = useCallback((_nextTheme: Theme) => {
    setThemeState("light");
  }, []);

  const value = useMemo<UiPreferencesContextValue>(() => {
    const isArabic = language === "ar";
    return {
      language,
      direction: isArabic ? "rtl" : "ltr",
      isArabic,
      theme,
      setLanguage,
      toggleLanguage: () => setLanguageState((current) => (current === "ar" ? "en" : "ar")),
      setTheme,
      toggleTheme: () => setThemeState("light"),
      text: (ar, en) => (isArabic ? ar : en),
    };
  }, [language, setLanguage, setTheme, theme]);

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences() {
  const value = useContext(UiPreferencesContext);
  if (!value) {
    return {
      language: "ar" as const,
      direction: "rtl" as const,
      isArabic: true,
      theme: "light" as const,
      setLanguage: () => undefined,
      toggleLanguage: () => undefined,
      setTheme: () => undefined,
      toggleTheme: () => undefined,
      text: (ar: string) => ar,
    };
  }
  return value;
}
