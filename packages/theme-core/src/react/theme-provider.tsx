"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";
import { REQUIRED_TOKENS } from "../required-tokens.js";
import { THEME_NAMES } from "../themes.js";

const THEME_LIST: string[] = [...THEME_NAMES];

// next-themes' own default, the key it stores the theme under when no storageKey is passed.
const NEXT_THEMES_DEFAULT_STORAGE_KEY = "theme";

const ThemeStorageKeyContext = React.createContext<string | null>(null);

/** The localStorage key the enclosing ThemeProvider stores the theme under; `null` outside one. */
export function useThemeStorageKey(): string | null {
  return React.useContext(ThemeStorageKeyContext);
}

declare const process: {
  env: {
    NODE_ENV?: string;
  };
};

function warnMissingTokens() {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const styles = getComputedStyle(root);

  const missing = REQUIRED_TOKENS.filter((t) => styles.getPropertyValue(t).trim() === "");
  const loud = REQUIRED_TOKENS.filter((t) => styles.getPropertyValue(t).includes("999 100% 50%"));

  if (missing.length || loud.length) {
     
    console.warn(
      `[theme-core] Missing/invalid required theme tokens.\n` +
        (missing.length ? `Missing: ${missing.join(", ")}\n` : "") +
        (loud.length ? `Still using loud fallbacks: ${loud.join(", ")}\n` : "") +
        `Define these in the consuming app (brand contract)`
    );
  }
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") warnMissingTokens();
  }, []);

  return (
    <ThemeStorageKeyContext.Provider value={props.storageKey ?? NEXT_THEMES_DEFAULT_STORAGE_KEY}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        themes={THEME_LIST}
        {...props}
      >
        {children}
      </NextThemesProvider>
    </ThemeStorageKeyContext.Provider>
  );
}