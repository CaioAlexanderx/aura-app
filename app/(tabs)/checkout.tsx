// ============================================================
// AURA. — Checkout da assinatura
//
// 11/11/2026 (p-104): visual novo, na identidade da porta de entrada e do
// site (mock v5 aprovado pelo Caio). Muda o visual e os textos; a lógica é a
// de antes: cotação (/billing/quote, inclusive o valor combinado), cupom
// (/billing/validate-coupon), tokenização do cartão, CPF/CNPJ quando falta,
// Pix e cartão. Tokens, fontes e botões: components/billing/estiloDoCheckout.
// Textos: components/billing/textosDoCheckout.
//
// p-105: quem chega pelo link do assento sem assinatura em dia vem com
// ?de=assento e lê a frase do assento no topo (em atraso, com o link da
// cobrança em aberto).
// ============================================================
import { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Image, ActivityIndicator, TextInput, Linking, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { useAuthStore } from "@/stores/auth";
import { billingApi, ApiError } from "@/services/api";
import type { ValidateCouponResponse } from "@/services/billingApi";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { describeCoupon, discountInEffectText, DISCOUNT_LOSS_TEXT, pickOpenInvoice } from "@/components/billing/couponText";
import { useCheckoutViewed } from "@/hooks/useCheckoutViewed";
import { totalDoCheckout } from "@/utils/valorCombinado";
import { Ck, marca, soWeb, injetarCssDoCheckout } from "@/components/billing/estiloDoCheckout";
import { CartaoDePlano } from "@/components/billing/CartaoDePlano";
import { ResumoDoCheckout } from "@/components/billing/ResumoDoCheckout";
import {
  PLANOS_DO_CHECKOUT, PRECO_DO_ACESSO_EXTRA, SELO_ANUAL, RODAPE_ASAAS, VOLTAR_AO_CAIXA,
  AVISO_ASSENTO_EM_ATRASO, AVISO_ASSENTO_SEM_ASSINATURA,
  precoDeTabela, precoDoPlanoNaCotacao, acessosExtrasDaConta, rotuloDoPlanoNoResumo, rotuloDosAcessosExtras,
  textoDoBotaoDePagar, linhaDoCupomAplicado, rotuloDoCupomNoResumo, textoDepoisDoCupom, mensagemDoCupomRecusado,
} from "@/components/billing/textosDoCheckout";

var isWeb = Platform.OS === "web";

var PLANS = PLANOS_DO_CHECKOUT;

// Com mensagem do backend na tela de sucesso (data da 1ª cobrança), dá tempo de
// ler antes de redirecionar; o botão "Continuar" leva na hora.
var MENSAGEM_MS = 7000;

// Acesso extra de equipe: R$19/mês por seat acima do limite do plano.
// Espelha SEAT_PRICE_BRL do backend (services/memberSeats.js). O seat é
// cobrado CHEIO — NUNCA recebe o desconto anual do plano (regra confirmada
// em 10/07/2026, ver services/billingPricing.js).
var SEAT_PRICE_BRL = PRECO_DO_ACESSO_EXTRA;

var ROTA_CAIXA = "/(tabs)/pdv";

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
// 11/11/2026 (p-104): ?plan= com chave que não existe (ex.: "personalizado")
// é ignorado — antes caía no primeiro plano da lista. A Expansão nunca vem
// marcada por padrão: só se for o plano da conta ou o pedido explícito.
function planoValido(p: unknown): string | null {
  var k = String(p || "").toLowerCase();
  return PLANS.some(function (x) { return x.key === k; }) ? k : null;
}
function planFromCompany(company: any): string | null {
  return planoValido(company?.plan);
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
function planoPermitido(desejado: string, permitidos: string[]): string {
  if (permitidos.indexOf(desejado) >= 0) return desejado;
  return permitidos.indexOf("negocio") >= 0 ? "negocio" : permitidos[0];
}

export default function CheckoutScreen() {
  var params = useLocalSearchParams<{ plan?: string; de?: string }>();
  var auth = useAuthStore() as any;
  var { company, hydrate, logout, trialActive, isDemo, isStaff } = auth;
  var refreshMe = auth.refreshMe;
  var largura = useWindowDimensions().width;
  var largo = largura > 768;
  // 17/10/2026 (t2-04): conta a abertura da tela (degrau "viu checkout" do
  // painel). Demo e staff não contam; uma vez por abertura, mesmo com re-render.
  useCheckoutViewed(isDemo || isStaff ? null : company?.id);
  var allowedPlans = allowedPlanKeys(company);
  var visiblePlans = PLANS.filter(function (p) { return allowedPlans.indexOf(p.key) >= 0; });
  var restrictedByVertical = visiblePlans.length < PLANS.length;
  var planoDaUrl = planoValido(params.plan);
  var veioDoAssento = String(params.de || "") === "assento";

  // Plano velho no JWT (armadilha 1 do CLAUDE.md): o plano marcado depende do
  // plano da conta, então relê o /auth/me ao abrir. O efeito de sincronia
  // abaixo aplica o plano novo, se mudou.
  useEffect(function () {
    injetarCssDoCheckout();
    if (typeof refreshMe !== "function") return;
    try { Promise.resolve(refreshMe()).catch(function () { }); } catch { /* o /me se atualiza no próximo mount */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Plano inicial: o da URL, o da conta ou o Negócio; nunca um plano que a
  // vertical da empresa nao aceita.
  var initialPlan = planoPermitido(planoDaUrl || planFromCompany(company) || "negocio", allowedPlans);
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
  // 13/10/2026 — texto do backend na tela de sucesso (cupom de dias grátis):
  // diz a data da 1ª cobrança e o valor.
  var [successMessage, setSuccessMessage] = useState<string | null>(null);

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
  var metodoDaApi = method === "card" ? "CREDIT_CARD" : "PIX";

  // 14/10/2026 — valor combinado da empresa (Gestão Aura). O backend devolve o
  // valor mensal certo para o plano/ciclo/forma escolhidos; só vale com
  // custom:true. Sem a rota (backend antigo), erro ou resposta estranha, o
  // total segue sendo o de tabela: o checkout nunca depende desta chamada.
  // 11/11/2026 (p-104): uma cotação por plano visível, para o preço de cada
  // cartão vir do backend (table_value − acessos extras); a do plano marcado
  // é a mesma de sempre (mesma chave de cache).
  var cotacoes = useQueries({
    queries: visiblePlans.map(function (p) {
      return {
        queryKey: ["billing-quote", company?.id, p.key, cycle, method],
        queryFn: function () { return billingApi.quote(company!.id, p.key, cycle, metodoDaApi); },
        enabled: !!company?.id && !isDemo,
        retry: false, staleTime: 30000,
      };
    }),
  });
  function cotacaoDe(chave: string) {
    var i = visiblePlans.findIndex(function (p) { return p.key === chave; });
    return i >= 0 && cotacoes[i] ? cotacoes[i].data : undefined;
  }
  function precoDoPlano(p: { key: string; monthly: number }) {
    var doBackend = precoDoPlanoNaCotacao(cotacaoDe(p.key), p.key, cycle);
    return doBackend !== null ? doBackend : precoDeTabela(p.monthly, isAnnual);
  }
  var cotacao = cotacaoDe(selectedPlan);

  // Sempre mostra mensalidade — o plano anual é cobrado mensalmente, não à vista.
  var price = precoDoPlano(plan);

  // 11/07/2026: acessos extras entram no valor cobrado por /billing/subscribe
  // (backend: getTotalValue = plano + 19 × seats). A tela mostrava só o plano e
  // cobrava plano + seats — cliente com acesso extra via "R$ 74,17" e era
  // debitado em "R$ 93,17". Agora o resumo e os botões exibem o total real.
  // 11/11/2026: o número vem do /billing/quote (extra_seats), senão da empresa.
  var extraSeats = acessosExtrasDaConta(cotacao, company);
  var seatsPrice = extraSeats * SEAT_PRICE_BRL;
  var tabelaTotal = Math.round((price + seatsPrice) * 100) / 100;

  var cotado = totalDoCheckout(tabelaTotal, cotacao, selectedPlan, cycle);
  var valorCombinado = cotado.combinado;
  var totalPrice = cotado.total;

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
  // p-105: em atraso = cobrança vencida na Asaas (billing_status 'overdue').
  var emAtraso = billingStatus === "overdue" || billingStatusData?.billing_status === "overdue";

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
        setCouponError(mensagemDoCupomRecusado(res.error));
      }
    } catch (err: any) {
      setCouponApplied(null);
      setCouponError(err instanceof ApiError ? err.message : "Não consegui conferir o código agora. Tente de novo.");
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
        else { setCouponApplied(null); setCouponError(mensagemDoCupomRecusado(res.error)); }
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
        setSuccessMessage(res.message || null);
        setSuccess(true);
        toast.success(res.message || couponApplied.trial_days + " dias grátis ativados!");
        await hydrate();
        setTimeout(function () { router.replace("/(tabs)/" as any); }, res.message ? MENSAGEM_MS : 2000);
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
      var subRes = await billingApi.subscribe(company.id, selectedPlan, "CREDIT_CARD", isAnnual ? "annual" : "monthly", {
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

      setSuccessMessage(subRes?.message || null);
      setSuccess(true);
      toast.success(subRes?.message || "Assinatura ativada!");
      await hydrate();
      setTimeout(function () { router.replace("/(tabs)/" as any); }, subRes?.message ? MENSAGEM_MS : 2000);
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
    if (userPickedRef.current || planoDaUrl) return;
    var p = planFromCompany(company);
    var c = cycleFromCompany(company);
    if (p && allowedPlans.indexOf(p) >= 0) setSelectedPlan(p);
    if (c) setCycle(c);
  }, [company?.id, (company as any)?.plan, (company as any)?.billing_cycle]);

  // Rede de seguranca: se o plano selecionado nao for aceito pela vertical
  // (ex: company.plan='essencial' num cliente Studio), corrige na hora — a tela
  // nunca deixa o cliente clicar em "assinar" num plano que o backend vai recusar.
  useEffect(function () {
    if (allowedPlans.indexOf(selectedPlan) < 0) setSelectedPlan(planoPermitido(selectedPlan, allowedPlans));
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

  function voltarAoCaixa() { router.replace(ROTA_CAIXA as any); }

  var cnt = [z.cnt, { paddingHorizontal: largo ? 32 : 16, paddingTop: largo ? 36 : 24, maxWidth: largo ? 720 : 560 }];

  // 2026-06-18: gate para usuário multi-CNPJ em modo consolidado (company=null).
  // Antes os botões "Gerar Pix" / "Assinar Agora" faziam `return` silencioso
  // sem nenhum feedback — o usuário clicava e nada acontecia.
  if (!company?.id) {
    return (
      <View testID="checkout-escolher-empresa" style={[z.screen, { justifyContent: "center", alignItems: "center", padding: 32 }]} {...marca("ck-palco")}>
        <Icon name="building" size={44} color={Colors.violet3} />
        <Text style={[z.title, { marginTop: 18 }]}>Selecione uma empresa</Text>
        <Text style={[z.subtitle, { marginBottom: 24 }]}>
          A assinatura é de cada empresa. Escolha qual empresa vai assinar para continuar.
        </Text>
        <Pressable onPress={function () { router.push("/empresas" as any); }} accessibilityRole="button" style={[z.cta, { width: undefined, paddingHorizontal: 28 }]} {...marca("ck-cta")}>
          <Text style={z.ctaText}>Escolher empresa</Text>
        </Pressable>
        <Pressable onPress={function () { router.back(); }} accessibilityRole="link" style={z.footLink} {...marca("ck-link")}>
          <Text style={z.footLinkText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  if (success) {
    return (
      <View style={[z.screen, { justifyContent: "center", alignItems: "center" }]} {...marca("ck-palco")}>
        <View style={z.successCard}>
          <View style={z.successIcon}><Icon name="check" size={32} color={Ck.ok} /></View>
          <Text style={z.successTitle}>{successMessage ? "Assinatura ativada!" : "Pagamento confirmado!"}</Text>
          {successMessage && <Text testID="checkout-sucesso-mensagem" style={z.successMsg}>{successMessage}</Text>}
          <Text style={z.successSub}>Plano {plan.label} ativo. Redirecionando...</Text>
          {successMessage && (
            <Pressable testID="checkout-sucesso-continuar" onPress={function () { router.replace("/(tabs)/" as any); }} style={[z.cta, { width: undefined, paddingHorizontal: 32 }]} {...marca("ck-cta")}>
              <Text style={z.ctaText}>Continuar</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  var linhaDoCupom = couponApplied && couponView && (couponView.savings || 0) > 0
    ? (function () { var r = rotuloDoCupomNoResumo(couponApplied!); return r ? { rotulo: r, valor: couponView!.savings } : null; })()
    : null;
  var depoisDoCupom = couponApplied && couponView
    ? textoDepoisDoCupom(couponApplied, couponApplied.recurring_value ?? totalPrice)
    : null;
  var bloqueadoPix = loading || blockedByDiscount || blockedByTaxId;
  var bloqueadoCartao = tokenizing || !cardValid || blockedByDiscount;

  return (
    <ScrollView testID="checkout" style={z.screen} contentContainerStyle={cnt} {...marca("ck-palco")}>
      <View style={z.head}>
        <Text style={[z.mono, { marginBottom: 6 }]}>Assinatura</Text>
        <Text style={z.title} accessibilityRole="header">Escolha seu plano</Text>
        <Text style={z.subtitle}>Sem contrato. Cancele quando quiser.</Text>
      </View>

      {/* p-105: veio pelo link do assento sem assinatura em dia. */}
      {veioDoAssento && (
        <View testID="checkout-aviso-assento" style={z.aviso}>
          <Text style={z.avisoTexto}>{emAtraso ? AVISO_ASSENTO_EM_ATRASO : AVISO_ASSENTO_SEM_ASSINATURA}</Text>
          {emAtraso && (
            <Pressable
              testID="checkout-aviso-assento-pagar"
              onPress={handlePayOpenInvoice}
              disabled={openInvoiceLoading}
              accessibilityRole="button"
              style={[z.vidro, { alignSelf: "flex-start", marginTop: 10 }, openInvoiceLoading && { opacity: 0.6 }]}
              {...marca("ck-vidro")}
            >
              {openInvoiceLoading ? <ActivityIndicator color={Colors.violet3} /> : <Text style={z.vidroText}>Pagar a mensalidade em aberto</Text>}
            </Pressable>
          )}
        </View>
      )}

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
                style={[z.cta, { marginTop: 10 }, openInvoiceLoading && { opacity: 0.6 }]}
                {...marca("ck-cta")}
              >
                {openInvoiceLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={z.ctaText}>Pagar mensalidade em aberto</Text>}
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
      <View style={z.seg} accessibilityRole="radiogroup" accessibilityLabel="Ciclo de cobrança">
        <Pressable
          testID="checkout-ciclo-mensal"
          onPress={function () { userPickedRef.current = true; setCycle("monthly"); }}
          accessibilityRole="radio"
          accessibilityState={{ selected: cycle === "monthly", checked: cycle === "monthly" }}
          style={[z.segBtn, cycle === "monthly" && z.segBtnOn]}
        >
          <Text style={[z.segTxt, cycle === "monthly" && z.segTxtOn]}>Mensal</Text>
        </Pressable>
        <Pressable
          testID="checkout-ciclo-anual"
          onPress={function () { userPickedRef.current = true; setCycle("annual"); }}
          accessibilityRole="radio"
          accessibilityState={{ selected: cycle === "annual", checked: cycle === "annual" }}
          style={[z.segBtn, cycle === "annual" && z.segBtnOn]}
        >
          <Text style={[z.segTxt, cycle === "annual" && z.segTxtOn]}>Anual</Text>
          <View style={z.tag}><Text style={z.tagTxt}>{SELO_ANUAL}</Text></View>
        </Pressable>
      </View>

      {/* Planos */}
      {restrictedByVertical && (
        <Text style={z.verticalNote}>
          O Aura Studio exige o plano Negócio ou superior: o Essencial não inclui o Studio.
        </Text>
      )}
      <Text style={[z.mono, z.lbl]}>Plano</Text>
      <View style={[z.plans, { flexDirection: largo ? "row" : "column" }]} accessibilityRole="radiogroup" accessibilityLabel="Plano">
        {visiblePlans.map(function (p) {
          return (
            <View key={p.key} style={largo ? { flex: 1, minWidth: 0 } : undefined}>
              <CartaoDePlano
                chave={p.key}
                nome={p.label}
                preco={precoDoPlano(p)}
                descricao={p.desc}
                popular={!!p.popular}
                selecionado={selectedPlan === p.key}
                anual={isAnnual}
                onPress={function () { userPickedRef.current = true; setSelectedPlan(p.key); }}
              />
            </View>
          );
        })}
      </View>

      {/* p-106: o seletor de acessos de funcionário entra aqui, entre os planos
          e a forma de pagamento (depende de backend novo; nada por ora). */}

      <Text style={[z.mono, z.lbl]}>Forma de pagamento</Text>
      <View style={z.pay} accessibilityRole="radiogroup" accessibilityLabel="Forma de pagamento">
        <Pressable
          testID="checkout-metodo-pix"
          onPress={function () { setMethod("pix"); }}
          accessibilityRole="radio"
          accessibilityState={{ selected: method === "pix", checked: method === "pix" }}
          style={[z.payBtn, method === "pix" && z.payBtnOn]}
          {...marca("ck-vidro")}
        >
          <Text style={[z.payTxt, method === "pix" && z.payTxtOn]}>Pix</Text>
        </Pressable>
        <Pressable
          testID="checkout-metodo-cartao"
          onPress={function () { setMethod("card"); }}
          accessibilityRole="radio"
          accessibilityState={{ selected: method === "card", checked: method === "card" }}
          style={[z.payBtn, method === "card" && z.payBtnOn]}
          {...marca("ck-vidro")}
        >
          <Text style={[z.payTxt, method === "card" && z.payTxtOn]}>Cartão</Text>
        </Pressable>
      </View>

      {/* Cupom de desconto / indicação */}
      <Text style={[z.mono, z.lbl]}>Cupom ou código de indicação</Text>
      {!couponApplied ? (
        <View style={z.cup}>
          <TextInput
            testID="checkout-cupom-campo"
            style={[z.cupInput, !couponInput && z.cupInputVazio]}
            value={couponInput}
            onChangeText={function (v) { setCouponInput(v.toUpperCase()); setCouponError(null); }}
            onSubmitEditing={handleApplyCoupon}
            placeholder="Digite o código"
            placeholderTextColor={Colors.ink3}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Cupom ou código de indicação"
            editable={!couponLoading}
          />
          <Pressable
            testID="checkout-cupom-aplicar"
            onPress={handleApplyCoupon}
            disabled={couponLoading || !couponInput.trim()}
            accessibilityRole="button"
            style={[z.vidro, (couponLoading || !couponInput.trim()) && { opacity: 0.55 }]}
            {...marca("ck-vidro")}
          >
            {couponLoading
              ? <ActivityIndicator size="small" color={Colors.violet3} />
              : <Text style={z.vidroText}>Aplicar</Text>}
          </Pressable>
        </View>
      ) : (
        <View style={z.cup}>
          <View style={[z.cupInput, z.cupAplicado]}>
            <Text style={z.cupCodigo} numberOfLines={1}>{couponApplied.code || couponInput}</Text>
          </View>
          <Pressable testID="checkout-cupom-remover" onPress={handleRemoveCoupon} accessibilityRole="button" style={z.vidro} {...marca("ck-vidro")}>
            <Text style={z.vidroText}>Remover</Text>
          </Pressable>
        </View>
      )}
      {couponApplied ? <Text testID="checkout-cupom-ok" style={z.cupOk}>{linhaDoCupomAplicado(couponApplied)}</Text> : null}
      {!couponApplied && couponError ? <Text testID="checkout-cupom-recusado" style={z.cupBad}>{couponError}</Text> : null}

      <ResumoDoCheckout
        rotuloDoPlano={rotuloDoPlanoNoResumo(plan.label, isAnnual)}
        valorDoPlano={valorCombinado ? totalPrice : price}
        combinado={valorCombinado}
        linhaDosAcessos={extraSeats > 0 && !valorCombinado ? { rotulo: rotuloDosAcessosExtras(extraSeats), valor: seatsPrice } : null}
        linhaDoCupom={linhaDoCupom}
        rotuloDoTotal={isFreeTrialCoupon ? "Você paga hoje" : "Total hoje"}
        total={isFreeTrialCoupon ? 0 : chargedNow}
        depois={depoisDoCupom}
      />

      {method === "pix" && !pixQr && (
        <View>
          {needsTaxId && (
            <View style={[z.formCard, { marginTop: 14 }]}>
              <View style={[z.cardField, { marginBottom: 0 }]}>
                <Text style={z.cardLabel}>CPF ou CNPJ de quem vai pagar</Text>
                <TextInput
                  style={[z.cardInput, taxIdComplete && !taxIdValid && { borderColor: Ck.warn }]}
                  value={taxId}
                  onChangeText={function (v) { setTaxId(maskCpfCnpj(v)); }}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  placeholderTextColor={Colors.ink3}
                  keyboardType="number-pad"
                  maxLength={18}
                  editable={!loading}
                />
                {taxIdComplete && !taxIdValid
                  ? <Text style={z.cupBad}>CPF ou CNPJ inválido. Confira os números.</Text>
                  : <Text style={z.taxIdHint}>Exigido pelo banco para gerar o Pix. Não tem CNPJ? Use seu CPF.</Text>}
              </View>
            </View>
          )}
          <Pressable testID="checkout-pagar-pix" onPress={handlePixSubscribe} disabled={bloqueadoPix} accessibilityRole="button" style={[z.cta, bloqueadoPix && { opacity: 0.5 }]} {...marca("ck-cta")}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={z.ctaText}>{textoDoBotaoDePagar({ metodo: "pix", valor: chargedNow, diasGratis: couponTrialDays })}</Text>}
          </Pressable>
        </View>
      )}

      {method === "pix" && pixQr && (
        <View style={z.pixCard}>
          <Image source={{ uri: "data:image/png;base64," + pixQr }} style={z.pixQrImg} resizeMode="contain" />
          <Pressable onPress={copyPix} style={z.vidro} {...marca("ck-vidro")}><Text style={z.vidroText}>Copiar código Pix</Text></Pressable>
          {polling && <ActivityIndicator color={Colors.violet3} style={{ marginTop: 12 }} />}
        </View>
      )}

      {method === "card" && (
        <View>
          <View style={[z.formCard, { marginTop: 14 }]}>
            <View style={z.cardField}>
              <Text style={z.cardLabel}>Número do cartão</Text>
              <TextInput style={z.cardInput} value={cardNumber} onChangeText={function (v) { setCardNumber(maskCard(v)); }} placeholder="0000 0000 0000 0000" placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={[z.cardField, { flex: 1 }]}>
                <Text style={z.cardLabel}>Validade</Text>
                <TextInput style={z.cardInput} value={cardExpiry} onChangeText={function (v) { setCardExpiry(maskExpiry(v)); }} placeholder="MM/AA" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={5} />
              </View>
              <View style={[z.cardField, { flex: 1 }]}>
                <Text style={z.cardLabel}>CVV</Text>
                <TextInput style={z.cardInput} value={cardCvv} onChangeText={function (v) { setCardCvv(v.replace(/\D/g, "")); }} placeholder="123" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={4} secureTextEntry />
              </View>
            </View>

            <View style={z.cardField}>
              <Text style={z.cardLabel}>Nome no cartão</Text>
              <TextInput style={z.cardInput} value={cardName} onChangeText={function (v) { setCardName(v.toUpperCase()); }} placeholder="NOME DO TITULAR" placeholderTextColor={Colors.ink3} autoCapitalize="characters" />
            </View>

            <View style={z.cardField}>
              <Text style={z.cardLabel}>CPF do titular</Text>
              <TextInput style={z.cardInput} value={cardCpf} onChangeText={function (v) { setCardCpf(maskCpf(v)); }} placeholder="000.000.000-00" placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={[z.cardField, { flex: 2 }]}>
                <Text style={z.cardLabel}>CEP do titular</Text>
                <TextInput style={z.cardInput} value={cardPostalCode} onChangeText={function (v) { setCardPostalCode(maskPostalCode(v)); }} placeholder="00000-000" placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
              </View>
              <View style={[z.cardField, { flex: 1 }]}>
                <Text style={z.cardLabel}>Número</Text>
                <TextInput style={z.cardInput} value={cardAddressNumber} onChangeText={function (v) { setCardAddressNumber(v.replace(/\D/g, "")); }} placeholder="123" placeholderTextColor={Colors.ink3} keyboardType="number-pad" />
              </View>
            </View>

            <View style={[z.cardField, { marginBottom: 0 }]}>
              <Text style={z.cardLabel}>Rua / Logradouro</Text>
              <TextInput style={z.cardInput} value={cardAddressStreet} onChangeText={setCardAddressStreet} placeholder="Rua..." placeholderTextColor={Colors.ink3} />
            </View>
          </View>

          <Pressable testID="checkout-pagar-cartao" onPress={handleCardSubscribe} disabled={bloqueadoCartao} accessibilityRole="button" style={[z.cta, bloqueadoCartao && { opacity: 0.5 }]} {...marca("ck-cta")}>
            {tokenizing ? <ActivityIndicator color="#fff" /> : <Text style={z.ctaText}>{textoDoBotaoDePagar({ metodo: "card", valor: chargedNow, diasGratis: couponTrialDays })}</Text>}
          </Pressable>
        </View>
      )}

      <View style={z.foot}>
        <Text style={z.footText}>{RODAPE_ASAAS}</Text>
        {/* 11/10/2026: o Caixa fica vivo sem assinatura; quem veio pelo aviso
            volta a vender sem assinar agora. 11/11/2026: o link diz para onde
            leva (antes, "Cancelar" voltava para a tela anterior). */}
        <Pressable testID="checkout-voltar-caixa" onPress={voltarAoCaixa} accessibilityRole="link" style={z.footLink} {...marca("ck-link")}>
          <Text style={z.footLinkText}>{VOLTAR_AO_CAIXA}</Text>
        </Pressable>
        {!hasActiveBilling && (
          <Pressable testID="checkout-sair" onPress={function () { logout(); }} accessibilityRole="button" style={[z.footLink, { minHeight: 32 }]} {...marca("ck-link")}>
            <Text style={[z.footLinkText, { color: Colors.ink3, fontWeight: "500" }]}>Sair da conta</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

var z = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  cnt: { paddingBottom: 64, alignSelf: "center", width: "100%" },
  head: { alignItems: "center", marginBottom: 18 },
  mono: { fontFamily: Fonts.mono, fontSize: 10.5, letterSpacing: 1.1, textTransform: "uppercase" as any, color: Colors.ink3 },
  lbl: { marginTop: 20, marginBottom: 8 },
  title: { fontFamily: Fonts.heading, fontSize: 34, lineHeight: 37, letterSpacing: -0.4, color: Colors.ink, textAlign: "center", marginBottom: 6, fontWeight: "400" },
  subtitle: { fontSize: 13, color: Colors.ink3, textAlign: "center" },
  aviso: { borderWidth: 1, borderColor: Ck.warnLine, backgroundColor: Ck.warnD, borderRadius: 14, padding: 14, marginBottom: 16 },
  avisoTexto: { fontSize: 13.5, lineHeight: 19, color: Colors.ink },
  seg: { flexDirection: "row", gap: 4, padding: 4, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.bg3 },
  segBtn: { flex: 1, minHeight: 44, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: "transparent", flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8 },
  segBtnOn: { backgroundColor: "#7c3aed", ...soWeb({ backgroundImage: "linear-gradient(135deg, #7c3aed, #6d28d9)", boxShadow: "0 8px 24px rgba(124,58,237,0.35), inset 0 1px 0 rgba(255,255,255,0.18)" }) },
  segTxt: { fontSize: 14, fontWeight: "700", color: Colors.ink2 },
  segTxtOn: { color: "#fff" },
  tag: { borderWidth: 1, borderColor: Ck.okMetal, backgroundColor: Ck.okD, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagTxt: { fontFamily: Fonts.mono, fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase" as any, color: Ck.ok },
  plans: { gap: 12 },
  verticalNote: { marginTop: 14, fontSize: 12, color: Colors.violet3, backgroundColor: Colors.violetD, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, fontWeight: "600", lineHeight: 16 },
  pay: { flexDirection: "row", gap: 8 },
  payBtn: { flex: 1, minHeight: 48, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },
  payBtnOn: { backgroundColor: Ck.vidro, borderColor: Ck.vidroAtivo },
  payTxt: { fontSize: 14, fontWeight: "700", color: Colors.ink2 },
  payTxtOn: { color: Colors.ink },
  cup: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  cupInput: { flex: 1, minWidth: 0, minHeight: 46, backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, paddingHorizontal: 12, paddingVertical: 11, fontFamily: Fonts.mono, fontSize: 13, letterSpacing: 0.8, color: Colors.ink },
  cupInputVazio: { fontFamily: Fonts.body, letterSpacing: 0 },
  cupAplicado: { justifyContent: "center", borderColor: Ck.okMetal },
  cupCodigo: { fontFamily: Fonts.mono, fontSize: 13, letterSpacing: 0.8, color: Colors.ink },
  cupOk: { marginTop: 8, fontSize: 12.5, lineHeight: 18, color: Ck.ok },
  cupBad: { marginTop: 8, fontSize: 12.5, lineHeight: 18, color: Ck.warn },
  vidro: { minHeight: 46, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: Ck.vidroBorda, backgroundColor: Ck.vidro, alignItems: "center", justifyContent: "center" },
  vidroText: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  cta: { width: "100%", marginTop: 14, minHeight: 56, borderRadius: 14, paddingVertical: 18, paddingHorizontal: 28, alignItems: "center", justifyContent: "center", backgroundColor: "#7c3aed" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: -0.1, textAlign: "center" },
  formCard: { backgroundColor: Colors.bg3, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Colors.border },
  taxIdHint: { fontSize: 12, color: Colors.ink3, marginTop: 6, lineHeight: 17 },
  discountCard: { backgroundColor: Colors.bg3, borderRadius: 18, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: Ck.warnLine },
  discountTitle: { fontFamily: Fonts.heading, fontSize: 20, color: Colors.ink, marginBottom: 6 },
  discountText: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  discountWarn: { marginTop: 12, color: Ck.warn, fontWeight: "600" },
  ackRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, paddingVertical: 4 },
  ackBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  ackBoxOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  ackText: { flex: 1, fontSize: 12.5, color: Colors.ink, fontWeight: "600" },
  pixCard: { marginTop: 14, backgroundColor: Colors.bg3, borderRadius: 18, padding: 24, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  pixQrImg: { width: 200, height: 200, borderRadius: 12, marginBottom: 16, backgroundColor: "#fff" },
  cardField: { marginBottom: 12 },
  cardLabel: { fontFamily: Fonts.mono, fontSize: 10.5, letterSpacing: 0.9, textTransform: "uppercase" as any, color: Colors.ink3, marginBottom: 6 },
  cardInput: { backgroundColor: Colors.bg4, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.ink },
  foot: { alignItems: "center", marginTop: 14 },
  footText: { fontSize: 12, color: Colors.ink3, textAlign: "center" },
  footLink: { alignSelf: "center", minHeight: 40, paddingHorizontal: 8, justifyContent: "center" },
  footLinkText: { fontSize: 13, color: Colors.violet4, fontWeight: "600" },
  successCard: { alignItems: "center", gap: 12, padding: 40 },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Ck.okD, borderWidth: 1, borderColor: Ck.okMetal, alignItems: "center", justifyContent: "center" },
  successTitle: { fontFamily: Fonts.heading, fontSize: 30, color: Colors.ink, textAlign: "center" },
  successSub: { fontSize: 14, color: Colors.ink3 },
  successMsg: { fontSize: 14, color: Colors.ink, textAlign: "center", lineHeight: 20, maxWidth: 420 },
});
