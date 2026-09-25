// ============================================================
// components/studio/storefront/useStorefront.ts
// Fonte unica de estado do storefront publico Studio.
// CONTRATO CONGELADO -- Onda 0.
//
// API publica (contratos para Onda 1):
//
//   const sf = useStorefront(slug);
//
//   // Estado da loja
//   sf.store           -- StorePayload | null
//   sf.loading         -- boolean
//   sf.error           -- string | null
//   sf.setError        -- (msg: string | null) => void
//   sf.erroDeCarga     -- { status, mensagem } | null  (falha ao CARREGAR a loja)
//   sf.recarregar()    -- refaz a carga (o "Tentar de novo" da tela de erro)
//
//   // Navegacao
//   sf.stage           -- Stage
//   sf.goTo(stage)     -- navega entre stages
//   sf.sincronizarComTela(tela) -- Onda 1B: poe o estado na tela da URL
//     (quem chama e a rota; devolve a Resolucao, com redirecionamento
//     quando a peca/categoria da URL nao existe mais)
//
//   Onda 1B (25/09/2026): `useStorefront(slug, { navegar })`. Com
//   `navegar`, cada troca de tela vira tambem uma troca de URL (ver
//   rotasDaVitrine.ts); sem ele (app/cardapio/studio/[slug], testes) a
//   tela continua sendo so estado, como antes.
//
//   // Produto sendo configurado
//   sf.activeProduct   -- StudioStoreProduct | null
//   sf.editingValues   -- Record<fieldId, any>  (valores correntes dos fields)
//   sf.setFieldValue(fieldId, value) -- grava valor de um field
//   sf.editingQty      -- number
//   sf.setEditingQty   -- (n: number) => void
//   sf.editingAddBack  -- boolean  (cliente optou pelo verso)
//   sf.setEditingAddBack -- (b: boolean) => void
//   sf.editingAddMiddle  -- boolean  (cliente optou pelo meio -- faixa
//                           central/wrap 360 de caneca e copo)
//   sf.setEditingAddMiddle -- (b: boolean) => void
//   sf.configuringUnitPrice -- numero calculado (base + choices + verso + meio)
//   sf.openConfigure(product, siblings?, inicial?) -- abre o configurador pra
//     um produto; `inicial` (ValoresIniciais) abre ja preenchido
//
//   // Pedir outro igual (Fase 4, 25/09/2026) -- repeticaoDoPedido.ts
//   sf.repeticao       -- RepeticaoNoEstado | null (pedido, estado, numero)
//   sf.pedirRepeticao(token, produtoId) -- busca a personalizacao do pedido
//     e, quando a peca estiver aberta no configurador, carrega os valores
//     nele (editingValues/Qty/AddBack/AddMiddle). A pagina do produto so
//     LE o estado: nada muda nela alem da faixa (VitrineNaRota.tsx).
//   sf.dispensarRepeticao() -- fecha a faixa
//   sf.editCartLine(line)     -- reabre o configurador pra editar linha
//   sf.commitConfigure()      -- valida + commita no carrinho + volta pra "list"
//
//   // Upload de imagem (campo type=image)
//   // Agente G (FieldImage) chama sf.uploadImage() e depois sf.setFieldValue()
//   sf.uploadImage(fieldId, file) -- Promise<void>
//     internamente: FileReader -> base64 -> POST /upload -> setFieldValue(fieldId, url)
//     estados: sf.uploadingFieldId (string|null), sf.uploadError (string|null)
//   sf.uploadingFieldId  -- string | null  (qual field esta em upload)
//   sf.uploadError       -- string | null
//   sf.clearUploadError  -- () => void
//
//   // Carrinho
//   sf.cart            -- CartLine[]
//   sf.cartSubtotal    -- number
//   sf.removeCartLine(lineId)
//
//   // Checkout
//   sf.customerName     sf.setCustomerName
//   sf.customerPhone    sf.setCustomerPhone
//   sf.customerEmail    sf.setCustomerEmail
//   sf.paymentMethod    sf.setPaymentMethod
//   sf.deliveryType     sf.setDeliveryType   -- pickup | delivery | courier
//   sf.courierName      sf.setCourierName    -- S8, so em "courier"
//   sf.courierPlate     sf.setCourierPlate   -- S8, mascarado ABC-1234
//   sf.quoteShipping()  -- S2, cota o frete pelo CEP (acao explicita)
//   sf.shippingQuote    sf.quotingShipping   sf.shippingError
//   sf.shippingFee      -- frete cobrado (0 fora de "delivery")
//   sf.pixDiscount      -- desconto do Pix (0 fora do Pix)
//   sf.cartTotal        -- cartSubtotal - pixDiscount + shippingFee
//   sf.addressStreet    sf.setAddressStreet
//   sf.addressNumber    sf.setAddressNumber
//   sf.addressNeigh     sf.setAddressNeigh
//   sf.addressCity      sf.setAddressCity
//   sf.addressState     sf.setAddressState
//   sf.addressZip       sf.setAddressZip
//   sf.notes            sf.setNotes
//   sf.sending          -- boolean
//   sf.submitOrder()    -- async, chama POST /order e seta sentOrder + stage="sent"
//
//   // Confirmacao
//   sf.sentOrder        -- SentOrder | null
//   sf.resetToList()    -- volta pra lista apos "sent"
//
//   // Internos (prefixo _ -- nao usar fora dos sub-componentes de display)
//   sf._editingLineId   -- string | null  (para saber se e edicao ou novo)
//   sf._effectiveBackSelected(cfg, explicit) -- boolean
//   sf._effectiveMiddleSelected(cfg, explicit) -- boolean
//   sf._lineUnitPrice(line) -- number
//   sf._lineTotal(line)     -- number
// ============================================================
import { useState, useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import { maskPhone } from "@/utils/masks";
import type {
  StorePayload, StudioStoreProduct, CartLine, Stage, SentOrder,
  DeliveryType, ShippingQuote,
} from "./types";
import { normalizePlate, maskPlate } from "./courierPlate";
import type { ErroDeCarga } from "./erroDaVitrine";
import { isArtSourceType, sideOf } from "@/components/studio/customizationConfig";
import {
  agruparVitrine, transportarValores, type VitrineEntry,
} from "./categoryGrouping";
import {
  resolverTela, chaveDaCategoria,
  type NavegarNaVitrine, type ModoDeNavegar, type TelaDaVitrine, type Resolucao,
} from "./rotasDaVitrine";
import { atribuicaoGuardada, camposDeAtribuicao } from "./linkDaAurinha";
import {
  itemParaOProduto, valoresIniciaisDaRepeticao,
  type RepeticaoNoEstado, type RespostaDaRepeticao, type ValoresIniciais,
} from "./repeticaoDoPedido";

import { enderecoDaApi } from "./enderecoDaApi";
// Fase 1C: medicao (GA4/Pixel, atras do consentimento) e loja que fecha
// no meio da compra. As regras moram nos modulos; aqui so as chamadas.
import { medirNaVitrine, itemDoProduto, itensDaSacola } from "./eventosDaVitrine";
import { lojaFechouNoEnvio } from "./lojaFechada";
// Fase 2 (Fechar a venda): preco numa conta so, a chave vitrine_v2, a
// cotacao no servidor e o pedido guardado para a pagina /pedido/<token>.
import {
  precoDaPeca, precoUnitarioDaLinha, totalDaLinha, versoEfetivo, meioEfetivo,
} from "./precoDaSacola";
import { vitrineV2NoNavegador } from "./chaveVitrineV2";
import {
  itensDoPedido, lerCotacao, assinaturaDaCotacao, RESPIRO_DA_COTACAO_MS,
  type CotacaoDaSacola,
} from "./cotacaoDaSacola";
import { situacaoDoDocumento, digitos } from "./formularioDoCheckout";
import { guardarDadosLembrados, storageLocal, storageDaAba } from "./dadosLembrados";
import { guardarPedidoPendente, guardarIdDoPedido } from "./pedidoGuardado";

const API_BASE = enderecoDaApi();

// --- Helpers de preco ---
// Fase 2 (25/09/2026): a conta de preco saiu daqui para precoDaSacola.ts
// (pura, com teste, e a mesma que o Cart.tsx le). O servico de arte pago
// passou a entrar UMA VEZ por linha, como o servidor cobra.
const effectiveBackSelected = versoEfetivo;
const effectiveMiddleSelected = meioEfetivo;

// ── S0 (18/08/2026) — grupo de origem da arte ────────────────
// `image` e `template` preenchem o MESMO slot de arte: compose3dMug e
// compose2d leem `values.image || values.template`. A lojista pode marcar
// "Obrigatorio" nos dois no painel de personalizacao, e o resultado era
// uma condicao impossivel — foi o que travou a compra em sheid-mania,
// loja publicada (ver docs/F1_CONTEUDO_STUDIO.md no aura-backend, S0).
//
// Regra: se ao menos um campo do grupo for required, basta UM preenchido.
// Com uma unica origem no config, o comportamento e identico ao anterior.
//
// ESPELHO OBRIGATORIO de validateCustomizationValues em
// src/routes/studioStorefront.js (aura-backend). Se um lado mudar sem o
// outro, o item entra no carrinho e o pedido leva 400 no fechamento.
//
// 19/08/2026: a lista de tipos do grupo saiu daqui e passou a vir de
// components/studio/customizationConfig.ts, que e o modulo que decide a
// forma do config. Eram tres copias da mesma regra (aqui, no editor e
// no backend); agora sao duas, e a que sobra e a de outro repositorio.
//
// 19/08/2026 (S — meio): fieldSideOf local virou um ternario front/back
// e o meio (wrap 360/faixa central) ficaria de fora da validacao. Em vez
// de estender o ternario aqui de novo, delega pro sideOf ja exportado de
// customizationConfig.ts — a mesma fonte que decide a forma do campo.

function isFilled(v: any): boolean {
  return !(v == null || (typeof v === "string" && !v.trim()));
}

/**
 * Mensagem de erro do primeiro campo obrigatorio nao satisfeito, ou null.
 * Pura de proposito: e o que os testes exercitam, e o que precisa bater
 * com validateCustomizationValues do backend.
 */
export function validateRequiredFields(
  cfg: StudioStoreProduct["customization_config"] | null | undefined,
  values: Record<string, any>,
  backActive: boolean,
  middleActive: boolean = false
): string | null {
  if (!cfg?.fields) return null;
  const ladoAtivo = (lado: "front" | "back" | "middle"): boolean => {
    if (lado === "back") return backActive;
    if (lado === "middle") return middleActive;
    return true;
  };
  const aplicaveis = cfg.fields.filter((f) => ladoAtivo(sideOf(f)));

  // "Crie minha arte pra mim": o cliente contratou a criacao e nao tem
  // arte pra enviar — dispensa o grupo de origem da arte.
  const arteContratada = aplicaveis.some(
    (f) =>
      (f.config as any)?.is_art_service === true && values[f.id] === "designer"
  );

  for (const side of ["front", "back", "middle"] as const) {
    const grupo = aplicaveis.filter(
      (f) => isArtSourceType(f.type) && sideOf(f) === side
    );
    if (!grupo.some((f) => f.required)) continue;
    if (arteContratada) continue;
    if (grupo.some((f) => isFilled(values[f.id]))) continue;
    const opcoes = grupo.map((f) => `"${f.label}"`).join(" ou ");
    return `Envie sua arte em ${opcoes}`;
  }

  for (const f of aplicaveis) {
    if (!f.required) continue;
    if (isArtSourceType(f.type)) continue; // ja coberto pelo grupo
    if (!isFilled(values[f.id])) return `Preencha "${f.label}"`;
  }
  return null;
}

// S6 — a faixa de quantidade incide sobre o preco de tabela; os deltas de
// personalizacao somam DEPOIS; o servico de arte entra uma vez por linha.
// E a mesma ordem do backend (services/precoDoStudio.js): se os dois
// lados discordassem, o cliente veria um total e pagaria outro.
function lineUnitPrice(line: CartLine): number {
  return precoUnitarioDaLinha(line);
}

function lineTotal(line: CartLine): number {
  return totalDaLinha(line);
}

// --- Hook ---
export function useStorefront(slug: string, opcoes?: { navegar?: NavegarNaVitrine }) {
  // Lido na hora de navegar, nao na montagem: quem passa o navegador e o
  // layout da rota, que pode recriar a funcao a cada render.
  const navegarRef = useRef<NavegarNaVitrine | undefined>(opcoes?.navegar);
  navegarRef.current = opcoes?.navegar;
  const [store, setStore] = useState<StorePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Fase 1A (25/09/2026): a falha de CARREGAR a loja guarda o status HTTP
  // (null = sem resposta) para a tela distinguir "nao achamos essa loja"
  // de "a loja nao carregou" — ver erroDaVitrine.ts. `tentativa` e o que
  // o "Tentar de novo" incrementa para refazer a carga.
  const [erroDeCarga, setErroDeCarga] = useState<ErroDeCarga | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const [stage, setStage] = useState<Stage>("list");
  const [grupoAberto, setGrupoAberto] = useState<{ categoria: any; produtos: StudioStoreProduct[] } | null>(null);
  const [activeProduct, setActiveProduct] = useState<StudioStoreProduct | null>(null);
  // S1 — os outros modelos da mesma categoria. Vazio quando o produto foi
  // aberto sozinho (sem categoria, ou categoria com um item so).
  const [activeSiblings, setActiveSiblings] = useState<StudioStoreProduct[]>([]);
  const [editingValues, setEditingValues] = useState<Record<string, any>>({});
  const [editingQty, setEditingQty] = useState(1);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingAddBack, setEditingAddBack] = useState<boolean>(false);
  const [editingAddMiddle, setEditingAddMiddle] = useState<boolean>(false);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);

  // Upload
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Checkout form
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card" | "on_delivery" | null>(null);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("pickup");
  // S8 — retirada por app: o cliente contrata Uber/99 e diz quem vai
  // buscar. Sem nome e placa a lojista entrega para o primeiro motoboy
  // que citar o numero do pedido.
  const [courierName, setCourierName] = useState("");
  const [courierPlate, setCourierPlate] = useState("");
  // S2 — cotacao de frete por CEP. `quote` guarda a resposta inteira do
  // servidor, nao so o valor: mode/eta/alert sao o que o cliente le.
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null);
  const [quotingShipping, setQuotingShipping] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressNeigh, setAddressNeigh] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressZip, setAddressZip] = useState("");
  const [notes, setNotes] = useState("");
  // Fase 2 (checkout em etapas, com a chave vitrine_v2): CPF/CNPJ na nota,
  // complemento do endereco e o "informo depois" da retirada por app.
  const [querDocumento, setQuerDocumento] = useState(false);
  const [customerDocument, setCustomerDocument] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [courierInformarDepois, setCourierInformarDepois] = useState(false);

  const [sending, setSending] = useState(false);
  const [sentOrder, setSentOrder] = useState<SentOrder | null>(null);
  // Fase 4 — "Pedir outro igual". Ver repeticaoDoPedido.ts.
  const [repeticao, setRepeticao] = useState<RepeticaoNoEstado | null>(null);

  // ── Fase 2: a sacola em gaveta ──────────────────────────────
  // A gaveta e estado da vitrine, nao uma tela: abre por cima de onde a
  // cliente esta (produto, home, checkout) sem tirar ela dali.
  const [sacolaAberta, setSacolaAberta] = useState(false);
  // "Adicionado a sacola": o toast com a miniatura e o "Ver sacola".
  const [adicionado, setAdicionado] = useState<{ lineId: string; n: number } | null>(null);
  // "Remover" com "Desfazer" por 5 s: a linha e onde ela estava.
  const [removida, setRemovida] = useState<{ line: CartLine; indice: number; n: number } | null>(null);
  // Editar uma linha a partir da gaveta volta para ela, na tela de onde a
  // cliente saiu (antes voltava para a home — useStorefront.ts:607).
  const voltaDaEdicao = useRef<{ stage: Stage; tela: TelaDaVitrine | null } | null>(null);

  // Carrega a loja
  useEffect(() => {
    if (!slug) return;
    // Resposta de uma tentativa antiga nao pode sobrescrever a nova.
    let vivo = true;
    setLoading(true);
    fetch(API_BASE + "/storefront/" + slug + "/studio/products")
      .then(async (r) => {
        let data: any = null;
        try { data = await r.json(); } catch { data = null; }
        if (!r.ok || !data || data.error) {
          const falha: any = new Error(data?.error || "Erro ao carregar loja");
          falha.status = r.status;
          throw falha;
        }
        return data;
      })
      .then((data) => {
        if (!vivo) return;
        setErroDeCarga(null);
        setStore(data as StorePayload);
        const pm = data.payment?.has_pix
          ? "pix"
          : data.payment?.has_card
          ? "card"
          : data.payment?.pay_on_delivery_enabled
          ? "on_delivery"
          : null;
        setPaymentMethod(pm);
      })
      .catch((e) => {
        if (!vivo) return;
        // Sem `status` e falha de rede (fetch rejeitou): nem houve resposta.
        setErroDeCarga({ status: typeof e?.status === "number" ? e.status : null, mensagem: e?.message || null });
        setError(e?.message || "Erro ao carregar loja");
      })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [slug, tentativa]);

  // Fase 2: a chave `vitrine_v2` (chaveVitrineV2.ts). O `?v2=` da URL e
  // guardado na aba JA no primeiro render: o link de peca aberto de fora
  // troca a URL pela home antes de a loja chegar (VitrineNaRota, entrada
  // na loja), e o parametro sumiria antes de ser lido.
  useState(() => (Platform.OS === "web" && slug ? vitrineV2NoNavegador(null, slug) : false));
  // Lida uma vez por loja carregada.
  const vitrineV2 = useMemo(
    () => (store && Platform.OS === "web" ? vitrineV2NoNavegador(store, slug) : store?.site && (store.site as any).vitrine_v2 === true),
    [store, slug],
  ) === true;

  /** "Tentar de novo" da tela de erro: refaz a carga da loja. */
  function recarregar() {
    setErroDeCarga(null);
    setError(null);
    setTentativa((t) => t + 1);
  }

  // Hidrata o carrinho do localStorage (web) por slug -- refresh nao perde nada.
  // Segue o padrao aura-food-storefront-<slug> do Food.
  useEffect(() => {
    if (Platform.OS !== "web" || !slug || typeof window === "undefined") {
      setCartHydrated(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem("aura-studio-storefront-" + slug);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCart(parsed as CartLine[]);
      }
    } catch {}
    setCartHydrated(true);
  }, [slug]);

  // Persiste o carrinho a cada mudanca (so depois de hidratar, pra nao
  // sobrescrever o salvo com [] no primeiro render). submitOrder limpa o
  // cart via setCart([]) -> este effect grava [] -> storage zera. OK.
  useEffect(() => {
    if (Platform.OS !== "web" || !slug || !cartHydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem("aura-studio-storefront-" + slug, JSON.stringify(cart));
    } catch {}
  }, [cart, slug, cartHydrated]);

  const cartSubtotal = useMemo(
    () => cart.reduce((s, l) => s + lineTotal(l), 0),
    [cart]
  );

  // S1 — a vitrine deixa de ser uma lista de SKUs. Categoria com 2+
  // modelos vira uma entrada só; o resto continua produto a produto.
  // Sem árvore no payload (base pré-migração da F0) o resultado é
  // idêntico à lista de antes.
  // S2 — frete cotado no servidor. O app NUNCA calcula o valor: manda o
  // CEP e o subtotal, e usa o que voltar. O `expected_delivery_fee` no
  // fechamento serve so pro servidor detectar cotacao velha (409).
  //
  // A cotacao e disparada por acao explicita (botao/blur), nao a cada
  // tecla: sao 8 digitos e o servidor geocodifica o CEP.
  async function quoteShipping(cepInformado?: string) {
    // Fase 2: o checkout em etapas cota no oitavo digito do CEP, antes de
    // o estado do campo chegar aqui — por isso o CEP pode vir por parametro.
    const cep = (cepInformado ?? addressZip).replace(/\D/g, "");
    if (cep.length !== 8) {
      setShippingQuote(null);
      setShippingError(cep.length === 0 ? null : "CEP incompleto");
      return;
    }
    setQuotingShipping(true);
    setShippingError(null);
    try {
      const url =
        API_BASE + "/storefront/" + slug + "/studio/shipping-quote" +
        "?cep=" + cep + "&subtotal=" + cartSubtotal;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Não foi possível calcular o frete");
      setShippingQuote(data);
      // fee null com error e "fora da area": nao e falha, e resposta.
      setShippingError(data?.fee == null && data?.error ? data.error : null);
    } catch (e: any) {
      setShippingQuote(null);
      setShippingError(e?.message || "Não foi possível calcular o frete");
    } finally {
      setQuotingShipping(false);
    }
  }

  // Frete cobrado: so entrega tem. Retirada e retirada por app sao zero —
  // no segundo caso quem paga o app e o cliente, direto.
  const shippingFee = useMemo(() => {
    if (deliveryType !== "delivery") return 0;
    const f = shippingQuote?.fee;
    return typeof f === "number" ? f : 0;
  }, [deliveryType, shippingQuote]);

  /**
   * O desconto do Pix, com a MESMA conta do servidor.
   *
   * O backend passou a aplicar o desconto no pedido Studio no S0
   * (routes/studioStorefront.js). Ate aqui o app somava subtotal + frete
   * e pronto: a partir do dia em que uma lojista ligasse o desconto, a
   * tela mostraria um total e a cobranca seria outra.
   *
   * A formula e copiada de la de proposito — `Math.round(subtotal * pct)
   * / 100`, arredondando em centavos — e o frete fica FORA, tambem como
   * la. Conta de dinheiro em dois lugares e conta que diverge; o jeito de
   * conviver com isso e ela ser identica e ter teste dos dois lados.
   */
  const pixDiscountPct = Number((store as any)?.payment?.pix_discount_pct) || 0;
  const pixDiscount = useMemo(() => {
    if (paymentMethod !== "pix" || pixDiscountPct <= 0) return 0;
    return Math.round(cartSubtotal * pixDiscountPct) / 100;
  }, [paymentMethod, pixDiscountPct, cartSubtotal]);

  const cartTotal = useMemo(
    () => cartSubtotal - pixDiscount + shippingFee,
    [cartSubtotal, pixDiscount, shippingFee],
  );

  // ── Fase 2: a sacola cotada no servidor (contrato B3) ──────
  // Com a chave, sacola e checkout mostram o que o servidor responde, com
  // as MESMAS funcoes que ele usa para cobrar. A conta local e so a
  // estimativa do primeiro instante. A resposta vale para a sacola que a
  // pediu (assinatura): mexeu na sacola, volta a estimativa ate a nova.
  const [cotacaoNoServidor, setCotacaoNoServidor] = useState<{ assinatura: string; dados: CotacaoDaSacola } | null>(null);
  const [cotando, setCotando] = useState(false);
  const assinaturaAtual = useMemo(
    () => (vitrineV2 && cart.length ? assinaturaDaCotacao(cart) : ""),
    [vitrineV2, cart],
  );
  useEffect(() => {
    if (!vitrineV2 || !slug || cart.length === 0 || !assinaturaAtual) return;
    if (cotacaoNoServidor?.assinatura === assinaturaAtual) return;
    let vivo = true;
    setCotando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(API_BASE + "/storefront/" + slug + "/studio/cotacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: itensDoPedido(cart) }),
        });
        const j = await r.json().catch(() => null);
        const dados = r.ok ? lerCotacao(j, cart.length) : null;
        if (vivo && dados) setCotacaoNoServidor({ assinatura: assinaturaAtual, dados });
      } catch {
        // Cotacao e conforto: sem ela fica a estimativa, e o servidor
        // continua sendo quem cobra no pedido.
      } finally {
        if (vivo) setCotando(false);
      }
    }, RESPIRO_DA_COTACAO_MS);
    return () => { vivo = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vitrineV2, slug, assinaturaAtual]);
  const cotacao = cotacaoNoServidor && cotacaoNoServidor.assinatura === assinaturaAtual
    ? cotacaoNoServidor.dados : null;

  // Trocar de modalidade ou mexer no carrinho invalida a cotacao: o valor
  // depende do subtotal (frete gratis acima de X).
  // Fase 2 (chave): no checkout em etapas a cotacao depende so do CEP — a
  // cliente que olha "Retirar na loja" e volta para "Receber em casa" nao
  // pode perder o frete (nem o "fora da area") que ja estava na tela.
  useEffect(() => {
    if (vitrineV2) return;
    setShippingQuote(null); setShippingError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryType]);

  const vitrine: VitrineEntry[] = useMemo(
    () => (store ? agruparVitrine(store.products, store.categories || []) : []),
    [store]
  );

  // O preco da peca aberta no configurador. `unitario` nao inclui o
  // servico de arte (e por linha); `total` e o que a linha vai custar.
  const configuringPreco = useMemo(() => {
    if (!activeProduct) return null;
    return precoDaPeca({
      produto: activeProduct,
      quantidade: editingQty,
      values: editingValues,
      verso: editingAddBack,
      meio: editingAddMiddle,
    });
  }, [activeProduct, editingValues, editingAddBack, editingAddMiddle, editingQty]);
  const configuringUnitPrice = configuringPreco?.unitario ?? 0;
  const configuringLineTotal = configuringPreco?.total ?? 0;
  const configuringArtDelta = configuringPreco?.arte ?? 0;

  /**
   * Troca de tela: o estado muda aqui e, na vitrine com rotas, a URL
   * acompanha. `tela` null = sem URL propria (a confirmacao, nesta fase).
   */
  function irPara(s: Stage, tela: TelaDaVitrine | null, modo: ModoDeNavegar) {
    setStage(s);
    if (tela && navegarRef.current) navegarRef.current(tela, modo);
  }

  function goTo(s: Stage) {
    // A tela de cada stage. "configure" e "modelos" precisam do alvo, que
    // ja esta no estado; quem abre produto e grupo usa openConfigure e
    // abrirGrupo, que sabem qual e.
    const tela: TelaDaVitrine | null =
      s === "list" ? { tipo: "home" }
      : s === "checkout" ? { tipo: "finalizar" }
      : s === "lote" ? { tipo: "orcamento" }
      : s === "configure" && activeProduct ? { tipo: "produto", id: String(activeProduct.id) }
      : s === "modelos" && grupoAberto ? { tipo: "categoria", categoria: chaveDaCategoria(grupoAberto.categoria) }
      : null;
    // Voltar para a loja VOLTA no historico quando a home esta nele: o
    // voltar do navegador, depois, nao reabre a peca que a cliente fechou.
    irPara(s, tela, s === "list" ? "voltar" : "empilhar");
  }

  /**
   * Abre a grade de modelos de um grupo.
   *
   * Antes o cartao do grupo abria o PRIMEIRO modelo direto, e os
   * outros viravam chips sem foto: quem vende variacao de louca
   * vendia sempre a mais barata.
   */
  function abrirGrupo(categoria: any, produtos: StudioStoreProduct[]) {
    setGrupoAberto({ categoria: categoria || null, produtos: produtos || [] });
    const chave = chaveDaCategoria(categoria);
    irPara("modelos", chave ? { tipo: "categoria", categoria: chave } : null, "empilhar");
  }

  function setFieldValue(fieldId: string, value: any) {
    setEditingValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function openConfigure(
    product: StudioStoreProduct,
    siblings: StudioStoreProduct[] = [],
    inicial?: ValoresIniciais,
  ) {
    abrirProduto(product, siblings, inicial);
    irPara("configure", { tipo: "produto", id: String(product.id) }, "empilhar");
  }

  /**
   * Abre a peca no configurador, sem mexer na URL.
   *
   * `inicial` (Fase 4): os valores com que o configurador abre — o
   * "Pedir outro igual". Sem ele, o configurador em branco de sempre.
   */
  function abrirProduto(
    product: StudioStoreProduct,
    siblings: StudioStoreProduct[] = [],
    inicial?: ValoresIniciais,
  ) {
    setActiveProduct(product);
    setActiveSiblings(siblings.length > 1 ? siblings : []);
    setEditingLineId(null);
    // Sem item, valoresIniciaisDaRepeticao devolve exatamente o de
    // sempre: a primeira cor de cada campo de cor, quantidade 1.
    const ini = inicial || valoresIniciaisDaRepeticao(null, product);
    setEditingValues(ini.valores);
    setEditingQty(ini.quantidade);
    setEditingAddBack(ini.verso);
    setEditingAddMiddle(ini.meio);
    setStage("configure");
  }

  /** A tela em que a cliente esta agora, pelo estado (para voltar a ela). */
  function telaAtual(): TelaDaVitrine | null {
    if (stage === "list") return { tipo: "home" };
    if (stage === "checkout") return { tipo: "finalizar" };
    if (stage === "lote") return { tipo: "orcamento" };
    if (stage === "configure" && activeProduct) return { tipo: "produto", id: String(activeProduct.id) };
    if (stage === "modelos" && grupoAberto) return { tipo: "categoria", categoria: chaveDaCategoria(grupoAberto.categoria) };
    return null;
  }

  /**
   * "Pedir outro igual" (Fase 4): busca a personalizacao do pedido para
   * a peca `produtoId`. A carga no configurador acontece no efeito
   * abaixo, quando a peca estiver aberta — a ordem entre a resposta do
   * pedido e a carga da loja nao importa.
   *
   * Chamado pela rota do produto quando a URL traz `?repetir=<token>`.
   * O mesmo pedido para a mesma peca nao e buscado de novo (voltar e
   * avancar do navegador).
   */
  function pedirRepeticao(token: string, produtoId: string) {
    const t = String(token || "").trim();
    const id = String(produtoId || "").trim();
    if (!t || !id || !slug) return;
    if (repeticao && repeticao.token === t && repeticao.produtoId === id && repeticao.estado !== "erro") return;
    setRepeticao({ token: t, produtoId: id, estado: "carregando", numero: null, item: null });
    fetch(API_BASE + "/storefront/" + slug + "/studio/pedido/" + encodeURIComponent(t) + "/repetir")
      .then(async (r) => {
        const data = (await r.json().catch(() => null)) as RespostaDaRepeticao | null;
        if (!r.ok || !data || !Array.isArray(data.itens)) throw new Error("repetir " + r.status);
        return data;
      })
      .then((data) => {
        const item = itemParaOProduto(data, id);
        setRepeticao((atual) => {
          // A cliente ja saiu para outro pedido/peca: resposta velha.
          if (!atual || atual.token !== t || atual.produtoId !== id) return atual;
          return { ...atual, numero: data.numero, item, estado: item ? "pronta" : "indisponivel" };
        });
      })
      .catch(() => {
        setRepeticao((atual) =>
          atual && atual.token === t && atual.produtoId === id ? { ...atual, estado: "erro" } : atual
        );
      });
  }

  // Carrega a personalizacao do pedido quando a peca dele esta aberta.
  // Uma vez so: depois de "aplicada", o que a cliente mexer e dela.
  useEffect(() => {
    if (!repeticao || repeticao.estado !== "pronta" || !repeticao.item) return;
    if (!activeProduct || String(activeProduct.id) !== repeticao.produtoId) return;
    // Editando uma linha da sacola a peca e a da linha, nao a do pedido.
    if (editingLineId) return;
    const ini = valoresIniciaisDaRepeticao(repeticao.item, activeProduct);
    setEditingValues(ini.valores);
    setEditingQty(ini.quantidade);
    setEditingAddBack(ini.verso);
    setEditingAddMiddle(ini.meio);
    setRepeticao({ ...repeticao, estado: "aplicada" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeticao, activeProduct?.id, editingLineId]);

  function editCartLine(line: CartLine) {
    // Fase 2: editar pela gaveta lembra de onde a cliente veio — ao salvar,
    // ela volta para la com a gaveta aberta.
    voltaDaEdicao.current = vitrineV2 ? { stage, tela: telaAtual() } : null;
    setSacolaAberta(false);
    setActiveProduct(line.product);
    // Editando uma linha do carrinho, o seletor de modelo some: trocar o
    // modelo aqui viraria outro produto na mesma linha, e o cliente
    // esperaria ter adicionado um item novo.
    setActiveSiblings([]);
    setEditingLineId(line.lineId);
    setEditingValues(line.values);
    setEditingQty(line.qty);
    setEditingAddBack(line.hasBackSelected === true);
    // Ver nota em lineUnitPrice: a bandeira do meio vive dentro de
    // `values`, nao num campo dedicado da CartLine.
    setEditingAddMiddle(line.values?.has_middle_selected === true);
    irPara("configure", { tipo: "produto", id: String(line.product.id) }, "empilhar");
  }

  // S1 — troca de modelo dentro da categoria, sem sair do configurador.
  // O que o cliente ja preencheu vai junto: transportarValores casa os
  // campos por TIPO, porque os ids nao sao estaveis entre produtos.
  function switchModel(product: StudioStoreProduct) {
    if (!activeProduct || product.id === activeProduct.id) return;
    const levados = transportarValores(
      activeProduct.customization_config,
      product.customization_config,
      editingValues
    );
    // Cor padrao do modelo novo quando a antiga nao teve para onde ir.
    const cfg = product.customization_config;
    if (cfg?.fields) {
      for (const f of cfg.fields) {
        if (f.type === "color" && levados[f.id] === undefined && f.config.colors?.length) {
          levados[f.id] = f.config.colors[0];
        }
      }
    }
    setActiveProduct(product);
    setEditingValues(levados);
    setEditingAddBack(levados.has_back_selected === true);
    // Mesma bandeira do verso (categoryGrouping.transportarValores so
    // carrega has_back_selected hoje — o meio segue a mesma condicao
    // aqui por simetria; se um dia o transporte ganhar has_middle_selected
    // la, este lado ja esta pronto pra receber).
    setEditingAddMiddle(levados.has_middle_selected === true);
    setError(null);
    // Trocar de modelo troca a URL sem empilhar: o voltar do navegador
    // sai do produto, nao desfila pelos modelos que a cliente olhou.
    navegarRef.current?.({ tipo: "produto", id: String(product.id) }, "trocar");
  }

  /**
   * @param opcoes.direto "Comprar agora" — pula a lista e vai pro
   *   checkout. Quem clica ali ja decidiu; devolver pra vitrine faz a
   *   pessoa procurar o carrinho pra fazer o que ela acabou de pedir.
   *   Mesma regra que a loja comum aplica no botao "Comprar agora".
   */
  function commitConfigure(opcoes?: { direto?: boolean }) {
    if (!activeProduct) return;
    const cfg = activeProduct.customization_config;
    const backActive = effectiveBackSelected(cfg, editingAddBack);
    const middleActive = effectiveMiddleSelected(cfg, editingAddMiddle);
    const faltou = validateRequiredFields(cfg, editingValues, backActive, middleActive);
    if (faltou) {
      setError(faltou);
      return;
    }
    setError(null);
    // has_middle_selected nao e campo, e bandeira -- guardamos ela dentro
    // do proprio `values` (ver nota em lineUnitPrice) pra sobreviver ate
    // o carrinho/checkout, ja que CartLine nao tem um slot dedicado tipo
    // hasBackSelected pro meio.
    let valuesToCommit: Record<string, any> = { ...editingValues, has_middle_selected: editingAddMiddle };
    if (cfg?.has_back === true && !backActive && cfg.fields) {
      const cleaned: Record<string, any> = { ...valuesToCommit };
      for (const f of cfg.fields) {
        if (sideOf(f) === "back") delete cleaned[f.id];
      }
      valuesToCommit = cleaned;
    }
    if (cfg?.has_middle === true && !middleActive && cfg.fields) {
      const cleaned: Record<string, any> = { ...valuesToCommit };
      for (const f of cfg.fields) {
        if (sideOf(f) === "middle") delete cleaned[f.id];
      }
      valuesToCommit = cleaned;
    }
    if (editingLineId) {
      setCart((prev) =>
        prev.map((l) =>
          l.lineId === editingLineId
            ? { ...l, qty: editingQty, values: valuesToCommit, hasBackSelected: editingAddBack }
            : l
        )
      );
      // Fase 2: salvar a edicao volta para a gaveta, na tela de onde a
      // cliente saiu. O voltar do navegador tira o configurador de cima.
      if (vitrineV2) {
        const volta = voltaDaEdicao.current;
        voltaDaEdicao.current = null;
        setEditingLineId(null);
        setSacolaAberta(true);
        // Voltando para uma peca (a gaveta foi aberta na pagina dela): a
        // peca abre de novo, limpa — e o estado ja esta la quando a rota
        // desenha, mesmo que seja a mesma peca que acabou de ser editada.
        const tela = volta?.tela || null;
        if (tela?.tipo === "produto") {
          const p = (store?.products || []).find((x) => String(x.id) === tela.id);
          if (p) {
            abrirProduto(p, []);
            navegarRef.current?.(tela, "voltar");
            return;
          }
        }
        setActiveProduct(null);
        setEditingAddBack(false);
        setEditingAddMiddle(false);
        if (tela && volta) irPara(volta.stage, tela, "voltar");
        else irPara("list", { tipo: "home" }, "voltar");
        return;
      }
    } else {
      medirNaVitrine((store as any)?.site?.rastreadores, {
        nome: "add_to_cart",
        itens: [itemDoProduto(activeProduct, configuringUnitPrice, editingQty)],
      });
      const lineId = String(Date.now()) + "-" + Math.random().toString(36).slice(2, 7);
      setCart((prev) => [
        ...prev,
        {
          lineId, product: activeProduct, qty: editingQty,
          values: valuesToCommit, hasBackSelected: editingAddBack,
        },
      ]);
      // Fase 2 (Tela 1, "Acabou de adicionar"): a cliente fica na peca, com
      // a personalizacao na tela, e o toast "Adicionado a sacola" oferece a
      // gaveta. Antes a peca sumia e a vitrine voltava para a home — quem
      // queria a mesma caneca para a irma tinha de montar tudo de novo.
      if (vitrineV2 && !opcoes?.direto) {
        setAdicionado((a) => ({ lineId, n: (a?.n || 0) + 1 }));
        return;
      }
    }
    setActiveProduct(null);
    setEditingLineId(null);
    setEditingAddBack(false);
    setEditingAddMiddle(false);
    // Editar uma linha do carrinho NUNCA vai direto pro checkout, mesmo
    // que o botao direto seja clicado: quem esta editando veio de la e
    // volta pra lista, que e de onde ela decide.
    // "Comprar agora" TROCA o produto pelo checkout: a peca virou item da
    // sacola, e o voltar do navegador levaria a um configurador em branco.
    if (opcoes?.direto && !editingLineId) irPara("checkout", { tipo: "finalizar" }, "trocar");
    else irPara("list", { tipo: "home" }, "voltar");
  }

  function removeCartLine(lineId: string) {
    const indice = cart.findIndex((l) => l.lineId === lineId);
    if (indice >= 0) {
      const line = cart[indice];
      setRemovida((r) => ({ line, indice, n: (r?.n || 0) + 1 }));
    }
    setCart((prev) => prev.filter((l) => l.lineId !== lineId));
  }

  /** "Desfazer": a linha volta para o mesmo lugar da sacola. */
  function desfazerRemocao() {
    const r = removida;
    if (!r) return;
    setRemovida(null);
    setCart((prev) => {
      if (prev.some((l) => l.lineId === r.line.lineId)) return prev;
      const novo = prev.slice();
      novo.splice(Math.min(r.indice, novo.length), 0, r.line);
      return novo;
    });
  }

  /**
   * Quantidade digitada na gaveta (decisao do PO: quantidade digitavel,
   * alem do - / +). Minimo 1 — zerar e "Remover", que tem o "Desfazer".
   */
  function setCartLineQty(lineId: string, qty: number) {
    const q = Math.max(1, Math.min(9999, Math.floor(Number(qty) || 1)));
    setCart((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, qty: q } : l)));
  }

  function abrirSacola() {
    setAdicionado(null);
    setSacolaAberta(true);
  }

  /**
   * uploadImage -- CONTRATO para Agente G (FieldImage)
   *
   * Chame com o fieldId e o File selecionado pelo picker.
   * O hook faz: FileReader -> base64 -> POST /upload -> setFieldValue(fieldId, url)
   * Estados expostos: uploadingFieldId, uploadError, clearUploadError
   *
   * O Agente G pode usar esta funcao OU reimplementar dentro do FieldImage
   * (que recebe `onChange` direto). Esta implementacao e o fallback/referencia.
   */
  async function uploadImage(fieldId: string, file: File, maxMb: number = 15): Promise<void> {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      setUploadError("Aceitos: PNG, JPG, WEBP");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setUploadError(`Arquivo grande demais (max ${maxMb}MB)`);
      return;
    }
    setUploadingFieldId(fieldId);
    setUploadError(null);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
        reader.readAsDataURL(file);
      });
      const res = await fetch(API_BASE + "/storefront/" + slug + "/studio/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_base64: dataUrl.split(",")[1],
          content_type: file.type,
          filename: file.name,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFieldValue(fieldId, data.url);
    } catch (e: any) {
      setUploadError(e?.message || "Erro no upload");
    } finally {
      setUploadingFieldId(null);
    }
  }

  // Guarda de toque duplo: o `sending` do estado so chega no proximo
  // render, e dois toques no mesmo quadro criariam dois pedidos.
  const enviandoAgora = useRef(false);

  async function submitOrder() {
    if (enviandoAgora.current) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      setError("Nome e telefone obrigatórios");
      return;
    }
    if (cart.length === 0) {
      setError("Carrinho vazio");
      return;
    }
    if (deliveryType === "delivery" && !addressStreet.trim()) {
      setError("Informe o endereço de entrega");
      return;
    }
    // Cotacao ja feita e o CEP esta fora da area: barrar aqui poupa o
    // cliente de mandar o pedido para levar 400. Sem cotacao nenhuma o
    // envio segue — o servidor e quem decide, e ele recalcula.
    if (
      deliveryType === "delivery" &&
      shippingQuote &&
      shippingQuote.fee == null &&
      shippingQuote.error
    ) {
      setError(shippingQuote.error);
      return;
    }
    // Fase 2: retirada por app aceita "informo depois" (decisao do PO) —
    // a cliente so sabe quem vem quando chama o app, dias depois.
    const courierDepois = vitrineV2 && deliveryType === "courier" && courierInformarDepois;
    if (deliveryType === "courier" && !courierDepois) {
      if (!courierName.trim()) {
        setError("Informe o nome de quem vai retirar o pedido");
        return;
      }
      if (!normalizePlate(courierPlate)) {
        setError("Placa inválida. Use o formato ABC1234 ou ABC1D23");
        return;
      }
    }
    // CPF/CNPJ na nota: so com a chave (o checkout de hoje nao pergunta).
    const documento = vitrineV2 && querDocumento ? digitos(customerDocument) : "";
    if (documento) {
      const sit = situacaoDoDocumento(documento);
      if (sit !== "cpf" && sit !== "cnpj") {
        setError("CPF/CNPJ inválido. Confira os dígitos.");
        return;
      }
    }
    enviandoAgora.current = true;
    setSending(true);
    setError(null);
    try {
      const body: Record<string, any> = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || null,
        delivery_type: deliveryType,
        payment_method: paymentMethod || undefined,
        notes: notes.trim() || null,
        // Os itens como o servidor espera — a MESMA montagem da cotacao
        // (cotacaoDaSacola.ts): verso so escolhido E preenchido (decisao
        // do Caio, 04/09/2026), e has_middle_selected espelho do verso.
        items: itensDoPedido(cart),
        address_zip: addressZip.replace(/\D/g, "") || null,
        address_street: addressStreet.trim() || null,
        address_number: addressNumber.trim() || null,
        address_neighborhood: addressNeigh.trim() || null,
        address_city: addressCity.trim() || null,
        address_state: addressState.trim().toUpperCase() || null,
        // S8 — normalizado aqui tambem, mas o servidor revalida.
        courier_name: deliveryType === "courier" && !courierDepois ? courierName.trim() : null,
        courier_plate: deliveryType === "courier" && !courierDepois ? normalizePlate(courierPlate) : null,
        // S2 — o servidor recalcula o frete pelo CEP; isto e so a cotacao
        // que o cliente VIU. Diferenca vira 409 em vez de cobranca errada.
        expected_delivery_fee:
          deliveryType === "delivery" && typeof shippingQuote?.fee === "number"
            ? shippingQuote.fee
            : undefined,
        // Onda 1B: de onde a cliente veio (link da Aurinha, contrato da
        // migration 313). Guardado na aba ao abrir o link; ausente ou
        // invalido nao manda nada — atribuicao nunca bloqueia o pedido.
        ...camposDeAtribuicao(atribuicaoGuardada(slug)),
      };
      if (vitrineV2) {
        // Fase 2 (contrato B1). `customer_document` e o campo novo; o
        // `customer_cpf_cnpj` + `request_nfce` e o que o servidor de hoje
        // (e a loja comum) ja le — os dois caem na mesma validacao.
        if (documento) {
          body.customer_document = documento;
          body.customer_cpf_cnpj = documento;
          body.request_nfce = true;
        }
        if (deliveryType === "delivery") body.address_complement = addressComplement.trim() || null;
        if (courierDepois) body.courier_informar_depois = true;
      }
      const res = await fetch(API_BASE + "/storefront/" + slug + "/studio/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      // A loja fechou enquanto a cliente comprava (409 com `motivo`): a
      // vitrine inteira passa a se comportar como fechada e o checkout
      // mostra o recado com o orcamento, em vez do recado como erro cru.
      const fechou = lojaFechouNoEnvio(res.status, data);
      if (fechou) {
        setStore((s) => (s ? ({ ...s, pedidos: fechou } as StorePayload) : s));
        return;
      }
      if (data.error) throw new Error(data.error);
      medirNaVitrine((store as any)?.site?.rastreadores, {
        nome: "purchase",
        pedido: String(data.order_number || data.order_id || ""),
        valor: Number(data.total) || cartTotal,
        frete: shippingFee || undefined,
        itens: itensDaSacola(cart, lineUnitPrice),
      });

      // Fase 2: com a chave, o pedido ganha endereco proprio. O id fica na
      // aba (para "Ja paguei" e o comprovante), o pedido em andamento fica
      // na loja (Tela 8 e volta do cartao), e os dados da cliente ficam
      // lembrados por 90 dias. Sem token (backend antes do B1 ou coluna
      // da migration 322 ausente), cai na confirmacao antiga.
      const token = typeof data.pedido_token === "string" && data.pedido_token.trim() ? data.pedido_token.trim() : null;
      if (vitrineV2) {
        guardarDadosLembrados(slug, {
          name: customerName.trim(),
          phone: customerPhone.trim(),
          email: customerEmail.trim(),
          customer_cpf_cnpj: documento,
          request_nfce: !!documento,
          address_zip: addressZip,
          address_street: addressStreet.trim(),
          address_number: addressNumber.trim(),
          address_complement: addressComplement.trim(),
          address_neighborhood: addressNeigh.trim(),
          address_city: addressCity.trim(),
          address_state: addressState.trim().toUpperCase(),
        }, storageLocal());
        if (data.order_id) {
          guardarPedidoPendente(slug, {
            id: String(data.order_id),
            token,
            order_number: data.order_number != null ? String(data.order_number) : null,
            payment_method: data.payment_method || paymentMethod || null,
            total: Number(data.total) || cartTotal,
            pecas: cart.reduce((n, l) => n + l.qty, 0),
            imagens: cart.map((l) => l.product.image_url).filter((u): u is string => !!u).slice(0, 4),
            card_init_point: data.card?.init_point || null,
          }, storageLocal());
        }
        if (token && data.order_id) guardarIdDoPedido(token, String(data.order_id), storageDaAba());
      }

      setCart([]);
      if (vitrineV2 && token && navegarRef.current) {
        setSentOrder(data);
        irPara("list", { tipo: "pedido", token }, "trocar");
        // Cartao: a pagina do pedido diz "voce paga no Mercado Pago e
        // volta pra ca" e o navegador segue. A volta cai na mesma pagina
        // com o status real (Tela 6).
        if (data.card?.init_point && Platform.OS === "web" && typeof window !== "undefined") {
          setTimeout(() => { window.location.href = data.card.init_point; }, 1200);
        }
        return;
      }
      setSentOrder(data);
      setStage("sent");
      if (data.card?.init_point && Platform.OS === "web" && typeof window !== "undefined") {
        setTimeout(() => { window.location.href = data.card.init_point; }, 800);
      }
    } catch (e: any) {
      setError(e?.message || "Erro ao enviar pedido");
    } finally {
      enviandoAgora.current = false;
      setSending(false);
    }
  }

  /**
   * Fase 2: abre a pagina de um pedido (a Tela 8 — "Continuar esse
   * pedido"). Na vitrine com rotas e navegacao; no endereco de dentro de
   * casa (sem roteador), o navegador vai direto ao endereco da loja.
   */
  function irParaPedido(token: string) {
    if (!token) return;
    if (navegarRef.current) {
      navegarRef.current({ tipo: "pedido", token }, "empilhar");
      return;
    }
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.assign("/" + encodeURIComponent(slug) + "/pedido/" + encodeURIComponent(token));
    }
  }

  function resetToList() {
    irPara("list", { tipo: "home" }, "voltar");
    setSentOrder(null);
  }

  /**
   * Onda 1B: poe o estado na tela que a URL pede. Quem chama e a rota
   * (VitrineNaRota.tsx), ao montar e quando o endereco muda — e NUNCA
   * navega: a URL ja e a verdade. Devolve a resolucao para a rota tratar
   * o redirecionamento (peca que saiu da loja, categoria sem grupo), ou
   * null enquanto a loja nao carregou.
   */
  function sincronizarComTela(tela: TelaDaVitrine): Resolucao | null {
    if (!store) return null;
    const r = resolverTela(tela, store, vitrine);
    switch (r.acao) {
      case "home": setStage("list"); break;
      case "orcamento": setStage("lote"); break;
      // O pedido enviado fica na URL do checkout ate a Fase 2 (confirmacao
      // em /pedido/<token>): voltar a /finalizar nao o apaga.
      case "finalizar": setStage((s) => (s === "sent" ? "sent" : "checkout")); break;
      case "categoria":
        if (chaveDaCategoria(grupoAberto?.categoria) !== chaveDaCategoria(r.categoria)) {
          setGrupoAberto({ categoria: r.categoria, produtos: r.produtos });
        }
        setStage("modelos");
        break;
      case "produto":
        // A mesma peca ja aberta (editando uma linha da sacola, ou o
        // avancar do navegador): o que a cliente preencheu fica.
        if (activeProduct && String(activeProduct.id) === String(r.produto.id)) setStage("configure");
        else abrirProduto(r.produto, r.irmaos);
        break;
    }
    return r;
  }

  return {
    // Loja
    store, loading, error, setError,
    erroDeCarga, recarregar,
    // Navegacao
    stage, goTo, sincronizarComTela,
    abrirGrupo, grupoAberto,
    // Configurador
    activeProduct,
    editingValues, setFieldValue,
    editingQty, setEditingQty,
    editingAddBack, setEditingAddBack,
    editingAddMiddle, setEditingAddMiddle,
    configuringUnitPrice,
    // Fase 2: o total da linha (servico de arte uma vez por linha).
    configuringLineTotal, configuringArtDelta,
    openConfigure, editCartLine, commitConfigure,
    activeSiblings, switchModel,
    vitrine,
    // Pedir outro igual (Fase 4)
    repeticao, pedirRepeticao,
    dispensarRepeticao: () => setRepeticao(null),
    // Upload
    uploadImage, uploadingFieldId, uploadError,
    clearUploadError: () => setUploadError(null),
    // Carrinho
    cart, cartSubtotal, removeCartLine,
    // Fase 2 — a chave, a gaveta, a quantidade digitavel, o "Desfazer" e
    // a cotacao no servidor.
    vitrineV2,
    sacolaAberta, abrirSacola, fecharSacola: () => setSacolaAberta(false),
    adicionado, limparAdicionado: () => setAdicionado(null),
    removida, desfazerRemocao, esquecerRemocao: () => setRemovida(null),
    setCartLineQty,
    cotacao, cotando,
    // Checkout
    customerName, setCustomerName,
    customerPhone, setCustomerPhone: (v: string) => setCustomerPhone(maskPhone(v)),
    customerEmail, setCustomerEmail,
    paymentMethod, setPaymentMethod,
    deliveryType, setDeliveryType,
    courierName, setCourierName,
    courierPlate, setCourierPlate: (v: string) => setCourierPlate(maskPlate(v)),
    shippingQuote, quotingShipping, shippingError, quoteShipping,
    shippingFee, cartTotal,
    // S5 — o desconto do Pix, para o resumo mostrar a linha.
    pixDiscount, pixDiscountPct,
    addressStreet, setAddressStreet,
    addressNumber, setAddressNumber,
    addressNeigh, setAddressNeigh,
    addressCity, setAddressCity,
    addressState, setAddressState: (v: string) => setAddressState(v.toUpperCase().slice(0, 2)),
    addressZip, setAddressZip,
    notes, setNotes,
    querDocumento, setQuerDocumento,
    customerDocument, setCustomerDocument,
    addressComplement, setAddressComplement,
    courierInformarDepois, setCourierInformarDepois,
    sending, submitOrder,
    // Confirmacao
    sentOrder, resetToList, irParaPedido,
    // Internos (prefixo _ -- sub-componentes de display apenas)
    _editingLineId: editingLineId,
    _effectiveBackSelected: effectiveBackSelected,
    _effectiveMiddleSelected: effectiveMiddleSelected,
    _lineUnitPrice: lineUnitPrice,
    _lineTotal: lineTotal,
  };
}

export type StorefrontState = ReturnType<typeof useStorefront>;
