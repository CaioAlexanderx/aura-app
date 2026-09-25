// ============================================================
// components/studio/storefront/rotasDaVitrine.ts
//
// Onda 1B (Fase 1 · Endereços): cada tela da vitrine tem URL.
//
// Até aqui a tela era só estado (`sf.stage` em useStorefront): voltar do
// navegador saía da loja, não existia link de produto e recarregar
// perdia a peça aberta (D1 da jornada). Agora:
//
//   /<slug>                 home         (stage "list")
//   /<slug>/c/<categoria>   modelos      (stage "modelos")
//   /<slug>/p/<id>          produto      (stage "configure")
//   /<slug>/finalizar       checkout     (stage "checkout"; "sent" também)
//   /<slug>/orcamento       lote         (stage "lote")
//   /<slug>/pedido/<token>  o pedido     (Fase 2: página própria, lida do
//                                         servidor pelo token — não é stage)
//
// Este módulo é a tradução entre as duas línguas — tela da URL e estado
// do hook — e nada mais. Puro de propósito: é regra, tem teste, e tela
// que importa Icon não carrega no jest.
// ============================================================
import type { Stage, StudioStoreProduct } from "./types";
import type { StoreCategory, VitrineEntry } from "./categoryGrouping";
import { alvoDaCategoria } from "./home/regrasDaHome";

export type TelaDaVitrine =
  | { tipo: "home" }
  | { tipo: "categoria"; categoria: string }
  | { tipo: "produto"; id: string }
  | { tipo: "finalizar" }
  | { tipo: "orcamento" }
  // Fase 2: a confirmação e o Pix em /<slug>/pedido/<token>. A página lê o
  // pedido do servidor (PaginaDoPedido.tsx), então não há estado a alcançar:
  // o hook só NAVEGA para ela, depois do pedido criado.
  | { tipo: "pedido"; token: string };

/**
 * Como chegar numa tela a partir de uma ação da cliente.
 *
 * - `empilhar`: tela nova por cima; o voltar do navegador volta para cá.
 * - `trocar`: a tela atual sai do histórico (trocar de modelo, "Comprar
 *   agora" — o produto virou item da sacola e não tem para onde voltar).
 * - `voltar`: volta até essa tela se ela estiver no histórico da loja;
 *   senão troca a atual por ela. É o "Voltar para a loja".
 */
export type ModoDeNavegar = "empilhar" | "trocar" | "voltar";

export type NavegarNaVitrine = (tela: TelaDaVitrine, modo: ModoDeNavegar) => void;

/** O pedaço da URL que identifica a categoria: o slug dela, ou o id. */
export function chaveDaCategoria(categoria: Pick<StoreCategory, "id" | "slug"> | null | undefined): string {
  if (!categoria) return "";
  const s = typeof categoria.slug === "string" ? categoria.slug.trim() : "";
  return s || String(categoria.id || "");
}

/**
 * O caminho de uma tela. `slug` é o segmento como está na URL — trocar a
 * grafia dele no meio da navegação ("Sheid-Mania" → "sheid-mania") faria
 * o roteador achar que é outra loja e remontar a vitrine inteira.
 */
export function caminhoDaTela(slug: string, tela: TelaDaVitrine): string {
  const base = "/" + encodeURIComponent(String(slug || "").trim());
  switch (tela.tipo) {
    case "categoria": return `${base}/c/${encodeURIComponent(tela.categoria)}`;
    case "produto": return `${base}/p/${encodeURIComponent(tela.id)}`;
    case "finalizar": return `${base}/finalizar`;
    case "orcamento": return `${base}/orcamento`;
    case "pedido": return `${base}/pedido/${encodeURIComponent(tela.token)}`;
    default: return base;
  }
}

/** Duas telas são a mesma (mesmo tipo e mesmo alvo)? */
export function mesmaTela(a: TelaDaVitrine | null | undefined, b: TelaDaVitrine | null | undefined): boolean {
  if (!a || !b || a.tipo !== b.tipo) return false;
  if (a.tipo === "produto") return a.id === (b as any).id;
  if (a.tipo === "categoria") return a.categoria === (b as any).categoria;
  if (a.tipo === "pedido") return a.token === (b as any).token;
  return true;
}

