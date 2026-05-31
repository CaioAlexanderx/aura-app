// ============================================================
// AURA STUDIO · StudioThemeToggle (Fase 0)
//
// Toggle de tema escuro/claro/auto. Cicla dark → light → auto.
// Studio é dark-first (DA-2): inicia em dark, ícone reflete o modo.
// Persistência via StudioThemeProvider (localStorage). Sem reload.
//
// Fase 0 monta isto no shell (sidebar desktop + barra mobile).
// Fase 3 relocaliza/poli pro topbar com busca.
// ============================================================
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { useStudioTheme, useStudioTokens, type StudioThemeMode } from "@/contexts/StudioThemeMode";

const NEXT: Record<StudioThemeMode, StudioThemeMode> = {
  dark: "light",
  light: "auto",
  auto: "dark",
};
const ICON: Record<StudioThemeMode, string> = {
  dark: "moon",
  light: "sun",
  auto: "refresh",
};
const LABEL: Record<StudioThemeMode, string> = {
  dark: "Tema escuro",
  light: "Tema claro",
  auto: "Tema automático",
};

export function StudioThemeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useStudioTheme();
  const tk = useStudioTokens();

  const size = compact ? 40 : 44;
  return (
    <Pressable
      onPress={() => setMode(NEXT[mode])}
      accessibilityRole="button"
      accessibilityLabel={`${LABEL[mode]}. Toque para alternar.`}
      {...(typeof window !== "undefined" ? { title: LABEL[mode] } : {})}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tk.paperCardElev,
        borderWidth: 2,
        borderColor: tk.ink5,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={ICON[mode] as any} size={compact ? 16 : 20} color={tk.ink2} />
      {mode === "auto" && (
        <View
          style={{
            position: "absolute",
            bottom: 3,
            right: 3,
            paddingHorizontal: 3,
            borderRadius: 4,
            backgroundColor: tk.accent,
          }}
        >
          <Text style={{ fontSize: 7, fontWeight: "900", color: "#fff" }}>A</Text>
        </View>
      )}
    </Pressable>
  );
}

export default StudioThemeToggle;
