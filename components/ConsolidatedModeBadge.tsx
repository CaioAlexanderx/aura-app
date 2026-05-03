// MULTICNPJ Sessao 1: indicador visual de modo consolidado.
// Aparece no header global so quando consolidatedView=true.
// Caller (header) decide o que fazer no onPress (geralmente abrir o switcher).

import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";

export function ConsolidatedModeBadge({ onPress, compact }: { onPress?: () => void; compact?: boolean }) {
  const { consolidatedView, companyCount } = useAuthStore();
  if (!consolidatedView) return null;

  const isWeb = Platform.OS === "web";

  return (
    <Pressable
      onPress={onPress}
      style={[s.badge, compact && s.badgeCompact, isWeb && onPress ? ({ cursor: "pointer" } as any) : null]}
    >
      <Text style={s.icon}>{"\uD83C\uDF10"}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.label}>{compact ? "Consolidado" : "Visao consolidada"}</Text>
        {!compact && (
          <Text style={s.sub}>{companyCount} empresa{companyCount !== 1 ? "s" : ""}</Text>
        )}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  badge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#7c3aed15", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: "#7c3aed40",
  },
  badgeCompact: { paddingHorizontal: 8, paddingVertical: 4 },
  icon: { fontSize: 14 },
  label: { fontSize: 12, color: "#7c3aed", fontWeight: "700" },
  sub: { fontSize: 9.5, color: Colors.ink3, fontWeight: "500", marginTop: 1 },
});

export default ConsolidatedModeBadge;
