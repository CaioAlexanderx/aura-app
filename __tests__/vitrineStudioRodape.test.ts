// ============================================================
// O rodapé da vitrine Studio (04/09/2026)
//
// A loja comum ganhou em 09/2026 um rodapé de três colunas. A vitrine
// terminava no último produto: sem endereço, sem horário, sem CNPJ, e
// sem as redes sociais — que chegam no payload desde a S0 e nunca foram
// desenhadas em lugar nenhum.
//
// A regra que este teste guarda é a de sempre: bloco nasce da config ou
// não existe. Coluna vazia com título solto é defeito, não placeholder.
// ============================================================
import {
  montarConteudoDoRodape, navegacaoDoRodape, linhaLegal, MAXIMO_NA_NAVEGACAO,
} from "@/components/studio/storefront/conteudoDoRodape";

const CATS = [
  { id: "c1", name: "Canecas", slug: "canecas", path: "/canecas", depth: 0, parent_id: null },
  { id: "c2", name: "Cerâmica", slug: "ceramica", path: "/canecas/ceramica", depth: 1, parent_id: "c1" },
  { id: "c3", name: "Camisetas", slug: "camisetas", path: "/camisetas", depth: 0, parent_id: null },
];
const produto = (id: string, categoryId: string | null) =>
  ({ id, name: id, description: null, price: 10, image_url: null, category_id: categoryId } as any);

const lojaDaSheid = {
  site: {
    name: "Sheid Mania", logo_url: null, primary_color: "#1a1612", accent_color: "#EC4899",
    endereco: "Av Dom Pedro I, 553 — Jardim Colonial",
    horario_resumo: "Seg a sáb, 9h às 18h",
    cnpj_formatado: "12.345.678/0001-90",
    redes: [{ rede: "instagram", nome: "Instagram", handle: "@sheidmania_", url: "https://instagram.com/sheidmania_" }],
  },
  categories: CATS,
  products: [produto("p1", "c2"), produto("p2", "c3")],
  rodape_institucional: { formas: ["Pix"], politica_titulo: "Trocas e devoluções", politica: "Você tem 7 dias." },
};

describe("por onde navegar", () => {
  test("só categorias de primeiro nível", () => {
    const n = navegacaoDoRodape(CATS, [produto("p1", "c2"), produto("p2", "c3")]);
    expect(n.map((p) => p.nome)).toEqual(["Canecas", "Camisetas"]);
  });

  test("a peça na subcategoria conta para a categoria mãe", () => {
    // Quem clica em "Canecas" espera achar a caneca que está em
    // "Canecas > Cerâmica". Sem isso, a porta principal sumiria.
    const n = navegacaoDoRodape(CATS, [produto("p1", "c2")]);
    expect(n.map((p) => p.slug)).toEqual(["canecas"]);
  });

  test("categoria sem peça não vira porta", () => {
    // Porta que abre em "nenhum produto encontrado" é pior do que porta
    // nenhuma.
    const n = navegacaoDoRodape(CATS, [produto("p1", "c3")]);
    expect(n.map((p) => p.nome)).toEqual(["Camisetas"]);
  });

  test("leva o slug, que é por onde a vitrine troca de categoria", () => {
    const n = navegacaoDoRodape(CATS, [produto("p1", "c1")]);
    expect(n[0]).toEqual({ id: "c1", slug: "canecas", nome: "Canecas" });
  });

  test("loja sem categoria ou sem produto não mostra a coluna", () => {
    expect(navegacaoDoRodape([], [produto("p1", "c1")])).toEqual([]);
    expect(navegacaoDoRodape(CATS, [])).toEqual([]);
    expect(navegacaoDoRodape(undefined, undefined)).toEqual([]);
  });

  test("o rodapé não vira índice: para no teto", () => {
    const muitas = Array.from({ length: 20 }, (_, i) => ({
      id: "x" + i, name: "Cat " + i, slug: "c" + i, path: "/c" + i, depth: 0, parent_id: null,
    }));
    const itens = muitas.map((c, i) => produto("p" + i, c.id));
    expect(navegacaoDoRodape(muitas, itens)).toHaveLength(MAXIMO_NA_NAVEGACAO);
  });

  test("ciclo no cadastro não trava a montagem", () => {
    // Categoria que é mãe da própria mãe existiria só por defeito de
    // dado — mas travaria a loja inteira num laço infinito.
    const ciclo = [
      { id: "a", name: "A", slug: "a", path: "/a", depth: 0, parent_id: "b" },
      { id: "b", name: "B", slug: "b", path: "/b", depth: 0, parent_id: "a" },
    ];
    expect(() => navegacaoDoRodape(ciclo, [produto("p", "a")])).not.toThrow();
  });
});

