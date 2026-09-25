// ============================================================
// components/studio/storefront/home/regrasDaHome.ts
//
// As regras da home nova da vitrine Studio (Fase 5 · Home e navegação,
// mockup docs/mockups/studio-vitrine-05-home.html). Atrás da chave
// `vitrine_v2`; a home de hoje (ProductList + HomeDaVitrine) segue com
// as regras de blocosDaHome.ts.
//
// A MESMA regra da home de hoje: bloco nasce da configuração ou do que a
// loja pode provar, nunca de texto inventado. O que muda é de onde vem:
//   - faixa de anúncio e selos da aba Design (`announcement_bar`,
//     `service_cards`); vazios, os automáticos do Studio, com os números
//     da loja (decisão 10 do PO: a faixa de números entra nos selos);
//   - até 3 banners com botão e destino interno (`#cat=`, `#vista=`),
//     como a loja Negócio;
//   - sem banner, a peça do destaque (`hero_product_id` ou a primeira
//     com prévia 3D) com as artes trocando sozinhas.
//
// Puro de propósito: é regra, tem teste, e tela que importa Icon não
// carrega no jest.
// ============================================================
import type { BannerDaLoja, StorePayload, StudioStoreProduct, StoreCategory } from "../types";
import { normalizar, casa } from "../buscaVitrine";
import { maisPedidos } from "../blocosDaHome";
import { agruparVitrine, type VitrineEntry } from "../categoryGrouping";

/** Cada banner fica 6 s na tela (mockup, tela 1). */
export const SEGUNDOS_POR_BANNER = 6;
/** No máximo 3 banners, como na loja Negócio. */
export const MAXIMO_DE_BANNERS = 3;
/** As artes do destaque trocam a cada 3,5 s. */
export const TROCA_DA_ARTE_MS = 3500;

function plural(n: number, um: string, muitos: string): string {
  return n === 1 ? um : muitos;
}

function numeroCurto(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace(".", ",");
}

/** O desconto do Pix que a loja anuncia (só com Pix ligado). */
export function descontoDoPix(store: StorePayload | null | undefined): number {
  if (!store?.payment?.has_pix) return 0;
  const d = Number(store.payment.pix_discount_pct);
  return Number.isFinite(d) && d > 0 ? d : 0;
}

// ── Faixa de anúncio ─────────────────────────────────────────

/**
 * Os itens da faixa do topo.
 *
 * Escrita na aba Design, vale o texto dela (partido no "·" para cada
 * item quebrar inteiro no celular). Vazia, a automática do Studio — a
 * adaptação da Negócio ("Frete grátis acima de R$ X · Troca em 7 dias ·
 * 5% off no Pix"), com a promessa que vale mais numa loja de encomenda:
 * "Você aprova o mockup antes de produzir". Cada item só entra se for
 * verdade: loja sem desconto no Pix não anuncia desconto.
 */
export function itensDaFaixa(store: StorePayload | null | undefined): string[] {
  const escrita = String(store?.site?.announcement_bar || "").trim();
  if (escrita) return escrita.split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);
  const itens = ["Você aprova o mockup antes de produzir"];
  const dias = Number(store?.sla?.total_estimate_days) || 0;
  if (dias > 0) itens.push(`Pronto em ${dias} ${plural(dias, "dia útil", "dias úteis")}`);
  const pix = descontoDoPix(store);
  if (pix > 0) itens.push(`${numeroCurto(pix)}% no Pix`);
  return itens;
}

// ── Destinos internos ────────────────────────────────────────

export type DestinoDaVitrine =
  | { tipo: "categoria"; categoria: StoreCategory }
  | { tipo: "grade" }
  | { tipo: "queridinhos" }
  | { tipo: "lote" }
  | { tipo: "externo"; url: string };

/**
 * Para onde leva o botão (ou o banner inteiro).
 *
 * O mesmo contrato do backend (storefrontBuilder.destinoDoCta): http(s),
 * `#cat=/caminho` (o `path` da árvore) e `#vista=todos|novidades|
 * mais_vendidos|lote`. Categoria que não existe mais nesta loja devolve
 * null — e sem destino a vitrine não desenha botão morto.
 */
