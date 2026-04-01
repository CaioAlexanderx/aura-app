import { useState } from "react";
import { View, Text, ScrollView, Pressable, Platform, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

const IS = typeof window !== "undefined" ? window.innerWidth > 768 : false;

const PLANS = [
  {
    key: "essencial", name: "Essencial", subtitle: "Para começar",
    monthly: 89, features: [
      "Financeiro básico", "PDV / Caixa", "Estoque", "NF-e (até 50/mês)",
      "Contabilidade guiada", "Suporte chat", "1 usuário",
    ],
  },
  {
    key: "negocio", name: "Negócio", subtitle: "Para crescer", popular: true,
    monthly: 199, features: [
      "Tudo do Essencial +", "CRM completo", "WhatsApp Business",
      "Canal Digital (loja online)", "Folha de Pagamento", "AgentBanners",
      "NF-e ilimitada", "Até 3 usuários", "Analista de Negócios",
    ],
  },
  {
    key: "expansao", name: "Expansão", subtitle: "Para escalar",
    monthly: 299, features: [
      "Tudo do Negócio +", "5 Agentes IA + chat", "FAB conversacional",
      "Custo Avançado", "Analytics avançado", "Multi-gateway",
      "Usuários ilimitados", "Suporte prioritário",
    ],
  },
];

const ADDONS = [
  { name: "Módulo Vertical", price: 69, desc: "Odonto, Salão, Food, Pet... (a partir do Negócio)" },
  { name: "Usuário adicional", price: 19, desc: "Por usuário/mês (todos os planos)" },
  { name: "Consultoria on-demand", price: 149, desc: "Por hora (mínimo 2h) — setup, automações, treinamento" },
];

const fmt = (n: number) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export default function PlanosScreen() {
  const [annual, setAnnual] = useState(false);
  const { company, isDemo } = useAuthStore();
  const currentPlan = (company?.plan as string) || "essencial";
  const discount = 0.15;
  const w = Platform.OS === "web";

  function price(monthly: number) {
    if (annual) return Math.round(monthly * (1 - discount) * 100) / 100;
    return monthly;
  }

  function savings(monthly: number) {
    return Math.round(monthly * discount * 12 * 100) / 100;
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: IS ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" }}>
      <Text style={s.title}>Planos Aura.</Text>
      <Text style={s.subtitle}>Escolha o plano ideal para o seu negócio</Text>

      {/* Annual toggle */}
      <View style={s.toggleWrap}>
        <Pressable onPress={() => setAnnual(false)} style={[s.toggleBtn, !annual && s.toggleActive]}>
          <Text style={[s.toggleText, !annual && s.toggleTextActive]}>Mensal</Text>
        </Pressable>
        <Pressable onPress={() => setAnnual(true)} style={[s.toggleBtn, annual && s.toggleActive]}>
          <Text style={[s.toggleText, annual && s.toggleTextActive]}>Anual</Text>
          <View style={s.discountBadge}><Text style={s.discountText}>15% OFF</Text></View>
        </Pressable>
      </View>

      {annual && (
        <Text style={s.savingsHint}>Economize até {fmt(savings(299))} por ano no plano Expansão</Text>
      )}

      {/* Plan cards */}
      <View style={s.plansRow}>
        {PLANS.map(plan => {
          const isCurrent = plan.key === currentPlan;
          const mo = price(plan.monthly);
          return (
            <View key={plan.key} style={[s.planCard, plan.popular && s.planPopular, isCurrent && s.planCurrent]}>
              {plan.popular && <View style={s.popularBadge}><Text style={s.popularText}>Mais popular</Text></View>}
              <Text style={s.planName}>{plan.name}</Text>
              <Text style={s.planSub}>{plan.subtitle}</Text>
              <View style={s.priceRow}>
                {annual && <Text style={s.priceOld}>R$ {plan.monthly}</Text>}
                <Text style={s.priceValue}>R$ {mo.toFixed(2).replace(".", ",")}</Text>
                <Text style={s.pricePeriod}>/{annual ? "mês (anual)" : "mês"}</Text>
              </View>
              {annual && <Text style={s.yearlySave}>Economia de {fmt(savings(plan.monthly))}/ano</Text>}
              <View style={s.featuresList}>
                {plan.features.map(f => (
                  <View key={f} style={s.featureRow}>
                    <Icon name="check" size={12} color={Colors.green} />
                    <Text style={s.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                style={[s.planBtn, isCurrent && s.planBtnCurrent]}
                onPress={() => isCurrent ? null : toast.info("Upgrade será habilitado após integração Asaas")}
              >
                <Text style={[s.planBtnText, isCurrent && s.planBtnTextCurrent]}>
                  {isCurrent ? "Plano atual" : "Escolher plano"}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Add-ons */}
      <Text style={s.sectionTitle}>Add-ons</Text>
      <View style={s.addonsRow}>
        {ADDONS.map(a => (
          <View key={a.name} style={s.addonCard}>
            <Text style={s.addonName}>{a.name}</Text>
            <Text style={s.addonPrice}>R$ {a.price}{a.name.includes("hora") ? "/h" : "/mês"}</Text>
            <Text style={s.addonDesc}>{a.desc}</Text>
          </View>
        ))}
      </View>

      {isDemo && <View style={s.demo}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "800", color: Colors.ink, textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.ink3, textAlign: "center", marginBottom: 24 },
  toggleWrap: { flexDirection: "row", justifyContent: "center", gap: 4, backgroundColor: Colors.bg3, borderRadius: 12, padding: 4, alignSelf: "center", marginBottom: 12 },
  toggleBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  toggleActive: { backgroundColor: Colors.violet },
  toggleText: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  toggleTextActive: { color: "#fff" },
  discountBadge: { backgroundColor: Colors.green, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  discountText: { fontSize: 9, color: "#fff", fontWeight: "700" },
  savingsHint: { fontSize: 12, color: Colors.green, textAlign: "center", marginBottom: 20, fontWeight: "500" },
  plansRow: { flexDirection: IS ? "row" : "column", gap: 12, marginBottom: 32 },
  planCard: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1.5, borderColor: Colors.border },
  planPopular: { borderColor: Colors.violet, borderWidth: 2 },
  planCurrent: { borderColor: Colors.green + "66" },
  popularBadge: { backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", marginBottom: 8 },
  popularText: { fontSize: 10, color: "#fff", fontWeight: "700" },
  planName: { fontSize: 20, fontWeight: "800", color: Colors.ink, marginBottom: 2 },
  planSub: { fontSize: 12, color: Colors.ink3, marginBottom: 16 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 4 },
  priceOld: { fontSize: 14, color: Colors.ink3, textDecorationLine: "line-through" },
  priceValue: { fontSize: 28, fontWeight: "800", color: Colors.ink },
  pricePeriod: { fontSize: 12, color: Colors.ink3 },
  yearlySave: { fontSize: 11, color: Colors.green, fontWeight: "500", marginBottom: 16 },
  featuresList: { gap: 8, marginBottom: 20, marginTop: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 13, color: Colors.ink, fontWeight: "500" },
  planBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  planBtnCurrent: { backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.green + "44" },
  planBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  planBtnTextCurrent: { color: Colors.green },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: Colors.ink, marginBottom: 12 },
  addonsRow: { flexDirection: IS ? "row" : "column", gap: 10, marginBottom: 32 },
  addonCard: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  addonName: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  addonPrice: { fontSize: 18, fontWeight: "800", color: Colors.violet3, marginBottom: 4 },
  addonDesc: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  demo: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
