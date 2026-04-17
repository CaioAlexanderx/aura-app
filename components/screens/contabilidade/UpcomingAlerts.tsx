import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { Obligation } from "./types";

var isWeb = Platform.OS === "web";

type Props = { obligations: Obligation[]; onGuide: (code: string) => void };

function countdownLabel(days: number | null): string {
  if (days === null) return "";
  if (days < 0) return Math.abs(days) + "d atrasado";
  if (days === 0) return "Hoje!";
  if (days === 1) return "Amanha";
  return days + " dias";
}

function urgencyColor(alert: string | null): string {
  if (alert === "overdue" || alert === "critical") return Colors.red;
  if (alert === "warning") return Colors.amber;
  return Colors.ink3;
}

function urgencyBg(alert: string | null): string {
  if (alert === "overdue" || alert === "critical") return Colors.redD;
  if (alert === "warning") return Colors.amberD;
  return Colors.bg4;
}

export function UpcomingAlerts({ obligations, onGuide }: Props) {
  var upcoming = obligations
    .filter(function(o) { return o.status !== "done" && o.status !== "future"; })
    .sort(function(a, b) { return (a.days_until_due ?? 999) - (b.days_until_due ?? 999); })
    .slice(0, 3);

  if (upcoming.length === 0) return null;

  return (
    <View style={s.container}>
      <Text style={s.title}>Proximos vencimentos</Text>
      <View style={s.list}>
        {upcoming.map(function(o) {
          var color = urgencyColor(o.alert_level);
          var bg = urgencyBg(o.alert_level);
          var days = o.days_until_due;
          var isOverdue = days !== null && days < 0;
          return (
            <Pressable key={o.code} onPress={function() { onGuide(o.code); }} style={[s.item, isWeb && { cursor: "pointer" } as any]}>
              <View style={[s.countdownBadge, { backgroundColor: bg }]}>
                <Text style={[s.countdownText, { color: color }]}>{countdownLabel(days)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName} numberOfLines={1}>{o.name}</Text>
                <Text style={s.itemAction} numberOfLines={1}>{o.filter_label === "aura_resolve" ? "Aura resolve" : "Voce faz"}</Text>
              </View>
              {o.estimated_amount != null && o.estimated_amount > 0 && (
                <Text style={s.itemAmount}>R$ {o.estimated_amount.toFixed(2).replace(".", ",")}</Text>
              )}
              <Icon name="chevron_right" size={14} color={Colors.ink3} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  container: { marginBottom: 20 },
  title: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 10 },
  list: { backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  countdownBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, minWidth: 70, alignItems: "center" },
  countdownText: { fontSize: 10, fontWeight: "700" },
  itemName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  itemAction: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  itemAmount: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
});

export default UpcomingAlerts;