/**
 * Link de produto e de categoria são os que se compartilham: quem chega
 * por eles de fora da loja precisa ter a home embaixo no histórico, ou o
 * voltar do navegador sai da loja (demo de 16/10, item 2).
 */
export function telaDeEntradaProfunda(tela: TelaDaVitrine): boolean {
  return tela.tipo === "produto" || tela.tipo === "categoria";
}

/** O que o estado do hook precisa ter para uma tela estar de pé. */
export type EstadoDaTela = {
  stage: Stage;
  produtoAtivoId?: string | null;
  categoriaAbertaChave?: string | null;
};

/**
 * O estado já representa a tela da URL?
 *
 * A rota só desenha quando sim. Antes de o estado alcançar a URL (um
 * quadro, no máximo) ela não desenha nada — desenhar a tela anterior
 * montaria um componente que não devia existir ali, com os efeitos dele
 * (evento de analytics, busca de galeria) disparando à toa.
 */
export function telaPronta(tela: TelaDaVitrine, e: EstadoDaTela): boolean {
  switch (tela.tipo) {
    case "home": return e.stage === "list";
    case "categoria": return e.stage === "modelos" && e.categoriaAbertaChave === tela.categoria;
    case "produto": return e.stage === "configure" && e.produtoAtivoId === tela.id;
    // A confirmação ainda é estado nesta fase (a rota /pedido/<token> é
    // da Fase 2): o pedido enviado fica na URL do checkout.
    case "finalizar": return e.stage === "checkout" || e.stage === "sent";
    case "orcamento": return e.stage === "lote";
    // A página do pedido não depende do estado do hook.
    case "pedido": return true;
  }
}

/** O que fazer para o estado alcançar a tela da URL. */
export type Resolucao =
  | { acao: "home" }
  | { acao: "categoria"; categoria: StoreCategory; produtos: StudioStoreProduct[] }
  | { acao: "produto"; produto: StudioStoreProduct; irmaos: StudioStoreProduct[] }
  | { acao: "finalizar" }
  | { acao: "orcamento" }
  | { acao: "pedido"; token: string }
  | { acao: "redirecionar"; para: TelaDaVitrine; aviso?: string };

export const AVISO_PECA_FORA = "Essa peça não está mais na loja";

/**
 * Resolve a tela da URL contra a loja carregada.
 *
 * Link velho não é erro: peça que saiu da loja volta para a home com um
 * aviso discreto, e categoria que não existe mais volta para a home em
 * silêncio. Categoria que ficou com um modelo só abre direto o modelo —
 * a vitrine também não mostra grade de um item (categoryGrouping.ts).
 */
export function resolverTela(
  tela: TelaDaVitrine,
  loja: { products?: StudioStoreProduct[] | null; categories?: StoreCategory[] | null } | null | undefined,
  vitrine: VitrineEntry[],
): Resolucao {
  switch (tela.tipo) {
    case "home": return { acao: "home" };
    case "finalizar": return { acao: "finalizar" };
    case "orcamento": return { acao: "orcamento" };
    case "pedido": return { acao: "pedido", token: tela.token };
    case "produto": {
      const produto = (loja?.products || []).find((p) => String(p.id) === tela.id);
      if (!produto) return { acao: "redirecionar", para: { tipo: "home" }, aviso: AVISO_PECA_FORA };
      // Os outros modelos da mesma categoria vêm junto, como quando a
      // peça é aberta pela grade: recarregar não pode sumir com o
      // seletor de modelo.
      const grupo = vitrine.find(
        (e) => e.kind === "category" && e.products.some((p) => p.id === produto.id),
      );
      return { acao: "produto", produto, irmaos: grupo && grupo.kind === "category" ? grupo.products : [] };
    }
    case "categoria": {
      const grupo = vitrine.find(
        (e) => e.kind === "category" && chaveDaCategoria(e.category) === tela.categoria,
      );
      if (grupo && grupo.kind === "category") {
        return { acao: "categoria", categoria: grupo.category, produtos: grupo.products };
      }
      // Fase 5: a categoria com filhas (Canecas > Cerâmica, Metalizadas)
      // abre com as peças das filhas — a mesma regra da barra, da gaveta e
      // do rodapé (home/regrasDaHome.ts, alvoDaCategoria). Sem árvore, é
      // exatamente o que era: as peças da própria categoria.
      const cat = (loja?.categories || []).find((c) => chaveDaCategoria(c) === tela.categoria);
      const alvo = alvoDaCategoria(cat, loja);
      if (alvo?.tipo === "grupo") return { acao: "categoria", categoria: alvo.categoria, produtos: alvo.produtos };
      if (alvo?.tipo === "produto") {
        return { acao: "redirecionar", para: { tipo: "produto", id: String(alvo.produto.id) } };
      }
      return { acao: "redirecionar", para: { tipo: "home" } };
    }
  }
}

