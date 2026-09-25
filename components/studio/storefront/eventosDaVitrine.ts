// ============================================================
// components/studio/storefront/eventosDaVitrine.ts
//
// Os eventos de venda da vitrine Studio no GA4 e no Pixel (Fase 1C).
//
// ── POR QUE AGORA ──────────────────────────────────────────────────────
// A Fase 2 refaz o checkout para vender mais. Sem a linha de base medida
// ANTES dela, não há como dizer se vendeu (FASEAMENTO §3.5, JORNADA §9).
// Até aqui a vitrine só mandava o PageView do snippet — nenhum produto
// visto, nenhuma sacola, nenhuma compra.
//
// ── AS REGRAS ──────────────────────────────────────────────────────────
//   - Sem consentimento, NADA sai. O mesmo `hasAnalyticsConsent()` que
//     decide a injeção do gtag/fbq (ConsentimentoDaVitrine) decide cada
//     evento: quem clicou "Só os essenciais" não é medido nem se o script
//     já estiver na página por outra aba.
//   - Sem ID válido, nada sai para aquele canal — `rastreadoresValidos` é
//     a mesma régua que o painel e o backend usam.
//   - Os nomes são os padrões de cada plataforma (GA4: view_item,
//     add_to_cart, begin_checkout, purchase, share; Pixel: ViewContent,
//     AddToCart, InitiateCheckout, Purchase). Nome próprio não entra nos
//     relatórios prontos de e-commerce, e a lojista não vai montar funil.
//   - O Pixel não tem evento padrão de compartilhar: `share` vai só ao GA4.
//   - Valor sempre em BRL e em reais com centavos, não em centavos.
//
// ── COMO USAR ──────────────────────────────────────────────────────────
//   medirNaVitrine(store?.site?.rastreadores, { nome: "view_item", itens: [...] });
// `parametrosDoEvento` e `chamadasDoEvento` são puras — é o que o teste
// cobre. `medirNaVitrine` só executa as chamadas no navegador.
// ============================================================
import { hasAnalyticsConsent } from "@/components/LGPDConsent";
import { rastreadoresValidos, type Rastreadores } from "./rastreadoresDaVitrine";

export const MOEDA = "BRL";

/** Uma peça como os dois painéis de medição entendem. */
export type ItemMedido = {
  id: string;
  nome: string;
  /** Preço unitário em reais, já com personalização e faixa de quantidade. */
  preco: number;
  quantidade: number;
};

export type EventoDaVitrine =
  | { nome: "view_item"; itens: ItemMedido[] }
  | { nome: "add_to_cart"; itens: ItemMedido[] }
  | { nome: "begin_checkout"; itens: ItemMedido[] }
  | { nome: "purchase"; itens: ItemMedido[]; pedido: string; valor: number; frete?: number }
  | { nome: "share"; metodo: string; item?: { id: string; nome: string } | null };

export type Chamada =
  | { canal: "ga4"; args: ["event", string, Record<string, any>] }
  | { canal: "pixel"; args: ["track", string, Record<string, any>] };

/** Reais com centavos, sem ruído de ponto flutuante (49.9 * 3 = 149.70000000000002). */
function reais(n: number): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

/** Tira as chaves sem valor: `shipping: undefined` vira coluna vazia no relatório. */
function semVazios(o: Record<string, any>): Record<string, any> {
  const r: Record<string, any> = {};
  for (const k of Object.keys(o)) if (o[k] !== undefined) r[k] = o[k];
  return r;
}

function qtd(n: number): number {
  return Math.max(1, Math.floor(Number(n) || 1));
}

/** Soma das linhas — o `value` do add_to_cart e do begin_checkout. */
export function valorDosItens(itens: ItemMedido[]): number {
  return reais((itens || []).reduce((s, i) => s + reais(i.preco) * qtd(i.quantidade), 0));
}

/** Monta um ItemMedido de um produto do payload. */
export function itemDoProduto(produto: any, preco?: number, quantidade = 1): ItemMedido {
  return {
    id: String(produto?.id ?? ""),
    nome: String(produto?.name || "Peça personalizada"),
    preco: reais(preco ?? Number(produto?.price)),
    quantidade: qtd(quantidade),
  };
}

/** Os itens da sacola, com o preço unitário que a cliente viu. */
export function itensDaSacola(linhas: any[], precoUnitario: (linha: any) => number): ItemMedido[] {
  return (linhas || []).map((l) => itemDoProduto(l?.product, precoUnitario(l), l?.qty));
}

/**
 * Os parâmetros de cada canal para um evento. Puro: nada de janela,
 * consentimento ou ID aqui — só a tradução para o formato de cada um.
 */
