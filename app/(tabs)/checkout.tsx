import { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Image, ActivityIndicator, TextInput, Linking } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { IS_WIDE } from "@/constants/helpers";
import { useAuthStore } from "@/stores/auth";
import { billingApi, ApiError } from "@/services/api";
import type { ValidateCouponResponse } from "@/services/billingApi";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { describeCoupon, discountInEffectText, DISCOUNT_LOSS_TEXT, pickOpenInvoice } from "@/components/billing/couponText";

var isWeb = Platform.OS === "web";

var PLANS = [
  { key: "essencial", label: "Essencial", monthly: 89, desc: "Base para comecar", features: ["PDV + cupom fiscal", "Cadastro e gestão de produtos", "Financeiro completo", "Relatórios contábeis básicos", "1 usuário"] },
  { key: "negocio", label: "Negócio", monthly: 169, desc: "Operação completa", popular: true, features: ["Tudo do Essencial", "Estoque completo com baixa automática e etiquetas", "Emissão de NF-e, NFC-e e NFS-e", "Sua loja online inclusa", "Financeiro completo (DRE + fluxo de caixa)", "Folha salarial", "Relatórios contábeis completos", "Suporte prioritario"] },
  { key: "expansao", label: "Expansão", monthly: 269, desc: "Escala e automação", features: ["Tudo do Negócio", "Gateway personalizado (use sua maquininha)", "API + integrações ilimitadas", "Hub social (Instagram e WhatsApp)", "Automações avancadas conectadas nas redes sociais", "IA avancada dentro de cada módulo", "Usuários ilimitados", "Multi CNPJ", "Emissão de NFS-e ilimitadas"] },
];

var ANNUAL_DISCOUNT = 1 / 6; // 2 meses grátis

// Acesso extra de equipe: R$19/mês por seat acima do limite do plano.
// Espelha SEAT_PRICE_BRL do backend (services/memberSeats.js). O seat é
// cobrado CHEIO — NUNCA recebe o desconto anual do plano (regra confirmada
// em 10/07/2026, ver services/billingPricing.js).
var SEAT_PRICE_BRL = 19;

function fmt(v: number) { return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtMo(v: number) { return fmt(v) + "/mes"; }
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  var p = String(iso).slice(0, 10).split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : String(iso);
}

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
// 21/09/2026 — CPF ou CNPJ de quem paga. O Asaas não gera cobrança para cliente
// sem documento, e a maioria das empresas entra sem CNPJ (MEI/autônomo). O
// checkout pedia o dado (via erro do Asaas) e não tinha campo para informar —
// no Pix, nenhum. Mesma validação de dígito verificador do backend
// (services/asaasCustomer.js): erro de digitação para aqui, não no Asaas.
function maskCpfCnpj(v: string) {
  var d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return maskCpf(d);
  return d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8, 12) + "-" + d.slice(12);
}
function isValidCpf(v: string) {
  var c = v.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  function calc(len: number) {
    var s = 0;
    for (var i = 0; i < len; i++) s += parseInt(c[i], 10) * (len + 1 - i);
    var r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  }
  return parseInt(c[9], 10) === calc(9) && parseInt(c[10], 10) === calc(10);
}
function isValidCnpj(v: string) {
  var c = v.replace(/\D/g, "");
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  function calc(len: number) {
    var w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    var s = 0;
    for (var i = 0; i < len; i++) s += parseInt(c[i], 10) * w[i];
    var r = s % 11;
    return r < 2 ? 0 : 11 - r;
  }
  return parseInt(c[12], 10) === calc(12) && parseInt(c[13], 10) === calc(13);
}
function isValidCpfCnpj(v: string) {
  var d = v.replace(/\D/g, "");
  return d.length === 11 ? isValidCpf(d) : d.length === 14 ? isValidCnpj(d) : false;
}
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

