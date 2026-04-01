import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";

type PlanLevel = "essencial" | "negocio" | "expansao";
const PLAN_ORDER: PlanLevel[] = ["essencial", "negocio", "expansao"];
const PLAN_LABELS: Record<PlanLevel, string> = { essencial: "Essencial", negocio: "Negócio", expansao: "Expansão" };
const PLAN_PRICES: Record<PlanLevel, string> = { essencial: "R$ 89/mês", negocio: "R$ 199/mês", expansao: "R$ 299/mês" };
const PLAN_COLORS: Record<PlanLevel, string> = { essencial: Colors.ink3, negocio: Colors.violet3, expansao: Colors.green };

const PLAN_FEATURES: Record<PlanLevel, string[]> = {
  essencial: ["Financeiro básico", "PDV / Caixa", "Estoque", "NF-e (até 50/mês)", "Contabilidade guiada", "1 usuário"],
  negocio: ["Tudo do Essencial +", "CRM completo", "WhatsApp Business", "Canal Digital (loja online)", "Folha de Pagamento", "AgentBanners", "NF-e ilimitada", "Até 3 usuários", "Analista de Negócios"],
  expansao: ["Tudo do Negócio +", "5 Agentes IA + chat", "FAB conversacional", "Custo Avançado", "Analytics avançado", "Multi-gateway", "Usuários ilimitados", "Suporte prioritário"],
};

export function useCanAccess(requiredPlan: PlanLevel): boolean {
  const { company } = useAuthStore();
  const current = (company?.plan as PlanLevel) || "essencial";
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(requiredPlan);
}

export function PlanBadge({ plan }: { plan: PlanLevel }) {
  return (
    <View style={[pb.badge, { backgroundColor: PLAN_COLORS[plan] + "18" }]}>
      <Text style={[pb.text, { color: PLAN_COLORS[plan] }]}>{PLAN_LABELS[plan]}</Text>
    </View>
  );
}
const pb = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
});

export function LockIcon({ plan }: { plan: PlanLevel }) {
  return (
    <View style={li.wrap}>
      <Text style={li.lock}>\u{1F512}</Text>
      <View style={[li.badge, { backgroundColor: PLAN_COLORS[plan] + "22" }]}>
        <Text style={[li.badgeText, { color: PLAN_COLORS[plan] }]}>{PLAN_LABELS[plan]}</Text>
      </View>
    </View>
  );
}
const li = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  lock: { fontSize: 10 },
  badge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { fontSize: 8, fontWeight: "600" },
});

export function UpgradeModal({ visible, requiredPlan, onClose }: { visible: boolean; requiredPlan: PlanLevel; onClose: () => void }) {
  if (!visible) return null;
  const features = PLAN_FEATURES[requiredPlan] || [];
  const isWeb = Platform.OS === "web";
  return (
    <View style={um.overlay}>
      <View style={um.modal}>
        <View style={um.iconWrap}>
          <Text style={um.iconText}>\u{1F680}</Text>
        </View>
        <Text style={um.title}>Recurso do plano {PLAN_LABELS[requiredPlan]}</Text>
        <Text style={um.subtitle}>Faça upgrade para desbloquear essa e outras funcionalidades:</Text>
        <View style={um.features}>
          {features.map(f => (
            <View key={f} style={um.featureRow}>
              <View style={um.dot} />
              <Text style={um.featureText}>{f}</Text>
            </View>
          ))}
        </View>
        <View style={um.priceRow}>
          <Text style={um.priceLabel}>A partir de</Text>
          <Text style={um.price}>{PLAN_PRICES[requiredPlan]}</Text>
        </View>
        <Pressable style={um.upgradeBtn} onPress={onClose}>
          <Text style={um.upgradeBtnText}>Quero fazer upgrade</Text>
        </Pressable>
        <Pressable style={um.closeBtn} onPress={onClose}>
          <Text style={um.closeText}>Agora não</Text>
        </Pressable>
      </View>
    </View>
  );
}
const um = StyleSheet.create({
  overlay: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", zIndex: 200 },
  modal: { backgroundColor: Colors.bg3, borderRadius: 24, padding: 32, maxWidth: 420, width: "90%", borderWidth: 1, borderColor: Colors.border2, alignItems: "center" },
  iconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: Colors.border2 },
  iconText: { fontSize: 28 },
  title: { fontSize: 20, fontWeight: "700", color: Colors.ink, textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  features: { width: "100%", gap: 8, marginBottom: 20 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.violet },
  featureText: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 16 },
  priceLabel: { fontSize: 12, color: Colors.ink3 },
  price: { fontSize: 24, fontWeight: "800", color: Colors.violet3 },
  upgradeBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, width: "100%", alignItems: "center", marginBottom: 8 },
  upgradeBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  closeBtn: { paddingVertical: 10 },
  closeText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
});

export default { useCanAccess, PlanBadge, LockIcon, UpgradeModal };
