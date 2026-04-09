import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Image, ActivityIndicator, Clipboard } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { billingApi, ApiError } from "@/services/api";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { maskPhone } from "@/utils/masks";

const isWeb = Platform.OS === "web";

const PLANS = [
  { key: "essencial", label: "Essencial", monthly: 89, desc: "Para comecar", features: ["1 usuario", "PDV + Estoque", "NF-e ate 50/mes", "Suporte chat"] },
  { key: "negocio", label: "Negocio", monthly: 199, desc: "Para crescer", popular: true, features: ["Ate 3 usuarios", "CRM + WhatsApp", "NF-e ilimitada", "Analista de Negocios"] },
  { key: "expansao", label: "Expansao", monthly: 299, desc: "Para escalar", features: ["Usuarios ilimitados", "IA 5 agentes", "Multi-gateway", "Suporte prioritario"] },
];

const ANNUAL_CARD_DISC = 0.15;
const ANNUAL_PIX_DISC = 0.20;

function fmt(v: number) { return "R$ " + v.toFixed(2).replace(".", ","); }
function fmtMo(v: number) { return fmt(v) + "/mes"; }

type PayMethod = "card" | "pix";
type Cycle = "monthly" | "annual";

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{ plan?: string }>();
  const { company, isDemo } = useAuthStore();
  const [selectedPlan, setSelectedPlan] = useState(params.plan || "negocio");
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [method, setMethod] = useState<PayMethod>("card");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardCpf, setCardCpf] = useState("");

  // Pix state
  const [pixQr, setPixQr] = useState<string | null>(null);
  const [pixCopyPaste, setPixCopyPaste] = useState<string | null>(null);
  const [pixExpiration, setPixExpiration] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<any>(null);

  const plan = PLANS.find(p => p.key === selectedPlan) || PLANS[1];

  function getPrice() {
    if (cycle === "annual" && method === "pix") return Math.round(plan.monthly * 12 * (1 - ANNUAL_PIX_DISC) * 100) / 100;
    if (cycle === "annual") return Math.round(plan.monthly * (1 - ANNUAL_CARD_DISC) * 100) / 100;
    return plan.monthly;
  }
  const price = getPrice();
  const isAnnualPix = cycle === "annual" && method === "pix";

  // Card mask
  function maskCard(v: string) { return v.replace(/\D/g, "").replace(/(\d{4})/g, "$1 ").trim().slice(0, 19); }
  function maskExpiry(v: string) { const n = v.replace(/\D/g, "").slice(0, 4); return n.length > 2 ? n.slice(0,2)+"/"+n.slice(2) : n; }

  // Asaas tokenization (client-side, card data never reaches Aura)
  async function tokenizeCard(): Promise<string> {
    // In production, load Asaas SDK and use window.Asaas.tokenize()
    // For now, call Asaas tokenize API directly from client
    // The SDK approach is preferred — this is a placeholder for the flow
    const nums = cardNumber.replace(/\D/g, "");
    if (nums.length < 13) throw new Error("Numero do cartao invalido");
    if (cardExpiry.length < 5) throw new Error("Validade invalida");
    if (cardCvv.length < 3) throw new Error("CVV invalido");
    if (!cardName.trim()) throw new Error("Nome no cartao obrigatorio");
    // Return placeholder — real implementation uses Asaas JS SDK
    return `tok_${nums.slice(-4)}_${Date.now()}`;
  }

  // Subscribe with card
  async function handleCardSubscribe() {
    if (!company?.id) return;
    setLoading(true);
    try {
      const token = await tokenizeCard();
      const res = await billingApi.subscribe(company.id, selectedPlan, "CREDIT_CARD", token, cycle, cardName, cardCpf);
      toast.success("Assinatura ativada!");
      setSuccess(true);
      setTimeout(() => router.replace("/(tabs)/dashboard"), 2000);
    } catch (err: any) {
      toast.error(err instanceof ApiError ? err.message : err.message || "Erro ao processar cartao");
    } finally { setLoading(false); }
  }

  // Subscribe with Pix
  async function handlePixSubscribe() {
    if (!company?.id) return;
    setLoading(true);
    try {
      const res = await billingApi.subscribe(company.id, selectedPlan, "PIX", undefined, cycle);
      if (res.pix_qr_code) { setPixQr(res.pix_qr_code); setPixCopyPaste(res.pix_copy_paste || null); setPixExpiration(res.pix_expiration || null); }
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
          setTimeout(() => router.replace("/(tabs)/dashboard"), 2000);
        }
      } catch {}
    }, 3000);
  }

  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  function copyPix() {
    if (!pixCopyPaste) return;
    if (isWeb && navigator.clipboard) { navigator.clipboard.writeText(pixCopyPaste); }
    else { try { Clipboard.setString(pixCopyPaste); } catch {} }
    toast.success("Codigo Pix copiado!");
  }

  const cardValid = cardNumber.replace(/\D/g, "").length >= 13 && cardExpiry.length >= 5 && cardCvv.length >= 3 && cardName.trim().length > 0;

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
        <Pressable onPress={() => setCycle("monthly")} style={[z.cycleBtn, cycle==="monthly" && z.cycleBtnActive]}><Text style={[z.cycleTxt, cycle==="monthly" && z.cycleTxtActive]}>Mensal</Text></Pressable>
        <Pressable onPress={() => setCycle("annual")} style={[z.cycleBtn, cycle==="annual" && z.cycleBtnActive]}><Text style={[z.cycleTxt, cycle==="annual" && z.cycleTxtActive]}>Anual</Text>{cycle==="annual" && <View style={z.discBadge}><Text style={z.discText}>ate 20% off</Text></View>}</Pressable>
      </View>

      {/* Plan cards */}
      <View style={z.plansRow}>
        {PLANS.map(p => {
          const sel = selectedPlan === p.key;
          const mo = cycle === "annual" ? Math.round(p.monthly * (1-ANNUAL_CARD_DISC)*100)/100 : p.monthly;
          return (
            <Pressable key={p.key} onPress={() => setSelectedPlan(p.key)} style={[z.planCard, sel && z.planCardSel, p.popular && !sel && z.planCardPop]}>
              {p.popular && <View style={z.popBadge}><Text style={z.popText}>Mais popular</Text></View>}
              <Text style={[z.planName, sel && {color:"#fff"}]}>{p.label}</Text>
              <Text style={[z.planPrice, sel && {color:"#fff"}]}>{fmtMo(mo)}</Text>
              {cycle==="annual" && <Text style={[z.planOrig, sel && {color:"rgba(255,255,255,0.5)"}]}>de {fmtMo(p.monthly)}</Text>}
              <Text style={[z.planDesc, sel && {color:"rgba(255,255,255,0.7)"}]}>{p.desc}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Payment method tabs */}
      <Text style={z.sectionTitle}>Forma de pagamento</Text>
      <View style={z.methodRow}>
        <Pressable onPress={() => setMethod("card")} style={[z.methodBtn, method==="card" && z.methodBtnActive]}><Text style={[z.methodTxt, method==="card" && z.methodTxtActive]}>Cartao de credito</Text></Pressable>
        <Pressable onPress={() => setMethod("pix")} style={[z.methodBtn, method==="pix" && z.methodBtnActive]}><Text style={[z.methodTxt, method==="pix" && z.methodTxtActive]}>Pix</Text></Pressable>
      </View>

      {/* Summary */}
      <View style={z.summaryCard}>
        <View style={z.summaryRow}><Text style={z.summaryLabel}>{plan.label} ({cycle==="annual"?"anual":"mensal"})</Text><Text style={z.summaryValue}>{isAnnualPix ? fmt(price)+" (1x)" : fmtMo(price)}</Text></View>
        {cycle==="annual" && !isAnnualPix && <Text style={z.summaryHint}>Cobrado mensalmente no cartao com 15% de desconto. Compromisso de 12 meses.</Text>}
        {isAnnualPix && <Text style={z.summaryHint}>Pagamento unico via Pix com 20% de desconto. Acesso por 12 meses.</Text>}
        {cycle==="monthly" && <Text style={z.summaryHint}>Cobrado {method==="card"?"automaticamente no cartao":"via Pix"} todo mes. Cancele quando quiser.</Text>}
      </View>

      {/* Card form */}
      {method === "card" && !pixQr && (
        <View style={z.formCard}>
          <View style={z.field}><Text style={z.label}>Numero do cartao</Text><TextInput style={z.input} value={cardNumber} onChangeText={v=>setCardNumber(maskCard(v))} placeholder="0000 0000 0000 0000" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={19} /></View>
          <View style={{flexDirection:"row",gap:12}}>
            <View style={[z.field,{flex:1}]}><Text style={z.label}>Validade</Text><TextInput style={z.input} value={cardExpiry} onChangeText={v=>setCardExpiry(maskExpiry(v))} placeholder="MM/AA" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={5} /></View>
            <View style={[z.field,{flex:1}]}><Text style={z.label}>CVV</Text><TextInput style={z.input} value={cardCvv} onChangeText={v=>setCardCvv(v.replace(/\D/g,"").slice(0,4))} placeholder="000" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={4} secureTextEntry /></View>
          </View>
          <View style={z.field}><Text style={z.label}>Nome no cartao</Text><TextInput style={z.input} value={cardName} onChangeText={setCardName} placeholder="MARIA DA SILVA" placeholderTextColor={Colors.ink3} autoCapitalize="characters" /></View>
          <View style={z.field}><Text style={z.label}>CPF do titular</Text><TextInput style={z.input} value={cardCpf} onChangeText={setCardCpf} placeholder="000.000.000-00" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={14} /></View>
          <View style={z.securityRow}><Icon name="settings" size={12} color={Colors.ink3} /><Text style={z.securityText}>Dados protegidos via tokenizacao. Seu cartao nunca passa pelo servidor da Aura.</Text></View>
          <Pressable onPress={handleCardSubscribe} disabled={loading||!cardValid} style={[z.payBtn, (!cardValid||loading) && {opacity:0.6}]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={z.payBtnText}>Assinar {plan.label} {isAnnualPix?"":fmtMo(price)}</Text>}
          </Pressable>
        </View>
      )}

      {/* Pix */}
      {method === "pix" && !pixQr && (
        <View style={z.formCard}>
          <Text style={z.pixIntro}>{isAnnualPix ? "Pague uma vez e tenha acesso por 12 meses." : "O Asaas envia lembrete mensal por email automaticamente."}</Text>
          <Pressable onPress={handlePixSubscribe} disabled={loading} style={[z.payBtn, loading && {opacity:0.6}]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={z.payBtnText}>Gerar QR Code Pix {fmt(price)}</Text>}
          </Pressable>
        </View>
      )}

      {/* Pix QR displayed */}
      {pixQr && (
        <View style={z.pixCard}>
          <Text style={z.pixTitle}>Escaneie o QR Code ou copie o codigo</Text>
          <Image source={{uri:"data:image/png;base64,"+pixQr}} style={z.pixQrImg} resizeMode="contain" />
          {pixCopyPaste && (
            <Pressable onPress={copyPix} style={z.copyBtn}><Icon name="file_text" size={14} color={Colors.violet3} /><Text style={z.copyBtnText}>Copiar codigo Pix</Text></Pressable>
          )}
          {pixExpiration && <Text style={z.pixExpiry}>Expira em 30 minutos</Text>}
          {polling && <View style={z.pollingRow}><ActivityIndicator size="small" color={Colors.violet3} /><Text style={z.pollingText}>Aguardando pagamento...</Text></View>}
        </View>
      )}

      <Pressable onPress={() => router.back()} style={z.backLink}><Text style={z.backLinkText}>Voltar</Text></Pressable>
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
  planOrig: { fontSize: 11, color: Colors.ink3, textDecorationLine: "line-through" as any, marginTop: 2 },
  planDesc: { fontSize: 11, color: Colors.ink3, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 12, textTransform: "uppercase" as any, letterSpacing: 0.5 },
  methodRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  methodBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  methodBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  methodTxt: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  methodTxtActive: { color: Colors.violet3 },
  summaryCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  summaryLabel: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  summaryValue: { fontSize: 16, color: Colors.green, fontWeight: "800" },
  summaryHint: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  formCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  field: { marginBottom: 14 },
  label: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 6, letterSpacing: 0.3 },
  input: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.ink },
  securityRow: { flexDirection: "row", gap: 6, alignItems: "center", marginBottom: 16 },
  securityText: { fontSize: 10, color: Colors.ink3, flex: 1 },
  payBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  payBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  pixIntro: { fontSize: 13, color: Colors.ink3, textAlign: "center", marginBottom: 20, lineHeight: 20 },
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
