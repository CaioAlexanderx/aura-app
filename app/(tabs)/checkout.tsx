import { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Image, ActivityIndicator, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { billingApi, ApiError } from "@/services/api";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

var isWeb = Platform.OS === "web";

var PLANS = [
  { key: "essencial", label: "Essencial", monthly: 89, desc: "Para comecar", features: ["1 usuario", "PDV + Estoque", "NF-e ate 50/mes", "Suporte chat"] },
  { key: "negocio", label: "Negocio", monthly: 199, desc: "Para crescer", popular: true, features: ["Ate 3 usuarios", "CRM + WhatsApp", "NF-e ilimitada", "Analista de Negocios"] },
  { key: "expansao", label: "Expansao", monthly: 299, desc: "Para escalar", features: ["Usuarios ilimitados", "IA 5 agentes", "Multi-gateway", "Suporte prioritario"] },
];

var ANNUAL_DISCOUNT = 0.20;

function fmt(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtMo(v: number) { return fmt(v) + "/mes"; }

function maskCard(v: string) {
  var d = v.replace(/\D/g, "").slice(0, 16);
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}
function maskExpiry(v: string) {
  var d = v.replace(/\D/g, "").slice(0, 4);
  if (d.length >= 3) return d.slice(0, 2) + "/" + d.slice(2);
  return d;
}
function maskCpf(v: string) {
  var d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length > 9) return d.slice(0,3) + "." + d.slice(3,6) + "." + d.slice(6,9) + "-" + d.slice(9);
  if (d.length > 6) return d.slice(0,3) + "." + d.slice(3,6) + "." + d.slice(6);
  if (d.length > 3) return d.slice(0,3) + "." + d.slice(3);
  return d;
}

function cardBrand(n: string) {
  var d = n.replace(/\D/g, "");
  if (/^4/.test(d)) return "Visa";
  if (/^5[1-5]/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "Amex";
  if (/^606282|^3841/.test(d)) return "Hipercard";
  if (/^(636368|438935|504175|451416|636297)/.test(d)) return "Elo";
  return "";
}

type Cycle = "monthly" | "annual";
type Method = "pix" | "card";

export default function CheckoutScreen() {
  var params = useLocalSearchParams<{ plan?: string }>();
  var { company, isDemo, isStaff, trialActive, hydrate, logout } = useAuthStore();
  var [selectedPlan, setSelectedPlan] = useState(params.plan || "negocio");
  var [cycle, setCycle] = useState<Cycle>("monthly");
  var [method, setMethod] = useState<Method>("pix");
  var [loading, setLoading] = useState(false);
  var [success, setSuccess] = useState(false);

  // Pix state
  var [pixQr, setPixQr] = useState<string | null>(null);
  var [pixCopyPaste, setPixCopyPaste] = useState<string | null>(null);
  var [pixExpiration, setPixExpiration] = useState<string | null>(null);
  var [polling, setPolling] = useState(false);
  var pollRef = useRef<any>(null);

  // Card state
  var [cardNumber, setCardNumber] = useState("");
  var [cardExpiry, setCardExpiry] = useState("");
  var [cardCvv, setCardCvv] = useState("");
  var [cardName, setCardName] = useState("");
  var [cardCpf, setCardCpf] = useState("");
  var [tokenizing, setTokenizing] = useState(false);

  // Determine if the user already has an active plan (plan-change scenario vs new-user gate)
  var billingStatus    = (company as any)?.billing_status;
  var accessCodeUsed   = !!(company as any)?.access_code_used;
  var hasActiveBilling = billingStatus === "active" || trialActive || accessCodeUsed || isDemo || isStaff;

  var plan = PLANS.find(function(p) { return p.key === selectedPlan; }) || PLANS[1];
  var isAnnual = cycle === "annual";
  var annualTotal = Math.round(plan.monthly * 12 * (1 - ANNUAL_DISCOUNT) * 100) / 100;
  var annualMonthly = Math.round(annualTotal / 12 * 100) / 100;
  var annualSavings = plan.monthly * 12 - annualTotal;
  var price = isAnnual ? annualTotal : plan.monthly;

  var cardDigits = cardNumber.replace(/\D/g, "");
  var expiryParts = cardExpiry.split("/");
  var cardValid = cardDigits.length >= 15 && cardExpiry.length === 5 && cardCvv.length >= 3 && cardName.length >= 3 && cardCpf.replace(/\D/g, "").length === 11;
  var brand = cardBrand(cardNumber);

  async function handlePixSubscribe() {
    if (!company?.id) return;
    setLoading(true);
    try {
      var res = await billingApi.subscribe(company.id, selectedPlan, "PIX", undefined, cycle);
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

  async function handleCardSubscribe() {
    if (!company?.id || !cardValid) return;
    setTokenizing(true);
    try {
      var tokenRes = await billingApi.tokenize(company.id, {
        card_number: cardDigits,
        card_expiry_month: expiryParts[0],
        card_expiry_year: expiryParts[1],
        card_ccv: cardCvv,
        holder_name: cardName,
        holder_cpf: cardCpf.replace(/\D/g, ""),
      });

      var subRes = await billingApi.subscribe(company.id, selectedPlan, "CREDIT_CARD", tokenRes.credit_card_token, cycle, cardName, cardCpf.replace(/\D/g, ""));
      setSuccess(true);
      toast.success("Assinatura ativada com cartao " + (tokenRes.credit_card_brand || brand) + " final " + (tokenRes.credit_card_last4 || cardDigits.slice(-4)) + "!");
      // Refresh billing_status no store antes de redirecionar,
      // senao o billing gate redirecionaria de volta ao checkout.
      await hydrate();
      setTimeout(function() { router.replace("/(tabs)/" as any); }, 2000);
    } catch (err: any) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao processar cartao");
    } finally { setTokenizing(false); }
  }

  function startPolling() {
    if (!company?.id) return;
    setPolling(true);
    pollRef.current = setInterval(async function() {
      try {
        var st = await billingApi.status(company!.id);
        if (st.billing_status === "active") {
          clearInterval(pollRef.current);
          setPolling(false);
          setSuccess(true);
          toast.success("Pagamento confirmado!");
          // Refresh billing_status no store antes de redirecionar.
          await hydrate();
          setTimeout(function() { router.replace("/(tabs)/" as any); }, 2000);
        }
      } catch {}
    }, 3000);
  }

  useEffect(function() { return function() { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  function copyPix() {
    if (!pixCopyPaste) return;
    if (isWeb && typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(pixCopyPaste);
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
        <Pressable onPress={function() { setCycle("monthly"); }} style={[z.cycleBtn, cycle==="monthly" && z.cycleBtnActive]}>
          <Text style={[z.cycleTxt, cycle==="monthly" && z.cycleTxtActive]}>Mensal</Text>
        </Pressable>
        <Pressable onPress={function() { setCycle("annual"); }} style={[z.cycleBtn, cycle==="annual" && z.cycleBtnActive]}>
          <Text style={[z.cycleTxt, cycle==="annual" && z.cycleTxtActive]}>Anual</Text>
          <View style={z.discBadge}><Text style={z.discText}>-20%</Text></View>
        </Pressable>
      </View>

      {/* Plan cards */}
      <View style={z.plansRow}>
        {PLANS.map(function(p) {
          var sel = selectedPlan === p.key;
          var pAnnualMo = Math.round(p.monthly * (1 - ANNUAL_DISCOUNT) * 100) / 100;
          var displayPrice = isAnnual ? pAnnualMo : p.monthly;
          var pAnnualTotal = Math.round(p.monthly * 12 * (1 - ANNUAL_DISCOUNT) * 100) / 100;
          return (
            <Pressable key={p.key} onPress={function() { setSelectedPlan(p.key); }} style={[z.planCard, sel && z.planCardSel, p.popular && !sel && z.planCardPop]}>
              {p.popular && <View style={z.popBadge}><Text style={z.popText}>Mais popular</Text></View>}
              <Text style={[z.planName, sel && {color:"#fff"}]}>{p.label}</Text>
              <Text style={[z.planPrice, sel && {color:"#fff"}]}>{fmtMo(displayPrice)}</Text>
              {isAnnual && (
                <View style={{ marginTop: 2, gap: 2 }}>
                  <Text style={[z.planOrig, sel && {color:"rgba(255,255,255,0.4)"}]}>
                    <Text style={{ textDecorationLine: "line-through" }}>{fmtMo(p.monthly)}</Text>
                  </Text>
                  <Text style={[z.planAnnualTotal, sel && {color:"rgba(255,255,255,0.6)"}]}>{fmt(pAnnualTotal)} no ano</Text>
                </View>
              )}
              <Text style={[z.planDesc, sel && {color:"rgba(255,255,255,0.7)"}]}>{p.desc}</Text>
              <View style={{ marginTop: 10, gap: 4 }}>
                {p.features.map(function(f) {
                  return (
                    <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Icon name="check" size={10} color={sel ? "#fff" : Colors.green} />
                      <Text style={{ fontSize: 11, color: sel ? "rgba(255,255,255,0.8)" : Colors.ink3 }}>{f}</Text>
                    </View>
                  );
                })}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Payment method */}
      <Text style={z.sectionTitle}>Forma de pagamento</Text>
      <View style={z.methodRow}>
        <Pressable onPress={function() { setMethod("pix"); }} style={[z.methodBtn, method === "pix" && z.methodBtnActive]}>
          <Icon name="wallet" size={16} color={method === "pix" ? Colors.violet3 : Colors.ink3} />
          <Text style={[z.methodTxt, method === "pix" && z.methodTxtActive]}>Pix</Text>
        </Pressable>
        <Pressable onPress={function() { setMethod("card"); }} style={[z.methodBtn, method === "card" && z.methodBtnActive]}>
          <Icon name="cart" size={16} color={method === "card" ? Colors.violet3 : Colors.ink3} />
          <Text style={[z.methodTxt, method === "card" && z.methodTxtActive]}>Cartao</Text>
        </Pressable>
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
            <Text style={z.summaryHint}>{method === "pix" ? "Pagamento unico via Pix. Acesso por 12 meses." : "Cobrado mensalmente no cartao com 15% de desconto."}</Text>
          </>
        )}
        {!isAnnual && <Text style={z.summaryHint}>{method === "pix" ? "Cobrado via Pix todo mes." : "Cobrado mensalmente no cartao."} Cancele quando quiser.</Text>}
      </View>

      {/* PIX flow */}
      {method === "pix" && !pixQr && (
        <View style={z.formCard}>
          <View style={z.pixInfoRow}>
            <Icon name="wallet" size={20} color={Colors.green} />
            <View style={{ flex: 1 }}>
              <Text style={z.pixInfoTitle}>Pagamento instantaneo via Pix</Text>
              <Text style={z.pixInfoDesc}>{isAnnual ? "Pague uma vez e tenha acesso por 12 meses." : "Voce recebera um lembrete mensal por e-mail."}</Text>
            </View>
          </View>
          <Pressable onPress={handlePixSubscribe} disabled={loading} style={[z.payBtn, loading && {opacity:0.6}]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={z.payBtnText}>Gerar QR Code Pix - {fmt(price)}</Text>}
          </Pressable>
        </View>
      )}

      {method === "pix" && pixQr && (
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

      {/* CARD flow */}
      {method === "card" && (
        <View style={z.formCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Icon name="cart" size={18} color={Colors.violet3} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.ink }}>Dados do cartao</Text>
            {brand ? <View style={z.brandBadge}><Text style={z.brandText}>{brand}</Text></View> : null}
          </View>

          <View style={z.cardField}>
            <Text style={z.cardLabel}>Numero do cartao</Text>
            <TextInput style={z.cardInput} value={cardNumber} onChangeText={function(v) { setCardNumber(maskCard(v)); }}
              placeholder="1234 5678 9012 3456" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={19} />
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={[z.cardField, { flex: 1 }]}>
              <Text style={z.cardLabel}>Validade</Text>
              <TextInput style={z.cardInput} value={cardExpiry} onChangeText={function(v) { setCardExpiry(maskExpiry(v)); }}
                placeholder="MM/AA" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={5} />
            </View>
            <View style={[z.cardField, { flex: 1 }]}>
              <Text style={z.cardLabel}>CVV</Text>
              <TextInput style={z.cardInput} value={cardCvv} onChangeText={function(v) { setCardCvv(v.replace(/\D/g, "").slice(0, 4)); }}
                placeholder="123" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={4} secureTextEntry />
            </View>
          </View>

          <View style={z.cardField}>
            <Text style={z.cardLabel}>Nome no cartao</Text>
            <TextInput style={z.cardInput} value={cardName} onChangeText={function(v) { setCardName(v.toUpperCase()); }}
              placeholder="MARIA DA SILVA" placeholderTextColor={Colors.ink3} autoCapitalize="characters" />
          </View>

          <View style={z.cardField}>
            <Text style={z.cardLabel}>CPF do titular</Text>
            <TextInput style={z.cardInput} value={cardCpf} onChangeText={function(v) { setCardCpf(maskCpf(v)); }}
              placeholder="123.456.789-01" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={14} />
          </View>

          <View style={z.secureRow}>
            <Icon name="lock" size={12} color={Colors.green} />
            <Text style={z.secureText}>Pagamento seguro. Dados tokenizados via Asaas. Seu cartao nao e armazenado.</Text>
          </View>

          <Pressable onPress={handleCardSubscribe} disabled={tokenizing || !cardValid} style={[z.payBtn, (tokenizing || !cardValid) && {opacity:0.5}]}>
            {tokenizing ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={z.payBtnText}>Processando...</Text>
              </View>
            ) : (
              <Text style={z.payBtnText}>Assinar com cartao - {isAnnual ? fmtMo(annualMonthly) : fmtMo(price)}</Text>
            )}
          </Pressable>
        </View>
      )}

      {
        /* Footer action:
           - Se usuario JA tem plano ativo (troca de plano) → Cancelar (voltar)
           - Se usuario AINDA nao pagou (billing gate) → Sair da conta
             Isso impede que o usuario navegue para outras telas sem pagar,
             pois o billing gate o redirecionaria de volta aqui. */
        hasActiveBilling ? (
          <Pressable onPress={function() { router.back(); }} style={z.backLink}>
            <Text style={z.backLinkText}>Cancelar</Text>
          </Pressable>
        ) : (
          <Pressable onPress={function() { logout(); }} style={z.backLink}>
            <Icon name="logout" size={14} color={Colors.ink3} />
            <Text style={[z.backLinkText, { marginLeft: 6 }]}>Sair da conta</Text>
          </Pressable>
        )
      }
    </ScrollView>
  );
}

var z = StyleSheet.create({
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
  cardField: { marginBottom: 12 },
  cardLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 5, letterSpacing: 0.3 },
  cardInput: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.ink, fontFamily: Platform.OS === "web" ? "monospace" : undefined } as any,
  brandBadge: { backgroundColor: Colors.violetD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border2 },
  brandText: { fontSize: 10, color: Colors.violet3, fontWeight: "700" },
  secureRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 16, marginTop: 4 },
  secureText: { fontSize: 10, color: Colors.ink3, flex: 1, lineHeight: 15 },
  backLink: { alignSelf: "center", marginTop: 8, paddingVertical: 10, flexDirection: "row", alignItems: "center" },
  backLinkText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  successCard: { alignItems: "center", gap: 12, padding: 40 },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: Colors.green + "33" },
  successTitle: { fontSize: 22, fontWeight: "800", color: Colors.ink },
  successSub: { fontSize: 14, color: Colors.ink3 },
});
