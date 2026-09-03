// ============================================================
// components/studio/storefront/blocosDaHome.ts
//
// Quais blocos a home mostra, e com o quê.
//
// A REGRA, herdada do redesign da loja comum: bloco nasce da
// configuração da lojista ou não existe. O handoff desenha uma home
// cheia — banner, "os queridinhos", "312 pedidos entregues", escada de
// desconto — e a Sheid Mania, que é a loja do desenho, tem zero pedidos,
// nenhuma faixa de quantidade e nenhum banner cadastrado.
//
// Desenhar o bloco vazio seria pior que não desenhar: "Os queridinhos da
// Sheid" com nada embaixo, ou um número de pedidos inventado, é a loja
// dizendo à cliente que ninguém compra ali.
//
// Fica separado do componente porque é aqui que moram as regras que
// precisam de teste — o resto é layout.
// ============================================================
import type { StorePayload, StudioStoreProduct, BannerDaLoja } from "./types";
import type { StoreCategory } from "./categoryGrouping";

/** Abaixo disto uma fileira parece sobra, não seleção. */
export const MINIMO_NA_FILEIRA = 2;
/** O bloco "mais pedidos" mostra no máximo isto. */
export const MAXIMO_MAIS_PEDIDOS = 4;
/** Categorias de primeiro nível na tira. */
export const MAXIMO_CATEGORIAS = 6;

export type PassoDaLoja = { n: number; titulo: string; texto: string };

export type BlocosDaHome = {
  hero: {
    banner: BannerDaLoja | null;
    /** Sem banner, o mockup 3D com o logo da loja vira a peça do topo. */
    usarMockup: boolean;
    logo: string | null;
    nome: string;
    tagline: string;
  };
  /** A faixa rolante do topo. Vazia quando não há nada verdadeiro a dizer. */
  avisos: string[];
  comoFunciona: PassoDaLoja[];
  categorias: Array<{ id: string; nome: string; slug: string; total: number }>;
  maisPedidos: StudioStoreProduct[];
  artes: Array<{ id: string; name: string; thumb: string }>;
  /** Números da faixa de confiança. Só entra o que for verdade. */
  confianca: Array<{ valor: string; rotulo: string }>;
  /** O bloco B2B só faz sentido com produto para orçar. */
  mostrarB2B: boolean;
};

function plural(n: number, um: string, muitos: string): string {
  return n === 1 ? um : muitos;
}

/** O primeiro banner ligado e com conteúdo. */
export function bannerDaVez(banners?: BannerDaLoja[] | null): BannerDaLoja | null {
  const lista = Array.isArray(banners) ? banners : [];
  return lista.find((b) => b && b.enabled !== false && (b.image_url || b.headline)) || null;
}

/**
 * A faixa rolante do topo: prazo, revisões e Pix.
 *
 * Cada item só entra se for verdade sobre esta loja. O desenho traz
 * "6% off no Pix" cravado na arte; aqui o número vem da configuração, e
 * loja sem desconto não anuncia desconto nenhum.
 */
export function avisosDaLoja(store: StorePayload): string[] {
  const avisos: string[] = [];
  const dias = store.sla?.total_estimate_days;
  if (typeof dias === "number" && dias > 0) {
    avisos.push(`Prazo atual: ${dias} ${plural(dias, "dia útil", "dias úteis")}`);
  }
  // "Você aprova antes de produzir" é a promessa da loja Studio inteira,
  // e ela vale mesmo sem revisão extra configurada.
  avisos.push("Você aprova o mockup antes de produzir");
  const rev = store.revisions?.max_included;
  if (typeof rev === "number" && rev > 0) {
    avisos.push(`${rev} ${plural(rev, "revisão inclusa", "revisões inclusas")}`);
  }
  const pix = (store as any).payment?.pix_discount_pct;
  if (typeof pix === "number" && pix > 0) {
    avisos.push(`${pix}% de desconto no Pix`);
  }
  return avisos;
}

/**
 * Os três passos, com o prazo real da loja no último.
 *
 * O texto vem do fluxo que a loja já tem — personalizar, aprovar,
 * receber — e não de copy genérico.
 */
export function passosDaLoja(store: StorePayload): PassoDaLoja[] {
  const dias = store.sla?.total_estimate_days || 0;
  const rev = store.revisions?.max_included || 0;
  const retira = store.delivery?.pickup_enabled !== false;
  const entrega = !!store.delivery?.delivery_enabled;

  const comoRecebe = retira && entrega
    ? "Retire na loja ou receba em casa."
    : entrega
      ? "A gente entrega no seu endereço."
      : "Retire na loja quando estiver pronto.";

  return [
    { n: 1, titulo: "Personalize na tela",
      texto: "Escolha a cor, envie sua arte ou seu texto e veja como fica antes de pagar." },
    { n: 2, titulo: "Aprove pelo WhatsApp",
      texto: rev > 0
        ? `Nada vai para produção sem o seu ok. ${rev} ${plural(rev, "revisão inclusa", "revisões inclusas")}.`
        : "Nada vai para produção sem o seu ok." },
    { n: 3, titulo: "Produção e entrega",
      texto: dias > 0
        ? `Pronto em até ${dias} ${plural(dias, "dia útil", "dias úteis")}. ${comoRecebe}`
        : comoRecebe },
  ];
}

