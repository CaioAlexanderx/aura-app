// ============================================================
// Vitrine Studio · Onda 1B — endereços (25/09/2026)
//
// Cada tela da vitrine ganhou URL (D1 da jornada): voltar do navegador
// volta uma tela, o link da peça abre a peça, F5 não perde a tela.
//
// 1. rotasDaVitrine.ts — a tradução tela ↔ estado, pura.
// 2. A árvore REAL de app/ resolvida pelo mesmo código do Expo Router:
//    as rotas estáticas da raiz continuam vencendo a loja, e cada tela
//    da loja cai na rota certa.
// 3. O guarda de autenticação deixa passar TODAS as telas da loja.
// ============================================================
import {
  caminhoDaTela, chaveDaCategoria, mesmaTela, telaPronta, resolverTela,
  telaDeEntradaProfunda, ehVitrinePublica, tituloDaPagina, linkDaPeca,
  AVISO_PECA_FORA, type TelaDaVitrine,
} from "@/components/studio/storefront/rotasDaVitrine";
import { agruparVitrine } from "@/components/studio/storefront/categoryGrouping";

const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

// ── Uma loja pequena: duas canecas na mesma categoria, uma camiseta
// sozinha na dela e um chaveiro sem categoria.
const CATS = [
  { id: "cat-1", name: "Canecas", slug: "canecas", path: "canecas", depth: 0, parent_id: null },
  { id: "cat-2", name: "Camisetas", slug: "camisetas", path: "camisetas", depth: 0, parent_id: null },
  { id: "cat-3", name: "Sem slug", slug: "", path: "", depth: 0, parent_id: null },
];
const P = (id: string, category_id: string | null) =>
  ({ id, name: "Peça " + id, price: 50, category_id, customization_config: { fields: [] } } as any);
const LOJA = {
  products: [P("a1", "cat-1"), P("a2", "cat-1"), P("b1", "cat-2"), P("c1", null)],
  categories: CATS as any,
};
const VITRINE = agruparVitrine(LOJA.products, LOJA.categories);

describe("caminhoDaTela", () => {
  test("uma URL por tela, sob o slug da loja", () => {
    expect(caminhoDaTela("sheid-mania", { tipo: "home" })).toBe("/sheid-mania");
    expect(caminhoDaTela("sheid-mania", { tipo: "produto", id: "8f21c4a9" })).toBe("/sheid-mania/p/8f21c4a9");
    expect(caminhoDaTela("sheid-mania", { tipo: "categoria", categoria: "canecas" })).toBe("/sheid-mania/c/canecas");
    expect(caminhoDaTela("sheid-mania", { tipo: "finalizar" })).toBe("/sheid-mania/finalizar");
    expect(caminhoDaTela("sheid-mania", { tipo: "orcamento" })).toBe("/sheid-mania/orcamento");
  });

  test("o slug fica como está na URL (trocar a grafia remontaria a loja)", () => {
    expect(caminhoDaTela("Sheid-Mania", { tipo: "home" })).toBe("/Sheid-Mania");
  });

  test("id e categoria estranhos saem escapados", () => {
    expect(caminhoDaTela("x", { tipo: "categoria", categoria: "cama mesa" })).toBe("/x/c/cama%20mesa");
    expect(caminhoDaTela("x", { tipo: "produto", id: "a/b" })).toBe("/x/p/a%2Fb");
  });
});

describe("chaveDaCategoria e mesmaTela", () => {
  test("o slug da categoria, ou o id quando ela não tem slug", () => {
    expect(chaveDaCategoria(CATS[0])).toBe("canecas");
    expect(chaveDaCategoria(CATS[2])).toBe("cat-3");
    expect(chaveDaCategoria(null)).toBe("");
  });

  test("mesma tela = mesmo tipo e mesmo alvo", () => {
    expect(mesmaTela({ tipo: "produto", id: "a" }, { tipo: "produto", id: "a" })).toBe(true);
    expect(mesmaTela({ tipo: "produto", id: "a" }, { tipo: "produto", id: "b" })).toBe(false);
    expect(mesmaTela({ tipo: "home" }, { tipo: "home" })).toBe(true);
    expect(mesmaTela({ tipo: "home" }, { tipo: "finalizar" })).toBe(false);
    expect(mesmaTela(null, { tipo: "home" })).toBe(false);
  });

  test("peça e categoria são as entradas que se compartilham", () => {
    expect(telaDeEntradaProfunda({ tipo: "produto", id: "a" })).toBe(true);
    expect(telaDeEntradaProfunda({ tipo: "categoria", categoria: "x" })).toBe(true);
    expect(telaDeEntradaProfunda({ tipo: "home" })).toBe(false);
    expect(telaDeEntradaProfunda({ tipo: "finalizar" })).toBe(false);
  });
});

