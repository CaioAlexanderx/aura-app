import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import type { Obligation } from "./types";
import { FILTER_CONFIG } from "./types";

type Props = { items: Obligation[]; onSelect: (code: string) => void };

export function PriorityStrip({ items, onSelect }: Props) {
  if (items.length === 0) return null;
  return (
    <View style={s.container}>
      <Text style={s.title}>Exige sua atencao</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 8 }}>
        {items.map(item => {
          const alertColor = item.alert_level === "overdue" ? Colors.red : item.alert_level === "critical" ? Colors.red : Colors.amber;
          const fc = FILTER_CONFIG[item.filter_label];
          return (
            <Pressable key={item.code} onPress={() => onSelect(item.code)} style={[s.card, { borderLeftColor: alertColor }]}>
              <View style={s.cardTop}>
                <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                {item.days_until_due != null && <Text style={[s.days, { color: alertColor }]}>{item.days_until_due <= 0 ? "VENCIDA" : `${item.days_until_due}d`}</Text>}
              </View>
              <View style={[s.badge, { backgroundColor: fc.bg }]}><Text style={[s.badgeText, { color: fc.color }]}>{fc.label}</Text></View>
              {item.aura_action && <Text style={s.action} numberOfLines={1}>{item.aura_action}</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginBottom: 20, gap: 8 },
  title: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  card: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, minWidth: 220, gap: 6 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardName: { fontSize: 13, color: Colors.ink, fontWeight: "600", flex: 1 },
  days: { fontSize: 12, fontWeight: "800" },
  badge: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start" },
  badgeText: { fontSize: 10, fontWeight: "600" },
  action: { fontSize: 11, color: Colors.ink3 },
});

export default PriorityStrip;