// 13/07/2026: o checkout abria SEMPRE em "Negócio / mensal", ignorando o que a
// empresa ja assina. Cliente que cai no checkout pra refazer a assinatura (cartao
// recusado, cobranca reemitida) tinha que lembrar de trocar plano E ciclo na mao —
// caso Encanto: Essencial anual (R$93,17 c/ 1 acesso extra) viraria Negocio mensal
// (R$188) num clique de distancia, e so apareceria na fatura.
// Agora pre-seleciona o plano e o ciclo que a empresa JA tem. Precedencia:
//   1. ?plan= na URL (link explicito de upgrade — respeita a intencao de quem mandou)
//   2. company.plan / company.billing_cycle (o que ela ja assina)
//   3. fallback historico: negocio / mensal (empresa nova, sem plano definido)
function planFromCompany(company: any): string | null {
  var p = String(company?.plan || "").toLowerCase();
  return PLANS.some(function (x) { return x.key === p; }) ? p : null;
}
function cycleFromCompany(company: any): Cycle | null {
  var c = String(company?.billing_cycle || "").toLowerCase();
  return c === "annual" || c === "monthly" ? (c as Cycle) : null;
}

// 13/07/2026 — o Aura Studio NAO tem plano Essencial: a vertical exige Negocio+
// (mesmo gate de app/studio/(estudio)/_layout.tsx). O checkout oferecia Essencial
// pra todo mundo — um cliente Studio podia assinar R$89 e cair num app que nao
// carrega o Studio: pagou e nao recebeu. A regra tambem vive no backend
// (/billing/subscribe devolve 400), esta aqui e so pra nao oferecer o que nao existe.
var VERTICAL_MIN_PLANS: Record<string, string[]> = {
  studio: ["negocio", "expansao"],
};
function allowedPlanKeys(company: any): string[] {
  var v = String(company?.vertical_active || "").toLowerCase();
  return VERTICAL_MIN_PLANS[v] || PLANS.map(function (p) { return p.key; });
}