describe("telaPronta: a rota só desenha quando o estado chegou nela", () => {
  test("cada tela com o seu stage", () => {
    expect(telaPronta({ tipo: "home" }, { stage: "list" })).toBe(true);
    expect(telaPronta({ tipo: "home" }, { stage: "configure" })).toBe(false);
    expect(telaPronta({ tipo: "orcamento" }, { stage: "lote" })).toBe(true);
    expect(telaPronta({ tipo: "finalizar" }, { stage: "checkout" })).toBe(true);
  });

  test("produto e categoria conferem o ALVO, não só o stage", () => {
    const t: TelaDaVitrine = { tipo: "produto", id: "a1" };
    expect(telaPronta(t, { stage: "configure", produtoAtivoId: "a1" })).toBe(true);
    expect(telaPronta(t, { stage: "configure", produtoAtivoId: "a2" })).toBe(false);
    const c: TelaDaVitrine = { tipo: "categoria", categoria: "canecas" };
    expect(telaPronta(c, { stage: "modelos", categoriaAbertaChave: "canecas" })).toBe(true);
    expect(telaPronta(c, { stage: "modelos", categoriaAbertaChave: "camisetas" })).toBe(false);
  });

  test("o pedido enviado continua na URL do checkout (a confirmação é da Fase 2)", () => {
    expect(telaPronta({ tipo: "finalizar" }, { stage: "sent" })).toBe(true);
  });
});

describe("resolverTela: a URL contra a loja carregada", () => {
  test("peça que existe abre com os outros modelos da categoria", () => {
    const r = resolverTela({ tipo: "produto", id: "a2" }, LOJA, VITRINE);
    expect(r.acao).toBe("produto");
    if (r.acao !== "produto") return;
    expect(r.produto.id).toBe("a2");
    expect(r.irmaos.map((p) => p.id)).toEqual(["a1", "a2"]);
  });

  test("peça solta abre sem seletor de modelo", () => {
    const r = resolverTela({ tipo: "produto", id: "c1" }, LOJA, VITRINE);
    expect(r.acao === "produto" && r.irmaos).toEqual([]);
  });

  test("peça que saiu da loja volta para a home com o aviso discreto", () => {
    expect(resolverTela({ tipo: "produto", id: "nao-existe" }, LOJA, VITRINE)).toEqual({
      acao: "redirecionar", para: { tipo: "home" }, aviso: AVISO_PECA_FORA,
    });
    expect(AVISO_PECA_FORA).toBe("Essa peça não está mais na loja");
  });

  test("categoria com grupo abre a grade", () => {
    const r = resolverTela({ tipo: "categoria", categoria: "canecas" }, LOJA, VITRINE);
    expect(r.acao).toBe("categoria");
    if (r.acao === "categoria") expect(r.produtos.map((p) => p.id)).toEqual(["a1", "a2"]);
  });

  test("categoria de um modelo só abre o modelo (a vitrine não tem grade de um item)", () => {
    expect(resolverTela({ tipo: "categoria", categoria: "camisetas" }, LOJA, VITRINE))
      .toEqual({ acao: "redirecionar", para: { tipo: "produto", id: "b1" } });
  });

  test("categoria que não existe volta para a home, sem aviso", () => {
    expect(resolverTela({ tipo: "categoria", categoria: "sumiu" }, LOJA, VITRINE))
      .toEqual({ acao: "redirecionar", para: { tipo: "home" } });
  });

  test("home, finalizar e orçamento não dependem da loja", () => {
    expect(resolverTela({ tipo: "home" }, null, []).acao).toBe("home");
    expect(resolverTela({ tipo: "finalizar" }, null, []).acao).toBe("finalizar");
    expect(resolverTela({ tipo: "orcamento" }, null, []).acao).toBe("orcamento");
  });
});

describe("tituloDaPagina", () => {
  test("peça · loja, como o servidor escreve na casca de /p/<id>", () => {
    expect(tituloDaPagina({ stage: "configure", nomeDaLoja: "Sheid Mania", produto: "Caneca Alça Coração" }))
      .toBe("Caneca Alça Coração · Sheid Mania");
    expect(tituloDaPagina({ stage: "modelos", nomeDaLoja: "Sheid Mania", categoria: "Canecas" }))
      .toBe("Canecas · Sheid Mania");
    expect(tituloDaPagina({ stage: "checkout", nomeDaLoja: "Sheid Mania" })).toBe("Finalizar pedido · Sheid Mania");
    expect(tituloDaPagina({ stage: "list", nomeDaLoja: "Sheid Mania" })).toBe("Sheid Mania");
  });

  test("sem nome de peça ou de loja não sai um separador solto", () => {
    expect(tituloDaPagina({ stage: "configure", nomeDaLoja: "Sheid Mania", produto: "" })).toBe("Sheid Mania");
    expect(tituloDaPagina({ stage: "list" })).toBe("Loja");
  });
});

