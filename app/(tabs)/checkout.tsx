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
  { key: "essencial", label: "Essencial", monthly: 89, desc: "Base para comecar", features: ["PDV + cupom fiscal", "Cadastro e gestao de produtos", "Financeiro completo", "Relatorios contabeis basicos", "1 usuario"] },
  { key: "negocio", label: "Negocio", monthly: 169, desc: "Operacao completa", popular: true, features: ["Tudo do Essencial", "Estoque completo com baixa automatica e etiquetas", "Emissao de NF-e, NFC-e e NFS-e", "Sua loja online inclusa", "Financeiro completo (DRE + fluxo de caixa)", "Folha salarial", "Relatorios contabeis completos", "Suporte prioritario"] },
  { key: "expansao", label: "Expansao", monthly: 269, desc: "Escala e automacao", features: ["Tudo do Negocio", "Gateway personalizado (use sua maquininha)", "API + integracoes ilimitadas", "Hub social (Instagram e WhatsApp)", "Automacoes avancadas conectadas nas redes sociais", "IA avancada dentro de cada modulo", "Usuarios ilimitados", "Multi CNPJ", "Emissao de NFS-e ilimitadas"] },
];

var ANNUAL_DISCOUNT = 1 / 6;

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
  if (d.length > 9) return d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9);
  if (d.length > 6) return d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6);
  if (d.length > 3) return d.slice(0, 3) + "." + d.slice(3);
  return d;
}
// Adicionada função que faltava
function maskPostalCode(v: string) {
  var d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length > 5) return d.slice(0, 5) + "-" + d.slice(5);
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

