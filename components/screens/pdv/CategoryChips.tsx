// ============================================================
// AURA. -- PDV/Caixa · Category chips (pill-shaped, with counts)
// ============================================================
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from "react-native";
import { Colors, Glass, IS_DARK_MODE } from "@/constants/colors";
import { IS_WEB, webOnly } from "./types";

export type Cat = { id: string; label: string; count: number };

type Props = {
  items: Cat[];
  active: string;
  onSelect: (id: string) => void;
};

export function CategoryChips({ items, active, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 20, paddingVertical: 2, flexDirection: "row" }}
      style={{ marginBottom: 18, flexGrow: 0 }}
    >
      {items.map(c => {
        const isActive = active === c.id;
        const webBox = webOnly({
          background: isActive ? "rgba(124,58,237,0.2)" : Glass.card,
          border: isActive ? "1px solid rgba(124,58,237,0.4)" : "1px solid " + Glass.lineBorderCard,
          color: isActive ? (IS_DARK_MODE ? "#fff" : Colors.ink) : Colors.ink2,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: isActive ? "0 4px 14px rgba(124,58,237,0.35)" : "none",
          transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
          cursor: "pointer",
        });
        return (
          <Pressable
            key={c.id}
            onPress={() => onSelect(c.id)}
            style={[
              s.chip,
              isActive && s.chipActive,
              Platform.OS === "web" ? (webBox as any) : null,
            ] as any}
          >
            <Text style={[s.txt, isActive && s.txtActive]}>{c.label}</Text>
            <Text style={[s.count, isActive && { opacity: 0.9 }]}>{c.count}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: Colors.violetD,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  txt: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.ink2,
  },
  txtActive: {
    color: IS_DARK_MODE ? "#fff" : Colors.ink,
  },
  count: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 10,
    opacity: 0.7,
    color: Colors.ink3,
  },
});

export default CategoryChips;