export function destinoDoBanner(
  url: string | null | undefined,
  store: StorePayload | null | undefined,
): DestinoDaVitrine | null {
  const u = String(url || "").trim();
  if (!u) return null;
  if (/^https?:\/\/\S+$/i.test(u)) return { tipo: "externo", url: u };
  const cat = /^#cat=(\/[a-z0-9][a-z0-9\-/]*)$/i.exec(u);
  if (cat) {
    const caminho = cat[1].toLowerCase().replace(/\/+$/, "");
    const ultimo = caminho.split("/").filter(Boolean).pop() || "";
    const lista = store?.categories || [];
    const achou =
      lista.find((c) => String(c.path || "").toLowerCase().replace(/\/+$/, "") === caminho) ||
      lista.find((c) => String(c.slug || "").toLowerCase() === ultimo);
    if (!achou || produtosDaArvore(achou.id, store).length === 0) return null;
    return { tipo: "categoria", categoria: achou };
  }
  const vista = /^#vista=(todos|novidades|mais_vendidos|lote)$/.exec(u);
  if (vista) {
    if (vista[1] === "lote") return { tipo: "lote" };
    if (vista[1] === "mais_vendidos" && maisPedidos(store?.products || []).length) return { tipo: "queridinhos" };
    return { tipo: "grade" };
  }
  return null;
}

// ── Banners ──────────────────────────────────────────────────

export type BannerDaHome = BannerDaLoja & {
  /** Tem texto NOSSO por cima (kicker, título ou corpo). */
  comTexto: boolean;
  /** Arte pronta: foto sem texto nosso e com destino — o banner inteiro é o link. */
  soLink: boolean;
  destino: DestinoDaVitrine | null;
  /** O que o leitor de tela ouve no banner-link e no botão. */
  rotulo: string;
};

/**
 * Os banners da home nova: ligados, com conteúdo, no máximo 3.
 *
 * `banners_automaticos` é o fallback da loja comum (capa + tagline)
 * quando a lojista não cadastrou nenhum: na home nova isso é "sem
 * banner", e o destaque é a peça com o mockup girando.
 */
export function bannersDaHome(store: StorePayload | null | undefined): BannerDaHome[] {
  if (!store?.site || (store.site as any).banners_automaticos === true) return [];
  const lista = Array.isArray(store.site.banners) ? store.site.banners : [];
  return lista
    .filter((b) => b && b.enabled !== false && (b.image_url || b.headline || b.body || b.kicker))
    .slice(0, MAXIMO_DE_BANNERS)
    .map((b) => {
      const comTexto = !!(String(b.headline || "").trim() || String(b.body || "").trim() || String(b.kicker || "").trim());
      const destino = destinoDoBanner(b.cta_url, store);
      return {
        ...b,
        comTexto,
        soLink: !comTexto && !!destino && !!b.image_url,
        destino,
        rotulo: String(b.cta || b.headline || b.kicker || store.site.name || "Destaque da loja").trim(),
      };
    });
}

/** O próximo banner (ou o anterior), dando a volta. */
export function proximoBanner(atual: number, total: number, passo: 1 | -1 = 1): number {
  if (total <= 0) return 0;
  return (((atual + passo) % total) + total) % total;
}

/**
 * O banner gira sozinho? Só com mais de um, sem pausa (toque, mouse,
 * foco ou o botão) e sem "reduzir movimento".
 */
export function bannerGira(p: { total: number; pausado: boolean; reduzirMovimento: boolean }): boolean {
  return p.total > 1 && !p.pausado && !p.reduzirMovimento;
}

/**
 * A altura do hero de banners.
 *
 * Desktop: a proporção 3:1 da loja Negócio (1280 → 427). Celular: com
 * arte própria do celular ou texto nosso por cima, a composição alta do
 * mockup (476 em 390); só com arte pronta larga e sem versão de celular,
 * a arte inteira em 3:1 — cortar o centro levaria o texto da arte junto.
 */
export function alturaDoHero(largura: number, desktop: boolean, banners: BannerDaHome[]): number {
  const w = Math.max(320, largura);
  if (desktop) return Math.round(Math.min(w, 1440) / 3);
  const alta = banners.some((b) => b.comTexto || !!b.image_url_mobile || !b.image_url);
  return alta ? Math.round(Math.min(476, w * 1.22)) : Math.round(w / 3);
}

// ── A peça do destaque (sem banner) ──────────────────────────

/**
 * A peça que gira no destaque quando não há banner.
 *
 * A escolhida na aba Design (`hero_product_id`) se ainda está na loja;
 * senão a primeira com prévia 3D na ordem da vitrine (decisão 10 do PO);
 * sem 3D, a primeira com foto; sem foto, a primeira.
 */