function addMonthsIso(base: Date, months: number) {
  var d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export default function CheckoutScreen() {
  var params = useLocalSearchParams<{ plan?: string }>();
  var { company, hydrate, logout, trialActive, isDemo, isStaff } = useAuthStore();
  var [selectedPlan, setSelectedPlan] = useState(params.plan || "negocio");
  var [cycle, setCycle] = useState<Cycle>("monthly");
  var [method, setMethod] = useState<Method>("pix");
  var [loading, setLoading] = useState(false);
  var [tokenizing, setTokenizing] = useState(false); // Adicionado estado que faltava
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
  var [cardPostalCode, setCardPostalCode] = useState("");
  var [cardAddressNumber, setCardAddressNumber] = useState("");
  var [cardAddressStreet, setCardAddressStreet] = useState("");
  var [cardAddressDistrict, setCardAddressDistrict] = useState("");
  var [cardAddressCity, setCardAddressCity] = useState("");
  var [cardAddressState, setCardAddressState] = useState("");
  var [loadingCep, setLoadingCep] = useState(false);

  var billingStatus = (company as any)?.billing_status;
  var accessCodeUsed = !!(company as any)?.access_code_used;
  var hasActiveBilling = billingStatus === "active" || trialActive || accessCodeUsed || isDemo || isStaff;

  var plan = PLANS.find(function (p) { return p.key === selectedPlan; }) || PLANS[1];
  var isAnnual = cycle === "annual";
  var annualTotal = Math.round(plan.monthly * 12 * (1 - ANNUAL_DISCOUNT) * 100) / 100;
  var annualMonthly = Math.round(annualTotal / 12 * 100) / 100;
  var annualSavings = plan.monthly * 12 - annualTotal;
  var price = isAnnual ? annualTotal : plan.monthly;

  var cardDigits = cardNumber.replace(/\D/g, "");
  var expiryParts = cardExpiry.split("/");
  var holderAddressNumberDigits = cardAddressNumber.replace(/\D/g, "");
  var holderAddressStreet = cardAddressStreet.trim();
  var holderAddressNumberDigits = cardAddressNumber.replace(/\D/g, "");
  var holderAddressStreet = cardAddressStreet.trim();
  var cardValid = cardDigits.length >= 15 && cardExpiry.length === 5 && cardCvv.length >= 3 && cardName.length >= 3 && cardCpf.replace(/\D/g, "").length === 11 && cardPostalCode.replace(/\D/g, "").length === 8 && holderAddressNumberDigits.length >= 1 && holderAddressStreet.length >= 3;
  var brand = cardBrand(cardNumber);

  var annualEndDate = isAnnual ? addMonthsIso(new Date(), 12) : undefined;

  async function handlePixSubscribe() {
    if (!company?.id) return;
    setLoading(true);
    try {
      var res = await billingApi.subscribe(company.id, selectedPlan, "PIX", "monthly", { endDate: annualEndDate, totalCycles: isAnnual ? 12 : undefined });
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
      // 1. Tokenizar
      var tokenRes = await billingApi.tokenize(company.id, {
        card_number: cardDigits,
        card_expiry_month: expiryParts[0],
        card_expiry_year: expiryParts[1],
        card_ccv: cardCvv,
        holder_name: cardName,
        holder_cpf: cardCpf.replace(/\D/g, ""),
        holder_postal_code: cardPostalCode.replace(/\D/g, ""),
        holder_address_number: holderAddressNumberDigits,
        holder_address: holderAddressStreet,
      });

      // 2. Assinar
      await billingApi.subscribe(company.id, selectedPlan, "CREDIT_CARD", "monthly", {
        endDate: annualEndDate,
        totalCycles: isAnnual ? 12 : undefined,
        creditCardToken: tokenRes.credit_card_token,
        holderName: cardName,
        holderCpf: cardCpf.replace(/\D/g, ""),
        holderPostalCode: cardPostalCode.replace(/\D/g, ""),
        holderAddressNumber: holderAddressNumberDigits,
        holderAddress: holderAddressStreet,
      });

      setSuccess(true);
      toast.success("Assinatura ativada!");
      await hydrate();
      setTimeout(function () { router.replace("/(tabs)/" as any); }, 2000);
    } catch (err: any) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao processar cartao");
    } finally { setTokenizing(false); }
  }

  function startPolling() {
    if (!company?.id) return;
    setPolling(true);
    pollRef.current = setInterval(async function () {
      try {
        var st = await billingApi.status(company!.id);
        if (st.billing_status === "active") {
          clearInterval(pollRef.current);
          setPolling(false);
          setSuccess(true);
          toast.success("Pagamento confirmado!");
          await hydrate();
          setTimeout(function () { router.replace("/(tabs)/" as any); }, 2000);
        }
      } catch { }
    }, 3000);
  }

  useEffect(function () { return function () { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  useEffect(function () {
    var cepDigits = cardPostalCode.replace(/\D/g, "");
    if (cepDigits.length !== 8) return;
    var cancelled = false;

    async function fetchCep() {
      setLoadingCep(true);
      try {
        var res = await fetch("https://viacep.com.br/ws/" + cepDigits + "/json/");
        var data = await res.json();
        if (cancelled || data?.erro) return;
        if (!cardAddressStreet.trim() && data.logradouro) setCardAddressStreet(String(data.logradouro));
        if (data.bairro) setCardAddressDistrict(String(data.bairro));
        if (data.localidade) setCardAddressCity(String(data.localidade));
        if (data.uf) setCardAddressState(String(data.uf));
      } catch { }
      finally { if (!cancelled) setLoadingCep(false); }
    }

    fetchCep();
    return function () { cancelled = true; };
  }, [cardPostalCode]);

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

      {/* Ciclo */}
      <View style={z.cycleRow}>
        <Pressable onPress={function () { setCycle("monthly"); }} style={[z.cycleBtn, cycle === "monthly" && z.cycleBtnActive]}>
          <Text style={[z.cycleTxt, cycle === "monthly" && z.cycleTxtActive]}>Mensal</Text>
        </Pressable>
        <Pressable onPress={function () { setCycle("annual"); }} style={[z.cycleBtn, cycle === "annual" && z.cycleBtnActive]}>
          <Text style={[z.cycleTxt, cycle === "annual" && z.cycleTxtActive]}>Anual</Text>
          <View style={z.discBadge}><Text style={z.discText}>2 meses grátis!</Text></View>
        </Pressable>
      </View>

      {/* Cards de Planos */}
      <View style={z.plansRow}>
        {PLANS.map(function (p) {
          var sel = selectedPlan === p.key;
          var pAnnualMo = Math.round(p.monthly * (1 - ANNUAL_DISCOUNT) * 100) / 100;
          var displayPrice = isAnnual ? pAnnualMo : p.monthly;
          return (
            <Pressable key={p.key} onPress={function () { setSelectedPlan(p.key); }} style={[z.planCard, sel && z.planCardSel, p.popular && !sel && z.planCardPop]}>
              {p.popular && <View style={z.popBadge}><Text style={z.popText}>Mais popular</Text></View>}
              <Text style={[z.planName, sel && { color: "#fff" }]}>{p.label}</Text>
              <Text style={[z.planPrice, sel && { color: "#fff" }]}>{fmtMo(displayPrice)}</Text>
              <Text style={[z.planDesc, sel && { color: "rgba(255,255,255,0.7)" }]}>{p.desc}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={z.sectionTitle}>Forma de pagamento</Text>
      <View style={z.methodRow}>
        <Pressable onPress={function () { setMethod("pix"); }} style={[z.methodBtn, method === "pix" && z.methodBtnActive]}>
          <Icon name="wallet" size={16} color={method === "pix" ? Colors.violet3 : Colors.ink3} />
          <Text style={[z.methodTxt, method === "pix" && z.methodTxtActive]}>Pix</Text>
        </Pressable>
        <Pressable onPress={function () { setMethod("card"); }} style={[z.methodBtn, method === "card" && z.methodBtnActive]}>
          <Icon name="cart" size={16} color={method === "card" ? Colors.violet3 : Colors.ink3} />
          <Text style={[z.methodTxt, method === "card" && z.methodTxtActive]}>Cartão</Text>
        </Pressable>
      </View>

      <View style={z.summaryCard}>
        <View style={z.summaryRow}>
          <Text style={z.summaryLabel}>{plan.label} ({isAnnual ? "anual" : "mensal"})</Text>
          <Text style={z.summaryValue}>{isAnnual ? fmt(price) : fmtMo(price)}</Text>
        </View>
      </View>

      {method === "pix" && !pixQr && (
        <View style={z.formCard}>
          <Pressable onPress={handlePixSubscribe} disabled={loading} style={[z.payBtn, loading && { opacity: 0.6 }]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={z.payBtnText}>Gerar Pix - {fmt(price)}</Text>}
          </Pressable>
        </View>
      )}

      {method === "pix" && pixQr && (
        <View style={z.pixCard}>
          <Image source={{ uri: "data:image/png;base64," + pixQr }} style={z.pixQrImg} resizeMode="contain" />
          <Pressable onPress={copyPix} style={z.copyBtn}><Text style={z.copyBtnText}>Copiar código Pix</Text></Pressable>
          {polling && <ActivityIndicator color={Colors.violet3} />}
        </View>
      )}

      {method === "card" && (
        <View style={z.formCard}>
          <View style={z.cardField}>
            <Text style={z.cardLabel}>Número do cartão</Text>
            <TextInput style={z.cardInput} value={cardNumber} onChangeText={function (v) { setCardNumber(maskCard(v)); }} placeholder="0000 0000 0000 0000" keyboardType="number-pad" />
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={[z.cardField, { flex: 1 }]}>
              <Text style={z.cardLabel}>Validade</Text>
              <TextInput style={z.cardInput} value={cardExpiry} onChangeText={function (v) { setCardExpiry(maskExpiry(v)); }} placeholder="MM/AA" keyboardType="number-pad" maxLength={5} />
            </View>
            <View style={[z.cardField, { flex: 1 }]}>
              <Text style={z.cardLabel}>CVV</Text>
              <TextInput style={z.cardInput} value={cardCvv} onChangeText={function (v) { setCardCvv(v.replace(/\D/g, "")); }} placeholder="123" keyboardType="number-pad" maxLength={4} secureTextEntry />
            </View>
          </View>

          <View style={z.cardField}>
            <Text style={z.cardLabel}>Nome no cartão</Text>
            <TextInput style={z.cardInput} value={cardName} onChangeText={function (v) { setCardName(v.toUpperCase()); }} placeholder="NOME DO TITULAR" autoCapitalize="characters" />
          </View>

          <View style={z.cardField}>
            <Text style={z.cardLabel}>CPF do titular</Text>
            <TextInput style={z.cardInput} value={cardCpf} onChangeText={function (v) { setCardCpf(maskCpf(v)); }} placeholder="000.000.000-00" keyboardType="number-pad" />
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={[z.cardField, { flex: 2 }]}>
              <Text style={z.cardLabel}>CEP do titular</Text>
              <TextInput style={z.cardInput} value={cardPostalCode} onChangeText={function (v) { setCardPostalCode(maskPostalCode(v)); }} placeholder="00000-000" keyboardType="number-pad" />
            </View>
            <View style={[z.cardField, { flex: 1 }]}>
              <Text style={z.cardLabel}>Número</Text>
              <TextInput style={z.cardInput} value={cardAddressNumber} onChangeText={function (v) { setCardAddressNumber(v.replace(/\D/g, "")); }} placeholder="123" keyboardType="number-pad" />
            </View>
          </View>

          <View style={z.cardField}>
            <Text style={z.cardLabel}>Rua / Logradouro</Text>
            <TextInput style={z.cardInput} value={cardAddressStreet} onChangeText={setCardAddressStreet} placeholder="Rua..." />
          </View>

          <Pressable onPress={handleCardSubscribe} disabled={tokenizing || !cardValid} style={[z.payBtn, (tokenizing || !cardValid) && { opacity: 0.5 }]}>
            {tokenizing ? <ActivityIndicator color="#fff" /> : <Text style={z.payBtnText}>Assinar Agora</Text>}
          </Pressable>
        </View>
      )}

      {hasActiveBilling ? (
        <Pressable onPress={function () { router.back(); }} style={z.backLink}><Text style={z.backLinkText}>Cancelar</Text></Pressable>
      ) : (
        <Pressable onPress={function () { logout(); }} style={z.backLink}><Text style={z.backLinkText}>Sair da conta</Text></Pressable>
      )}
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
  planDesc: { fontSize: 11, color: Colors.ink3, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 12, textTransform: "uppercase" as any, letterSpacing: 0.5 },
  methodRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  methodBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  methodBtnActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  methodTxt: { fontSize: 13, color: Colors.ink3, fontWeight: "600" },
  methodTxtActive: { color: Colors.violet3 },
  summaryCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  summaryValue: { fontSize: 16, color: Colors.green, fontWeight: "800" },
  formCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  payBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  payBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  pixCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.border, alignItems: "center", marginBottom: 20 },
  pixQrImg: { width: 200, height: 200, borderRadius: 12, marginBottom: 16 },
  copyBtn: { backgroundColor: Colors.violetD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1, borderColor: Colors.border2, marginBottom: 12 },
  copyBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  cardField: { marginBottom: 12 },
  cardLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", marginBottom: 5 },
  cardInput: { backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.ink },
  backLink: { alignSelf: "center", marginTop: 8, paddingVertical: 10, flexDirection: "row", alignItems: "center" },
  backLinkText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  successCard: { alignItems: "center", gap: 12, padding: 40 },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 22, fontWeight: "800", color: Colors.ink },
  successSub: { fontSize: 14, color: Colors.ink3 },
});