/**
 * As peças mais pedidas.
 *
 * Some inteiro quando ninguém pediu nada ainda — que é o caso de toda
 * loja Studio nova, e da Sheid hoje. Ordenar por zero mostraria "os
 * queridinhos" escolhidos por ordem alfabética.
 */
export function maisPedidos(produtos: StudioStoreProduct[]): StudioStoreProduct[] {
  const comPedido = (produtos || []).filter((p) => (p.pedidos || 0) > 0);
  if (comPedido.length < MINIMO_NA_FILEIRA) return [];
  return comPedido
    .slice()
    .sort((a, b) => (b.pedidos || 0) - (a.pedidos || 0))
    .slice(0, MAXIMO_MAIS_PEDIDOS);
}

/** As artes prontas da loja, sem repetir a mesma em produtos diferentes. */
export function artesProntas(produtos: StudioStoreProduct[]): Array<{ id: string; name: string; thumb: string }> {
  const vistas = new Set<string>();
  const saida: Array<{ id: string; name: string; thumb: string }> = [];
  for (const p of produtos || []) {
    for (const t of p.templates || []) {
      const img = t.thumb_url || t.image_url;
      if (!img || vistas.has(t.id)) continue;
      vistas.add(t.id);
      saida.push({ id: t.id, name: t.name, thumb: img });
      if (saida.length >= 8) return saida;
    }
  }
  return saida.length >= MINIMO_NA_FILEIRA ? saida : [];
}

/** Os números que a loja pode provar. */
export function numerosDeConfianca(store: StorePayload): Array<{ valor: string; rotulo: string }> {
  const saida: Array<{ valor: string; rotulo: string }> = [];
  const entregues = store.numeros?.pedidos_entregues || 0;
  if (entregues > 0) {
    saida.push({ valor: String(entregues), rotulo: plural(entregues, "pedido entregue", "pedidos entregues") });
  }
  const rev = store.revisions?.max_included || 0;
  if (rev > 0) {
    saida.push({ valor: String(rev), rotulo: plural(rev, "revisão inclusa", "revisões inclusas") });
  }
  const dias = store.sla?.total_estimate_days || 0;
  if (dias > 0) {
    saida.push({ valor: String(dias), rotulo: plural(dias, "dia útil", "dias úteis") });
  }
  return saida.length >= MINIMO_NA_FILEIRA ? saida : [];
}

/** Categorias de primeiro nível, com quantos produtos cada uma tem. */
export function tiraDeCategorias(
  categorias: StoreCategory[] | undefined,
  produtos: StudioStoreProduct[],
): Array<{ id: string; nome: string; slug: string; total: number }> {
  const raizes = (categorias || []).filter((c) => c.depth === 0);
  const conta = (raiz: StoreCategory) =>
    (produtos || []).filter((p) => (p.category_path || "").startsWith(raiz.path)).length;
  const comProduto = raizes
    .map((c) => ({ id: c.id, nome: c.name, slug: c.slug, total: conta(c) }))
    .filter((c) => c.total > 0);
  // O minimo vale DEPOIS do filtro. A Sheid tem tres categorias na
  // arvore e produto em uma so: "Escolha por onde comecar" com um
  // cartao nao e escolha, e rotulo — visto na loja no ar em 03/09.
  if (comProduto.length < MINIMO_NA_FILEIRA) return [];
  return comProduto.slice(0, MAXIMO_CATEGORIAS);
}

/** Monta a home inteira a partir do payload. */
export function montarBlocosDaHome(store: StorePayload): BlocosDaHome {
  const produtos = store.products || [];
  const banner = bannerDaVez(store.site?.banners);
  return {
    hero: {
      banner,
      // Sem banner, o mockup 3D com o logo vira a peça do topo — é o que
      // a loja tem de mais próprio, e é o argumento de venda dela.
      usarMockup: !banner,
      logo: store.site?.logo_url || null,
      nome: store.site?.name || "",
      tagline: store.site?.tagline || "",
    },
    avisos: avisosDaLoja(store),
    comoFunciona: passosDaLoja(store),
    categorias: tiraDeCategorias(store.categories, produtos),
    maisPedidos: maisPedidos(produtos),
    artes: artesProntas(produtos),
    confianca: numerosDeConfianca(store),
    mostrarB2B: produtos.length > 0,
  };
}
