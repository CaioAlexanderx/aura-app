import { useMemo } from "react";
import { useModules, ModuleKey } from "./useModules";
import { Colors } from "@/constants/colors";

// ============================================================
// VER-02a: useVerticalTheme hook
// Returns accent color and theme overrides based on active module
// ============================================================

export interface VerticalTheme {
  accent: string;        // Primary accent color
  accentDark: string;    // 12% opacity background
  accentText: string;    // Text color on accent bg
  moduleName: string;    // Display name
  moduleKey: ModuleKey | null;
  moduleIcon: string;    // Icon identifier
  isVerticalActive: boolean;
}

const MODULE_THEMES: Record<ModuleKey, { accent: string; accentDark: string; accentText: string }> = {
  odonto:   { accent: "#06B6D4", accentDark: "rgba(6,182,212,0.12)",   accentText: "#0E7490" },
  barber:   { accent: "#F59E0B", accentDark: "rgba(245,158,11,0.12)",  accentText: "#92400E" },
  estetica: { accent: "#EC4899", accentDark: "rgba(236,72,153,0.12)",  accentText: "#9D174D" },
  pet:      { accent: "#10B981", accentDark: "rgba(16,185,129,0.12)",  accentText: "#065F46" },
  food:     { accent: "#EF4444", accentDark: "rgba(239,68,68,0.12)",   accentText: "#991B1B" },
  moda:     { accent: "#8B5CF6", accentDark: "rgba(139,92,246,0.12)",  accentText: "#5B21B6" },
  academia: { accent: "#3B82F6", accentDark: "rgba(59,130,246,0.12)",  accentText: "#1E40AF" },
};

const DEFAULT_THEME: VerticalTheme = {
  accent: Colors.violet || "#6d28d9",
  accentDark: Colors.violetD || "rgba(109,40,217,0.12)",
  accentText: Colors.violet3 || "#7C3AED",
  moduleName: "",
  moduleKey: null,
  moduleIcon: "",
  isVerticalActive: false,
};

/**
 * Returns the current vertical theme based on the primary active module.
 * Falls back to Aura's default violet theme if no module is active.
 *
 * Usage:
 *   const theme = useVerticalTheme();
 *   <View style={{ borderColor: theme.accent }}>
 *   <Text style={{ color: theme.accentText }}>...</Text>
 *
 * For a specific module (regardless of what's active):
 *   const theme = useVerticalTheme("odonto");
 */
export function useVerticalTheme(forceModule?: ModuleKey): VerticalTheme {
  const { primaryModule, getModule } = useModules();

  return useMemo(() => {
    const mod = forceModule ? getModule(forceModule) : primaryModule;

    if (!mod || !mod.is_active) return DEFAULT_THEME;

    const colors = MODULE_THEMES[mod.key];
    if (!colors) return DEFAULT_THEME;

    return {
      accent: colors.accent,
      accentDark: colors.accentDark,
      accentText: colors.accentText,
      moduleName: mod.name,
      moduleKey: mod.key,
      moduleIcon: mod.icon,
      isVerticalActive: true,
    };
  }, [primaryModule, forceModule]);
}

/**
 * Get theme for a specific module key without the hook.
 * Useful in StyleSheet.create or outside React components.
 */
export function getModuleTheme(key: ModuleKey) {
  return MODULE_THEMES[key] || { accent: "#6d28d9", accentDark: "rgba(109,40,217,0.12)", accentText: "#7C3AED" };
}
