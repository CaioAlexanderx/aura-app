// ============================================================
// usePdvState — ViewModel hook do PDV (Caixa)
//
// Extrai todo estado, queries, handlers e dados derivados de
// CaixaScreenInner. O componente pdv.tsx fica responsável
// apenas pela camada de layout/renderização.
//
// 14/05/2026: interceptação do crediário parcelado em
// handleFinalize() — showCrediario + handleCrediarioConfirm.
// handleOpenCrediario() — atalho direto via botão ActCrediario (F6).
//
// 26/05/2026 (crediario fase 1): handleCrediarioConfirm agora
// recebe { installments, first_due_date } do modal e repassa
// para finalizeSale(), que inclui os campos no POST /pdv/sale.
// O backend cria as credit_installments inline (best-effort).
//
// 13/06/2026 (unify): handleCrediarioConfirm detecta payload.unify.
// Quando presente:
//   1. Chama finalizeSale() com installments=1 (só débito, sem cronograma próprio).
//      A venda é registrada normalmente no crediário.
//   2. Após obter o sale_id no callback onSuccess do saleMutation,
//      o hook chama creditApi.applyUnify() para montar o cronograma unificado.
//      DECISÃO: o fluxo atual de finalizeSale() não exposes o sale_id diretamente
//      ao caller (ele seta lastSale internamente). Para obter o sale_id:
//        - guardamos o payload de unify em pendingUnifyRef (useRef)
//        - um useEffect monitora lastSale e, quando a venda muda + há pendingUnify,
//          chama applyUnify com sale_id = lastSale.id.
//      Esta abordagem é segura: lastSale só muda no onSuccess de finalizeSale,
//      e o ref é limpo imediatamente após o dispatch.
//
// 29/08/2026 (QA do Caixa):
//   · cartProps passa `finalizeDisabled` — o caminho de bloqueio do botão
//     "Finalizar venda" existia no CartPanel mas nunca era acionado.
//   · requiredHints deixou de ser string[] e virou RequiredHint[] com onPress,
//     apontando pros seletores da ActionToolbar (refs abaixo).
//   · orderSuffix (número de venda aleatório, recalculado a cada render)
//     removido — ver comentário em orderLabel.
//   · customerOptions não abre mais em ordem alfabética.
//
// 01/09/2026 (QA onda 2): a ordenação por recência do seletor de cliente era
// client-side sobre a PÁGINA que tinha chegado — o topo era "o mais recente
// entre os primeiros alfabeticamente", não o mais recente da base. Agora o
// hook pede useCustomers({ sort: "recent" }) e o servidor ordena por
// last_purchase_at DESC NULLS LAST, name ASC. Sobrou só a contagem de quantos
// clientes do topo entram no bloco "Atendidos recentemente".
//
// 22/09/2026 (Matcon M1 — docs/matcon-faseamento-po-ux.md §3):
//   · "Salvar orçamento": useMatconQuote monta a mutation + o card de
//     sucesso; aqui só compomos os dados do carrinho/cliente/vendedora e
//     colamos o resultado em cartProps (onSaveQuote/savingQuote/savedQuote).
//   · `?quote={id}` na rota do Caixa (com o toggle ligado): busca o
//     orçamento com matconApi.getQuote e povoa o carrinho via
//     addToCart+setQty (mesmo par que o campo decimal do CartPanel usa),
//     identifica o cliente se houver customer_id, e tira o `quote` da URL
//     pra não recarregar de novo num refresh/voltar. Sem `?quote`, nada
//     muda — é só mais um useEffect que nunca dispara.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";

import { useAuthStore } from "@/stores/auth";
import { useProducts } from "@/hooks/useProducts";
import { useCart, PAYMENTS } from "@/hooks/useCart";
import { useCustomers } from "@/hooks/useCustomers";
import { usePdvSettings, validateSaleAgainstSettings } from "@/hooks/usePdvSettings";
import { usePagination } from "@/hooks/usePagination";
import { useCategories } from "@/hooks/useCategories";
import { expandirComDescendentes } from "@/utils/categoryFilter";
import { useGlobalBarcodeScanner } from "@/hooks/useGlobalBarcodeScanner";
import { useViewport, productColumnsFor, cartWidthFor } from "@/hooks/useViewport";
import { useCaixa } from "@/hooks/useCaixa";

import { couponsApi, employeesApi, pdvApi } from "@/services/api";
import { nfceApi } from "@/services/nfceApi";
import { creditApi } from "@/services/creditApi";
import { matconApi } from "@/services/matconApi";
import { readMatconSettings } from "@/constants/matcon";
import { useMatconQuote } from "@/hooks/useMatconQuote";
import { useMatconReferral } from "@/hooks/useMatconReferral";

import { toast } from "@/components/Toast";
import { flyToCart } from "@/components/screens/pdv/flyToCart";
import { IS_WEB, fmtCurrency } from "@/components/screens/pdv/types";
import type { CartDisplayItem, PayChip, RequiredHint } from "@/components/screens/pdv/CartPanel";
import type { PersonPickerHandle } from "@/components/screens/pdv/ActionToolbar";
import type { Product } from "@/components/screens/estoque/types";
import type { CrediarioConfirmPayload } from "@/components/screens/pdv/PdvModals";

import { openQuotePdf, type QuoteItem } from "@/utils/quotePdf";
import { lerConfigDoCartao, precoNoCartaoDoProduto } from "@/utils/precoNoCartao";
import { normalizeText, buildProductHaystack, matchesQuery } from "@/utils/productSearch";

const PAGE_SIZE = 12;

// Quantos clientes entram no bloco "Atendidos recentemente" do seletor.
const MAX_RECENT_CUSTOMERS = 8;

