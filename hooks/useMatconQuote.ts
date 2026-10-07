// ============================================================
// AURA. — Matcon M1: "Salvar orçamento" do Caixa
// (docs/matcon-faseamento-po-ux.md §3 · docs/CONTRACT_MATCON.md · mockup
// docs/mockups/matcon-modulo.html #carrinho, bloco "Salvar orçamento")
//
// 22/09/2026. Isola tudo que o botão "Salvar orçamento" do CartPanel
// precisa: a mutation createQuote, o estado do card "Orçamento #N salvo" e
// os dois botões do card ("Enviar no WhatsApp" → markQuoteSent, "Ver
// orçamentos" → /matcon/orcamentos). O CartPanel só recebe onSaveQuote/
// savingQuote/savedQuote (props opcionais, ver components/screens/pdv/
// CartPanel.tsx) — nenhuma chamada de API mora lá.
//
// O carrinho NÃO é limpo depois de salvar (o vendedor pode imprimir e
// finalizar também) — só quem chama `useCart`/`usePdvState` decide isso.
//
// 22/09/2026 (preço no cartão, docs/mockups/preco-no-cartao.html tela 6):
// os itens vão com o preço no DINHEIRO; com `cardTotal` (opção da loja
// ligada) o card e o WhatsApp falam os dois — "R$ 1.000,00 no dinheiro ou
// PIX · R$ 1.110,00 no cartão". Sem ele, tudo como antes.
//
// 23/09/2026 (QA em produção): o POST /matcon/quotes ainda não existia no
// backend — o botão "Orçamento" mostrava "Rota nao encontrada" e nada
// imprimia. A primeira correção (#946) imprimia quando salvar falhava e,
// depois de um 404, desistia de salvar na sessão.
//
// 23/09/2026 (QA final, backend do M1 chegando): o fluxo agora é UM clique
// = IMPRIME E SALVA.
//   1. `onPrint` roda PRIMEIRO, síncrono, dentro do próprio clique: o
//      navegador só deixa `window.open` abrir a janela de impressão no
//      gesto do usuário — depois de um `await` da API ele bloqueia como
//      pop-up. Por isso não esperamos o servidor para imprimir.
//   2. Em seguida salva (createQuote). Deu certo → card "Orçamento #N
//      salvo" com "Enviar no WhatsApp" / "Ver orçamentos". Falhou → o papel
//      já saiu; o toast diz em português simples que ele não ficou guardado
//      (textoDoErro, components/screens/pdv/erroNoCaixa.ts — nunca "Rota nao
//      encontrada"). O salvar continua disponível no próximo clique, mesmo
//      depois de um 404: o backend pode ter chegado no meio do dia.
//   Limite conhecido: o papel sai sem o número do orçamento (ele só existe
//   depois da resposta do servidor).
//
// 07/10/2026 — EDITAR. Com `editing` (o orçamento aberto pelo "Editar" da
// tela de Orçamentos), o mesmo clique imprime e salva POR CIMA: PATCH no
// mesmo id, mesmo número, mesmo link público. Vão só os campos que o Caixa
// conhece (itens, desconto, cliente, vendedor); validade, obra e
// observação não são mandadas e por isso ficam como estavam. O desconto vai
// sempre, até zero — senão tirar o desconto no Caixa não tiraria do
// orçamento. `onSaved` avisa quem chamou (o Caixa sai do modo edição e
// atualiza as listas).
// ============================================================
import { useState } from "react";
import { router } from "expo-router";
import { toast } from "@/components/Toast";
import { openWhatsApp } from "@/utils/whatsapp";
import { matconApi, type Quote, type QuoteCreateBody, type QuoteItem } from "@/services/matconApi";
import type { SavedQuoteCard } from "@/components/screens/pdv/CartPanel";
import { textoDoErro } from "@/components/screens/pdv/erroNoCaixa";

// "YYYY-MM-DD" → "29/09". Sem `new Date()`: data pura viraria UTC e mudaria
// o dia perto da meia-noite (mesma cautela de dataPorExtenso em acompanhar).
function fmtDiaMes(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  return String(d).padStart(2, "0") + "/" + String(m).padStart(2, "0");
}

// Link absoluto pro orçamento público, mesmo padrão de
// app/studio/(estudio)/gestao/orcamentos/[id].tsx (urlDoOrcamento): no web
// usa o próprio origin (funciona em qualquer domínio/preview), com fallback
// pro domínio de produção fora do browser (SSR/nativo não tem window).
const APP_ORIGIN_FALLBACK = "https://app.getaura.com.br";
function appOrigin(): string {
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return window.location.origin;
  }
  return APP_ORIGIN_FALLBACK;
}

export type MatconQuoteCartLine = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  unit?: string | null;
};

/** O orçamento que o Caixa está editando (aberto com `?quote=&edit=1`). */
export type MatconQuoteEditing = {
  id: string;
  number: number;
  /** Cliente que o orçamento tinha ao abrir — para saber se foi tirado. */
  customerId: string | null;
};

export type UseMatconQuoteParams = {
  companyId: string | null | undefined;
  matconEnabled: boolean;
  cart: MatconQuoteCartLine[];
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  sellerId?: string | null;
  discount?: number;
  /** Preço no cartão: total da venda no cartão agora. null/ausente = opção desligada. */
  cardTotal?: number | null;
  /** Imprime o orçamento pelo caminho de sempre. Roda no clique, ANTES de
   *  salvar (ver o topo do arquivo). Sem ele, o botão só salva. */
  onPrint?: () => void;
  /** Presente = o botão salva por cima deste orçamento em vez de criar outro. */
  editing?: MatconQuoteEditing | null;
  /** Depois de salvar (novo ou editado), com o orçamento que o servidor devolveu. */
  onSaved?: (quote: Quote, info: { edited: boolean }) => void;
};