export function pecaDoDestaque(
  store: StorePayload | null | undefined,
): { produto: StudioStoreProduct; escolhida: boolean } | null {
  const produtos = store?.products || [];
  if (!produtos.length) return null;
  const id = String((store?.site as any)?.hero_product_id || "");
  if (id) {
    const p = produtos.find((x) => String(x.id) === id);
    if (p) return { produto: p, escolhida: true };
  }
  const p =
    produtos.find((x) => x.visual_kind === "model3d") ||
    produtos.find((x) => !!x.image_url) ||
    produtos[0];
  return { produto: p, escolhida: false };
}

export type ArteDoDestaque = { rotulo: string; values: Record<string, any> };

/** Nomes de exemplo quando a peça não tem arte pronta (mockup, tela 2). */
export function nomesDeExemplo(nomeDaLoja: string | null | undefined): string[] {
  const primeira = String(nomeDaLoja || "").trim().split(/\s+/)[0] || "";
  return ["Helena", "Vovó Lourdes", primeira ? `Time ${primeira}` : "Feliz aniversário"];
}

/**
 * As artes que trocam sozinhas no destaque.
 *
 * Com arte pronta vinculada à peça (campo `template`), as artes dela —
 * são as da loja, a cliente pode escolher igual. Sem arte pronta e com
 * campo de texto, três nomes de exemplo. Sem nenhum dos dois, a peça
 * sozinha (lista vazia: sem seletor). A cor da louça, quando há, é a
 * primeira da lojista, como o configurador abre.
 */
export function artesDoDestaque(
  produto: StudioStoreProduct | null | undefined,
  nomeDaLoja?: string | null,
): ArteDoDestaque[] {
  const campos: any[] = (produto?.customization_config as any)?.fields || [];
  const naFrente = (f: any) => f && f.side !== "back" && f.side !== "middle";
  const base: Record<string, any> = {};
  const cor = campos.find((f) => naFrente(f) && f.type === "color" && Array.isArray(f.config?.colors) && f.config.colors.length);
  if (cor) base[cor.id] = cor.config.colors[0];

  const campoArte = campos.find((f) => naFrente(f) && f.type === "template");
  const artes = (produto?.templates || []).filter((t) => t && t.image_url);
  if (campoArte && artes.length) {
    return artes.slice(0, 3).map((t) => ({ rotulo: t.name, values: { ...base, [campoArte.id]: t.image_url } }));
  }
  const campoTexto = campos.find((f) => naFrente(f) && f.type === "text" && !f.config?.is_art_service);
  if (campoTexto) {
    return nomesDeExemplo(nomeDaLoja).map((n) => ({ rotulo: n, values: { ...base, [campoTexto.id]: n } }));
  }
  return [];
}

/** A próxima arte do destaque gira? A mesma regra do banner. */
export function arteGira(p: { total: number; pausado: boolean; reduzirMovimento: boolean }): boolean {
  return bannerGira(p);
}

// ── Textos do destaque sem banner ────────────────────────────

