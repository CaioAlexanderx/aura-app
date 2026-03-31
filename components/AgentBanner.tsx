import { useState } from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";

type AgentInsight = {
  title: string;
  desc: string;
  action: string;
  actionLabel: string;
  priority: "high" | "medium" | "low";
  icon: string;
};

type Props = {
  agent: string;
  insight: AgentInsight;
  onAction?: () => void;
};

export function AgentBanner({ agent, insight, onAction }: Props) {
  const { company } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);
  const [h, sH] = useState(false);
  const w = Platform.OS === "web";

  // Only show for Negocio+ plans (or demo)
  const plan = company?.plan || "essencial";
  if (plan === "essencial") return null;
  if (dismissed) return null;

  const pc = insight.priority === "high" ? Colors.red : insight.priority === "medium" ? Colors.amber : Colors.green;
  const pcBg = insight.priority === "high" ? Colors.redD : insight.priority === "medium" ? Colors.amberD : Colors.greenD;

  return (
    <Pressable
      onHoverIn={w ? () => sH(true) : undefined}
      onHoverOut={w ? () => sH(false) : undefined}
      style={[s.banner, h && { borderColor: Colors.border2, transform: [{ translateY: -1 }] }, w && { transition: "all 0.2s ease" } as any]}
    >
      <View style={s.row}>
        <View style={[s.icon, { backgroundColor: pc + "18" }]}>
          <Icon name={insight.icon as any} size={18} color={pc} />
        </View>
        <View style={s.info}>
          <View style={s.topRow}>
            <View style={s.agentTag}>
              <Icon name="star" size={10} color={Colors.violet3} />
              <Text style={s.agentLabel}>Agente {agent}</Text>
            </View>
            <View style={[s.priorityBadge, { backgroundColor: pcBg }]}>
              <Text style={[s.priorityText, { color: pc }]}>{insight.priority === "high" ? "Urgente" : insight.priority === "medium" ? "Atenção" : "Info"}</Text>
            </View>
          </View>
          <Text style={s.title}>{insight.title}</Text>
          <Text style={s.desc} numberOfLines={2}>{insight.desc}</Text>
        </View>
      </View>
      <View style={s.actions}>
        <Pressable onPress={onAction} style={s.actionBtn}>
          <Text style={s.actionText}>{insight.actionLabel}</Text>
          <Icon name="chevron_right" size={14} color="#fff" />
        </Pressable>
        <Pressable onPress={() => setDismissed(true)} style={s.dismissBtn}>
          <Text style={s.dismissText}>Dispensar</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  banner: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  row: { flexDirection: "row", gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 2 },
  info: { flex: 1, gap: 4 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  agentTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.violetD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  agentLabel: { fontSize: 9, fontWeight: "700", color: Colors.violet3, letterSpacing: 0.3 },
  priorityBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  priorityText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  title: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  desc: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  actions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  actionText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  dismissBtn: { paddingVertical: 10, paddingHorizontal: 12 },
  dismissText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
});

export default AgentBanner;