/**
 * O guarda de autenticação deixa passar a vitrine inteira.
 *
 * `useSegments` devolve o nome da ROTA, não o caminho: o segmento
 * dinâmico da raiz chega como o literal "[slug]". Até a Onda 1B a vitrine
 * era um arquivo só (`app/[slug].tsx`) e o guarda comparava
 * `segments.length === 1`; com as telas aninhadas (`[slug]/p/[id]`...)
 * isso mandaria a cliente para o login ao abrir um produto. Nenhuma rota
 * do painel começa com "[slug]" — as estáticas aparecem com o próprio
 * nome — então a comparação do primeiro segmento basta.
 */
export function ehVitrinePublica(segments: readonly string[] | null | undefined): boolean {
  return !!segments && segments[0] === "[slug]";
}

/**
 * O título da aba por tela: "Caneca Alça Coração · Sheid Mania".
 *
 * O servidor já escreve esse título na casca de /p/<id> (BE-1), para o
 * robô da prévia; este é o do navegador depois que a cliente anda pela
 * loja sem recarregar.
 */
export function tituloDaPagina({
  stage, nomeDaLoja, produto, categoria,
}: {
  stage: Stage;
  nomeDaLoja?: string | null;
  produto?: string | null;
  categoria?: string | null;
}): string {
  const loja = String(nomeDaLoja || "").trim() || "Loja";
  const junto = (t?: string | null) => {
    const s = String(t || "").trim();
    return s ? `${s} · ${loja}` : loja;
  };
  switch (stage) {
    case "configure": return junto(produto);
    case "modelos": return junto(categoria);
    case "checkout": return junto("Finalizar pedido");
    case "sent": return junto("Pedido enviado");
    case "lote": return junto("Orçamento em lote");
    default: return loja;
  }
}

/** O endereço público das lojas Studio (vitrineStudioShell.js no backend). */
export const HOST_DA_LOJA = "loja.getaura.com.br";

/**
 * O link que o "Compartilhar" manda.
 *
 * O payload da vitrine Studio não traz o endereço canônico da loja (o da
 * loja comum traz `storefront_url`); quando trouxer, ele vence. Sem ele:
 *
 * - aberta em `loja.getaura.com.br` → o próprio endereço;
 * - aberta no host do PAINEL (`app.getaura.com.br/cardapio/studio/…`,
 *   preview da lojista) → o endereço público. É lá que o servidor
 *   escreve a prévia com foto (BE-1); o do painel sai sem foto e manda
 *   a cliente para o host errado;
 * - qualquer outro host (desenvolvimento) → a própria origem.
 */
export function linkDaPeca({
  slug, id, origem, canonica,
}: {
  slug: string;
  id: string;
  origem?: string | null;
  canonica?: string | null;
}): string {
  const caminhoDaPeca = `/p/${encodeURIComponent(id)}`;
  const c = String(canonica || "").trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(c)) return c + caminhoDaPeca;

  const s = String(slug || "").trim().toLowerCase();
  const daLoja = `https://${HOST_DA_LOJA}/${encodeURIComponent(s)}${caminhoDaPeca}`;
  const o = String(origem || "").trim().replace(/\/+$/, "");
  let host = "";
  try { host = o ? new URL(o).hostname.toLowerCase() : ""; } catch { host = ""; }
  if (!host || host === HOST_DA_LOJA || host === "getaura.com.br" || host.endsWith(".getaura.com.br")) {
    return daLoja;
  }
  return `${o}/${encodeURIComponent(s)}${caminhoDaPeca}`;
}
