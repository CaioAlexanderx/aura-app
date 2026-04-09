import { useState } from "react";
import { View, Text, ScrollView, Pressable, Platform, StyleSheet, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { useQuery } from "@tanstack/react-query";
import { billingApi } from "@/services/api";
import { router } from "expo-router";

const IS = typeof window !== "undefined" ? window.innerWidth > 768 : false;
const AURA_WHATSAPP = "https://wa.me/5512991234567?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20a%20consultoria%20Aura";

const PLANS = [
  {
    key: "essencial", name: "Essencial", subtitle: "Para comecar",
    monthly: 89, features: [
      "Controle de entradas e saidas",
      "Venda pelo celular ou computador",
      "Controle de estoque",
      "Emissao de nota fiscal (ate 50/mes)",
      "Ajuda com impostos e obrigacoes",
      "Suporte por chat",
      "1 usuario",
    ],
  },
  {
    key: "negocio", name: "Negocio", subtitle: "Para crescer", popular: true,
    monthly: 199, features: [
      "Tudo do Essencial +",
      "Cadastro e historico de clientes",
      "Mensagens automaticas pelo WhatsApp",
      "Sua loja online",
      "Folha de pagamento",
      "Dicas inteligentes no seu painel",
      "Nota fiscal ilimitada",
      "Ate 3 usuarios",
      "Um especialista disponivel para voce",
    ],
  },
  {
    key: "expansao", name: "Expansao", subtitle: "Para escalar",
    monthly: 299, features: [
      "Tudo do Negocio +",
      "Assistente inteligente para seu negocio",
      "Chat rapido em cada tela",
      "Analise detalhada de custos",
      "Relatorios avancados",
      "Aceite pagamentos de varios meios",
      "Usuarios ilimitados",
      "Suporte prioritario",
    ],
  },
];

const ADDONS = [
  { name: "Modulo para sua area", price: "R$ 69/mes", desc: "Odonto, Salao, Barbearia, Pet, Alimentacao e mais (a partir do Negocio)" },
  { name: "Usuario adicional", price: "R$ 19/mes", desc: "Para cada pessoa a mais na equipe, por mes" },
  { name: "Consultoria sob medida", price: "Sob consulta", desc: "Configuracao, treinamento, automacoes e integracoes personalizadas para o seu negocio", cta: true },
];

const fmtR = (n: number) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export default function PlanosScreen() {
  const [annual, setAnnual] = useState(false);
  const { company, token, isDemo } = useAuthStore();
  const currentPlan = (company?.plan as string) || "essencial";
  const discount = 0.15;

  const { data: billingStatus } = useQuery({
    queryKey: ["billing-status", company?.id],
    queryFn: () => billingApi.status(company!.id),
    enabled: !!company?.id && !!token && !isDemo,
    retry: 1, staleTime: 60000,
  });

  function handleChoosePlan(planKey: string) {
    if (planKey === currentPlan) return;
    if (isDemo) { toast.info("Crie uma conta para assinar"); return; }
    // Redirect to checkout with plan pre-selected
    router.push(`/(tabs)/checkout?plan=${planKey}`);
  }

  function price(monthly: number) { return annual ? Math.round(monthly * (1 - discount) * 100) / 100 : monthly; }
  function annualTotal(monthly: number) { return Math.round(monthly * (1 - discount) * 12 * 100) / 100; }
  function savings(monthly: number) { return Math.round(monthly * discount * 12 * 100) / 100; }

  const trialActive = billingStatus?.trial_active;
  const trialDays = billingStatus?.trial_days_left || 0;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: IS ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" }}>
      <Text style={s.title}>Planos Aura.</Text>
      <Text style={s.subtitle}>Escolha o plano ideal para o seu negocio</Text>

      {trialActive && <View style={s.trialBanner}><Text style={s.trialText}>Periodo de teste - {trialDays} dias restantes</Text></View>}

      {billingStatus && !trialActive && billingStatus.billing_status !== "inactive" && (
        <View style={s.statusBanner}><Text style={s.statusText}>Plano {billingStatus.plan} - {billingStatus.billing_status === "active" ? "Ativo" : billingStatus.billing_status}</Text></View>
      )}

      <View style={s.toggleWrap}>
        <Pressable onPress={() => setAnnual(false)} style={[s.toggleBtn, !annual && s.toggleActive]}><Text style={[s.toggleText, !annual && s.toggleTextActive]}>Mensal</Text></Pressable>
        <Pressable onPress={() => setAnnual(true)} style={[s.toggleBtn, annual && s.toggleActive]}><Text style={[s.toggleText, annual && s.toggleTextActive]}>Anual</Text><View style={s.discountBadge}><Text style={s.discountText}>15% OFF</Text></View></Pressable>
      </View>

      {annual && <Text style={s.savingsHint}>Economize ate {fmtR(savings(299))} por ano no plano Expansao</Text>}

      <View style={s.plansRow}>
        {PLANS.map(plan => {
          const isCurrent = plan.key === currentPlan;
          const mo = price(plan.monthly);
          const yr = annualTotal(plan.monthly);
          return (
            <View key={plan.key} style={[s.planCard, (plan as any).popular && s.planPopular, isCurrent && s.planCurrent]}>
              {(plan as any).popular && <View style={s.popularBadge}><Text style={s.popularText}>Mais popular</Text></View>}
              <Text style={s.planName}>{plan.name}</Text>
              <Text style={s.planSub}>{plan.subtitle}</Text>
              <View style={s.priceRow}>
                {annual && <Text style={s.priceOld}>R$ {plan.monthly}</Text>}
                <Text style={s.priceValue}>R$ {mo.toFixed(2).replace(".", ",")}</Text>
                <Text style={s.pricePeriod}>/mes</Text>
              </View>
              {annual && <Text style={s.yearlyTotal}>Total anual: {fmtR(yr)}</Text>}
              {annual && <Text style={s.yearlySave}>Economia de {fmtR(savings(plan.monthly))}/ano</Text>}
              <View style={s.featuresList}>
                {plan.features.map(f => (
                  <View key={f} style={s.featureRow}><Icon name="check" size={12} color={Colors.green} /><Text style={s.featureText}>{f}</Text></View>
                ))}
              </View>
              <Pressable style={[s.planBtn, isCurrent && s.planBtnCurrent]} onPress={() => handleChoosePlan(plan.key)}>
                <Text style={[s.planBtnText, isCurrent && s.planBtnTextCurrent]}>{isCurrent ? "Plano atual" : "Escolher plano"}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Text style={s.sectionTitle}>Add-ons</Text>
      <View style={s.addonsRow}>
        {ADDONS.map(a => (
          <View key={a.name} style={s.addonCard}>
            <Text style={s.addonName}>{a.name}</Text>
            <Text style={[s.addonPrice, (a as any).cta && { color: Colors.ink }]}>{a.price}</Text>
            <Text style={s.addonDesc}>{a.desc}</Text>
            {(a as any).cta && (
              <Pressable onPress={() => Linking.openURL(AURA_WHATSAPP)} style={s.addonCta}>
                <Text style={s.addonCtaText}>Falar com a Aura</Text>
              </Pressable>
            )}
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
  trialBanner: { backgroundColor: Colors.amberD, borderRadius: 12, padding: 12, marginBottom: 16, alignItems: "center", borderWidth: 1, borderColor: Colors.amber + "44" },
  trialText: { fontSize: 13, color: Colors.amber, fontWeight: "600" },
  statusBanner: { backgroundColor: Colors.greenD, borderRadius: 12, padding: 12, marginBottom: 16, alignItems: "center", borderWidth: 1, borderColor: Colors.green + "44" },
  statusText: { fontSize: 13, color: Colors.green, fontWeight: "600" },
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
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 2 },
  priceOld: { fontSize: 14, color: Colors.ink3, textDecorationLine: "line-through" },
  priceValue: { fontSize: 28, fontWeight: "800", color: Colors.ink },
  pricePeriod: { fontSize: 12, color: Colors.ink3 },
  yearlyTotal: { fontSize: 13, color: Colors.ink, fontWeight: "600", marginBottom: 2 },
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
  addonCard: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  addonName: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  addonPrice: { fontSize: 18, fontWeight: "800", color: Colors.violet3 },
  addonDesc: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  addonCta: { backgroundColor: Colors.violetD, borderRadius: 8, paddingVertical: 8, alignItems: "center", marginTop: 8, borderWidth: 1, borderColor: Colors.border2 },
  addonCtaText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  demo: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