/** Já comprou alguma vez? useCustomers mapeia last_purchase_at pra
 *  Customer.lastPurchase e usa "---" quando o cliente nunca comprou —
 *  que é exatamente o grupo do NULLS LAST do `?sort=recent`. */
function jaComprou(c: { lastPurchase?: string | null }): boolean {
  const v = (c.lastPurchase || "").trim();
  return v.length > 0 && v !== "---";
}

/** products.card_price do scan: null/lixo = segue o % da loja. */
function parseCardPrice(v: any): number | null {
  const n = parseFloat(v);
  return isFinite(n) && n > 0 ? n : null;
}

function getProductStock(p: any): number {
  const v = p?.stock ?? p?.stock_qty ?? 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function isProductInStock(p: any): boolean {
  if (p?.has_variants === true) return true;
  return getProductStock(p) > 0;
}

const PAY_ICONS: Record<string, string> = {
  pix:       "dollar",
  dinheiro:  "wallet",
  cartao:    "receipt",
  debito:    "trending_up",
  crediario: "clock",
};

export const PAY_METHODS: PayChip[] = PAYMENTS.map(p => ({
  key:   p.key,
  label: p.label,
  icon:  PAY_ICONS[p.key] || "dollar",
}));

export function usePdvState() {
  const { company, isDemo } = useAuthStore();
  const { products } = useProducts();
  // D2 (F0): arvore para expandir o filtro de categoria na subarvore.
  const { flattened: categoriasFlat } = useCategories();
  // ?sort=recent: o seletor de cliente do balcão abre pelo último atendido.
  const { customers } = useCustomers({ sort: "recent" });
  const { settings: pdvSettings } = usePdvSettings();
  // 22/09/2026 (Matcon M1): única leitura do toggle neste hook — "Salvar
  // orçamento" e o `?quote=` abaixo dependem só de matcon.matcon_enabled.
  const matcon = useMemo(() => readMatconSettings(pdvSettings), [pdvSettings]);
  // 22/09/2026 (preço no cartão, docs/mockups/preco-no-cartao.html). Única
  // leitura da opção neste hook; desligada, o useCart segue o caminho de
  // sempre e nada abaixo mostra preço no cartão.
  const cardCfg = useMemo(() => lerConfigDoCartao(pdvSettings), [pdvSettings]);
  const cardPriceOn = cardCfg.enabled;

  // ── Plano / módulos ─────────────────────────────────────────────────────────
  const plan = (company?.plan || "essencial").toLowerCase();
  const isNegocioPlus = plan === "negocio" || plan === "expansao" || plan === "personalizado";
  // 16/06/2026: equipe/vendedoras tambem disponivel no Essencial quando ha
  // acesso extra pago (extra_seats_granted > 0). Espelha o hasTeamCapacity do
  // gate de Equipe (#255). Sem isso, a lista de vendedoras so carregava no
  // Negocio+ e sumia ao devolver o cliente pra Essencial + acesso extra (caso
  // Encanto: 3 vendedoras cadastradas, picker vazio no PDV).
  const extraSeatsGranted = Number((company as any)?.extra_seats_granted || 0);
  const hasTeamCapacity = isNegocioPlus || extraSeatsGranted > 0;
  const moduleOverrides = ((company as any)?.module_overrides ?? {}) as Record<string, boolean>;
  const isModuleEnabled = (key: string, planDefault: boolean) =>
    moduleOverrides[key] === true ? true
    : moduleOverrides[key] === false ? false
    : planDefault;
  const clientesEnabled = isModuleEnabled("clientes", isNegocioPlus);

  // ── Toggles PDV settings ───────────────────────────────────────────────────────
  const caixaEnabled      = !!(pdvSettings as any)?.caixa_enabled;
  const cashTenderEnabled = (pdvSettings as any)?.cash_tender_modal_enabled !== false;
  const crediarioEnabled  = !!(pdvSettings as any)?.crediario_enabled;

  // ── Caixa ──────────────────────────────────────────────────────────────
  const { sessaoAtiva, isAberto, isLoading: caixaLoading, invalidate: invalidateCaixa } = useCaixa();
  const [showCaixaModal, setShowCaixaModal] = useState(false);

  // ── Modal de troco ────────────────────────────────────────────────────────
  const [showChangeModal,  setShowChangeModal]  = useState(false);
  const [cashModalAmount,  setCashModalAmount]  = useState(0);
  const [cashModalIsSplit, setCashModalIsSplit] = useState(false);

  // ── Crediário parcelado ──────────────────────────────────────────────────
  const [showCrediario, setShowCrediario] = useState(false);

  // Ref para o payload de unify pendente (ver comentário no topo do arquivo).
  // Tipo inline para evitar import circular.
  const pendingUnifyRef = useRef<{
    account_id: string;
    installments: number;
    first_due_date: string;
    amount: number;
  } | null>(null);

  // ── Scanner ───────────────────────────────────────────────────────────
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  // ── Employees ───────────────────────────────────────────────────────────
  const { data: empData } = useQuery({
    queryKey:  ["employees", company?.id],
    queryFn:   () => employeesApi.list(company!.id),
    enabled:   !!company?.id && hasTeamCapacity,
    staleTime: 60_000,
  });
  const employees = useMemo(
    () => ((empData?.employees || []) as any[]).map(e => ({
      id: e.id, name: e.name || "", subtitle: e.role || undefined,
    })),
    [empData],
  );

  // ── NFC-e config ─────────────────────────────────────────────────────────
  const { data: nfceConfigData } = useQuery({
    queryKey:  ["nfce-config", company?.id],
    queryFn:   () => nfceApi.getConfig(company!.id),
    enabled:   !!company?.id && !isDemo,
    staleTime: 5 * 60_000,
  });
  const autoEmitNfce =
    !!nfceConfigData?.config?.auto_emit_nfce && nfceConfigData?.config?.is_active;

  // ── Cart ──────────────────────────────────────────────────────────────
  const {
    cart, payment, setPayment, lastSale, total: totalRaw, totalAfterCoupon,
    itemCount, isProcessing,
    addToCart, setQty, updateQty, setUnitPrice, removeItem, finalizeSale, newSale: rawNewSale,
    setQuoteId,
    referredProfessionalId, setReferredProfessionalId,
    setLotAllocations,
    selectedCustomerId, selectedCustomerName, selectedCustomerPhone, selectCustomer,
    selectedEmployeeId, selectedEmployeeName, selectEmployee,
    sellerName, setSellerName,
    couponCode, setCouponCode, couponApplied, setCouponApplied, clearCoupon,
    discountType, discountValue, manualDiscountAmount,
    cpfNaNota, setCpfNaNota,
    splitMode, toggleSplitMode,
    splitPayments, addSplitPayment, updateSplitPayment, removeSplitPayment,
    splitRemaining, splitIsBalanced,
    precoNoCartao, couponDiscount: cartCouponDiscount, setCouponRule,
    splitNote, splitStatus,
  } = useCart(cardCfg);

  // ── Matcon M1 — "Salvar orçamento" ──────────────────────────────────────
  // useMatconQuote é quem sabe montar o QuoteCreateBody e falar com
  // matconApi; aqui só passamos o retrato atual do carrinho/cliente/
  // vendedora. `discount` é o desconto EFETIVO da venda (cupom + manual),
  // mesma soma que já alimenta o resumo do carrinho mais abaixo.
  // Preço no cartão: o orçamento salvo guarda o preço do DINHEIRO por item
  // (é ele que o Caixa trata como base ao reabrir com ?quote=) e o desconto
  // no dinheiro; o total no cartão viaja só pro card e pro WhatsApp.
  const matconQuoteDiscount = precoNoCartao
    ? precoNoCartao.descontoDinheiro
    : (couponApplied?.discount || 0) + (manualDiscountAmount || 0);
  const matconQuote = useMatconQuote({
    companyId: company?.id,
    matconEnabled: matcon.matcon_enabled,
    cart: cart.map(i => ({ productId: i.productId, name: i.name, price: i.cashPrice ?? i.price, qty: i.qty, unit: i.unit })),
    cardTotal: precoNoCartao ? precoNoCartao.totalCartao : null,
    customerId: selectedCustomerId,
    customerName: selectedCustomerName,
    customerPhone: selectedCustomerPhone,
    sellerId: selectedEmployeeId,
    discount: matconQuoteDiscount,
  });

  // ── Matcon M3 — "Indicado por" (chip do Caixa) ───────────────────────────
  // useMatconReferral cuida da busca/seleção do profissional; aqui só
  // sincronizamos a escolha com o carrinho (referredProfessionalId, que vai
  // como referred_by_professional_id no POST da venda) e limpamos o chip
  // quando o carrinho recomeça — mesmo padrão do useMatconQuote acima, uma
  // única leitura de matcon.* neste hook.
  const matconReferral = useMatconReferral({
    companyId: company?.id,
    matconEnabled: matcon.matcon_enabled,
    clubEnabled: matcon.matcon_club_enabled,
    pointsPer100: matcon.matcon_points_per_100,
  });
  useEffect(() => {
    setReferredProfessionalId(matconReferral.referred?.id || null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matconReferral.referred]);
  // "Nova venda" reabre o balcão do zero — o chip "Indicado por" some junto
  // com cliente/vendedora/cupom (setCart/setQuoteId já zeram
  // referredProfessionalId dentro de useCart; aqui só falta esquecer QUEM
  // era o profissional exibido no chip).
  function newSale() {
    matconReferral.clear();
    rawNewSale();
  }

  // ── Matcon M1 — Caixa abre orçamento convertido (`?quote={id}`) ─────────
  // A esteira de Orçamentos (fora deste PR) manda pra cá com `?quote=<id>`
  // depois de "Converter em pedido". Só roda com o toggle ligado; sem
  // `?quote` este efeito nunca dispara — zero impacto pra quem não tem
  // Matcon. `quoteLoadedRef` evita recarregar o mesmo orçamento a cada
  // re-render, e o `router.setParams` tira o `quote` da URL depois de
  // povoar o carrinho (senão um refresh/voltar duplicaria os itens).
  const quoteRouteParams = useLocalSearchParams<{ quote?: string }>();
  const quoteLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    const quoteId = quoteRouteParams.quote ? String(quoteRouteParams.quote) : null;
    if (!quoteId || !matcon.matcon_enabled || !company?.id) return;
    if (quoteLoadedRef.current === quoteId) return;
    quoteLoadedRef.current = quoteId;

    matconApi.getQuote(company.id, quoteId)
      .then(({ quote }) => {
        quote.items.forEach((it, idx) => {
          // Item sem product_id (avulso, digitado no orçamento) ganha uma
          // chave sintética só pra existir no carrinho — não bate com
          // nenhum produto do catálogo, então não soma quantidade com
          // nada que já esteja lá.
          const key = it.product_id || ("orcamento-" + quote.id + "-" + idx);
          // Preço no cartão: o unit_price do orçamento é o preço no
          // dinheiro; o do cartão sai do card_price/% do produto (mesma
          // proporção quando o preço do orçamento é outro).
          const doCatalogo = it.product_id ? products.find(p => p.id === it.product_id) : undefined;
          addToCart({
            id: key, name: it.name, price: it.unit_price, unit: it.unit || undefined,
            cardPrice: doCatalogo?.cardPrice ?? null,
            refPrice: doCatalogo ? doCatalogo.price : undefined,
          });
          setQty(key, it.quantity);
        });
        if (quote.customer_id) {
          selectCustomer(quote.customer_id, quote.customer_name || null, quote.customer_phone || null);
        }
        setQuoteId(quote.id); // vai como quote_id no POST da venda (M1)
        toast.success("Orçamento #" + quote.number + " carregado no carrinho");
        try { router.setParams({ quote: undefined } as any); } catch {}
      })
      .catch(() => {
        toast.error("Não foi possível carregar o orçamento");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteRouteParams.quote, matcon.matcon_enabled, company?.id]);

  // ── Viewport ──────────────────────────────────────────────────────────────
  const vp         = useViewport();
  const wide        = vp.wide;
  const productCols = productColumnsFor(vp);
  const cartWidth   = cartWidthFor(vp);

  // ── Ref do CartPanel (flyToCart) ────────────────────────────────────────────────
  const cartHeadRef = useRef<any>(null);

  // ── Refs dos seletores da ActionToolbar (29/08/2026) ───────────────────────
  // Os popovers de vendedora/cliente são estado interno do ActPerson. Em vez de
  // duplicar esse controle, o componente expõe um handle `open()` e o rodapé do
  // carrinho usa ele pra transformar os avisos de bloqueio em atalho.
  // Só um layout (wide OU mobile) monta por vez, então um ref por seletor basta.
  const sellerPickerRef   = useRef<PersonPickerHandle | null>(null);
  const customerPickerRef = useRef<PersonPickerHandle | null>(null);

  // ── Filtros / busca ──────────────────────────────────────────────────────────
  const [query,          setQuery]          = useState("");
  const [cat,            setCat]            = useState<string>("all");
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  // ── Estados de modais ────────────────────────────────────────────────────────
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [pendingProduct,  setPendingProduct]  = useState<Product | null>(null);
  const [showTroca,       setShowTroca]       = useState(false);

  // ── Categorias ───────────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of products) {
      const k = p.category || "Produtos";
      map[k] = (map[k] || 0) + 1;
    }
    return [
      { id: "all", label: "Todos", count: products.length },
      ...Object.keys(map).sort().map(k => ({ id: k, label: k, count: map[k] })),
    ];
  }, [products]);

  const outOfStockCount = useMemo(
    () => products.reduce((acc, p) => acc + (isProductInStock(p) ? 0 : 1), 0),
    [products],
  );

  // ── Índice de busca ────────────────────────────────────────────────────────────
  const productIndex = useMemo(() => {
    const idx = new Map<string, string>();
    for (const p of products) idx.set((p as any).id, buildProductHaystack(p));
    return idx;
  }, [products]);

  // D2 (F0): filtro de categoria hierarquico. Escolher "Feminino" no PDV
  // tem que trazer o que esta em "Feminino > Calcados > Botas" -- senao a
  // arvore piora a vida de quem esta no caixa com o cliente na frente.
  // Igualdade exata vira pertencimento a subarvore; base sem arvore cai
  // no comportamento antigo. Ver utils/categoryFilter.ts.
  const catsAceitas = useMemo(
    () => (cat === "all" ? [] : expandirComDescendentes([cat], categoriasFlat)),
    [cat, categoriasFlat]
  );

  const filtered = useMemo(() => {
    const normQuery = normalizeText(query);
    return products.filter(p => {
      const haystack = productIndex.get((p as any).id) ?? buildProductHaystack(p);
      return (
        matchesQuery(haystack, normQuery) &&
        (catsAceitas.length === 0 || catsAceitas.includes(p.category)) &&
        (showOutOfStock || isProductInStock(p))
      );
    });
  }, [products, productIndex, query, catsAceitas, showOutOfStock]);

  const { paginated, page, totalPages, total: filteredTotal, goTo } =
    usePagination(filtered, PAGE_SIZE, query + cat + (showOutOfStock ? "1" : "0"));

  const qtyById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of cart) {
      const base = it.productId.split("__")[0];
      m[base] = (m[base] || 0) + it.qty;
    }
    return m;
  }, [cart]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function pickCustomerWithPhone(v: { id: string; name: string } | null) {
    if (!v) { selectCustomer(null, null, null); return; }
    const c = customers.find(c => c.id === v.id);
    selectCustomer(v.id, v.name, c?.phone || null);
  }

  const scanFeedbackTimerRef = useRef<any>(null);
  function flashScanFeedback(code: string) {
    setLastScannedCode(code);
    if (scanFeedbackTimerRef.current) clearTimeout(scanFeedbackTimerRef.current);
    scanFeedbackTimerRef.current = setTimeout(() => {
      setLastScannedCode(null);
      scanFeedbackTimerRef.current = null;
    }, 800);
  }
  useEffect(
    () => () => { if (scanFeedbackTimerRef.current) clearTimeout(scanFeedbackTimerRef.current); },
    [],
  );

  async function handleScan(code: string) {
    const cleaned = (code || "").trim();
    if (!cleaned) return;
    flashScanFeedback(cleaned);

    const localProduct = products.find(p => p.barcode === cleaned);
    if (localProduct) { handleAddProduct(localProduct); return; }
    if (!company?.id || isDemo) { setQuery(cleaned); return; }

    try {
      const result = await pdvApi.scan(company.id, cleaned);
      if (result.match === "exact" && result.source === "variant_barcode" && result.product && result.variant_id) {
        const parentLocal  = products.find(p => p.id === result.product.id);
        const suffix       = (result.product as any).sku_suffix || "Variante";
        const parentName   = parentLocal?.name || (result.product as any).name || "Produto";
        const parentPrice  = parentLocal?.price ?? (result.product as any).price ?? 0;
        const price        = result.effective_price || parentPrice;
        // Preço no cartão: o scan devolve o card_price do PAI mesmo quando a
        // variante tem preço próprio — o addToCart leva na proporção.
        const parentCard   = parentLocal ? parentLocal.cardPrice : parseCardPrice((result.product as any).card_price);
        const parent: any  = parentLocal || { id: result.product.id, name: parentName, price: parentPrice, cardPrice: parentCard };
        addToCart(parent, { id: result.variant_id, label: suffix, price });
        toast.success(parentName + " · " + suffix);
        return;
      }
      if (result.match === "exact" && result.product) {
        const full = products.find(p => p.id === result.product.id);
        if (full) { handleAddProduct(full); return; }
        const bp: any = {
          id:    result.product.id,
          name:  (result.product as any).name || "Produto",
          price: result.effective_price || (result.product as any).price || 0,
          cardPrice: parseCardPrice((result.product as any).card_price),
          refPrice: parseFloat((result.product as any).price) || undefined,
        };
        addToCart(bp);
        toast.success(bp.name);
        return;
      }
      setQuery(cleaned);
    } catch {
      setQuery(cleaned);
    }
  }

  function handleAddProduct(
    p: Product,
    evt?: { x: number; y: number; accent: string; letter: string },
  ) {
    if (p.has_variants) { setPendingProduct(p); return; }
    addToCart(p);
    if (evt && cartHeadRef.current && IS_WEB) {
      const target = cartHeadRef.current.getBoundingClientRect?.();
      if (target) {
        flyToCart(
          { x: evt.x, y: evt.y },
          { x: target.left + target.width / 2 - 22, y: target.top + 30 },
          evt.accent,
          evt.letter,
        );
      }
    }
  }

  function handleVariantSelected(variant: { id: string; label: string; price: number; stock: number }) {
    if (!pendingProduct) return;
    if (!variant.id) { addToCart(pendingProduct); }
    else             { addToCart(pendingProduct, variant); }
    setPendingProduct(null);
  }

  function handleFinalize() {
    if (caixaEnabled && !isAberto) {
      toast.error("Abra o caixa antes de finalizar a venda");
      setShowCaixaModal(true);
      return;
    }
    const v = validateSaleAgainstSettings(pdvSettings, {
      customerId: selectedCustomerId,
      sellerId:   selectedEmployeeId,
      sellerName,
    });
    if (!v.ok) {
      toast.error("Selecione " + v.missing.join(" e ") + " antes de finalizar a venda");
      return;
    }

    // Crediário Parcelado — intercepta antes do modal de troco.
    if (payment === "crediario" && !splitMode) {
      if (!selectedCustomerId) {
        toast.error("Selecione um cliente para usar o crediário parcelado");
        return;
      }
      setShowCrediario(true);
      return;
    }

    // Split com uma parcela no crediário
    const splitHasCrediario = splitMode &&
      splitPayments.some(p => p.method === "crediario" && (Number(p.value) || 0) > 0);
    if (splitHasCrediario) {
      if (!splitIsBalanced) {
        toast.error(splitRemaining > 0
          ? `Faltam R$ ${splitRemaining.toFixed(2)} pra fechar`
          : `Sobrando R$ ${Math.abs(splitRemaining).toFixed(2)} nos pagamentos`);
        return;
      }
      if (!selectedCustomerId) {
        toast.error("Selecione um cliente para usar o crediário");
        return;
      }
      setShowCrediario(true);
      return;
    }

    const splitOk    = !splitMode || splitIsBalanced;
    const cashAmount = splitMode
      ? splitPayments
          .filter(p => p.method === "dinheiro")
          .reduce((s, p) => s + (Number(p.value) || 0), 0)
      : (payment === "dinheiro" ? totalAfterCoupon : 0);
    if (cashTenderEnabled && cashAmount > 0 && splitOk) {
      setCashModalAmount(cashAmount);
      setCashModalIsSplit(splitMode);
      setShowChangeModal(true);
      return;
    }
    finalizeSale();
  }

  function handleConfirmCashChange() {
    setShowChangeModal(false);
    finalizeSale();
  }

  // ── Unify: useEffect monitora lastSale e despacha applyUnify quando pendente ──
  // Quando o lojista confirma com unify ativo, handleCrediarioConfirm:
  //   1. Grava o payload em pendingUnifyRef
  //   2. Chama finalizeSale() com installments=1 (débito puro)
  // Quando finalizeSale() resolve, lastSale muda → este effect dispara.
  const lastSaleIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lastSale) return;
    if (lastSale.id === lastSaleIdRef.current) return; // já processou esta venda
    lastSaleIdRef.current = lastSale.id;

    const pu = pendingUnifyRef.current;
    if (!pu || !company?.id || !selectedCustomerId) {
      pendingUnifyRef.current = null;
      return;
    }
    // Limpamos imediatamente para não re-disparar
    pendingUnifyRef.current = null;

    const { account_id, installments, first_due_date, amount } = pu;
    const saleId = lastSale.id;
    const compId = company.id;
    const custId = selectedCustomerId;

    creditApi.applyUnify(compId, custId, account_id, {
      amount,
      installments,
      first_due_date,
      sale_id: saleId,
    }).then(() => {
      toast.success("Carnê unificado com sucesso!");
    }).catch((err: any) => {
      // A venda já foi registrada; o unify é best-effort.
      // Informamos o lojista para que possa corrigir manualmente na ficha.
      toast.error(
        "Venda registrada, mas a unificação falhou: " +
        (err?.message || "erro desconhecido") +
        ". Unifique manualmente na ficha do cliente."
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSale]);

  // Parcelas configuradas no modal — fecha e conclui a venda com os parâmetros.
  function handleCrediarioConfirm(payload: CrediarioConfirmPayload) {
    setShowCrediario(false);

    if (payload.unify) {
      // Fluxo de unify: a venda vai com installments=1 (só débito).
      // O applyUnify será feito pelo useEffect acima após lastSale atualizar.
      pendingUnifyRef.current = {
        account_id:    payload.unify.account_id,
        installments:  payload.unify.installments,
        first_due_date: payload.unify.first_due_date,
        amount:        totalAfterCoupon, // valor da nova compra
      };
      finalizeSale(undefined, { installments: 1, first_due_date: payload.first_due_date });
    } else {
      // Fluxo normal — inalterado
      finalizeSale(undefined, payload);
    }
  }

  function handleOpenCrediario() {
    if (cart.length === 0) {
      toast.info("Adicione produtos ao carrinho antes de usar o crediário");
      return;
    }
    if (!selectedCustomerId) {
      toast.error("Selecione um cliente para usar o crediário parcelado");
      return;
    }
    setPayment("crediario");
    setShowCrediario(true);
  }

  async function handleValidateCoupon(code: string) {
    if (!company?.id) return { ok: false, error: "Empresa não identificada" };
    try {
      // selectedCustomerId vai junto: cupom nominal (aniversário / crédito
      // livre) só é válido para o próprio cliente. O backend é quem decide —
      // aqui só informamos quem está na venda. Sem cliente selecionado o
      // cupom nominal é recusado com mensagem explicando o que fazer.
      // Preço no cartão: o mínimo do cupom confere pelo total no DINHEIRO —
      // trocar pra cartão nunca derruba o cupom. A regra (percent/fixed)
      // fica guardada pra o % valer sobre o preço do método escolhido.
      const baseDoCupom = precoNoCartao ? precoNoCartao.subtotalDinheiro : totalRaw;
      const res = await couponsApi.validate(company.id, code, baseDoCupom, selectedCustomerId);
      if (res.valid && res.code) {
        if (precoNoCartao) {
          const valor = Number(res.discount_value);
          setCouponRule(res.discount_type === "percent" && isFinite(valor)
            ? { code: res.code, tipo: "percent", valor: valor }
            : { code: res.code, tipo: "fixed", valor: isFinite(valor) && valor > 0 ? valor : (res.discount_amount || 0) });
        }
        setCouponApplied({ code: res.code, discount: res.discount_amount || 0 });
        setCouponCode(res.code);
        toast.success("Cupom " + res.code + " aplicado! −" + fmtCurrency(res.discount_amount || 0));
        return { ok: true, code: res.code, discount: res.discount_amount };
      }
      return { ok: false, error: res.error || "Cupom inválido" };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Erro ao validar cupom" };
    }
  }

  function handleGenerateQuote() {
    if (cart.length === 0) {
      toast.info("Adicione produtos ao carrinho antes de gerar orçamento");
      return;
    }
    // 22/09/2026 (Matcon M0): a unidade vai junto pro orçamento impresso —
    // "12,5 m²" em vez de "12.5". Item sem unidade imprime como sempre.
    const profile       = (company as any)?.profile || {};
    // Preço no cartão: dois preços por linha e dois totais, "Dinheiro ou
    // PIX" e "No cartão" (decisão 4 do Caio — nunca "à vista").
    if (precoNoCartao) {
      const pc = precoNoCartao;
      openQuotePdf({
        items: cart.map(i => ({
          name: i.name, qty: i.qty, unit: i.unit,
          unitPrice: i.cashPrice ?? i.price,
          cardUnitPrice: i.cardPrice ?? i.price,
        })),
        customerName:       selectedCustomerName,
        sellerName:         selectedEmployeeName || sellerName || null,
        total:              pc.subtotalDinheiro,
        totalAfterDiscount: pc.descontoDinheiro > 0 ? pc.totalDinheiro : undefined,
        discount:           pc.descontoDinheiro > 0 ? pc.descontoDinheiro : undefined,
        card: {
          total:              pc.subtotalCartao,
          totalAfterDiscount: pc.totalCartao,
          discount:           pc.descontoCartao > 0 ? pc.descontoCartao : undefined,
        },
        companyName:        company?.name || "Sua empresa",
        companyLogoUrl:     profile.logo_url || null,
        companyPhone:       profile.phone || null,
        companyAddress:     profile.address || null,
      });
      toast.success("Orçamento gerado");
      return;
    }
    const items: QuoteItem[] = cart.map(i => ({ name: i.name, qty: i.qty, unitPrice: i.price, unit: i.unit }));
    const discount      = couponApplied ? couponApplied.discount : (manualDiscountAmount || 0);
    const afterDiscount = totalRaw - discount;
    openQuotePdf({
      items,
      customerName:       selectedCustomerName,
      sellerName:         selectedEmployeeName || sellerName || null,
      total:              totalRaw,
      totalAfterDiscount: discount > 0 ? afterDiscount : undefined,
      discount:           discount > 0 ? discount : undefined,
      companyName:        company?.name || "Sua empresa",
      companyLogoUrl:     profile.logo_url || null,
      companyPhone:       profile.phone || null,
      companyAddress:     profile.address || null,
    });
    toast.success("Orçamento gerado");
  }

  // ── Scanner gate ──────────────────────────────────────────────────────────
  const scannerListening =
    !lastSale &&
    !pendingProduct &&
    !showCaixaModal &&
    !showTroca &&
    !showChangeModal &&
    !showNewCustomer &&
    !showCrediario;
  useGlobalBarcodeScanner({ onScan: handleScan, enabled: scannerListening });

  // ── Dados derivados para renderização ────────────────────────────────────────────
  // 22/09/2026 (Matcon M0): unit/purchaseUnit/purchaseFactor descem pro
  // CartPanel, que decide entre campo decimal e stepper pela unidade do
  // produto. Item sem unidade (scanner que não achou o produto local) chega
  // com undefined e cai no stepper de sempre.
  const displayItems: CartDisplayItem[] = cart.map(it => {
    const base = it.productId.split("__")[0];
    // Preço no cartão: a linha mostra, em cinza ao lado, o preço do OUTRO
    // método ("· cartão R$ 42,20"). Desligada, o objeto é o de sempre.
    if (precoNoCartao) {
      const outroNoCartao = !precoNoCartao.noCartao;
      return {
        productId: it.productId, productBaseId: base, name: it.name, price: it.price, qty: it.qty, listPrice: it.listPrice,
        unit: it.unit, purchaseUnit: it.purchaseUnit, purchaseFactor: it.purchaseFactor,
        otherPrice: outroNoCartao ? (it.cardPrice ?? it.price) : (it.cashPrice ?? it.price),
        otherLabel: outroNoCartao ? "cartão" : "dinheiro",
      };
    }
    return {
      productId: it.productId, productBaseId: base, name: it.name, price: it.price, qty: it.qty, listPrice: it.listPrice,
      unit: it.unit, purchaseUnit: it.purchaseUnit, purchaseFactor: it.purchaseFactor,
    };
  });

  const subtotal       = totalRaw;
  // cartCouponDiscount = o desconto do cupom NO MÉTODO escolhido (com o
  // preço no cartão, 5% de R$ 1.110,00 no crédito); desligado, é o
  // couponApplied.discount de sempre.
  const couponDiscount = cartCouponDiscount;
  const discountAmount = couponDiscount + (manualDiscountAmount || 0);
  const totalFinal     = totalAfterCoupon;

  const crediarioSplitAmount = Math.round(
    splitPayments.filter(p => p.method === "crediario")
      .reduce((s, p) => s + (Number(p.value) || 0), 0) * 100
  ) / 100;
  const crediarioModalAmount = splitMode && crediarioSplitAmount > 0
    ? crediarioSplitAmount
    : totalFinal;
  const discountLabel  = couponApplied?.code
    ? couponApplied.code
    : manualDiscountAmount > 0
      ? discountType === "%" ? (discountValue + "%") : "manual"
      : null;

  // 29/08/2026: cada aviso leva ao seletor que resolve a pendência. Antes era
  // texto puro — dizia o que faltava e deixava o lojista procurar sozinho.
  // "Cliente obrigatório" só vira botão quando o módulo Clientes está liberado
  // (com o gate de plano ativo o ActPerson está disabled e não abriria nada).
  const requiredHints: RequiredHint[] = [];
  if (pdvSettings.require_customer && !selectedCustomerId) {
    requiredHints.push({
      label: "Cliente obrigatório",
      onPress: clientesEnabled ? () => customerPickerRef.current?.open() : undefined,
    });
  }
  if (pdvSettings.require_seller && !selectedEmployeeId && !(sellerName || "").trim()) {
    requiredHints.push({
      label: "Vendedora obrigatória",
      onPress: () => sellerPickerRef.current?.open(),
    });
  }
  if (caixaEnabled && !isAberto) {
    requiredHints.push({ label: "Caixa fechado", onPress: () => setShowCaixaModal(true) });
  }

  const activeSellerValue = selectedEmployeeId
    ? { id: selectedEmployeeId, name: selectedEmployeeName || "Vendedora" }
    : sellerName?.trim()
      ? { id: "__free__" + sellerName.trim(), name: sellerName.trim() }
      : null;

  const activeCustomerValue = selectedCustomerId
    ? {
        id:       selectedCustomerId,
        name:     selectedCustomerName || "Cliente",
        subtitle: customers.find(c => c.id === selectedCustomerId)?.phone || undefined,
      }
    : null;

  // 01/09/2026: a lista já chega ordenada do servidor (?sort=recent =
  // last_purchase_at DESC NULLS LAST, name ASC). Não reordenamos nada aqui —
  // a ordenação local só sabia reordenar a página carregada e mentia sobre
  // quem era o "mais recente". Só medimos onde termina o bloco de recentes:
  // como os que nunca compraram vêm todos DEPOIS (NULLS LAST), basta contar
  // os primeiros que já compraram, até o teto do bloco. Busca digitada não
  // passa por aqui (o ActPerson filtra a lista inteira).
  const { customerOptions, customerRecentCount } = useMemo(() => {
    let recentCount = 0;
    while (
      recentCount < customers.length &&
      recentCount < MAX_RECENT_CUSTOMERS &&
      jaComprou(customers[recentCount])
    ) recentCount++;

    return {
      customerOptions: customers.map(c => ({
        id: c.id, name: c.name, subtitle: c.phone || c.email,
      })),
      customerRecentCount: recentCount,
    };
  }, [customers]);

  // 29/08/2026: aqui existia um `orderSuffix` = Date.now() % 100000, recalculado
  // A CADA RENDER — o cabeçalho trocava de "número da venda" várias vezes
  // durante uma única venda. Como a venda ainda é rascunho (não existe no
  // backend), não há número real: mostramos um rótulo de estado. Um contador
  // local persistido seria igualmente falso e divergiria do backend.
  const orderLabel = "Nova venda";

  const cartProps = {
    orderNumber:       orderLabel,
    items:             displayItems,
    subtotal,
    discountAmount,
    total:             totalFinal,
    itemCount,
    payMethods:        PAY_METHODS,
    activePay:         payment,
    onPay:             setPayment,
    onInc:             (id: string) => updateQty(id, 1),
    onDec:             (id: string) => updateQty(id, -1),
    onSetQty:          setQty,
    // 22/09/2026 (Matcon M4): o CartPanel calcula de quais lotes sai cada
    // item (LoteDoItem) e devolve aqui; o useCart guarda e manda como
    // `items[].lot_allocations` no POST da venda. Sem lote controlado
    // nunca é chamado, e a venda baixa FIFO como sempre.
    onLotAllocations:  setLotAllocations,
    onPriceChange:     setUnitPrice,
    onRemove:          removeItem,
    onClear:           () => { cart.forEach(i => removeItem(i.productId)); clearCoupon(); },
    onFinalize:        handleFinalize,
    onGenerateQuote:   handleGenerateQuote,
    showOrcamento:     true,
    onSaveQuote:       matconQuote.saveQuote,
    savingQuote:       matconQuote.saving,
    savedQuote:        matconQuote.savedQuote,
    discountLabel,
    isProcessing,
    // Bloqueio por requisito. O CartPanel usa isso só pra APARÊNCIA (opacidade
    // + sem brilho + aria-disabled) e mantém o Pressable ativo, porque é o
    // handleFinalize que explica no toast o que está faltando.
    finalizeDisabled:  requiredHints.length > 0,
    requiredHints,
    cpfNaNota,
    onCpfNaNotaChange: setCpfNaNota,
    // Preço no cartão (tela 3/5 do mockup): o par "dinheiro e PIX · cartão"
    // sempre à vista no topo. null com a opção desligada = topo de sempre.
    pricePair: precoNoCartao
      ? {
          cash: precoNoCartao.totalDinheiro,
          card: precoNoCartao.totalCartao,
          active: (splitMode ? "split" : precoNoCartao.noCartao ? "card" : "cash") as "split" | "card" | "cash",
        }
      : null,
    subtotalLabel: precoNoCartao && precoNoCartao.noCartao ? "Subtotal no cartão" : undefined,
    splitMode,
    splitPayments,
    splitRemaining,
    splitIsBalanced,
    // Preço no cartão: a conta do dividido e o status "faltam R$ X no
    // dinheiro ou PIX, ou R$ Y no cartão". null = painel de sempre.
    splitNote,
    splitStatusText: splitStatus,
    onToggleSplit:        toggleSplitMode,
    onAddSplitPayment:    () => addSplitPayment(),
    onUpdateSplitPayment: updateSplitPayment,
    onRemoveSplitPayment: removeSplitPayment,
  };

  return {
    // Company / auth
    company, isDemo, plan, isNegocioPlus, clientesEnabled, crediarioEnabled,
    // Caixa
    caixaEnabled, sessaoAtiva, isAberto, caixaLoading, invalidateCaixa,
    showCaixaModal,
    openCaixaModal:  () => setShowCaixaModal(true),
    closeCaixaModal: () => setShowCaixaModal(false),
    // Change modal
    showChangeModal, cashModalAmount, cashModalIsSplit,
    handleConfirmCashChange,
    cancelChange: () => setShowChangeModal(false),
    // Crediário parcelado
    showCrediario,
    crediarioModalAmount,
    handleCrediarioConfirm,
    handleOpenCrediario,
    closeCrediario: () => setShowCrediario(false),
    // Scanner
    lastScannedCode, scannerListening,
    // Employees / NFC-e
    employees, autoEmitNfce,
    // Cart
    payment, setPayment, lastSale, newSale, isProcessing,
    // Matcon M3 — chip "Indicado por" do Caixa (IndicadoPorChip)
    referral: matconReferral,
    selectedCustomerId, selectedCustomerName, selectCustomer,
    selectedEmployeeId, selectedEmployeeName, selectEmployee,
    sellerName, setSellerName,
    couponApplied, setCouponApplied, clearCoupon, setCouponCode,
    cpfNaNota, setCpfNaNota,
    splitMode, splitPayments, splitRemaining, splitIsBalanced,
    toggleSplitMode, addSplitPayment, updateSplitPayment, removeSplitPayment,
    // Viewport
    vp, wide, productCols, cartWidth,
    // Produtos / busca
    products, query, setQuery, cat, setCat, showOutOfStock, setShowOutOfStock,
    categories, outOfStockCount, paginated, page, totalPages, filteredTotal, goTo, qtyById,
    // Modais (openers/closers nomeados)
    pendingProduct,
    closePendingProduct: () => setPendingProduct(null),
    showNewCustomer,
    openNewCustomer:  () => setShowNewCustomer(true),
    closeNewCustomer: () => setShowNewCustomer(false),
    customers, customerOptions, customerRecentCount,
    sellerPickerRef, customerPickerRef,
    showTroca,
    openTroca:  () => setShowTroca(true),
    closeTroca: () => setShowTroca(false),
    // Handlers
    handleScan, handleAddProduct, handleVariantSelected, handleFinalize,
    handleValidateCoupon, handleGenerateQuote,
    pickCustomerWithPhone,
    // Dados derivados
    cartHeadRef, cartProps, orderLabel,
    subtotal, discountAmount, totalFinal, discountLabel,
    requiredHints, activeSellerValue, activeCustomerValue, displayItems,
    // 22/09/2026 (QA Matcon): o grid e o fim da venda mostram o milheiro em
    // peças ("20 mlh em estoque · 20.000 un", "500 produtos").
    matconEnabled: matcon.matcon_enabled,
    // Preço no cartão: o grid mostra "cartão R$ X" embaixo do preço.
    cardPriceOn,
    gridCardPrice: (p: { price: number; cardPrice?: number | null }) => precoNoCartaoDoProduto(p, cardCfg),
  };
}