describe("linkDaPeca: o link que o Compartilhar manda", () => {
  test("na loja pública, o próprio endereço", () => {
    expect(linkDaPeca({ slug: "sheid-mania", id: "8f21c4a9", origem: "https://loja.getaura.com.br" }))
      .toBe("https://loja.getaura.com.br/sheid-mania/p/8f21c4a9");
  });

  test("no preview do painel, o endereço PÚBLICO (é lá que a prévia tem foto)", () => {
    expect(linkDaPeca({ slug: "Sheid-Mania", id: "8f21c4a9", origem: "https://app.getaura.com.br" }))
      .toBe("https://loja.getaura.com.br/sheid-mania/p/8f21c4a9");
  });

  test("endereço canônico do payload vence (domínio próprio)", () => {
    expect(linkDaPeca({ slug: "sheid-mania", id: "x1", origem: "https://loja.getaura.com.br", canonica: "https://sheidmania.com.br/" }))
      .toBe("https://sheidmania.com.br/p/x1");
  });

  test("em desenvolvimento, a própria origem", () => {
    expect(linkDaPeca({ slug: "aura-qa", id: "x1", origem: "http://localhost:8081" }))
      .toBe("http://localhost:8081/aura-qa/p/x1");
  });

  test("sem origem (nativo), o endereço público", () => {
    expect(linkDaPeca({ slug: "aura-qa", id: "x1", origem: null }))
      .toBe("https://loja.getaura.com.br/aura-qa/p/x1");
  });
});