export function parametrosDoEvento(e: EventoDaVitrine): {
  ga4: { nome: string; params: Record<string, any> };
  pixel: { nome: string; params: Record<string, any> } | null;
} {
  if (e.nome === "share") {
    return {
      ga4: {
        nome: "share",
        params: {
          method: e.metodo,
          content_type: e.item ? "product" : "store",
          item_id: e.item?.id ?? undefined,
        },
      },
      pixel: null,
    };
  }

  const itens = e.itens || [];
  const ga4Items = itens.map((i) => ({
    item_id: i.id, item_name: i.nome, price: reais(i.preco), quantity: qtd(i.quantidade),
  }));
  const ids = itens.map((i) => i.id);
  const contents = itens.map((i) => ({ id: i.id, quantity: qtd(i.quantidade), item_price: reais(i.preco) }));
  const numItens = itens.reduce((s, i) => s + qtd(i.quantidade), 0);
  const valor = e.nome === "purchase" ? reais(e.valor) : valorDosItens(itens);

  if (e.nome === "view_item") {
    return {
      ga4: { nome: "view_item", params: { currency: MOEDA, value: valor, items: ga4Items } },
      pixel: {
        nome: "ViewContent",
        params: {
          content_ids: ids, content_name: itens[0]?.nome, content_type: "product",
          value: valor, currency: MOEDA,
        },
      },
    };
  }
  if (e.nome === "add_to_cart") {
    return {
      ga4: { nome: "add_to_cart", params: { currency: MOEDA, value: valor, items: ga4Items } },
      pixel: {
        nome: "AddToCart",
        params: { content_ids: ids, contents, content_type: "product", value: valor, currency: MOEDA },
      },
    };
  }
  if (e.nome === "begin_checkout") {
    return {
      ga4: { nome: "begin_checkout", params: { currency: MOEDA, value: valor, items: ga4Items } },
      pixel: {
        nome: "InitiateCheckout",
        params: {
          content_ids: ids, contents, content_type: "product",
          num_items: numItens, value: valor, currency: MOEDA,
        },
      },
    };
  }
  // purchase — o valor é o total que o SERVIDOR cobrou (com frete e
  // desconto do Pix), não a soma da tela.
  return {
    ga4: {
      nome: "purchase",
      params: {
        transaction_id: e.pedido, currency: MOEDA, value: valor,
        shipping: e.frete != null ? reais(e.frete) : undefined,
        items: ga4Items,
      },
    },
    pixel: {
      nome: "Purchase",
      params: {
        content_ids: ids, contents, content_type: "product",
        num_items: numItens, value: valor, currency: MOEDA,
      },
    },
  };
}

/**
 * O que de fato sai, para quem. Vazio sem consentimento ou sem ID
 * válido — é a decisão inteira, e é pura para o teste cobrir.
 */
export function chamadasDoEvento(
  e: EventoDaVitrine,
  rastreadores: Partial<Rastreadores> | null | undefined,
  consentiu: boolean,
): Chamada[] {
  if (!consentiu) return [];
  const v = rastreadoresValidos(rastreadores);
  if (!v.ga4 && !v.pixel) return [];
  const p = parametrosDoEvento(e);
  const lista: Chamada[] = [];
  // `send_to` prende o evento ao ID da LOJA: se um dia a página tiver
  // outro gtag configurado, a venda da lojista não vaza para ele.
  if (v.ga4) lista.push({ canal: "ga4", args: ["event", p.ga4.nome, semVazios({ ...p.ga4.params, send_to: v.ga4 })] });
  if (v.pixel && p.pixel) lista.push({ canal: "pixel", args: ["track", p.pixel.nome, semVazios(p.pixel.params)] });
  return lista;
}

/**
 * Manda o evento, se puder. Devolve quantas chamadas saíram.
 *
 * Nunca lança: medir é secundário, e um erro aqui não pode impedir a
 * cliente de adicionar à sacola ou de ver a confirmação do pedido.
 */
export function medirNaVitrine(
  rastreadores: Partial<Rastreadores> | null | undefined,
  e: EventoDaVitrine,
  opcoes: { consentiu?: boolean; alvo?: any } = {},
): number {
  try {
    const alvo = opcoes.alvo ?? (typeof window !== "undefined" ? (window as any) : null);
    if (!alvo) return 0;
    const consentiu = opcoes.consentiu ?? hasAnalyticsConsent();
    let n = 0;
    for (const c of chamadasDoEvento(e, rastreadores, consentiu)) {
      // gtag/fbq só existem depois da injeção, que também espera o
      // consentimento. Sem a função na janela, não há para onde mandar.
      const fn = c.canal === "ga4" ? alvo.gtag : alvo.fbq;
      if (typeof fn !== "function") continue;
      fn(...c.args);
      n++;
    }
    return n;
  } catch {
    return 0;
  }
}