export default function CheckoutScreen() {
  var params = useLocalSearchParams<{ plan?: string }>();
  var { company, hydrate, logout, trialActive, isDemo, isStaff } = useAuthStore();
  var allowedPlans = allowedPlanKeys(company);
  var visiblePlans = PLANS.filter(function (p) { return allowedPlans.indexOf(p.key) >= 0; });
  var restrictedByVertical = visiblePlans.length < PLANS.length;

  // Plano inicial: nunca um plano que a vertical da empresa nao aceita.
  var initialPlan = params.plan || planFromCompany(company) || "negocio";
  if (allowedPlans.indexOf(initialPlan) < 0) initialPlan = allowedPlans[0];
  var [selectedPlan, setSelectedPlan] = useState(initialPlan);
  var [cycle, setCycle] = useState<Cycle>(cycleFromCompany(company) || "monthly");
  // Se o usuario ja escolheu na tela, o sync com a empresa para de sobrescrever.
  var userPickedRef = useRef(false);

  // 13/07/2026 — cupom. Dois efeitos possiveis (access_codes ja tinha os dois
  // campos, ambos mortos ate aqui):
  //   discount_pct → desconto na 1a mensalidade (recorrencia segue cheia)
  //   trial_days   → nenhuma cobranca hoje; cartao fica salvo e a 1a cobranca
  //                  e agendada pra D+N (campanha de indicacao)
  var [couponInput, setCouponInput] = useState("");
  var [couponApplied, setCouponApplied] = useState<ValidateCouponResponse | null>(null);
  var [couponError, setCouponError] = useState<string | null>(null);
  var [couponLoading, setCouponLoading] = useState(false);
  var [method, setMethod] = useState<Method>("pix");
  var [loading, setLoading] = useState(false);
  var [tokenizing, setTokenizing] = useState(false);
  var [success, setSuccess] = useState(false);

  // Pix state
  var [pixQr, setPixQr] = useState<string | null>(null);
  var [pixCopyPaste, setPixCopyPaste] = useState<string | null>(null);
  var [pixExpiration, setPixExpiration] = useState<string | null>(null);
  var [polling, setPolling] = useState(false);
  var pollRef = useRef<any>(null);

  // CPF/CNPJ de quem paga (Pix). No cartão, o CPF do titular já cumpre o papel.
  var [taxId, setTaxId] = useState("");
  // Backend devolveu stage='cpf_cnpj': mostra o campo mesmo se a tela achava
  // que não precisava (ex.: cliente Asaas antigo, criado sem documento).
  var [taxIdForced, setTaxIdForced] = useState(false);

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

  var plan = PLANS.find(function (p) { return p.key === selectedPlan; }) || PLANS[1];  // PLANS[1] = negocio
  var isAnnual = cycle === "annual";
  var annualTotal = Math.round(plan.monthly * 12 * (1 - ANNUAL_DISCOUNT) * 100) / 100;
  var annualMonthly = Math.round(annualTotal / 12 * 100) / 100;
  var annualSavings = plan.monthly * 12 - annualTotal;
  // Sempre mostra mensalidade — o plano anual é cobrado mensalmente, não à vista.
  var price = isAnnual ? annualMonthly : plan.monthly;

  // 11/07/2026: acessos extras entram no valor cobrado por /billing/subscribe
  // (backend: getTotalValue = plano + 19 × seats). A tela mostrava só o plano e
  // cobrava plano + seats — cliente com acesso extra via "R$ 74,17" e era
  // debitado em "R$ 93,17". Agora o resumo e os botões exibem o total real.
  var extraSeats = parseInt(String((company as any)?.extra_seats_granted ?? 0), 10) || 0;
  var seatsPrice = extraSeats * SEAT_PRICE_BRL;
  var totalPrice = Math.round((price + seatsPrice) * 100) / 100;

  // Com cupom, o backend e a fonte da verdade do valor (ele recalcula com o
  // plano/ciclo/seats reais da empresa). A tela so exibe o que ele devolveu.
  // 11/09/2026: os textos saem de couponText (dias gratis / 1a mensalidade /
  // N primeiras mensalidades).
  var couponView = couponApplied ? describeCoupon(couponApplied, totalPrice) : null;
  var couponTrialDays = couponApplied?.trial_days || 0;
  var chargedNow = couponView ? couponView.chargedNow : totalPrice;
  var isFreeTrialCoupon = couponTrialDays > 0;

  // 11/09/2026 — desconto de varios meses EM ANDAMENTO. Assinar de novo aqui
  // (a unica forma de trocar plano/ciclo/pagamento no app) encerra o desconto;
  // o backend faz isso sozinho, a tela so nao deixa acontecer sem o cliente
  // saber. E, se ha mensalidade em aberto (Pix vencido, cartao recusado), o
  // caminho que MANTEM o desconto e pagar essa mensalidade, nao assinar de novo.
  var { data: billingStatusData } = useQuery({
    queryKey: ["billing-status", company?.id],
    queryFn: function () { return billingApi.status(company!.id); },
    enabled: !!company?.id && !isDemo,
    retry: 1, staleTime: 60000,
  });
  var activeDiscount = billingStatusData?.discount || null;
  var billingNotActive = !!billingStatusData && billingStatusData.billing_status !== "active";
  var [discountLossAck, setDiscountLossAck] = useState(false);
  var [openInvoiceLoading, setOpenInvoiceLoading] = useState(false);
  var blockedByDiscount = !!activeDiscount && !discountLossAck;

  // Precisa pedir CPF/CNPJ? O backend responde (needs_cpf_cnpj); enquanto o
  // status não chega — ou num backend anterior a 21/09 — decide pelo CNPJ da
  // empresa que já está na tela.
  var needsTaxId = taxIdForced || (typeof billingStatusData?.needs_cpf_cnpj === "boolean"
    ? billingStatusData.needs_cpf_cnpj
    : !isValidCnpj(String((company as any)?.cnpj || "")));
  var taxIdDigits = taxId.replace(/\D/g, "");
  var taxIdValid = isValidCpfCnpj(taxIdDigits);
  var taxIdComplete = taxIdDigits.length === 11 || taxIdDigits.length === 14;
  var blockedByTaxId = needsTaxId && !taxIdValid;

  var cardDigits = cardNumber.replace(/\D/g, "");
  var expiryParts = cardExpiry.split("/");
  var holderAddressNumberDigits = cardAddressNumber.replace(/\D/g, "");
  var holderAddressStreet = cardAddressStreet.trim();
  var cardValid = cardDigits.length >= 15 && cardExpiry.length === 5 && cardCvv.length >= 3 && cardName.length >= 3 && isValidCpf(cardCpf) && cardPostalCode.replace(/\D/g, "").length === 8 && holderAddressNumberDigits.length >= 1 && holderAddressStreet.length >= 3;
  var brand = cardBrand(cardNumber);

  var annualEndDate = isAnnual ? addMonthsIso(new Date(), 12) : undefined;

  async function handleApplyCoupon() {
    if (!company?.id) return;
    var code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      var res = await billingApi.validateCoupon(company.id, code, selectedPlan, isAnnual ? "annual" : "monthly", method === "card" ? "CREDIT_CARD" : "PIX");
      if (res.valid) {
        setCouponApplied(res);
        setCouponError(null);
        toast.success(describeCoupon(res, totalPrice).toast);
      } else {
        setCouponApplied(null);
        setCouponError(res.error || "Cupom inválido");
      }
    } catch (err: any) {
      setCouponApplied(null);
      setCouponError(err instanceof ApiError ? err.message : "Erro ao validar cupom");
    } finally { setCouponLoading(false); }
  }

  function handleRemoveCoupon() {
    setCouponApplied(null);
    setCouponInput("");
    setCouponError(null);
  }

  // Trocar plano/ciclo muda o valor — o cupom aplicado foi calculado em cima do
  // valor antigo, entao revalida (nunca deixa na tela um total desatualizado).
  useEffect(function () {
    if (!couponApplied || !company?.id) return;
    var code = couponApplied.code || couponInput;
    if (!code) return;
    var cancelled = false;
    billingApi.validateCoupon(company.id, code, selectedPlan, isAnnual ? "annual" : "monthly", method === "card" ? "CREDIT_CARD" : "PIX")
      .then(function (res) {
        if (cancelled) return;
        if (res.valid) setCouponApplied(res);
        else { setCouponApplied(null); setCouponError(res.error || "Cupom inválido"); }
      })
      .catch(function () { });
    return function () { cancelled = true; };
  }, [selectedPlan, cycle, method]);

  async function handlePixSubscribe() {
    if (!company?.id || blockedByTaxId) return;
    setLoading(true);
    try {
      var res = await billingApi.subscribe(company.id, selectedPlan, "PIX", isAnnual ? "annual" : "monthly", { endDate: annualEndDate, totalCycles: isAnnual ? 12 : undefined, accessCode: couponApplied?.code, cpfCnpj: taxIdValid ? taxIdDigits : undefined });
      // Cupom de dias gratis no Pix: nao ha o que pagar hoje, entao nao vem QR.
      if (couponApplied?.trial_days) {
        setSuccess(true);
        toast.success(res.message || couponApplied.trial_days + " dias grátis ativados!");
        await hydrate();
        setTimeout(function () { router.replace("/(tabs)/" as any); }, 2000);
        return;
      }
      if (res.pix_qr_code) {
        setPixQr(res.pix_qr_code);
        setPixCopyPaste(res.pix_copy_paste || null);
        setPixExpiration(res.pix_expiration || null);
      }
      startPolling();
    } catch (err: any) {
      // Faltou (ou o Asaas recusou) o CPF/CNPJ: abre o campo em vez de deixar
      // o cliente num erro sem saída.
      if (err instanceof ApiError && err.data?.stage === "cpf_cnpj") setTaxIdForced(true);
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

      // 2. Assinar — cycle correto: "annual" gera assinatura mensal com endDate 12 meses
      await billingApi.subscribe(company.id, selectedPlan, "CREDIT_CARD", isAnnual ? "annual" : "monthly", {
        endDate: annualEndDate,
        totalCycles: isAnnual ? 12 : undefined,
        accessCode: couponApplied?.code,
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
      toast.error(err instanceof ApiError ? err.message : "Erro ao processar cartão");
    } finally { setTokenizing(false); }
  }

  // Paga a mensalidade em aberto na fatura do Asaas (Pix, boleto ou cartao,
  // conforme a cobranca) e fica esperando o webhook ativar a conta — sem criar
  // assinatura nova, entao o desconto continua.
  async function handlePayOpenInvoice() {
    if (!company?.id) return;
    setOpenInvoiceLoading(true);
    try {
      var res = await billingApi.invoices(company.id);
      var invoice = pickOpenInvoice(res.invoices);
      if (!invoice || !invoice.invoice_url) {
        toast.error("Não encontramos mensalidade em aberto. Fale com a gente em contato@getaura.com.br");
        return;
      }
      if (isWeb && typeof window !== "undefined") window.open(invoice.invoice_url, "_blank");
      else await Linking.openURL(invoice.invoice_url);
      toast.info("Assim que o pagamento cair, sua conta volta ao normal.");
      if (!pollRef.current) startPolling();
    } catch (err: any) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao buscar a mensalidade em aberto");
    } finally { setOpenInvoiceLoading(false); }
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

  // O company costuma hidratar DEPOIS do mount (/auth/me), entao o valor inicial
  // do useState pode ter sido calculado com company=null. Re-sincroniza assim que
  // ele chega — mas nunca por cima de uma escolha que o usuario ja fez na tela,
  // nem por cima de um ?plan= explicito na URL.
  useEffect(function () {
    if (userPickedRef.current || params.plan) return;
    var p = planFromCompany(company);
    var c = cycleFromCompany(company);
    if (p && allowedPlans.indexOf(p) >= 0) setSelectedPlan(p);
    if (c) setCycle(c);
  }, [company?.id, (company as any)?.plan, (company as any)?.billing_cycle]);

  // Rede de seguranca: se o plano selecionado nao for aceito pela vertical
  // (ex: company.plan='essencial' num cliente Studio), corrige na hora — a tela
  // nunca deixa o cliente clicar em "assinar" num plano que o backend vai recusar.
  useEffect(function () {
    if (allowedPlans.indexOf(selectedPlan) < 0) setSelectedPlan(allowedPlans[0]);
  }, [selectedPlan, (company as any)?.vertical_active]);

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
    toast.success("Código Pix copiado!");
  }

  // 2026-06-18: gate para usuário multi-CNPJ em modo consolidado (company=null).
  // Antes os botões "Gerar Pix" / "Assinar Agora" faziam `return` silencioso
  // sem nenhum feedback — o usuário clicava e nada acontecia.
  if (!company?.id) {
    return (
      <View style={[z.screen, { justifyContent: "center", alignItems: "center", padding: 32 }]}>
        <Icon name="building" size={48} color={Colors.ink3} />
        <Text style={[z.title, { marginTop: 20 }]}>Selecione uma empresa</Text>
        <Text style={[z.subtitle, { marginBottom: 28 }]}>
          Escolha qual empresa deseja assinar um plano para continuar.
        </Text>
        <Pressable
          onPress={function () { router.push("/empresas" as any); }}
          style={z.payBtn}
        >
          <Text style={z.payBtnText}>Escolher empresa</Text>
        </Pressable>
        <Pressable onPress={function () { router.back(); }} style={z.backLink}>
          <Text style={z.backLinkText}>Voltar</Text>
        </Pressable>
      </View>
    );
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

      {activeDiscount && (
        <View style={z.discountCard}>
          <Text style={z.discountTitle}>Você tem um desconto em andamento</Text>
          <Text style={z.discountText}>{discountInEffectText(activeDiscount)}</Text>

          {billingNotActive && (
            <>
              <Text style={[z.discountText, { marginTop: 10 }]}>
                Para manter o desconto, pague a mensalidade em aberto em vez de assinar de novo:
              </Text>
              <Pressable
                onPress={handlePayOpenInvoice}
                disabled={openInvoiceLoading}
                style={[z.payBtn, { marginTop: 10 }, openInvoiceLoading && { opacity: 0.6 }]}
              >
                {openInvoiceLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={z.payBtnText}>Pagar mensalidade em aberto</Text>}
              </Pressable>
              {polling && <ActivityIndicator color={Colors.violet3} style={{ marginTop: 10 }} />}
            </>
          )}

          <Text style={[z.discountText, z.discountWarn]}>{DISCOUNT_LOSS_TEXT}</Text>
          <Pressable
            onPress={function () { setDiscountLossAck(!discountLossAck); }}
            style={z.ackRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: discountLossAck }}
          >
            <View style={[z.ackBox, discountLossAck && z.ackBoxOn]}>
              {discountLossAck && <Icon name="check" size={12} color="#fff" />}
            </View>
            <Text style={z.ackText}>Entendi. Quero assinar de novo sem o desconto.</Text>
          </Pressable>
        </View>
      )}

      {/* Ciclo */}
      <View style={z.cycleRow}>
        <Pressable onPress={function () { userPickedRef.current = true; setCycle("monthly"); }} style={[z.cycleBtn, cycle === "monthly" && z.cycleBtnActive]}>
          <Text style={[z.cycleTxt, cycle === "monthly" && z.cycleTxtActive]}>Mensal</Text>
        </Pressable>
        <Pressable onPress={function () { userPickedRef.current = true; setCycle("annual"); }} style={[z.cycleBtn, cycle === "annual" && z.cycleBtnActive]}>
          <Text style={[z.cycleTxt, cycle === "annual" && z.cycleTxtActive]}>Anual</Text>
          <View style={z.discBadge}><Text style={z.discText}>2 meses grátis!</Text></View>
        </Pressable>
      </View>

      {/* Cards de Planos */}
      {restrictedByVertical && (
        <Text style={z.verticalNote}>
          O Aura Studio exige o plano Negócio ou superior — o Essencial não inclui o Studio.
        </Text>
      )}
      <View style={z.plansRow}>
        {visiblePlans.map(function (p) {
          var sel = selectedPlan === p.key;
          var pAnnualMo = Math.round(p.monthly * (1 - ANNUAL_DISCOUNT) * 100) / 100;
          var displayPrice = isAnnual ? pAnnualMo : p.monthly;
          return (
            <Pressable key={p.key} onPress={function () { userPickedRef.current = true; setSelectedPlan(p.key); }} style={[z.planCard, sel && z.planCardSel, p.popular && !sel && z.planCardPop]}>
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

      {/* Cupom de desconto / indicação */}
      <View style={z.couponCard}>
        {!couponApplied ? (
          <>
            <View style={z.couponRow}>
              <TextInput
                style={z.couponInput}
                value={couponInput}
                onChangeText={function (v) { setCouponInput(v.toUpperCase()); setCouponError(null); }}
                placeholder="CUPOM OU CÓDIGO DE INDICAÇÃO"
                placeholderTextColor={Colors.ink3}
                autoCapitalize="characters"
                editable={!couponLoading}
              />
              <Pressable
                onPress={handleApplyCoupon}
                disabled={couponLoading || !couponInput.trim()}
                style={[z.couponBtn, (couponLoading || !couponInput.trim()) && { opacity: 0.5 }]}
              >
                {couponLoading
                  ? <ActivityIndicator size="small" color={Colors.violet3} />
                  : <Text style={z.couponBtnText}>Aplicar</Text>}
              </Pressable>
            </View>
            {couponError && <Text style={z.couponError}>{couponError}</Text>}
          </>
        ) : (
          <View style={z.couponAppliedRow}>
            <View style={{ flex: 1 }}>
              <Text style={z.couponAppliedTitle}>{couponView?.title}</Text>
              <Text style={z.couponAppliedSub}>{couponView?.subtitle}</Text>
            </View>
            <Pressable onPress={handleRemoveCoupon} style={z.couponRemove}>
              <Text style={z.couponRemoveText}>Remover</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={z.summaryCard}>
        <View style={z.summaryRow}>
          <Text style={z.summaryLabel}>{plan.label} ({isAnnual ? "anual" : "mensal"})</Text>
          <Text style={z.summaryValue}>{fmtMo(price)}</Text>
        </View>
        {isAnnual && (
          <Text style={z.annualNote}>Cobrado mensalmente · economia de {fmt(annualSavings)}/ano</Text>
        )}
        {extraSeats > 0 && (
          <View style={z.summaryRow}>
            <Text style={z.summaryLabel}>{extraSeats} acesso{extraSeats > 1 ? "s" : ""} extra{extraSeats > 1 ? "s" : ""} de equipe</Text>
            <Text style={z.summaryValue}>{fmtMo(seatsPrice)}</Text>
          </View>
        )}
        {couponView && couponView.summaryLabel && (
          <View style={z.summaryRow}>
            <Text style={z.summaryLabel}>{couponView.summaryLabel}</Text>
            <Text style={z.couponDiscountValue}>- {fmt(couponView.savings)}</Text>
          </View>
        )}

        <View style={[z.summaryRow, z.summaryTotalRow]}>
          <Text style={z.summaryTotalLabel}>{isFreeTrialCoupon ? "Você paga hoje" : "Total hoje"}</Text>
          <Text style={z.summaryTotalValue}>{isFreeTrialCoupon ? "R$ 0,00" : fmt(chargedNow)}</Text>
        </View>
        {(couponView || extraSeats > 0) && (
          <Text style={z.annualNote}>
            {couponView ? couponView.afterNote : "Cobrado mensalmente"}
          </Text>
        )}
      </View>

      {method === "pix" && !pixQr && (
        <View style={z.formCard}>
          {needsTaxId && (
            <View style={z.cardField}>
              <Text style={z.cardLabel}>CPF ou CNPJ de quem vai pagar</Text>
              <TextInput
                style={[z.cardInput, taxIdComplete && !taxIdValid && { borderColor: Colors.red }]}
                value={taxId}
                onChangeText={function (v) { setTaxId(maskCpfCnpj(v)); }}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                placeholderTextColor={Colors.ink3}
                keyboardType="number-pad"
                maxLength={18}
                editable={!loading}
              />
              {taxIdComplete && !taxIdValid
                ? <Text style={z.couponError}>CPF ou CNPJ inválido. Confira os números.</Text>
                : <Text style={z.taxIdHint}>Exigido pelo banco para gerar o Pix. Não tem CNPJ? Use seu CPF.</Text>}
            </View>
          )}
          <Pressable onPress={handlePixSubscribe} disabled={loading || blockedByDiscount || blockedByTaxId} style={[z.payBtn, (loading || blockedByDiscount || blockedByTaxId) && { opacity: 0.5 }]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={z.payBtnText}>{isFreeTrialCoupon ? "Ativar " + couponTrialDays + " dias grátis" : "Gerar Pix - " + fmt(chargedNow)}</Text>}
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

          <Pressable onPress={handleCardSubscribe} disabled={tokenizing || !cardValid || blockedByDiscount} style={[z.payBtn, (tokenizing || !cardValid || blockedByDiscount) && { opacity: 0.5 }]}>
            {tokenizing ? <ActivityIndicator color="#fff" /> : <Text style={z.payBtnText}>{isFreeTrialCoupon ? "Ativar " + couponTrialDays + " dias grátis (sem cobrança hoje)" : "Assinar Agora - " + fmt(chargedNow)}</Text>}
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
  annualNote: { fontSize: 11, color: Colors.ink3, marginTop: 6 },
  formCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  payBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 16, alignItems: "center", width: "100%" },
  summaryTotalRow: { borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: 8, marginTop: 4 },
  summaryTotalLabel: { fontSize: 13, fontWeight: "700", color: Colors.ink1 },
  summaryTotalValue: { fontSize: 15, fontWeight: "800", color: Colors.violet3 },
  verticalNote: { fontSize: 11, color: Colors.violet3, backgroundColor: Colors.violetD, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 10, fontWeight: "600", lineHeight: 15 },
  couponCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  couponRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  couponInput: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink, letterSpacing: 0.5 },
  couponBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  couponBtnText: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  couponError: { fontSize: 11, color: Colors.red, marginTop: 8 },
  taxIdHint: { fontSize: 11, color: Colors.ink3, marginTop: 6 },
  couponAppliedRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  couponAppliedTitle: { fontSize: 13, fontWeight: "700", color: Colors.green },
  couponAppliedSub: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  couponRemove: { paddingHorizontal: 10, paddingVertical: 6 },
  couponRemoveText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  couponDiscountValue: { fontSize: 15, color: Colors.green, fontWeight: "800" },
  discountCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.amber },
  discountTitle: { fontSize: 14, fontWeight: "700", color: Colors.ink, marginBottom: 6 },
  discountText: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  discountWarn: { marginTop: 12, color: Colors.amber, fontWeight: "600" },
  ackRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, paddingVertical: 4 },
  ackBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  ackBoxOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  ackText: { flex: 1, fontSize: 12, color: Colors.ink, fontWeight: "600" },
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
