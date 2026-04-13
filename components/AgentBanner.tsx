import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { request } from "@/services/api";

type Insight = {
  id: string;
  severity: "critical" | "warning" | "info";
  agent: string;
  title: string;
  description: string;
  action?: { type: string; target: string; label: string; params?: any };
};

const SEVERITY = {
  critical: { bg: Colors.redD, border: Colors.red + "33", icon: "alert", iconColor: Colors.red },
  warning:  { bg: Colors.amberD, border: Colors.amber + "33", icon: "alert", iconColor: Colors.amber },
  info:     { bg: Colors.violetD, border: Colors.border2, icon: "star", iconColor: Colors.violet3 },
};

function InsightCard({ insight, onDismiss }: { insight: Insight; onDismiss: () => void }) {
  const sev = SEVERITY[insight.severity] || SEVERITY.info;
  return (
    <View style={[z.card, { backgroundColor: sev.bg, borderColor: sev.border }]}>
      <View style={z.cardIcon}>
        <Icon name={sev.icon as any} size={16} color={sev.iconColor} />
      </View>
      <View style={z.cardContent}>
        <View style={z.cardHeader}>
          <Text style={[z.agent, { color: sev.iconColor }]}>{insight.agent}</Text>
          <Pressable onPress={onDismiss} hitSlop={8}>
            <Text style={z.dismiss}>x</Text>
          </Pressable>
        </View>
        <Text style={z.title}>{insight.title}</Text>
        <Text style={z.desc}>{insight.description}</Text>
        {insight.action && (
          <Pressable
            onPress={() => {
              if (insight.action?.type === "navigate" && insight.action.target) {
                router.push(("/(tabs)" + insight.action.target) as any);
              }
            }}
            style={[z.actionBtn, { borderColor: sev.iconColor + "44" }]}
          >
            <Text style={[z.actionText, { color: sev.iconColor }]}>{insight.action.label}</Text>
            <Icon name="chevron_right" size={12} color={sev.iconColor} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function AgentBanner({ context }: { context: string }) {
  const { company, isDemo } = useAuthStore();
  const plan = (company as any)?.plan || "essencial";
  const planLevel = { essencial: 0, negocio: 1, expansao: 2 }[plan] ?? 0;
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["ai-insights", company?.id, context],
    queryFn: () => request<{ insights: Insight[] }>(`/companies/${company!.id}/ai/insights/${context}`),
    enabled: !!company?.id && !isDemo && planLevel >= 1,
    staleTime: 60000,
    retry: 1,
  });

  if (planLevel < 1 || isDemo) return null;

  const insights = (data?.insights || []).filter(i => !dismissed.has(i.id));
  if (isLoading || insights.length === 0) return null;

  return (
    <View style={z.container}>
      {insights.map(insight => (
        <InsightCard
          key={insight.id}
          insight={insight}
          onDismiss={() => setDismissed(prev => new Set(prev).add(insight.id))}
        />
      ))}
    </View>
  );
}

const z = StyleSheet.create({
  container: { gap: 8, marginBottom: 16 },
  card: { flexDirection: "row", borderRadius: 14, padding: 14, borderWidth: 1, gap: 12 },
  cardIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginTop: 2 },
  cardContent: { flex: 1, gap: 4 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  agent: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  dismiss: { fontSize: 14, color: Colors.ink3, fontWeight: "600", paddingHorizontal: 4 },
  title: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  desc: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  actionText: { fontSize: 11, fontWeight: "700" },
});

export default AgentBanner;
