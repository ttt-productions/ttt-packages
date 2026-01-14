"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { REQUIRED_TOKENS } from "./required-tokens";

function warnMissingTokens() {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const styles = getComputedStyle(root);

  const missing = REQUIRED_TOKENS.filter((t) => styles.getPropertyValue(t).trim() === "");
  const loud = REQUIRED_TOKENS.filter((t) => styles.getPropertyValue(t).includes("999 100% 50%"));

  if (missing.length || loud.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[theme-core] Missing/invalid required theme tokens.\n` +
        (missing.length ? `Missing: ${missing.join(", ")}\n` : "") +
        (loud.length ? `Still using loud fallbacks: ${loud.join(", ")}\n` : "") +
        `Define these in the consuming app (brand contract)`
    );
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") warnMissingTokens();
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      themes={["light", "dark", "high-contrast"]}
    >
      {children}
    </NextThemesProvider>
  );
}
