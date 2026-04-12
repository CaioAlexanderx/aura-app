import { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Image, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { billingApi, ApiError } from "@/services/api";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

const isWeb = Platform.OS === "web";

// Feature flag: cartao habilitado quando tokenizacao Asaas for liberada
const CARD_ENABLED = false;

const PLANS = [
  { key: "essencial", label: "Essencial", monthly: 89, desc: "Para comecar", features: ["1 usuario", "PDV + Estoque", "NF-e ate 50/mes", "Suporte chat"] },
  { key: "negocio", label: "Negocio", monthly: 199, desc: "Para crescer", popular: true, features: ["Ate 3 usuarios", "CRM + WhatsApp", "NF-e ilimitada", "Analista de Negocios"] },
  { key: "expansao", label: "Expansao", monthly: 299, desc: "Para escalar", features: ["Usuarios ilimitados", "IA 5 agentes", "Multi-gateway", "Suporte prioritario"] },
];

const ANNUAL_DISCOUNT = 0.20;

// BUGFIX P1 #4: Format with thousands separator (pt-BR locale)
function fmt(v: number) {
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtMo(v: number) { return fmt(v) + "/mes"; }

type Cycle = "monthly" | "annual";

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{ plan?: string }>();
  const { company, isDemo } = useAuthStore();
  const [selectedPlan, setSelectedPlan] = useState(params.plan || "negocio");
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Pix state
  const [pixQr, setPixQr] = useState<string | null>(null);
  const [pixCopyPaste, setPixCopyPaste] = useState<string | null>(null);
  const [pixExpiration, setPixExpiration] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<any>(null);

  const plan = PLANS.find(p => p.key === selectedPlan) || PLANS[1];
  const isAnnual = cycle === "annual";

  // Price calculations
  const annualTotal = Math.round(plan.monthly * 12 * (1 - ANNUAL_DISCOUNT) * 100) / 100;
  const annualMonthly = Math.round(annualTotal / 12 * 100) / 100;
  const annualSavings = plan.monthly * 12 - annualTotal;
  const price = isAnnual ? annualTotal : plan.monthly;

  // Subscribe with Pix
  async function handlePixSubscribe() {
    if (!company?.id) return;
    setLoading(true);
    try {
      const res = await billingApi.subscribe(company.id, selectedPlan, "PIX", undefined, cycle);
      if (res.pix_qr_code) {
        setPixQr(res.pix_qr_code);
        setPixCopyPaste(res.pix_copy_paste || null);
        setPixExpiration(res.pix_expiration || null);
      }
      startPolling();
    } catch (err: any) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao gerar Pix");
    } finally { setLoading(false); }
  }

  function startPolling() {
    if (!company?.id) return;
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const st = await billingApi.status(company.id);
        if (st.billing_status === "active") {
          clearInterval(pollRef.current);
          setPolling(false);
          setSuccess(true);
          toast.success("Pagamento confirmado!");
          setTimeout(() => router.replace("/(tabs)/"), 2000);
        }
      } catch {}
    }, 3000);
  }

  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  function copyPix() {
    if (!pixCopyPaste) return;
    if (isWeb && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(pixCopyPaste);
    }
    toast.success("Codigo Pix copiado!");
  }

  if (success) {
    return (
      <View style={[z.screen, { justifyContent: "center", alignItems: "center" }]}>
        <View style={z.successCard}>
          <View style={z.successIcon}><Icon name="check" size={32} color={Colors.green} /></View>
          <Text style={z.successTitle}>Pagamento confirmado!</Text>
          <Text style={z.successSub}>Plano {plan.label} ativo. Redirecionando...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={z.screen} contentContainerStyle={z.cnt}>
      <Text style={z.title}>Escolha seu plano</Text>
      <Text style={z.subtitle}>Sem contratos. Cancele quando quiser.</Text>

      {/* Cycle toggle */}
      <View style={z.cycleRow}>
        <Pressable onPress={() => setCycle("monthly")} style={[z.cycleBtn, cycle==="monthly" && z.cycleBtnActive]}>
          <Text style={[z.cycleTxt, cycle==="monthly" && z.cycleTxtActive]}>Mensal</Text>
        </Pressable>
        <Pressable onPress={() => setCycle("annual")} style={[z.cycleBtn, cycle==="annual" && z.cycleBtnActive]}>
          <Text style={[z.cycleTxt, cycle==="annual" && z.cycleTxtActive]}>Anual</Text>
          <View style={z.discBadge}><Text style={z.discText}>-20%</Text></View>
        </Pressable>
      </View>

      {/* Plan cards */}
      <View style={z.plansRow}>
        {PLANS.map(p => {
          const sel = selectedPlan === p.key;
          const pAnnualMo = Math.round(p.monthly * (1 - ANNUAL_DISCOUNT) * 100) / 100;
          const pAnnualTotal = Math.round(p.monthly * 12 * (1 - ANNUAL_DISCOUNT) * 100) / 100;
          const displayPrice = isAnnual ? pAnnualMo : p.monthly;
          return (
            <Pressable key={p.key} onPress={() => setSelectedPlan(p.key)} style={[z.planCard, sel && z.planCardSel, p.popular && !sel && z.planCardPop]}>
              {p.popular && <View style={z.popBadge}><Text style={z.popText}>Mais popular</Text></View>}
              <Text style={[z.planName, sel && {color:"#fff"}]}>{p.label}</Text>
              <Text style={[z.planPrice, sel && {color:"#fff"}]}>{fmtMo(displayPrice)}</Text>
              {isAnnual && (
                <View style={{ marginTop: 2, gap: 2 }}>
                  <Text style={[z.planOrig, sel && {color:"rgba(255,255,255,0.4)"}]}>
                    <Text style={{ textDecorationLine: "line-through" }}>{fmtMo(p.monthly)}</Text>
                  </Text>
                  <Text style={[z.planAnnualTotal, sel && {color:"rgba(255,255,255,0.6)"}]}>
                    {fmt(pAnnualTotal)} no ano
                  </Text>
                </View>
              )}
              <Text style={[z.planDesc, sel && {color:"rgba(255,255,255,0.7)"}]}>{p.desc}</Text>
              <View style={{ marginTop: 10, gap: 4 }}>
                {p.features.map(f => (
                  <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Icon name="check" size={10} color={sel ? "#fff" : Colors.green} />
                    <Text style={{ fontSize: 11, color: sel ? "rgba(255,255,255,0.8)" : Colors.ink3 }}>{f}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Payment method */}
      <Text style={z.sectionTitle}>Forma de pagamento</Text>
      <View style={z.methodRow}>
        <View style={[z.methodBtn, z.methodBtnActive]}>
          <Icon name="wallet" size={16} color={Colors.violet3} />
          <Text style={[z.methodTxt, z.methodTxtActive]}>Pix</Text>
        </View>
        <View style={[z.methodBtn, { opacity: 0.5 }]}>
          <Icon name="cart" size={16} color={Colors.ink3} />
          <Text style={z.methodTxt}>Cartao</Text>
          <View style={z.soonBadge}><Text style={z.soonText}>Em breve</Text></View>
        </View>
      </View>

      {/* Summary */}
      <View style={z.summaryCard}>
        <View style={z.summaryRow}>
          <Text style={z.summaryLabel}>{plan.label} ({isAnnual ? "anual" : "mensal"})</Text>
          <Text style={z.summaryValue}>{isAnnual ? fmt(price) : fmtMo(price)}</Text>
        </View>
        {isAnnual && (
          <>
            <Text style={z.summaryEquiv}>Equivale a {fmtMo(annualMonthly)}</Text>
            <Text style={z.summarySaving}>Economia de {fmt(annualSavings)} por ano</Text>
            <Text style={z.summaryHint}>Pagamento unico via Pix. Acesso por 12 meses.</Text>
          </>
        )}
        {!isAnnual && <Text style={z.summaryHint}>Cobrado via Pix todo mes. Cancele quando quiser.</Text>}
      </View>

      {/* Pix action */}
      {!pixQr && (
        <View style={z.formCard}>
          <View style={z.pixInfoRow}>
            <Icon name="wallet" size={20} color={Colors.green} />
            <View style={{ flex: 1 }}>
              <Text style={z.pixInfoTitle}>Pagamento instantaneo via Pix</Text>
              <Text style={z.pixInfoDesc}>
                {isAnnual
                  ? "Pague uma vez e tenha acesso por 12 meses."
                  : "Voce recebera um lembrete mensal por e-mail."}
              </Text>
            </View>
          </View>
          <Pressable onPress={handlePixSubscribe} disabled={loading} style={[z.payBtn, loading && {opacity:0.6}]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={z.payBtnText}>Gerar QR Code Pix - {fmt(price)}</Text>}
          </Pressable>
        </View>
      )}

      {/* Pix QR displayed */}
      {pixQr && (
        <View style={z.pixCard}>
          <Text style={z.pixTitle}>Escaneie o QR Code ou copie o codigo</Text>
          <Image source={{uri:"data:image/png;base64,"+pixQr}} style={z.pixQrImg} resizeMode="contain" />
          {pixCopyPaste && (
            <Pressable onPress={copyPix} style={z.copyBtn}>
              <Icon name="file_text" size={14} color={Colors.violet3} />
              <Text style={z.copyBtnText}>Copiar codigo Pix</Text>
            </Pressable>
          )}
          {pixExpiration && <Text style={z.pixExpiry}>Expira em 30 minutos</Text>}
          {polling && (
            <View style={z.pollingRow}>
              <ActivityIndicator size="small" color={Colors.violet3} />
              <Text style={z.pollingText}>Aguardando pagamento...</Text>
            </View>
          )}
        </View>
      )}

      <Pressable onPress={() => router.back()} style={z.backLink}>
        <Text style={z.backLinkText}>Voltar</Text>
      </Pressable>
    </ScrollView>
  );
}

const z = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  cnt: { padding: IS_WIDE ? 40 : 20, paddingBottom: 60, maxWidth: 560, alignSelf: "center", width: "100%" },
  title: { fontSize: 24, fontWeight: "800", color: Colors.ink, textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 13, color: Colors.ink3, textAlign: "center", marginBottom: 24 },
  cycleRow: { flexDirection: "row", backgroundColor: Colors.bg3, borderRadius: 12, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  cycleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  cycleBtnActive: { backgroundColor: Colors.violet },
  cycleTxt: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  cycleTxtActive: { color: "#fff" },
  discBadge: { backgroundColor: Colors.green, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  discText: { fontSize: 9, color: "#fff", fontWeight: "700" },
  plansRow: { flexDirection: IS_WIDE ? "row" : "column", gap: 10, marginBottom: 24 },
  planCard: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 16, padding: 18, borderWidth: 1.5, borderColor: Colors.border, position: "relative" as any },
  planCardSel: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  planCardPop: { borderColor: Colors.violet + "66" },
  popBadge: { position: "absolute" as any, top: -8, right: 12, backgroundColor: Colors.violet, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  popText: { fontSize: 9, color: "#fff", fontWeight: "700" },
  planName: { fontSize: 16, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  planPrice: { fontSize: 20, fontWeight: "800", color: Colors.ink },
  planOrig: { fontSize: 11, color: Colors.ink3 },
  planAnnualTotal: { fontSize: 11, color: Colors.green, fontWeight: "600" },
  planDesc: { fontSize: 11, color: Colors.ink3, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 12, textTransform: "uppercase" as any, letterSpacing: 0.5 },
  methodRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  methodBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  methodBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  methodTxt: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  methodTxtActive: { color: Colors.violet3 },
  soonBadge: { backgroundColor: Colors.bg4, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  soonText: { fontSize: 8, color: Colors.ink3, fontWeight: "600" },
  summaryCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  summaryLabel: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  summaryValue: { fontSize: 16, color: Colors.green, fontWeight: "800" },
  summaryEquiv: { fontSize: 12, color: Colors.violet3, fontWeight: "600", marginBottom: 2 },
  summarySaving: { fontSize: 12, color: Colors.green, fontWeight: "600", marginBottom: 6 },
  summaryHint: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  formCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  pixInfoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20 },
  pixInfoTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  pixInfoDesc: { fontSize: 12, color: Colors.ink3, lineHeight: 18 },
  payBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  payBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  pixCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border, alignItems: "center", marginBottom: 20 },
  pixTitle: { fontSize: 14, color: Colors.ink, fontWeight: "600", textAlign: "center", marginBottom: 16 },
  pixQrImg: { width: 200, height: 200, borderRadius: 12, marginBottom: 16 },
  copyBtn: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: Colors.violetD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 12 },
  copyBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  pixExpiry: { fontSize: 11, color: Colors.amber, marginBottom: 8 },
  pollingRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  pollingText: { fontSize: 12, color: Colors.violet3, fontWeight: "500" },
  backLink: { alignSelf: "center", marginTop: 8, paddingVertical: 10 },
  backLinkText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  successCard: { alignItems: "center", gap: 12, padding: 40 },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: Colors.green + "33" },
  successTitle: { fontSize: 22, fontWeight: "800", color: Colors.ink },
  successSub: { fontSize: 14, color: Colors.ink3 },
});
