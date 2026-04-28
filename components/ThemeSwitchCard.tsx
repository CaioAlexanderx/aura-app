// ============================================================
// ThemeSwitchCard - Toggle modo claro/escuro.
//
// Pluga o useThemeStore (constants/colors.ts) numa UI Card.
// Persistencia ja existia (localStorage + cookie).
// Toggle dispara reload da pagina pois Colors esta congelado em import.
//
// Plugado em: app/(tabs)/configuracoes.tsx + app/dental/(clinic)/clinica.tsx
// ============================================================

import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors, useThemeStore } from "@/constants/colors";
import { Icon } from "@/components/Icon";

interface Props {
  // Quando true, usa fundo dental (cyan) ao inves de violet
  dental?: boolean;
}

export function ThemeSwitchCard({ dental }: Props) {
  const isDark = useThemeStore((s) => s.isDark);
  const toggle = useThemeStore((s) => s.toggle);

  // Mobile / nativo: nao ha como fazer reload automatico, esconde o card
  if (Platform.OS !== "web") return null;

  const accent = dental ? "#06B6D4" : (Colors.violet3 || "#a78bfa");
  const accentBg = dental ? "rgba(6,182,212,0.10)" : Colors.violetD;

  return (
    <View style={[s.card, { borderColor: Colors.border, backgroundColor: Colors.bg3 }]}>
      <View style={[s.iconBox, { backgroundColor: accentBg, borderColor: Colors.border }]}>
        <Icon name={isDark ? "moon" : "sun"} size={18} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color: Colors.ink }]}>Aparencia</Text>
        <Text style={[s.desc, { color: Colors.ink3 }]}>
          {isDark ? "Modo escuro ativo" : "Modo claro ativo"}
          {" - "}
          <Text style={{ color: accent, fontWeight: "600" }}>
            {isDark ? "trocar pra claro" : "trocar pra escuro"}
          </Text>
        </Text>
      </View>
      <Pressable
        onPress={toggle}
        style={[s.toggle, {
          backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
          borderColor: Colors.border,
        }]}
        accessibilityRole="switch"
        accessibilityState={{ checked: !isDark }}
      >
        <View style={[s.knob, {
          left: isDark ? 4 : 26,
          backgroundColor: accent,
        }]} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 4,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontWeight: "600" },
  desc: { fontSize: 11, marginTop: 2 },
  toggle: {
    width: 50,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    position: "relative",
  },
  knob: {
    position: "absolute",
    top: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
