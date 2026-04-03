import React, { createContext, useContext } from "react";
import { useVerticalTheme, VerticalTheme } from "@/hooks/useVerticalTheme";
import { Colors } from "@/constants/colors";

// ============================================================
// VER-02c: AccentProvider
// Provides accent color context to child components
// Usage: wrap a screen or section with <AccentProvider>
//        then useAccent() in any child to get current accent
// ============================================================

const defaultAccent = {
  accent: Colors.violet || "#6d28d9",
  accentDark: Colors.violetD || "rgba(109,40,217,0.12)",
  accentText: Colors.violet3 || "#7C3AED",
};

const AccentContext = createContext(defaultAccent);

export function AccentProvider({ children }: { children: React.ReactNode }) {
  const theme = useVerticalTheme();
  const value = theme.isVerticalActive
    ? { accent: theme.accent, accentDark: theme.accentDark, accentText: theme.accentText }
    : defaultAccent;

  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>;
}

/**
 * Get current accent colors (vertical-aware)
 * Falls back to Aura violet if no vertical is active
 */
export function useAccent() {
  return useContext(AccentContext);
}
