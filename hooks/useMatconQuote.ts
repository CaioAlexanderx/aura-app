// ============================================================
// AURA. — Matcon M1: "Salvar orçamento" do Caixa
// (docs/matcon-faseamento-po-ux.md §3 · docs/CONTRACT_MATCON.md · mockup
// docs/mockups/matcon-modulo.html #carrinho, bloco "Salvar orçamento")
//
// 22/09/2026. Isola tudo que o botão "Salvar orçamento" do CartPanel
// precisa: a mutation createQuote, o estado do card "Orçamento #N salvo" e
// os dois botões do card ("Enviar no WhatsApp" → markQuoteSent, "Ver na
// esteira" → /matcon/orcamentos). O CartPanel só recebe onSaveQuote/
// savingQuote/savedQuote (props opcionais, ver components/screens/pdv/
// CartPanel.tsx) — nenhuma chamada de API mora lá.
//
// O carrinho NÃO é limpo depois de salvar (o vendedor pode imprimir e
// finalizar também) — só quem chama `useCart`/`usePdvState` decide isso.
// ============================================================
import { useState } from "react";
import { router } from "expo-router";
import { toast } from "@/components/Toast";
import { openWhatsApp } from "@/utils/whatsapp";
import { matconApi, type Quote, type QuoteItem } from "@/services/matconApi";
import type { SavedQuoteCard } from "@/components/screens/pdv/CartPanel";

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
};

export function useMatconQuote(params: UseMatconQuoteParams) {
  const { companyId, matconEnabled, cart, customerId, customerName, customerPhone, sellerId, discount } = params;
  const [saving, setSaving] = useState(false);
  const [lastQuote, setLastQuote] = useState<Quote | null>(null);

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
      toast.success("Orçamento #" + quote.number + " salvo");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar orçamento");
    } finally {
      setSaving(false);
    }
  }

  function sendWhatsApp() {
    if (!lastQuote) return;
    const url = appOrigin() + "/orcamento/" + lastQuote.public_token;
    const primeiro = (lastQuote.customer_name || "").trim().split(" ")[0];
    const saudacao = primeiro ? "Oi, " + primeiro + "! " : "Oi! ";
    const valor = "R$ " + lastQuote.total.toFixed(2).replace(".", ",");
    const texto = saudacao + "Segue seu orçamento #" + lastQuote.number + " — " + valor + ". " + url;
    const opened = openWhatsApp(lastQuote.customer_phone, texto);
    if (!opened) {
      toast.error("Cliente sem WhatsApp cadastrado — copie o link do orçamento na esteira");
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
  }

  const savedQuote: SavedQuoteCard | null = lastQuote
    ? {
        number: lastQuote.number,
        validUntilLabel: fmtDiaMes(lastQuote.valid_until),
        total: lastQuote.total,
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