describe("a linha de baixo", () => {
  test("com CNPJ, do jeito que a loja comum escreve", () => {
    expect(linhaLegal("Sheid Mania", "12.345.678/0001-90", 2026))
      .toBe("© 2026 Sheid Mania · CNPJ 12.345.678/0001-90");
  });

  test("sem CNPJ, não sobra um separador solto", () => {
    expect(linhaLegal("Sheid Mania", "", 2026)).toBe("© 2026 Sheid Mania");
  });

  test("o ano é parâmetro, não o relógio da máquina", () => {
    expect(linhaLegal("X", "", 1999)).toContain("1999");
  });
});

describe("o rodapé inteiro", () => {
  test("a loja da Sheid mostra as três colunas", () => {
    const r = montarConteudoDoRodape(lojaDaSheid, new Date("2026-09-04T12:00:00Z"));
    expect(r.temAlgo).toBe(true);
    expect(r.identidade.endereco).toContain("Dom Pedro");
    expect(r.identidade.horario).toBe("Seg a sáb, 9h às 18h");
    expect(r.identidade.redes).toHaveLength(1);
    expect(r.navegacao.map((p) => p.nome)).toEqual(["Canecas", "Camisetas"]);
    expect(r.linhaLegal).toBe("© 2026 Sheid Mania · CNPJ 12.345.678/0001-90");
  });

  test("rede sem endereço não vira botão que não abre", () => {
    const r = montarConteudoDoRodape({
      ...lojaDaSheid,
      site: { ...lojaDaSheid.site, redes: [{ rede: "tiktok", nome: "TikTok", handle: "@x", url: "" }] },
    });
    expect(r.identidade.redes).toEqual([]);
  });

  test("payload antigo, sem nenhum campo novo, não quebra", () => {
    // Cache do navegador com o payload anterior ao PR do backend.
    const r = montarConteudoDoRodape({ site: { name: "Loja X" }, products: [] });
    expect(r.temAlgo).toBe(true);
    expect(r.identidade.endereco).toBe("");
    expect(r.navegacao).toEqual([]);
    expect(r.linhaLegal).toContain("Loja X");
  });

  test("sem payload nenhum, o rodapé não aparece", () => {
    expect(montarConteudoDoRodape(null).temAlgo).toBe(false);
    expect(montarConteudoDoRodape({}).temAlgo).toBe(false);
  });
});

describe("a vitrine desenha, o backend decide", () => {
  const fs = require("fs");
  const path = require("path");
  const RAIZ = path.join(__dirname, "..", "components", "studio", "storefront");

  test("o rodapé não remonta a lista de formas de pagamento", () => {
    const modulo = fs.readFileSync(path.join(RAIZ, "conteudoDoRodape.ts"), "utf8");
    const tela = fs.readFileSync(path.join(RAIZ, "RodapeDaVitrine.tsx"), "utf8");
    expect(modulo).not.toContain("Cartão de crédito");
    expect(tela).not.toContain("Cartão de crédito");
    // O bloco institucional continua vindo do componente que já lia o
    // texto pronto do backend.
    expect(tela).toContain("rodape_institucional");
  });

  test("a assinatura da Aura aparece uma vez, e leva ao site do produto", () => {
    const tela = fs.readFileSync(path.join(RAIZ, "RodapeDaVitrine.tsx"), "utf8");
    expect((tela.match(/getaura\.com\.br/g) || []).length).toBe(1);
    expect(tela).toContain("https://getaura.com.br");
  });

  test("a barra flutuante saiu da vitrine e não aponta mais para outra loja", () => {
    const lista = fs.readFileSync(path.join(RAIZ, "ProductList.tsx"), "utf8");
    expect(lista).not.toContain("<PoweredByAura");
    const barra = fs.readFileSync(path.join(RAIZ, "ui", "PoweredByAura.tsx"), "utf8");
    expect(barra).not.toContain("loja.getaura.com.br/aura");
  });
});