// ── A árvore real de app/ ─────────────────────────────────────
// Resolvida pelo mesmo código que o Expo Router usa no navegador
// (getRoutes → config → getStateFromPath). Se alguém criar uma rota na
// raiz que colida com a loja, ou mover uma tela da loja, quebra aqui.
describe("as rotas da árvore real de app/", () => {
  const { getRoutes } = require("expo-router/build/getRoutesCore");
  const { getReactNavigationConfig } = require("expo-router/build/getReactNavigationConfig");
  const { getStateFromPath } = require("expo-router/build/fork/getStateFromPath");

  function arquivos(dir: string, acc: string[] = []): string[] {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) arquivos(p, acc);
      else if (/\.(tsx?|jsx?)$/.test(f)) acc.push("./" + path.relative(path.join(RAIZ, "app"), p));
    }
    return acc;
  }
  const chaves = arquivos(path.join(RAIZ, "app"));
  const contexto = Object.assign(() => ({ default: () => null }), {
    keys: () => chaves, resolve: (k: string) => k, id: "0",
  });
  const rotas = getRoutes(contexto, {
    importMode: "sync", platform: "web",
    getSystemRoute: ({ route, type }: any) => ({
      type, route, loadRoute: () => ({ default: () => null }),
      contextKey: "sistema:" + route, generated: true, dynamic: null, children: [],
    }),
  });
  const config = getReactNavigationConfig(rotas, true);

  /** A rota folha que o caminho abre, como "[slug] > p/[id]". */
  function rotaDe(caminho: string): string {
    const estado = getStateFromPath(caminho, config);
    const nomes: string[] = [];
    let r = estado?.routes[estado.routes.length - 1];
    while (r) {
      nomes.push(r.name);
      r = r.state?.routes[r.state.routes.length - 1];
    }
    return nomes.join(" > ");
  }

  test("app/[slug].tsx virou layout com telas", () => {
    expect(fs.existsSync(path.join(RAIZ, "app/[slug].tsx"))).toBe(false);
    expect(fs.existsSync(path.join(RAIZ, "app/[slug]/_layout.tsx"))).toBe(true);
  });

  test("as rotas estáticas da raiz continuam vencendo a loja", () => {
    expect(rotaDe("/studio")).toMatch(/^studio/);
    expect(rotaDe("/login")).toBe("(auth) > login");
    expect(rotaDe("/empresas")).toBe("empresas");
    expect(rotaDe("/cardapio/sheid")).toBe("cardapio/[slug]");
    expect(rotaDe("/cardapio/studio/sheid")).toBe("cardapio/studio/[slug]");
    expect(rotaDe("/acompanhar/tok")).toBe("acompanhar/[token]");
    expect(rotaDe("/aprovacao/tok")).toBe("aprovacao/[token]");
    expect(rotaDe("/orcamento/tok")).toBe("orcamento/[token]");
    expect(rotaDe("/m/1")).toBe("m/[tableId]");
  });

  test("cada tela da loja cai na sua rota, dentro do layout da loja", () => {
    expect(rotaDe("/sheid-mania")).toBe("[slug] > index");
    expect(rotaDe("/sheid-mania?produto=abc&origem=aurinha")).toBe("[slug] > index");
    expect(rotaDe("/sheid-mania/p/8f21c4a9")).toBe("[slug] > p/[id]");
    expect(rotaDe("/sheid-mania/c/canecas")).toBe("[slug] > c/[categoria]");
    expect(rotaDe("/sheid-mania/finalizar")).toBe("[slug] > finalizar");
    expect(rotaDe("/sheid-mania/orcamento")).toBe("[slug] > orcamento");
  });

  test("as rotas reservadas que o servidor já serve (BE-1) não quebram", () => {
    expect(rotaDe("/sheid-mania/sacola")).toBe("[slug] > sacola");
    expect(rotaDe("/sheid-mania/pedido/tok")).toBe("[slug] > pedido/[token]");
    expect(rotaDe("/sheid-mania/acompanhar/tok")).toBe("[slug] > acompanhar/[token]");
    expect(rotaDe("/sheid-mania/aprovacao/tok")).toBe("[slug] > aprovacao/[token]");
    // Fase 2: /sacola e /pedido/<token> deixaram de ser reservadas —
    // viraram a gaveta aberta e a página do pedido.
    expect(fs.readFileSync(path.join(RAIZ, "app/[slug]/sacola.tsx"), "utf8")).toContain("<SacolaNaRota />");
    expect(fs.readFileSync(path.join(RAIZ, "app/[slug]/pedido/[token].tsx"), "utf8")).toContain("<PedidoNaRota");
    // Fase 4: aprovação e acompanhamento viraram páginas no endereço da loja.
    const ler = (f: string) => fs.readFileSync(path.join(RAIZ, "app/[slug]", f + ".tsx"), "utf8");
    expect(ler("aprovacao/[token]")).toContain("<PaginaDaAprovacao");
    expect(ler("acompanhar/[token]")).toContain("<PaginaDoAcompanhamento");
  });

  test("Fase 4: os endereços antigos do pós-compra continuam de pé (links já enviados)", () => {
    expect(rotaDe("/aprovacao/tok")).toBe("aprovacao/[token]");
    expect(rotaDe("/acompanhar/tok")).toBe("acompanhar/[token]");
  });
});

// ── O guarda de autenticação ─────────────────────────────────
describe("toda tela da loja é pública", () => {
  test("ehVitrinePublica aceita a home e as telas aninhadas", () => {
    expect(ehVitrinePublica(["[slug]"])).toBe(true);
    expect(ehVitrinePublica(["[slug]", "p", "[id]"])).toBe(true);
    expect(ehVitrinePublica(["[slug]", "c", "[categoria]"])).toBe(true);
    expect(ehVitrinePublica(["[slug]", "finalizar"])).toBe(true);
    expect(ehVitrinePublica(["[slug]", "pedido", "[token]"])).toBe(true);
  });

  test("nenhuma rota do painel passa por ela", () => {
    expect(ehVitrinePublica(["studio", "(estudio)"])).toBe(false);
    expect(ehVitrinePublica(["(tabs)"])).toBe(false);
    expect(ehVitrinePublica(["(auth)", "login"])).toBe(false);
    expect(ehVitrinePublica(["empresas"])).toBe(false);
    // Um slug de verdade nunca chega aqui: useSegments devolve o NOME da
    // rota ("[slug]"), não o caminho.
    expect(ehVitrinePublica(["sheid-mania"])).toBe(false);
    expect(ehVitrinePublica([])).toBe(false);
    expect(ehVitrinePublica(null)).toBe(false);
  });

  test("o _layout usa a regra e ela entra no pass-through público", () => {
    const layout = fs.readFileSync(path.join(RAIZ, "app/_layout.tsx"), "utf8");
    expect(layout).toContain("const onVitrinePublica = ehVitrinePublica(segments);");
    expect(layout).toContain("onVitrinePublica ||");
    // A regra antiga (só a home) não pode voltar.
    expect(layout).not.toContain('segments.length === 1 && segments[0] === "[slug]"');
  });
});
