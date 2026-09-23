import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pdvApi } from "@/services/api";
import type { PdvSaleResponse } from "@/services/salesApi";
import type { LotAllocation } from "@/services/matconApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { textoDoErro } from "@/components/screens/pdv/erroNoCaixa";
import {
  CARTAO_DESLIGADO, contaComOServidor, ehCartao, editarPrecoNoDividido, editarPrecoProporcional, fraseDaConta, linhasNoMetodo, linhasRateadas,
  precoNoCartaoDoItem, r2, resolverDividido, statusDoDividido, totalComoNoServidor,
  type ConfigDoCartao, type ContaDaVenda, type DescontosDaVenda, type LinhaDoPayload, type PrecosDaLinha, type RegraDoCupom,
} from "@/utils/precoNoCartao";

// 22/09/2026 (Matcon M0): o item carrega a unidade de venda do produto e,
// quando existe, a unidade de compra + o fator (caixa de 2,32 m²). Tudo
// opcional: produto sem unidade cadastrada, ou loja sem o toggle, continua
// exatamente como antes — quem decide o controle do carrinho é o CartPanel,
// aqui só viajam os dados. `qty` sempre foi number e continua number: nenhum
// parseInt/Math.round no caminho até o payload da venda.
export type CartItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  listPrice?: number;
  unit?: string;
  purchaseUnit?: string | null;
  purchaseFactor?: number | null;
  // 22/09/2026 (preço no cartão, docs/mockups/preco-no-cartao.html tela 3).
  // Só existem com a opção da loja ligada. No estado do carrinho `price` e
  // `listPrice` são SEMPRE os do dinheiro e estes dois, os do cartão —
  // guardados no momento em que o item entra, como o preço de hoje. O
  // `cart` que o hook devolve é a VISTA do chip escolhido: `price`/
  // `listPrice` do método, e os quatro preços em cash*/card*.
  cardPrice?: number;
  cardListPrice?: number;
  cashPrice?: number;
  cashListPrice?: number;
};

// Multi-pagamento: cada entrada vira uma `detPag` no SEFAZ NFC-e (tPag = method, vPag = value).
// O backend mapeia method PDV → tPag SEFAZ (dinheiro→01, cartao→03, debito→04, pix→17,
// crediario→05 — Crédito Loja; F4 correcao 29/05/2026).
export type PaymentEntry = {
  method: string;        // chave do PDV: "dinheiro" | "pix" | "debito" | "cartao" | "crediario"
  value: number;         // valor em R$
  change?: number;       // troco (só faz sentido em dinheiro)
  // 22/09/2026 (preço no cartão, só com a opção ligada): a linha "o que
  // falta" — se preenche sozinha pela regra do dividido até alguém digitar
  // nela. Nunca vai no POST.
  auto?: boolean;
};

export type SaleResult = {
  id: string;
  // 01/09/2026: sequencial legivel por empresa que o backend passou a devolver
  // em body.sale.sale_number. SO EXIBICAO (recibo) — `id` continua sendo a
  // chave de toda rota. null/undefined em venda antiga ou fallback offline.
  saleNumber?: number | null;
  total: number;
  payment: string;       // método "primário" — primeira entrada quando split, ou o único quando single
  payments?: PaymentEntry[]; // populado quando splitMode foi usado (length >= 1)
  items: CartItem[];
  date: string;
  // 31/08/2026 (OS): id do cliente vinculado. SaleComplete usa pra buscar
  // as OS "pronta" dele e oferecer entrega+vinculo na tela de sucesso.
  customerId?: string;
  customerName?: string;
  customerPhone?: string;   // pra wa.me share da NFC-e
  employeeName?: string;
  sellerName?: string;
  couponCode?: string;
  couponDiscount?: number;
  manualDiscount?: number;
  // QA 23/09/2026: a conta que a tela final mostra, do jeito que o servidor
  // gravou (subtotal − discount = total). Ausentes em venda antiga: a tela
  // cai na soma dos itens.
  subtotal?: number;
  discount?: number;
  cpfNaNota?: string;       // CPF do consumidor (opcional, pra NFC-e)
};

// Crediário (F1 29/05/2026): venda fica como "a receber" no ledger do cliente
// (customer_credit_transactions debit + transactions A Receber).
// OBRIGATÓRIO: customer_id deve estar preenchido quando payment=crediario.
// Backend retorna 422 CREDIARIO_REQUIRES_CUSTOMER caso contrário — o onError
// abaixo trata esse caso com mensagem acionável para o lojista.
export const PAYMENTS = [
  { key: "dinheiro",  label: "Dinheiro" },
  { key: "pix",       label: "PIX" },
  { key: "debito",    label: "Débito" },
  { key: "cartao",    label: "Crédito" },
  { key: "crediario", label: "Crediário" },
];

const MAX_DISCOUNT_PCT = 50;