function fmtValor(n: number): string {
  return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function useMatconQuote(params: UseMatconQuoteParams) {
  const { companyId, matconEnabled, cart, customerId, customerName, customerPhone, sellerId, discount, cardTotal, onPrint, editing, onSaved } = params;
  const [saving, setSaving] = useState(false);
  const [lastQuote, setLastQuote] = useState<Quote | null>(null);
  // O card diz "atualizado" quando o último salvar foi uma edição.
  const [lastWasEdit, setLastWasEdit] = useState(false);
  // Total no cartão NO MOMENTO de salvar (o orçamento guarda o preço do dia).
  const [lastCardTotal, setLastCardTotal] = useState<number | null>(null);

  async function saveQuote() {
    if (!matconEnabled || !companyId || saving) return;
    if (cart.length === 0) {
      toast.info("Adicione produtos ao carrinho antes de fazer o orçamento");
      return;
    }
    // 1. Imprime já, dentro do clique (antes de qualquer await).
    const imprimiu = !!onPrint;
    if (onPrint) onPrint();
    // Um orçamento novo substitui o card do anterior.
    setLastQuote(null);
    setLastCardTotal(null);
    // 2. Salva.
    setSaving(true);
    try {
      const items: QuoteItem[] = cart.map(i => ({
        // productId pode carregar "__variantId" (mesma cartKey do useCart) —
        // o backend espera um product_id de catálogo, então cortamos ali.
        product_id: i.productId ? i.productId.split("__")[0] : null,
        name: i.name,
        unit: i.unit || null,
        quantity: i.qty,
        unit_price: i.price,
      }));
      let quote: Quote;
      if (editing) {
        const body: Partial<QuoteCreateBody> = {
          items,
          discount: discount && discount > 0 ? discount : 0,
        };
        if (customerId) {
          body.customer_id = customerId;
        } else if (editing.customerId) {
          // Tinha cliente e o Caixa ficou sem: o orçamento também fica sem.
          body.customer_id = null;
          body.customer_name = null;
          body.customer_phone = null;
        }
        if (sellerId) body.seller_id = sellerId;
        quote = (await matconApi.updateQuote(companyId, editing.id, body)).quote;
      } else {
        quote = (await matconApi.createQuote(companyId, {
          customer_id: customerId || undefined,
          customer_name: customerId ? undefined : (customerName || undefined),
          customer_phone: customerPhone || undefined,
          seller_id: sellerId || undefined,
          discount: discount && discount > 0 ? discount : undefined,
          items,
        })).quote;
      }
      const edited = !!editing;
      setLastQuote(quote);
      setLastWasEdit(edited);
      setLastCardTotal(cardTotal != null && cardTotal > 0 ? cardTotal : null);
      const feito = edited ? "atualizado" : "salvo";
      toast.success(imprimiu
        ? "Orçamento #" + quote.number + " impresso e " + feito + " em Orçamentos"
        : "Orçamento #" + quote.number + " " + feito + " em Orçamentos");
      if (onSaved) onSaved(quote, { edited });
    } catch (e: any) {
      const acao = editing ? "as mudanças não ficaram guardadas" : "não ficou guardado";
      toast.error(textoDoErro(e, imprimiu
        ? "O orçamento foi impresso, mas " + acao + " em Orçamentos. Tente de novo daqui a pouco."
        : editing
          ? "Não consegui salvar as mudanças do orçamento. Tente de novo daqui a pouco."
          : "Não consegui salvar o orçamento. Tente de novo daqui a pouco."));
    } finally {
      setSaving(false);
    }
  }

  function sendWhatsApp() {
    if (!lastQuote) return;
    const url = appOrigin() + "/orcamento/" + lastQuote.public_token;
    const primeiro = (lastQuote.customer_name || "").trim().split(" ")[0];
    const saudacao = primeiro ? "Oi, " + primeiro + "! " : "Oi! ";
    const valor = lastCardTotal != null
      ? fmtValor(lastQuote.total) + " no dinheiro ou PIX · " + fmtValor(lastCardTotal) + " no cartão"
      : "R$ " + lastQuote.total.toFixed(2).replace(".", ",");
    const texto = saudacao + "Segue seu orçamento #" + lastQuote.number + " — " + valor + ". " + url;
    const opened = openWhatsApp(lastQuote.customer_phone, texto);
    if (!opened) {
      toast.error("Cliente sem WhatsApp cadastrado — abra o orçamento em Orçamentos e mande o link por lá");
      return;
    }
    // Best-effort: o envio em si já aconteceu (wa.me abriu); markQuoteSent
    // só grava sent_at pra esteira mostrar "aberto no WhatsApp há X dias".
    if (companyId) matconApi.markQuoteSent(companyId, lastQuote.id).catch(() => {});
  }

  function viewEsteira() {
    router.push("/matcon/orcamentos" as any);
  }

  function dismiss() {
    setLastQuote(null);
    setLastCardTotal(null);
  }

  const savedQuote: SavedQuoteCard | null = lastQuote
    ? {
        number: lastQuote.number,
        ...(lastWasEdit ? { updated: true } : {}),
        validUntilLabel: fmtDiaMes(lastQuote.valid_until),
        total: lastQuote.total,
        ...(lastCardTotal != null ? { cardTotal: lastCardTotal } : {}),
        onSendWhatsApp: sendWhatsApp,
        onViewEsteira: viewEsteira,
        onDismiss: dismiss,
      }
    : null;

  return {
    saving,
    savedQuote,
    // undefined (não uma função no-op) quando o módulo está desligado —
    // é o mesmo sinal que o CartPanel usa pra decidir se renderiza o botão.
    saveQuote: matconEnabled ? saveQuote : undefined,
  };
}
