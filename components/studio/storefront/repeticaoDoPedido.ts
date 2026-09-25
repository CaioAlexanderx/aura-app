// ============================================================
// components/studio/storefront/repeticaoDoPedido.ts
//
// "Pedir outro igual" (Fase 4 · JORNADA §4.10): a página do produto abre
// com a personalização de um pedido já carregada — `/<slug>/p/<id>?repetir=<token>`.
//
// O backend (GET /storefront/:slug/studio/pedido/:token/repetir) já
// devolve os valores filtrados pelo configurador de hoje. Aqui mora a
// última conferência, contra o produto como a VITRINE o carregou, e a
// montagem do estado inicial do configurador — regra pura, testada, que
// a página atual (ProductConfigurator) e a nova da Fase 3 leem do mesmo
// lugar: o estado do useStorefront.
// ============================================================
import type { StudioStoreProduct } from "./types";

/** Um item da resposta de /repetir. */
export type ItemDaRepeticao = {
  product_id: string | null;
  nome: string | null;
  quantidade: number;
  indisponivel: boolean;
  personalizacao: {
    valores: Record<string, any>;
    verso: boolean;
    meio: boolean;
    arte_enviada?: boolean;
  } | null;
};

export type RespostaDaRepeticao = {
  numero: string | null;
  itens: ItemDaRepeticao[];
};

/** O que o configurador recebe para abrir preenchido. */
export type ValoresIniciais = {
  valores: Record<string, any>;
  quantidade: number;
  verso: boolean;
  meio: boolean;
};

/**
 * O estado da repetição no hook:
 *   carregando  → buscando o pedido
 *   pronta      → chegou, esperando a peça abrir no configurador
 *   aplicada    → o configurador está com a personalização do pedido
 *   indisponivel→ a peça do pedido não está mais na loja
 *   erro        → não deu para ler o pedido (link velho, rede)
 */
export type EstadoDaRepeticao = "carregando" | "pronta" | "aplicada" | "indisponivel" | "erro";

export type RepeticaoNoEstado = {
  token: string;
  produtoId: string;
  estado: EstadoDaRepeticao;
  numero: string | null;
  item: ItemDaRepeticao | null;
};

/** O caminho da página do produto com a repetição pedida. */
export function caminhoDeRepetir(slug: string, produtoId: string, token: string): string {
  return `/${encodeURIComponent(slug)}/p/${encodeURIComponent(produtoId)}?repetir=${encodeURIComponent(token)}`;
}

/**
 * O item do pedido que vai para o configurador desta peça. Com mais de
 * uma linha da mesma peça (duas canecas com nomes diferentes), a
 * primeira — a página do produto abre uma personalização por vez.
 */
export function itemParaOProduto(
  resposta: RespostaDaRepeticao | null | undefined,
  produtoId: string,
): ItemDaRepeticao | null {
  const itens = resposta?.itens || [];
  return itens.find((i) => String(i.product_id) === String(produtoId) && !i.indisponivel && !!i.personalizacao) || null;
}

/** O primeiro item que ainda está na loja — o destino do "Pedir outro igual". */
export function primeiroDisponivel(resposta: RespostaDaRepeticao | null | undefined): ItemDaRepeticao | null {
  return (resposta?.itens || []).find((i) => !!i.product_id && !i.indisponivel) || null;
}

/**
 * O estado inicial do configurador a partir do item do pedido.
 *
 * Começa pelo que o configurador já faria sozinho (a primeira cor de
 * cada campo de cor) e põe por cima o que veio do pedido — só para
 * campos que a peça carregada tem. A quantidade volta como foi pedida:
 * quem comprou 50 lembrancinhas quer outras 50, não uma.
 */
export function valoresIniciaisDaRepeticao(
  item: ItemDaRepeticao | null | undefined,
  produto: Pick<StudioStoreProduct, "customization_config"> | null | undefined,
): ValoresIniciais {
  const cfg: any = produto?.customization_config;
  const campos: any[] = Array.isArray(cfg?.fields) ? cfg.fields : [];
  const valores: Record<string, any> = {};
  for (const f of campos) {
    if (f?.type === "color" && Array.isArray(f.config?.colors) && f.config.colors.length) {
      valores[f.id] = f.config.colors[0];
    }
  }
  const doPedido = item?.personalizacao?.valores || {};
  const ids = new Set(campos.map((f) => f?.id).filter(Boolean));
  const temServicoDeArte = campos.some((f) => f?.type === "option" && f?.config?.is_art_service === true);
  for (const [chave, valor] of Object.entries(doPedido)) {
    if (valor == null) continue;
    const campoDaCor = chave.endsWith("_cor") ? chave.slice(0, -4) : null;
    if (ids.has(chave)) valores[chave] = valor;
    else if (campoDaCor && ids.has(campoDaCor)) valores[chave] = valor;
    else if (chave === "art_service_brief" && temServicoDeArte) valores[chave] = valor;
  }
  const quantidade = Math.max(1, Math.floor(Number(item?.quantidade) || 1));
  return {
    valores,
    quantidade,
    verso: cfg?.has_back === true && item?.personalizacao?.verso === true,
    meio: cfg?.has_middle === true && item?.personalizacao?.meio === true,
  };
}

/** O texto da faixa da página do produto, por estado. `null` = sem faixa. */
export function textoDaFaixaDeRepeticao(r: Pick<RepeticaoNoEstado, "estado" | "numero"> | null | undefined): string | null {
  if (!r) return null;
  const n = r.numero ? ` #${r.numero}` : "";
  if (r.estado === "aplicada") return `Personalização do pedido${n} carregada — confira e ajuste.`;
  if (r.estado === "indisponivel") return `A peça do pedido${n} não está mais na loja. Escolha outra ou fale com a loja.`;
  if (r.estado === "erro") return `Não conseguimos carregar a personalização do pedido${n}. Monte a peça de novo.`;
  return null;
}