// FIX 06/05/2026: pid estava retornando cartKey inteiro (incluía __variantId),
// causando "invalid input syntax for type uuid" no backend ao finalizar split.
function decomposeCartKey(cartKey: string): { pid: string; vid: string | null } {
  var idx = cartKey.indexOf("__");
  if (idx < 0) return { pid: cartKey, vid: null };
  return { pid: cartKey.slice(0, idx), vid: cartKey.slice(idx + 2) };
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// 22/09/2026 (preço no cartão): o hook recebe a opção da loja
// (utils/precoNoCartao.lerConfigDoCartao). Sem ela — ou com ela desligada —
// todo o caminho é o de antes: nenhum item ganha preço no cartão, a vista é
// o próprio estado e o payload sai idêntico.
export function useCart(cardCfg: ConfigDoCartao = CARTAO_DESLIGADO) {
  const cartaoOn = cardCfg.enabled === true;
  // 22/09/2026 (Matcon M1): id do orçamento que montou este carrinho
  // (Caixa aberto com ?quote=). Vai como quote_id no POST da venda — o
  // backend grava converted_sale_id e cria a 1ª entrega; sem isso o
  // pedido nasceria duas vezes (docs/CONTRACT_MATCON.md, convert). Zera
  // junto com o carrinho.
  var [quoteId, setQuoteId] = useState<string | null>(null);

  // 22/09/2026 (Matcon M3): id do profissional "indicado por" desta venda
  // (chip do Caixa — IndicadoPorChip via useMatconReferral). Vai como
  // referred_by_professional_id no POST da venda; o backend credita
  // floor(total/100) × matcon_points_per_100 no profissional
  // (docs/CONTRACT_MATCON.md, M3). Zera junto com o carrinho, mesmo padrão
  // de quoteId acima.
  var [referredProfessionalId, setReferredProfessionalId] = useState<string | null>(null);

  // 22/09/2026 (Matcon M4): de quais LOTES sai cada item, por productId do
  // carrinho (a mesma chave do setQty/removeItem, com o sufixo da variante).
  // Quem calcula é o carrinho — CartPanel/LoteDoItem, que conhece os saldos;
  // aqui só viajam os dados até `items[].lot_allocations` no POST da venda.
  // Item sem alocação NÃO manda o campo: o backend baixa do lote mais antigo
  // (FIFO), que é o default do contrato. Zera junto com o carrinho.
  var [lotAllocations, setLotAllocationsMap] = useState<Record<string, LotAllocation[]>>({});

  function mesmasAlocacoes(a: LotAllocation[] | undefined, b: LotAllocation[]): boolean {
    if (!a) return b.length === 0;
    if (a.length !== b.length) return false;
    return a.every(function (x, i) { return x.lot_id === b[i].lot_id && x.quantity === b[i].quantity; });
  }

  // Idempotente de propósito: o CartPanel reporta a cada recálculo (mudou a
  // quantidade, o lote preferido ou o saldo), e sem esta comparação o estado
  // novo a cada render viraria loop de render no item.
  function setLotAllocations(productId: string, allocations: LotAllocation[]) {
    var next = allocations || [];
    setLotAllocationsMap(function (prev) {
      if (mesmasAlocacoes(prev[productId], next)) return prev;
      if (next.length === 0) {
        if (!prev[productId]) return prev;
        var limpo = { ...prev };
        delete limpo[productId];
        return limpo;
      }
      var atualizado = { ...prev };
      atualizado[productId] = next;
      return atualizado;
    });
  }

  function clearLotAllocations() {
    setLotAllocationsMap(function (prev) { return Object.keys(prev).length === 0 ? prev : {}; });
  }
  const { company, isDemo } = useAuthStore();
  const qc = useQueryClient();
  const companyId = company?.id;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState("pix");
  const [lastSale, setLastSale] = useState<SaleResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | null>(null);
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string | null>(null);

  // Seller name (free text) — used by all plans
  const [sellerName, setSellerName] = useState<string>("");

  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number } | null>(null);
  // Preço no cartão: a REGRA do cupom (percent/fixed + valor), vinda do
  // validate. Com ela o cupom em % vale sobre o preço do método escolhido;
  // sem ela (ou opção desligada) vale o `discount` de sempre, fixo.
  const [couponRule, setCouponRule] = useState<(RegraDoCupom & { code: string }) | null>(null);

  const [discountType, setDiscountType] = useState<"%" | "R$">("%");
  const [discountValue, setDiscountValue] = useState("");

  // CPF na nota (NFC-e) — caixa digita ou cliente fala. Independente de
  // selectedCustomer, mas o front pode pre-preencher quando aplicavel.
  const [cpfNaNota, setCpfNaNota] = useState<string>("");

  // ── Multi-pagamento ─────────────────────────────────────────
  // splitMode=false → comportamento legado, único `payment` chip
  // splitMode=true → soma dos splitPayments deve fechar com totalAfterCoupon
  const [splitMode, setSplitMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState<PaymentEntry[]>([]);

  const saleMutation = useMutation({
    mutationFn: (body: any) => pdvApi.createSale(companyId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      qc.invalidateQueries({ queryKey: ["dashboard", companyId] });
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      // 01/09/2026: invalida o prefixo inteiro (nao so ["customers", companyId]).
      // Com ?sort=recent a venda muda a ORDEM da lista, e o modo consolidado
      // guarda a lista sob ["customers","me"] — que a chave antiga nao alcancava.
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["employees", companyId] });
      // Crediário: invalida saldos pra UI de /clientes refletir o novo debit.
      qc.invalidateQueries({ queryKey: ["credit-balances", companyId] });
      // Fase 1: invalida credit-installments pra dashboard de inadimplência
      qc.invalidateQueries({ queryKey: ["credit-installments", companyId] });
      qc.invalidateQueries({ queryKey: ["credit-profile", companyId] });
    },
  });

  // ── Preço no cartão: a vista do chip ─────────────────────────
  // Crediário, dinheiro e PIX = preço do dinheiro; débito e crédito = preço
  // no cartão. Trocar de chip NÃO mexe no estado do carrinho (nem no cupom):
  // só escolhe qual dos dois preços guardados vale.
  const noCartao = cartaoOn && !splitMode && ehCartao(payment);
  const cartView: CartItem[] = useMemo(() => {
    if (!cartaoOn) return cart;
    return cart.map(function(i) {
      const card = i.cardPrice ?? i.price;
      const cardList = i.cardListPrice ?? card;
      return {
        ...i,
        cashPrice: i.price, cashListPrice: i.listPrice,
        cardPrice: card, cardListPrice: cardList,
        price: noCartao ? card : i.price,
        listPrice: noCartao ? cardList : i.listPrice,
      };
    });
  }, [cart, cartaoOn, noCartao]);

  const total = cartView.reduce((s, i) => s + i.price * i.qty, 0);
  const itemCount = cart.reduce((s, i) => s + i.qty, 0);

  const parsedDiscount = parseFloat(discountValue.replace(",", ".")) || 0;
  let manualDiscountAmount = 0;
  if (parsedDiscount > 0 && total > 0) {
    if (discountType === "%") {
      const cappedPct = Math.min(parsedDiscount, MAX_DISCOUNT_PCT);
      manualDiscountAmount = Math.round(total * cappedPct / 100 * 100) / 100;
    } else {
      const maxAbsolute = total * MAX_DISCOUNT_PCT / 100;
      manualDiscountAmount = Math.min(parsedDiscount, maxAbsolute);
    }
  }

  let couponDiscount = couponApplied?.discount || 0;
  let totalAfterCoupon = Math.max(0, total - manualDiscountAmount - couponDiscount);

  // Com a opção ligada, os dois totais (dinheiro e cartão) saem do MESMO
  // cálculo do POST /pdv/sale (totalComoNoServidor): o que a tela mostra é
  // o que o backend grava. Cupom e desconto em % valem sobre o preço do
  // método; desconto em R$ tira o mesmo valor dos dois (teto de 50% pelo
  // subtotal no dinheiro). O mínimo do cupom foi conferido pelo total no
  // dinheiro (usePdvState.handleValidateCoupon).
  const precosDasLinhas: PrecosDaLinha[] = cartaoOn
    ? cart.map(function(i) {
        const card = i.cardPrice ?? i.price;
        return { qty: i.qty, cash: i.price, cashList: i.listPrice ?? i.price, card: card, cardList: i.cardListPrice ?? card };
      })
    : [];
  let descontosDaVenda: DescontosDaVenda = {};
  // A conta do método escolhido (opção ligada, fora do dividido).
  let simDoMetodo: ContaDaVenda | null = null;
  let precoNoCartao: {
    totalDinheiro: number; totalCartao: number;
    subtotalDinheiro: number; subtotalCartao: number;
    descontoDinheiro: number; descontoCartao: number;
    noCartao: boolean;
  } | null = null;
  if (cartaoOn) {
    const linhasD = linhasNoMetodo(precosDasLinhas, false);
    const linhasK = linhasNoMetodo(precosDasLinhas, true);
    const subtotalD = totalComoNoServidor(linhasD, {}).subtotal;
    const cupom: RegraDoCupom | null = couponApplied
      ? (couponRule && couponRule.code === couponApplied.code
          ? { tipo: couponRule.tipo, valor: couponRule.valor }
          : { tipo: "fixed", valor: couponApplied.discount || 0 })
      : null;
    descontosDaVenda = { cupom: cupom };
    if (parsedDiscount > 0 && subtotalD > 0) {
      if (discountType === "%") descontosDaVenda.manualPct = Math.min(parsedDiscount, MAX_DISCOUNT_PCT);
      else descontosDaVenda.manualValor = r2(Math.min(parsedDiscount, subtotalD * MAX_DISCOUNT_PCT / 100));
    }
    const simD = totalComoNoServidor(linhasD, descontosDaVenda);
    const simK = totalComoNoServidor(linhasK, descontosDaVenda);
    const sim = noCartao ? simK : simD;
    simDoMetodo = sim;
    manualDiscountAmount = sim.manual;
    couponDiscount = sim.cupom;
    totalAfterCoupon = sim.total;
    precoNoCartao = {
      totalDinheiro: simD.total, totalCartao: simK.total,
      subtotalDinheiro: simD.subtotal, subtotalCartao: simK.subtotal,
      descontoDinheiro: simD.desconto, descontoCartao: simK.desconto,
      noCartao: noCartao,
    };
  }

  // Splits — derivados puros
  const splitTotalLegado = useMemo(
    () => round2(splitPayments.reduce((s, p) => s + (Number(p.value) || 0), 0)),
    [splitPayments],
  );
  // Restante = totalAfterCoupon − soma dos splits. Pode ser negativo (overpay).
  const splitRemainingLegado = useMemo(
    () => round2(totalAfterCoupon - splitTotalLegado),
    [totalAfterCoupon, splitTotalLegado],
  );

  // ── Preço no cartão: a regra do dividido (tela 4 do mockup) ──────
  // base = total no dinheiro; fator = total no cartão ÷ total no dinheiro
  // desta venda. Dinheiro/PIX/crediário abatem da base pelo valor, cartão
  // abate valor ÷ fator, e a linha "auto" é o que falta. Recalcula sozinho
  // quando o carrinho muda (as linhas digitadas ficam, a "auto" acompanha).
  // Desligada: null, e o dividido é o de sempre (valores digitados).
  const dividido = cartaoOn && precoNoCartao
    ? resolverDividido(splitPayments, precoNoCartao.totalDinheiro, precoNoCartao.totalCartao)
    : null;
  const splitTotal = dividido ? dividido.total : splitTotalLegado;
  const splitRemaining = dividido ? dividido.falta : splitRemainingLegado;
  // Tolerância: 1 centavo (mesma do backend validatePayments).
  const splitIsBalanced = dividido ? dividido.equilibrado : Math.abs(splitRemaining) < 0.01;
  const splitPaymentsVista: PaymentEntry[] = dividido ? dividido.entradas : splitPayments;
  // O que a venda cobra: no dividido com preço no cartão, a soma dos
  // pagamentos (+ o que falta, no dinheiro, enquanto não fecha).
  const totalDaVenda = dividido && splitMode ? r2(dividido.total + Math.max(0, dividido.falta)) : totalAfterCoupon;
  const splitNote = dividido && splitMode && precoNoCartao && splitPayments.length > 0
    ? fraseDaConta(splitPayments, precoNoCartao.totalDinheiro, dividido)
    : null;
  const splitStatus = dividido && splitMode ? statusDoDividido(dividido) : null;

  // ── Preço no cartão: a vista do DIVIDIDO (QA 23/09/2026) ─────────
  // O topo mostrava o total da venda dividida com o desconto do dinheiro, e
  // as linhas voltavam ao preço do dinheiro. Agora o carrinho mostra as
  // linhas como vão no POST (acréscimo da parte no cartão rateado no preço
  // de cada item) e o desconto/subtotal saem delas — subtotal − desconto =
  // o total do topo. Sobrando pagamento, a vista para no preço do cartão
  // (o status já avisa para diminuir). Desligada ou fora do dividido: nada.
  let linhasDaVista: LinhaDoPayload[] | null = null;
  let subtotalDaVista: number | null = null;
  if (dividido && splitMode && precoNoCartao && cart.length > 0) {
    const C = precoNoCartao.totalDinheiro;
    const K = precoNoCartao.totalCartao;
    const alvoVista = Math.min(Math.max(totalDaVenda, Math.min(C, K)), Math.max(C, K));
    linhasDaVista = linhasRateadas(precosDasLinhas, alvoVista, descontosDaVenda);
    const simDaVista = totalComoNoServidor(linhasDaVista, descontosDaVenda);
    couponDiscount = simDaVista.cupom;
    manualDiscountAmount = simDaVista.manual;
    subtotalDaVista = simDaVista.subtotal;
  }
  const vistaDoCarrinho: CartItem[] = linhasDaVista
    ? cartView.map(function(i, idx) {
        const lp = linhasDaVista![idx];
        return lp && i.qty > 0 ? { ...i, price: lp.totalDaLinha / i.qty, listPrice: lp.unit_price } : i;
      })
    : cartView;

  function addSplitPayment(entry?: Partial<PaymentEntry>) {
    if (cartaoOn && precoNoCartao) {
      // As linhas que já estão lá viram valor fixo (o que mostravam) e a
      // nova é "o que falta" — a regra se preenche sozinha.
      const C = precoNoCartao.totalDinheiro;
      const K = precoNoCartao.totalCartao;
      setSplitPayments(prev => {
        const fixas = resolverDividido(prev, C, K).entradas.map(p => ({ method: p.method, value: round2(p.value), change: p.change }));
        const method = entry?.method || (prev.length === 0 ? payment : "cartao");
        if (entry?.value !== undefined) return [...fixas, { method: method, value: round2(entry.value), change: entry.change }];
        return [...fixas, { method: method, value: 0, auto: true }];
      });
      return;
    }
    setSplitPayments(prev => [
      ...prev,
      {
        method: entry?.method || (prev.length === 0 ? payment : "dinheiro"),
        // Se nada informado, sugere o restante (até 0).
        value: entry?.value !== undefined
          ? round2(entry.value)
          : round2(Math.max(0, totalAfterCoupon - prev.reduce((s, p) => s + p.value, 0))),
        change: entry?.change,
      },
    ]);
  }

  function updateSplitPayment(idx: number, patch: Partial<PaymentEntry>) {
    setSplitPayments(prev => prev.map((p, i) => i === idx ? {
      ...p,
      // Preço no cartão: digitar o valor fixa a linha (deixa de ser "o que falta").
      ...(cartaoOn && patch.value !== undefined ? { auto: false } : {}),
      ...(patch.method !== undefined ? { method: patch.method } : {}),
      ...(patch.value !== undefined ? { value: round2(patch.value) } : {}),
      ...(patch.change !== undefined ? { change: round2(patch.change) } : {}),
    } : p));
  }

  function removeSplitPayment(idx: number) {
    setSplitPayments(prev => {
      const resto = prev.filter((_, i) => i !== idx);
      // Preço no cartão: saiu a linha "o que falta" — a última assume.
      if (cartaoOn && prev[idx]?.auto && resto.length > 0 && !resto.some(p => p.auto)) {
        return resto.map((p, i) => i === resto.length - 1 ? { ...p, auto: true } : p);
      }
      return resto;
    });
  }

  function clearSplitPayments() {
    setSplitPayments([]);
  }

  function toggleSplitMode() {
    setSplitMode(prev => {
      const next = !prev;
      if (next) {
        // Inicia com 1 entrada cobrindo total no chip atual. Com preço no
        // cartão ela é "o que falta" (se preenche pelo método escolhido).
        setSplitPayments(cartaoOn
          ? [{ method: payment, value: 0, auto: true }]
          : [{ method: payment, value: round2(totalAfterCoupon) }]);
      } else {
        setSplitPayments([]);
      }
      return next;
    });
  }

  // ── Cart ops ────────────────────────────────────────────────

  // 22/09/2026 (Matcon M0): os 3 campos novos do produto são opcionais no
  // tipo do parâmetro — quem chama com o objeto de hoje (o scanner monta um
  // `{id,name,price}` na mão) continua compilando e o item nasce sem unidade,
  // ou seja, com o stepper de sempre.
  // 22/09/2026 (preço no cartão): `cardPrice` é o products.card_price do
  // catálogo (null = segue o %) e `refPrice` o preço do catálogo ao qual ele
  // se refere — quando o preço que entra é outro (variante com preço
  // próprio, linha de orçamento), o do cartão vai na mesma proporção.
  function addToCart(
    product: {
      id: string; name: string; price: number; unit?: string; purchaseUnit?: string | null; purchaseFactor?: number | null;
      cardPrice?: number | null; refPrice?: number;
    },
    variant?: { id: string; label: string; price?: number },
  ) {
    setLastSale(null);
    var cartKey = variant ? product.id + "__" + variant.id : product.id;
    var displayName = variant ? product.name + " (" + variant.label + ")" : product.name;
    var effectivePrice = (variant?.price != null && variant.price > 0) ? variant.price : product.price;
    var cardPrice = cartaoOn
      ? precoNoCartaoDoItem(effectivePrice, { price: product.refPrice ?? product.price, cardPrice: product.cardPrice }, cardCfg)
      : null;

    setCart(function(prev) {
      var existing = prev.find(function(i) { return i.productId === cartKey; });
      if (existing) return prev.map(function(i) { return i.productId === cartKey ? { ...i, qty: i.qty + 1 } : i; });
      return [...prev, {
        productId: cartKey, name: displayName, price: effectivePrice, qty: 1, listPrice: effectivePrice,
        unit: product.unit || undefined,
        purchaseUnit: product.purchaseUnit ?? undefined,
        purchaseFactor: product.purchaseFactor ?? undefined,
        ...(cardPrice != null ? { cardPrice: cardPrice, cardListPrice: cardPrice } : {}),
      }];
    });
    if (couponApplied) setCouponApplied(null);
  }

  // 22/09/2026 (Matcon M0): `qty` pode chegar fracionada (12,5 m²) vinda do
  // campo decimal do carrinho. Nada aqui trunca — o valor entra no item como
  // veio e segue assim até `quantity` no POST /pdv/sale. Zero (ou lixo) ainda
  // remove o item, que é a regra que o stepper já usava.
  function setQty(productId: string, qty: number) {
    if (!isFinite(qty) || qty <= 0) { setCart(function(prev) { return prev.filter(function(i) { return i.productId !== productId; }); }); return; }
    setCart(function(prev) { return prev.map(function(i) { return i.productId === productId ? { ...i, qty: qty } : i; }); });
    if (couponApplied) setCouponApplied(null);
  }

  // FIX 05/05/2026: `-` no qty=1 remove o item (fluxo natural do PDV).
  // Antes mantinha em 1 e o usuário precisava usar a lixeira separada.
  function updateQty(productId: string, delta: number) {
    setCart(function(prev) {
      // Calcula primeiro pra decidir se filtra (remove) ou mapeia (atualiza)
      var item = prev.find(function(i) { return i.productId === productId; });
      if (!item) return prev;
      var newQty = item.qty + delta;
      if (newQty <= 0) {
        return prev.filter(function(i) { return i.productId !== productId; });
      }
      return prev.map(function(i) { return i.productId === productId ? { ...i, qty: newQty } : i; });
    });
    if (couponApplied) setCouponApplied(null);
  }

  // Mai/2026: alteração livre do preço unitário do item no carrinho.
  // Caixa pode descontar/promover sem cap. Limpa cupom (precisa revalidar).
  // Round 2 casas pra evitar artefatos de digitação tipo 99.99000001.
  function setUnitPrice(productId: string, price: number) {
    if (!isFinite(price) || price < 0) return;
    const rounded = Math.round(price * 100) / 100;
    // Dividido com preço no cartão: a linha mostra o preço rateado. Editar
    // leva dinheiro e cartão na mesma proporção do que foi digitado sobre o
    // que estava na tela. Sair do campo sem mudar (o rateado tem mais casas
    // que o campo) não mexe em nada.
    const mostrado = linhasDaVista ? vistaDoCarrinho.find(function(i) { return i.productId === productId; }) : undefined;
    if (mostrado) {
      if (Math.abs(rounded - r2(mostrado.price)) < 0.005) return;
      setCart(function(prev) {
        return prev.map(function(i) {
          if (i.productId !== productId) return i;
          const novo = editarPrecoNoDividido({ cash: i.price, card: i.cardPrice ?? i.price }, mostrado.price, rounded);
          return { ...i, price: novo.cash, cardPrice: novo.card };
        });
      });
      if (couponApplied) setCouponApplied(null);
      return;
    }
    setCart(function(prev) {
      return prev.map(function(i) {
        if (i.productId !== productId) return i;
        if (!cartaoOn) return { ...i, price: rounded };
        // Preço no cartão (decisão 5 do Caio): o lápis mexe no preço do
        // método escolhido e o outro vai junto, na mesma proporção.
        const novo = editarPrecoProporcional({ cash: i.price, card: i.cardPrice ?? i.price }, rounded, noCartao);
        return { ...i, price: novo.cash, cardPrice: novo.card };
      });
    });
    if (couponApplied) setCouponApplied(null);
  }

  function removeItem(productId: string) {
    setCart(function(prev) { return prev.filter(function(i) { return i.productId !== productId; }); });
    setLotAllocations(productId, []);
    if (couponApplied) setCouponApplied(null);
  }

  function selectCustomer(id: string | null, name: string | null, phone?: string | null) {
    setSelectedCustomerId(id);
    setSelectedCustomerName(name);
    setSelectedCustomerPhone(phone || null);
  }
  function selectEmployee(id: string | null, name: string | null) { setSelectedEmployeeId(id); setSelectedEmployeeName(name); }
  function clearCoupon() { setCouponCode(""); setCouponApplied(null); setCouponRule(null); }
  function clearDiscount() { setDiscountValue(""); }

  /**
   * finalizeSale
   * @param saleDate  - data retroativa opcional (YYYY-MM-DD)
   * @param crediario - parâmetros de parcelamento quando payment=crediario e installments>1.
   *                    Passados diretamente no body do POST /pdv/sale para o backend
   *                    criar as credit_installments inline (F1 creditLedger, 29/05/2026).
   */
  function finalizeSale(
    saleDate?: string,
    crediario?: { installments: number; first_due_date: string },
  ) {
    if (cart.length === 0 || isProcessing) return;
    // Bloqueio só quando split está ativo e não fecha
    if (splitMode && !splitIsBalanced) {
      toast.error(splitRemaining > 0
        ? `Faltam R$ ${splitRemaining.toFixed(2)} pra fechar`
        : `Sobrando R$ ${Math.abs(splitRemaining).toFixed(2)} nos pagamentos`);
      return;
    }

    setIsProcessing(true);

    // Vista do chip: com a opção desligada é o próprio `cart` (mesmo payload
    // de sempre); ligada, `price`/`listPrice` já são os do método escolhido.
    var cartSnapshot = [...cartView];
    var effectiveSellerName = sellerName.trim() || selectedEmployeeName || null;
    var cleanCpf = cpfNaNota.replace(/\D/g, "");

    // Pagamento "primário" (o que vai no campo singular tanto na sale quanto no resumo)
    // Preço no cartão: os pagamentos são os RESOLVIDOS (a linha "o que
    // falta" com o valor calculado); linha zerada não vai no POST.
    var entradasDaVenda: PaymentEntry[] = splitPaymentsVista;
    if (dividido) {
      var comValor = splitPaymentsVista.filter(function(p) { return (Number(p.value) || 0) > 0; });
      entradasDaVenda = comValor.length > 0 ? comValor : splitPaymentsVista.slice(0, 1);
    }
    var primaryPayment = splitMode && entradasDaVenda.length > 0 ? entradasDaVenda[0].method : payment;
    var paymentsSnapshot: PaymentEntry[] | undefined = splitMode && entradasDaVenda.length > 0
      ? entradasDaVenda.map(p => ({ method: p.method, value: round2(p.value), change: p.change ? round2(p.change) : undefined }))
      : undefined;

    // Preço no cartão + dividido: o acréscimo da parte no cartão é rateado
    // no preço de cada item (resíduo de centavos na última linha), e a soma
    // das linhas fecha com a soma dos pagamentos — é esse preço que vai na
    // nota (SaleComplete/NfceActions usam items[].price) e que a troca
    // devolve. Venda toda num método = exatamente o preço daquele método.
    var linhasDoPayload: LinhaDoPayload[] | null = null;
    if (dividido && paymentsSnapshot) {
      var alvo = round2(paymentsSnapshot.reduce(function(s, p) { return s + p.value; }, 0));
      linhasDoPayload = linhasRateadas(precosDasLinhas, alvo, descontosDaVenda);
      var rateadas = linhasDoPayload;
      cartSnapshot = cartSnapshot.map(function(i, idx) {
        var lp = rateadas[idx];
        return lp ? { ...i, price: i.qty > 0 ? lp.totalDaLinha / i.qty : i.price, listPrice: lp.unit_price } : i;
      });
    }

    var saleData: any = {
      items: cartSnapshot.map(function(i, idx) {
        var decomposed = decomposeCartKey(i.productId);
        // Lapis do PDV: mantem o preco de tabela do estoque (listPrice) como
        // unit_price e lanca a diferenca como desconto do item (total da linha).
        // O backend desconta item_discount do total da linha.
        var listPrice = (i.listPrice != null && i.listPrice > 0) ? i.listPrice : i.price;
        var unitOriginal = Math.max(listPrice, i.price);
        var itemDiscount = round2(Math.max(0, unitOriginal - i.price) * i.qty);
        // Matcon M4: soma das alocações = quantity do item (o rateio é
        // feito em cima da quantidade atual). Sem alocação o campo nem vai
        // no JSON, e o backend baixa FIFO.
        var allocs = lotAllocations[i.productId] || [];
        if (linhasDoPayload && linhasDoPayload[idx]) {
          var lp = linhasDoPayload[idx];
          return {
            product_id: decomposed.pid,
            variant_id: decomposed.vid || undefined,
            quantity: i.qty,
            unit_price: lp.unit_price,
            item_discount: lp.item_discount,
            product_name_snapshot: i.name,
            lot_allocations: allocs.length > 0
              ? allocs.map(function(a) { return { lot_id: a.lot_id, quantity: a.quantity }; })
              : undefined,
          };
        }
        return {
          product_id: decomposed.pid,
          variant_id: decomposed.vid || undefined,
          quantity: i.qty,
          unit_price: unitOriginal,
          item_discount: itemDiscount > 0 ? itemDiscount : undefined,
          product_name_snapshot: i.name,
          lot_allocations: allocs.length > 0
            ? allocs.map(function(a) { return { lot_id: a.lot_id, quantity: a.quantity }; })
            : undefined,
        };
      }),
      payment_method: primaryPayment,
      customer_id: selectedCustomerId || undefined,
      employee_id: selectedEmployeeId || undefined,
      seller_name: effectiveSellerName || undefined,
      quote_id: quoteId || undefined,
      referred_by_professional_id: referredProfessionalId || undefined,
    };

    if (paymentsSnapshot) saleData.payments = paymentsSnapshot;
    if (saleDate) saleData.sale_date = saleDate;
    if (couponApplied?.code) saleData.coupon_code = couponApplied.code;

    if (cartaoOn) {
      // Mesmos números que o totalComoNoServidor usou na tela.
      if (descontosDaVenda.manualValor && descontosDaVenda.manualValor > 0) saleData.discount_amount = descontosDaVenda.manualValor;
      else if (descontosDaVenda.manualPct && descontosDaVenda.manualPct > 0) saleData.discount_pct = descontosDaVenda.manualPct;
    } else if (manualDiscountAmount > 0) {
      if (discountType === "%") {
        saleData.discount_pct = Math.min(parsedDiscount, MAX_DISCOUNT_PCT);
      } else {
        saleData.discount_amount = manualDiscountAmount;
      }
    }

    // Crediário parcelado: adiciona installments no body da venda.
    // O backend (F1 creditLedger) cria as credit_installments DENTRO da transacao principal.
    // Crediario parcelado: anexa installments quando ha QUALQUER parcela no
    // credito -- single (primaryPayment) OU split (uma das entradas e crediario).
    // O backend (creditLedger) cria as credit_installments sobre o valor do
    // crediario (calcCreditAmount), nao sobre o total da venda.
    var hasCreditPortion = primaryPayment === "crediario" ||
      (!!paymentsSnapshot && paymentsSnapshot.some(function(p){ return p.method === "crediario" && p.value > 0; }));
    if (crediario && crediario.installments > 1 && hasCreditPortion) {
      saleData.installments = crediario.installments;
      saleData.first_due_date = crediario.first_due_date;
    }

    // A conta da tela final. Dividido: a das linhas rateadas que vão no
    // POST (o cupom em % recalculado sobre elas, como o servidor faz);
    // opção ligada num método só: a do método; desligada: a de sempre.
    var contaLocal: ContaDaVenda;
    if (linhasDoPayload) {
      contaLocal = totalComoNoServidor(linhasDoPayload, descontosDaVenda);
    } else if (simDoMetodo) {
      contaLocal = simDoMetodo;
    } else {
      var descontoDeSempre = round2(Math.max(0, total - totalAfterCoupon));
      var manualDeSempre = round2(Math.min(manualDiscountAmount || 0, descontoDeSempre));
      contaLocal = {
        subtotal: round2(total),
        cupom: round2(descontoDeSempre - manualDeSempre),
        manual: manualDeSempre,
        desconto: descontoDeSempre,
        total: totalAfterCoupon,
      };
    }

    function buildLastSale(saleId: string, saleNumber?: number | null, venda?: any): SaleResult {
      // Com a resposta do servidor, vale o que ele gravou.
      var conta = contaComOServidor(contaLocal, venda);
      return {
        id: String(saleId),
        saleNumber: saleNumber ?? null,
        total: conta.total,
        payment: primaryPayment,
        payments: paymentsSnapshot,
        items: cartSnapshot,
        date: new Date().toLocaleString("pt-BR"),
        customerId: selectedCustomerId || undefined,
        customerName: selectedCustomerName || undefined,
        customerPhone: selectedCustomerPhone || undefined,
        employeeName: selectedEmployeeName || undefined,
        sellerName: effectiveSellerName || undefined,
        couponCode: couponApplied?.code,
        couponDiscount: conta.cupom > 0 ? conta.cupom : undefined,
        manualDiscount: conta.manual > 0 ? conta.manual : undefined,
        subtotal: conta.subtotal,
        discount: conta.desconto,
        cpfNaNota: cleanCpf || undefined,
      };
    }

    if (companyId && !isDemo) {
      saleMutation.mutate(saleData, {
        onSuccess: function(raw: any) {
          var res = raw as PdvSaleResponse;
          var saleId = res?.sale?.id || (res as any)?.id || Date.now().toString(36).toUpperCase().slice(-6);
          // sale_number pode vir null (venda de ambiente nao migrado) — o
          // recibo cai no UUID encurtado nesse caso.
          var saleNumber = typeof res?.sale?.sale_number === "number" ? res.sale.sale_number : null;
          setLastSale(buildLastSale(String(saleId), saleNumber, res?.sale));
          setCart([]); setQuoteId(null); setReferredProfessionalId(null); clearLotAllocations(); toast.success("Venda registrada!"); setIsProcessing(false); clearCoupon(); clearDiscount();
          setSellerName("");
          setCpfNaNota("");
          // QA 23/09/2026 (decisão do Caio): a próxima venda começa limpa —
          // sem dividido e no PIX (antes herdava "0× SPLIT" e o método).
          voltarAoPagamentoInicial();
        },
        onError: function(err: any) {
          // F3-3A (29/05/2026): trata 422 CREDIARIO_REQUIRES_CUSTOMER com mensagem acionavel.
          // ApiError.data contem o body JSON do backend; .code eh o codigo do erro.
          const errCode = err?.data?.code || err?.code;
          if (errCode === "CREDIARIO_REQUIRES_CUSTOMER") {
            toast.error("Selecione um cliente antes de finalizar no crediário.");
          } else {
            toast.error(textoDoErro(err, "Não deu para registrar a venda. Tente de novo."));
          }
          setIsProcessing(false);
        },
      });
    } else {
      setLastSale(buildLastSale(Date.now().toString(36).toUpperCase().slice(-6)));
      setCart([]); setQuoteId(null); setReferredProfessionalId(null); clearLotAllocations(); setIsProcessing(false);
      voltarAoPagamentoInicial();
    }
  }

  // Venda nova: sem dividido e no PIX (QA 23/09/2026, decisão do Caio).
  function voltarAoPagamentoInicial() {
    setSplitMode(false);
    setSplitPayments([]);
    setPayment("pix");
  }

  function newSale() {
    setLastSale(null); setCart([]); setQuoteId(null); setReferredProfessionalId(null); clearLotAllocations(); setIsProcessing(false);
    setSelectedCustomerId(null); setSelectedCustomerName(null); setSelectedCustomerPhone(null);
    setSelectedEmployeeId(null); setSelectedEmployeeName(null);
    setSellerName("");
    setCpfNaNota("");
    clearCoupon(); clearDiscount();
    // QA 23/09/2026: não herda mais o dividido nem o método da venda
    // anterior ("0× SPLIT" com carrinho vazio, preços no cartão).
    voltarAoPagamentoInicial();
  }

  return {
    quoteId, setQuoteId,
    referredProfessionalId, setReferredProfessionalId,
    // Matcon M4 — o pai (usePdvState/cartProps) liga `setLotAllocations` no
    // `onLotAllocations` do CartPanel; sem isso a linha do lote continua
    // aparecendo e a venda baixa FIFO.
    lotAllocations, setLotAllocations, clearLotAllocations,
    // `cart` é a VISTA do chip (ver cartView; no dividido, as linhas
    // rateadas). Sem preço no cartão, é o estado.
    cart: vistaDoCarrinho, payment, setPayment, lastSale,
    total: subtotalDaVista ?? total, totalAfterCoupon: totalDaVenda, itemCount, isProcessing,
    // Preço no cartão: os dois totais (null com a opção desligada), o
    // desconto efetivo do cupom no método e a regra do cupom.
    precoNoCartao, couponDiscount, setCouponRule,
    addToCart, setQty, updateQty, setUnitPrice, removeItem, finalizeSale, newSale,
    selectedCustomerId, selectedCustomerName, selectedCustomerPhone, selectCustomer,
    selectedEmployeeId, selectedEmployeeName, selectEmployee,
    sellerName, setSellerName,
    couponCode, setCouponCode, couponApplied, setCouponApplied, clearCoupon,
    discountType, setDiscountType, discountValue, setDiscountValue, manualDiscountAmount, clearDiscount,
    cpfNaNota, setCpfNaNota,
    // Multi-pagamento
    splitMode, toggleSplitMode,
    splitPayments: splitPaymentsVista, addSplitPayment, updateSplitPayment, removeSplitPayment, clearSplitPayments,
    splitTotal, splitRemaining, splitIsBalanced,
    // Preço no cartão: a conta do dividido numa linha e o status nas duas
    // línguas (null com a opção desligada).
    splitNote, splitStatus,
  };
}