/** "Canecas, camisetas e copos" — as categorias com peça, na ordem do menu. */
export function listaDeCategorias(nomes: string[]): string {
  const n = nomes.map((s) => String(s || "").trim()).filter(Boolean).slice(0, 3).map((s) => s.toLowerCase());
  if (!n.length) return "";
  const frase = n.length === 1 ? n[0] : n.slice(0, -1).join(", ") + " e " + n[n.length - 1];
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/** O parágrafo do destaque: a tagline da lojista, ou a frase do Studio. */
export function fraseDoDestaque(store: StorePayload | null | undefined): string {
  const tag = String(store?.site?.tagline || "").trim();
  if (tag) return tag;
  const cats = menuDaLoja(store).map((i) => i.categoria.name);
  const quem = listaDeCategorias(cats) || "Peças";
  return `${quem} com a sua foto, o seu nome ou a sua frase. Você vê como fica antes de pagar.`;
}

/**
 * "Personalizar uma caneca": o convite com o nome da categoria no
 * singular. Só para o que dá para acertar (plural regular em -as, -os,
 * -ões); o resto vira "Personalizar esta peça".
 */
export function conviteDaPeca(nomeDaCategoria: string | null | undefined): string {
  const nome = String(nomeDaCategoria || "").trim().toLowerCase();
  const [primeira, ...resto] = nome.split(/\s+/);
  const cauda = resto.length ? " " + resto.join(" ") : "";
  if (!primeira) return "Personalizar esta peça";
  if (/ões$/.test(primeira)) return `Personalizar um ${primeira.replace(/ões$/, "ão")}${cauda}`;
  if (/[^e]as$/.test(primeira)) return `Personalizar uma ${primeira.slice(0, -1)}${cauda}`;
  if (/[^e]os$/.test(primeira)) return `Personalizar um ${primeira.slice(0, -1)}${cauda}`;
  // Singular composto ("Cartão de visita"): só -ão tem gênero certo
  // ("foto" termina em -o e é feminino). O resto não arrisca.
  if (resto.length && /ão$/.test(primeira)) return `Personalizar um ${nome}`;
  return "Personalizar esta peça";
}

/** O bairro (ou o trecho final) do endereço: "Jardim Colonial". */
export function lugarDaLoja(endereco: string | null | undefined): string {
  const e = String(endereco || "").trim();
  if (!e) return "";
  const partes = e.split(/\s[-–—]\s|,\s*(?=[^\d])/).map((s) => s.trim()).filter(Boolean);
  const ultimo = partes.length > 1 ? partes[partes.length - 1] : "";
  return /\d/.test(ultimo) ? "" : ultimo.replace(/\/[A-Z]{2}$/, "");
}

// ── Categorias: árvore, menu, página ─────────────────────────

/** Os ids da categoria e de todas as descendentes. */
export function idsDaArvore(catId: string, categorias: StoreCategory[] | null | undefined): Set<string> {
  const lista = categorias || [];
  const ids = new Set<string>([String(catId)]);
  let cresceu = true;
  while (cresceu) {
    cresceu = false;
    for (const c of lista) {
      if (c.parent_id && ids.has(String(c.parent_id)) && !ids.has(String(c.id))) {
        ids.add(String(c.id));
        cresceu = true;
      }
    }
  }
  return ids;
}

/**
 * As peças de uma categoria e das filhas dela, na ordem da vitrine.
 * Quem abre "Canecas" espera achar a caneca que está em "Canecas >
 * Metalizadas" (mesma regra do rodapé, conteudoDoRodape.ts).
 */
export function produtosDaArvore(
  catId: string,
  store: { products?: StudioStoreProduct[] | null; categories?: StoreCategory[] | null } | null | undefined,
): StudioStoreProduct[] {
  const ids = idsDaArvore(catId, store?.categories);
  return (store?.products || []).filter((p) => !!p.category_id && ids.has(String(p.category_id)));
}

export type AlvoDaCategoria =
  | { tipo: "grupo"; categoria: StoreCategory; produtos: StudioStoreProduct[] }
  | { tipo: "produto"; produto: StudioStoreProduct };

/**
 * Onde a âncora de uma categoria leva: a página dela (2+ peças), a peça
 * direto (uma só — a vitrine não mostra grade de um item) ou nada.
 */
export function alvoDaCategoria(
  categoria: StoreCategory | null | undefined,
  store: { products?: StudioStoreProduct[] | null; categories?: StoreCategory[] | null } | null | undefined,
): AlvoDaCategoria | null {
  if (!categoria) return null;
  const produtos = produtosDaArvore(categoria.id, store);
  if (produtos.length >= 2) return { tipo: "grupo", categoria, produtos };
  if (produtos.length === 1) return { tipo: "produto", produto: produtos[0] };
  return null;
}

export type ItemDoMenu = {
  categoria: StoreCategory;
  total: number;
  filhas: ItemDoMenu[];
};

/**
 * As categorias da barra, da gaveta e do rodapé: de primeiro nível, com
 * peça à venda, das que têm mais peças para as que têm menos (a regra do
 * StoreNav, storeNavModel.ts). Filhas com peça viram a sanfona da gaveta.
 */
export function menuDaLoja(store: StorePayload | null | undefined): ItemDoMenu[] {
  const cats = store?.categories || [];
  const conhecidos = new Set(cats.map((c) => String(c.id)));
  const montar = (c: StoreCategory): ItemDoMenu => ({
    categoria: c,
    total: produtosDaArvore(c.id, store).length,
    filhas: cats
      .filter((f) => String(f.parent_id || "") === String(c.id))
      .map(montar)
      .filter((f) => f.total > 0),
  });
  return cats
    .filter((c) => !c.parent_id || !conhecidos.has(String(c.parent_id)))
    .map(montar)
    .filter((i) => i.total > 0)
    .sort((a, b) => b.total - a.total || a.categoria.name.localeCompare(b.categoria.name, "pt-BR"));
}

/** "Início / Canecas / Metalizadas": os ancestrais da categoria, do topo para ela. */
export function trilhaDaCategoria(
  categoria: StoreCategory | null | undefined,
  categorias: StoreCategory[] | null | undefined,
): StoreCategory[] {
  if (!categoria) return [];
  const porId = new Map((categorias || []).map((c) => [String(c.id), c]));
  const trilha: StoreCategory[] = [categoria];
  const vistos = new Set([String(categoria.id)]);
  let pai = categoria.parent_id ? porId.get(String(categoria.parent_id)) : undefined;
  while (pai && !vistos.has(String(pai.id))) {
    trilha.unshift(pai);
    vistos.add(String(pai.id));
    pai = pai.parent_id ? porId.get(String(pai.parent_id)) : undefined;
  }
  return trilha;
}

/** As filhas da categoria que têm peça, com quantas — as opções da página. */
export function subcategorias(
  categoria: StoreCategory | null | undefined,
  store: StorePayload | null | undefined,
): Array<{ categoria: StoreCategory; total: number }> {
  if (!categoria) return [];
  return (store?.categories || [])
    .filter((c) => String(c.parent_id || "") === String(categoria.id))
    .map((c) => ({ categoria: c, total: produtosDaArvore(c.id, store).length }))
    .filter((s) => s.total > 0);
}

// ── Busca ────────────────────────────────────────────────────

export type ResultadoDaBusca = {
  pecas: Array<{ produto: StudioStoreProduct; noNome: boolean; categoria: string | null }>;
  categorias: Array<{ categoria: StoreCategory; casam: number; total: number }>;
};

/**
 * A busca da vitrine, a cada letra.
 *
 * A regra de casar é a de hoje (buscaVitrine.casa: todos os termos, sem
 * acento, em nome e descrição). O que muda é a ORDEM: quem casa pelo
 * nome vem antes de quem só casa pela descrição (pergunta j do mockup).
 * "caneca co" traz a Cromada só por "Cor prata" na descrição — ela fica,
 * mas por último, e a linha diz por que ela está ali.
 */
export function buscarNaVitrine(q: string, store: StorePayload | null | undefined): ResultadoDaBusca {
  const termo = normalizar(q);
  if (!termo) return { pecas: [], categorias: [] };
  const nomeDaCat = new Map((store?.categories || []).map((c) => [String(c.id), c.name]));
  const pecas = (store?.products || [])
    .filter((p) => casa(q, p.name, p.description))
    .map((p) => ({
      produto: p,
      noNome: casa(q, p.name),
      categoria: (p.category_id && nomeDaCat.get(String(p.category_id))) || p.category || null,
    }));
  // Estável: dentro de cada grupo, a ordem da vitrine.
  const ordenadas = [...pecas.filter((x) => x.noNome), ...pecas.filter((x) => !x.noNome)];
  const idsQueCasam = new Set(ordenadas.map((x) => String(x.produto.id)));
  const categorias = menuDaLoja(store)
    .map((i) => {
      const daArvore = produtosDaArvore(i.categoria.id, store);
      return {
        categoria: i.categoria,
        casam: daArvore.filter((p) => idsQueCasam.has(String(p.id))).length,
        total: daArvore.length,
      };
    })
    .filter((c) => c.total > 1 && (c.casam > 0 || casa(q, c.categoria.name)));
  return { pecas: ordenadas, categorias };
}

/** O nome partido em pedaços, com os termos buscados marcados. */
export function trechosDestacados(nome: string, q: string): Array<{ texto: string; marcado: boolean }> {
  const texto = String(nome || "");
  const termos = normalizar(q).split(" ").filter(Boolean);
  if (!termos.length || !texto) return [{ texto, marcado: false }];
  // Mapa letra a letra do texto sem acento para o original.
  let plano = "";
  const mapa: number[] = [];
  Array.from(texto).forEach((ch, i) => {
    const k = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    for (const c of k) { plano += c; mapa.push(i); }
  });
  const letras = Array.from(texto);
  const marca = new Array(letras.length).fill(false);
  for (const t of termos) {
    let at = plano.indexOf(t);
    while (at >= 0) {
      for (let j = at; j < at + t.length; j++) marca[mapa[j]] = true;
      at = plano.indexOf(t, at + t.length);
    }
  }
  const saida: Array<{ texto: string; marcado: boolean }> = [];
  letras.forEach((ch, i) => {
    const ult = saida[saida.length - 1];
    if (ult && ult.marcado === marca[i]) ult.texto += ch;
    else saida.push({ texto: ch, marcado: marca[i] });
  });
  return saida;
}

const PALAVRAS_VAZIAS = new Set(["com", "para", "sem", "dos", "das", "de", "da", "do", "e", "em", "kit", "personalizada", "personalizado", "personalizadas", "personalizados", "unidade", "unidades"]);

/**
 * As sugestões do campo vazio: as palavras dos produtos DESTA loja, das
 * mais comuns para as menos — não uma lista inventada (mockup, tela 4).
 */
export function sugestoesDeBusca(store: StorePayload | null | undefined, maximo = 6): string[] {
  const conta = new Map<string, { n: number; forma: string }>();
  for (const p of store?.products || []) {
    const vistas = new Set<string>();
    for (const bruta of String(p.name || "").split(/[^\p{L}]+/u)) {
      const k = normalizar(bruta);
      if (k.length < 4 || PALAVRAS_VAZIAS.has(k) || vistas.has(k)) continue;
      vistas.add(k);
      const atual = conta.get(k);
      const forma = bruta.toLowerCase();
      conta.set(k, { n: (atual?.n || 0) + 1, forma: atual?.forma || forma });
    }
  }
  return [...conta.values()]
    .sort((a, b) => b.n - a.n || a.forma.localeCompare(b.forma, "pt-BR"))
    .slice(0, maximo)
    .map((x) => x.forma.charAt(0).toUpperCase() + x.forma.slice(1));
}

/** A mensagem do "Pedir pelo WhatsApp" do "Nada encontrado", com o termo. */
export function mensagemDaBuscaVazia(termo: string, nomeDaLoja?: string | null): string {
  const t = String(termo || "").trim();
  const loja = String(nomeDaLoja || "").trim();
  return `Olá${loja ? ", " + loja : ""}! Procurei "${t}" na loja e não achei. Vocês fazem?`;
}

// ── Selos de confiança ───────────────────────────────────────

export type SeloDaHome = { icone: string; titulo: string; texto: string };

/** Os ícones do painel (os mesmos da loja comum) no conjunto do app. */
const ICONE_DO_PAINEL: Record<string, string> = {
  truck: "truck", pkg: "package", shield: "shield", sparkle: "sparkles", leaf: "sparkles",
  heart: "heart", star: "star", pix: "pix", card: "credit_card", receipt: "receipt",
  bag: "shopping_bag", user: "user",
};

/**
 * Os selos de confiança.
 *
 * Escritos na aba Design (`service_cards`), valem os dela. Vazios, os
 * automáticos do Studio, que nascem do que a loja LIGOU (como selosPadrao
 * da Negócio) e carregam os números que ela pode provar — a faixa de
 * números saiu da home e entrou aqui (decisão 10 do PO):
 *   - "Você aprova antes", com as revisões inclusas;
 *   - "N pedidos entregues", só com pedido entregue;
 *   - compra segura, retirada ou entrega, atendimento humano;
 *   - o prazo, quando sobra lugar (a faixa e o "Como funciona" já dizem).
 * No máximo 4.
 */
export function selosDaHome(store: StorePayload | null | undefined): SeloDaHome[] {
  const escritos = ((store?.site as any)?.service_cards || []) as Array<{ icon?: string; title?: string; body?: string; enabled?: boolean }>;
  const deles = (Array.isArray(escritos) ? escritos : [])
    .filter((c) => c && c.enabled !== false && (String(c.title || "").trim() || String(c.body || "").trim()))
    .slice(0, 4)
    .map((c) => ({ icone: ICONE_DO_PAINEL[String(c.icon || "")] || "sparkles", titulo: String(c.title || "").trim(), texto: String(c.body || "").trim() }));
  if (deles.length) return deles;

  const selos: SeloDaHome[] = [];
  const rev = Number(store?.revisions?.max_included) || 0;
  selos.push({
    icone: "eye", titulo: "Você aprova antes",
    texto: rev > 0
      ? `Mockup antes de produzir, ${rev} ${plural(rev, "revisão inclusa", "revisões inclusas")}`
      : "Mockup antes de produzir, nada sai sem o seu ok",
  });
  const entregues = Number(store?.numeros?.pedidos_entregues) || 0;
  if (entregues > 0) {
    selos.push({ icone: "check_circle", titulo: `${entregues} ${plural(entregues, "pedido entregue", "pedidos entregues")}`, texto: "Feitos e entregues por esta loja" });
  }
  const pg = store?.payment;
  if (pg?.has_pix || pg?.has_card) {
    selos.push({ icone: "shield", titulo: "Compra segura", texto: [pg.has_pix ? "Pix" : null, pg.has_card ? "cartão" : null].filter(Boolean).join(" ou ") + ", pagamento protegido" });
  } else if (pg?.pay_on_delivery_enabled) {
    selos.push({ icone: "shield", titulo: "Pague na retirada", texto: "Combinado direto com a loja" });
  }
  const dv = store?.delivery;
  if (dv?.delivery_enabled) {
    selos.push({ icone: "truck", titulo: "Entrega", texto: String(dv.delivery_eta_text || "").trim() || "Combinada com a loja" });
  } else if (dv?.pickup_enabled !== false) {
    selos.push({ icone: "store", titulo: "Retire na loja", texto: lugarDaLoja(store?.site?.endereco) || "Sem custo de envio" });
  }
  if (String(store?.site?.whatsapp || "").replace(/\D/g, "").length >= 10) {
    selos.push({ icone: "whatsapp", titulo: "Atendimento humano", texto: "WhatsApp direto com a loja" });
  }
  const dias = Number(store?.sla?.total_estimate_days) || 0;
  if (dias > 0) selos.push({ icone: "clock", titulo: `Pronto em ${dias} ${plural(dias, "dia útil", "dias úteis")}`, texto: "Prazo de hoje, contado depois da sua aprovação" });
  return selos.slice(0, 4);
}

// ── Para empresas ────────────────────────────────────────────

/**
 * A categoria mais forte da loja: a de mais pedidos; sem pedido, a de
 * mais peças. É ela que dá a frase do bloco para empresas.
 */
export function categoriaMaisForte(store: StorePayload | null | undefined): ItemDoMenu | null {
  const menu = menuDaLoja(store);
  if (!menu.length) return null;
  const pedidos = (i: ItemDoMenu) => produtosDaArvore(i.categoria.id, store).reduce((s, p) => s + (p.pedidos || 0), 0);
  return menu.slice().sort((a, b) => pedidos(b) - pedidos(a) || b.total - a.total)[0];
}

/** O título do bloco para empresas, na língua da categoria mais forte. */
export function tituloParaEmpresas(nomeDaCategoria: string | null | undefined): string {
  const n = normalizar(nomeDaCategoria);
  if (/caneca|xicara/.test(n)) return "50 canecas com o nome de cada convidado? Preço na hora.";
  if (/camis|camiset|blusa|moletom|polo/.test(n)) return "30 camisetas com o nome de cada pessoa do time? Preço na hora.";
  if (/copo|garraf|squeeze|taca|tulipa/.test(n)) return "40 copos com o nome de cada convidado? Preço na hora.";
  if (/azulej/.test(n)) return "30 azulejos com a foto de cada família? Preço na hora.";
  return "50 peças com o nome de cada convidado? Preço na hora.";
}

export type BlocoParaEmpresas = {
  titulo: string;
  /** A escada da peça de referência, quando a loja configurou faixas. */
  degraus: Array<{ minimo: number; preco: number; pct: number }>;
  /** "Caneca Branca, preço por unidade. Prazo: ..." — só com escada. */
  legenda: string | null;
  /** Até 5 fotos das peças da categoria, para o leque. */
  fotos: string[];
};

/** O bloco para empresas inteiro. */
export function blocoParaEmpresas(store: StorePayload | null | undefined): BlocoParaEmpresas {
  const forte = categoriaMaisForte(store);
  const produtos = forte ? produtosDaArvore(forte.categoria.id, store) : store?.products || [];
  const comEscada = produtos
    .filter((p) => Array.isArray(p.qty_tiers) && p.qty_tiers.some((t) => Number(t.discount_pct) > 0))
    .sort((a, b) => (b.pedidos || 0) - (a.pedidos || 0))[0];
  const faixas = comEscada ? (comEscada.qty_tiers || []).filter((t) => Number(t.discount_pct) > 0).slice(-3) : [];
  const degraus = faixas.map((t) => ({ minimo: Number(t.min_qty), preco: Number(t.unit_price), pct: Math.round(Number(t.discount_pct)) }));
  let legenda: string | null = null;
  if (comEscada) {
    const comPrazo = (comEscada.qty_tiers || []).filter((t: any) => Number(t.lead_days) > 0) as any[];
    const prazo = comPrazo.length
      ? " Prazo: " + comPrazo.map((t, i) => {
          const faixa = t.max_qty == null ? `${t.min_qty} ou mais` : i === 0 && Number(t.min_qty) <= 1 ? `até ${t.max_qty} un` : `${t.min_qty} a ${t.max_qty}`;
          return `${faixa}, ${t.lead_days} ${plural(Number(t.lead_days), "dia útil", "dias úteis")}`;
        }).join(" · ") + "."
      : "";
    legenda = `${comEscada.name}, preço por unidade.${prazo}`;
  }
  const fotos = produtos.map((p) => p.image_url).filter((u): u is string => !!u).slice(0, 5);
  return { titulo: tituloParaEmpresas(forte?.categoria.name), degraus, legenda, fotos };
}

// ── Artes prontas que abrem a peça ───────────────────────────

export type ArteDaHome = {
  id: string; nome: string;
  /** A miniatura, para a vitrine. */
  imagem: string;
  /** O valor do campo de arte pronta: a imagem inteira (FieldTemplate.tsx). */
  valor: string;
  produto: StudioStoreProduct; campoId: string;
};

/**
 * As artes prontas da loja, cada uma com a peça que a aceita — tocar abre
 * a peça com a arte já aplicada (pergunta e do mockup). Só artes de peça
 * com campo de arte pronta; a mais pedida primeiro. Menos de 2 não é
 * seleção (MINIMO_NA_FILEIRA de blocosDaHome.ts).
 */
export function artesDaHome(produtos: StudioStoreProduct[] | null | undefined, maximo = 6): ArteDaHome[] {
  const ordem = (produtos || []).slice().sort((a, b) => (b.pedidos || 0) - (a.pedidos || 0));
  const vistas = new Set<string>();
  const saida: ArteDaHome[] = [];
  for (const p of ordem) {
    const campo = ((p.customization_config as any)?.fields || []).find((f: any) => f && f.type === "template" && f.side !== "back" && f.side !== "middle");
    if (!campo) continue;
    for (const t of p.templates || []) {
      const img = t.thumb_url || t.image_url;
      if (!img || !t.image_url || vistas.has(String(t.id))) continue;
      vistas.add(String(t.id));
      saida.push({ id: String(t.id), nome: t.name, imagem: img, valor: t.image_url, produto: p, campoId: campo.id });
      if (saida.length >= maximo) return saida;
    }
  }
  return saida.length >= 2 ? saida : [];
}

// ── O botão flutuante do WhatsApp ────────────────────────────

/** Onde o "Tirar dúvida" começa, medido do pé da tela (botão + margem). */
export const ALTURA_DO_TIRAR_DUVIDA = 84;

/**
 * O "Tirar dúvida" aparece?
 *
 * No mockup ele cobria as artes do destaque no celular (tela 2) e ficaria
 * em cima do contador dos banners. Regra geométrica, a mesma nos dois
 * tamanhos: o botão só aparece quando o destaque (o fim dele, `fimDoTopo`,
 * medido do alto da página) já está acima da faixa do pé da tela onde o
 * botão mora. Rolou para a loja, ele volta. O fim da página tem folga
 * para ele não cobrir o rodapé.
 */
export function mostrarTirarDuvida(p: { rolagem: number; fimDoTopo: number; alturaDaTela: number }): boolean {
  if (!(p.fimDoTopo > 0) || !(p.alturaDaTela > 0)) return false;
  return p.fimDoTopo - p.rolagem <= p.alturaDaTela - ALTURA_DO_TIRAR_DUVIDA;
}

// ── A grade agrupada da home nova ────────────────────────────

/**
 * As entradas da grade da home nova: categoria com 2+ peças vira um
 * cartão só — pela categoria de PRIMEIRO NÍVEL. Com árvore (Canecas >
 * Cerâmica, Metalizadas), o cartão é "Canecas · 10 modelos", o mesmo
 * destino da barra e do rodapé; sem árvore, é exatamente o
 * agruparVitrine de sempre (categoryGrouping.ts).
 */
export function gradeDaHome(store: StorePayload | null | undefined): VitrineEntry[] {
  const cats = store?.categories || [];
  const produtos = store?.products || [];
  if (!cats.some((c) => c.parent_id)) return agruparVitrine(produtos, cats);
  const porId = new Map(cats.map((c) => [String(c.id), c]));
  const raizDe = (id: string | null | undefined) => {
    const c = id ? porId.get(String(id)) : undefined;
    return c ? trilhaDaCategoria(c, cats)[0] : undefined;
  };
  const naRaiz = produtos.map((p) => {
    const r = raizDe(p.category_id);
    return r ? { ...p, category_id: r.id } : p;
  });
  // Os cartões levam as peças originais (com a categoria delas): a página
  // da categoria e o seletor de modelo leem a categoria de verdade.
  const original = new Map(produtos.map((p) => [String(p.id), p]));
  return agruparVitrine(naRaiz, cats).map((e) =>
    e.kind === "category"
      ? { ...e, products: e.products.map((p) => original.get(String(p.id)) || p) }
      : { kind: "product" as const, product: original.get(String(e.product.id)) || e.product });
}
