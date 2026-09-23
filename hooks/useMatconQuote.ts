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
// 23/09/2026 (QA em produção): o POST /matcon/quotes ainda não existe no
// backend — o botão "Orçamento" mostrava "Rota nao encontrada" e nada
// imprimia. Agora, se salvar falhar (qualquer erro), `onSaveFailed` imprime
// pelo caminho de sempre (quem chama decide o toast). Se o erro foi 404 (a
// rota não existe), o hook para de oferecer o salvar nesta sessão: o botão
// volta a imprimir direto, no próprio clique (sem esperar a API, o que
// também evita o bloqueio de janela do navegador).
// ============================================================
import { useState } from "react";
import { router } from "expo-router";
import { toast } from "@/components/Toast";
import { openWhatsApp } from "@/utils/whatsapp";
import { matconApi, type Quote, type QuoteItem } from "@/services/matconApi";
import type { SavedQuoteCard } from "@/components/screens/pdv/CartPanel";
import { ehRotaAusente, textoDoErro } from "@/components/screens/pdv/erroNoCaixa";

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
  /** Salvar falhou: imprime pelo caminho de sempre. Sem ele, só o toast. */
  onSaveFailed?: () => void;
};

function fmtValor(n: number): string {
  return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function useMatconQuote(params: UseMatconQuoteParams) {
  const { companyId, matconEnabled, cart, customerId, customerName, customerPhone, sellerId, discount, cardTotal, onSaveFailed } = params;
  const [saving, setSaving] = useState(false);
  // A rota de salvar respondeu 404: nesta sessão o botão só imprime.
  const [semRota, setSemRota] = useState(false);
  const [lastQuote, setLastQuote] = useState<Quote | null>(null);
  // Total no cartão NO MOMENTO de salvar (o orçamento guarda o preço do dia).
  const [lastCardTotal, setLastCardTotal] = useState<number | null>(null);

  async function saveQuote() {
    if (!matconEnabled || !companyId) return;
    if (cart.length === 0) {
      toast.info("Adicione produtos ao carrinho antes de salvar o orçamento");
      return;
    }
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
      const { quote } = await matconApi.createQuote(companyId, {
        customer_id: customerId || undefined,
        customer_name: customerId ? undefined : (customerName || undefined),
        customer_phone: customerPhone || undefined,
        seller_id: sellerId || undefined,
        discount: discount && discount > 0 ? discount : undefined,
        items,
      });
      setLastQuote(quote);
      setLastCardTotal(cardTotal != null && cardTotal > 0 ? cardTotal : null);
      toast.success("Orçamento #" + quote.number + " salvo");
    } catch (e: any) {
      if (ehRotaAusente(e)) setSemRota(true);
      if (onSaveFailed) onSaveFailed();
      else toast.error(textoDoErro(e, "Não deu para salvar o orçamento"));
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
    // Também undefined depois de um 404: o "Orçamento" volta a imprimir.
    saveQuote: matconEnabled && !semRota ? saveQuote : undefined,
  };
}
