// ============================================================
// AURA. — D2 (F0): filtro de categoria hierárquico
//
// O que estes testes provam:
//   1. Escolher o topo traz a subárvore inteira — sem isso, quanto mais o
//      lojista organiza, menos produto aparece ao filtrar pelo topo.
//   2. Escolher a folha traz só a folha.
//   3. Base SEM árvore devolve a seleção intacta — o filtro fica
//      exatamente como era antes da D2, que é o estado da maioria das
//      empresas hoje.
//   4. Nada selecionado continua significando "Todos".
//   5. Irmãos homônimos casam os dois ramos (limitação herdada da DEC-01)
//      — documentado como over-match deliberado: mostra a mais, nunca a
//      menos.
// ============================================================
import { expandirComDescendentes } from "@/utils/categoryFilter";

// Espelha a fixture do backend (tests/fixtures/categoryTree.js).
const ARVORE = [
  { name: "Feminino",  path: "/feminino" },
  { name: "Calçados",  path: "/feminino/calcados" },
  { name: "Botas",     path: "/feminino/calcados/botas" },
  { name: "Sandálias", path: "/feminino/calcados/sandalias" },
  { name: "Acessórios",path: "/feminino/acessorios" },
  { name: "Bolsas",    path: "/feminino/acessorios/bolsas" },
  { name: "Masculino", path: "/masculino" },
  { name: "Calçados",  path: "/masculino/calcados" },  // homônimo de propósito
  { name: "Tênis",     path: "/masculino/calcados/tenis" },
];

describe("D2 — filtro hierárquico de categoria", () => {
  test("escolher o topo traz a subárvore inteira", () => {
    const r = expandirComDescendentes(["Feminino"], ARVORE);
    expect(r).toEqual(expect.arrayContaining([
      "Feminino", "Calçados", "Botas", "Sandálias", "Acessórios", "Bolsas",
    ]));
    // Não vaza para o outro ramo de nível 0.
    expect(r).not.toContain("Masculino");
    expect(r).not.toContain("Tênis");
  });

  test("escolher um nó do meio traz só o que está abaixo dele", () => {
    const r = expandirComDescendentes(["Acessórios"], ARVORE);
    expect(r.sort()).toEqual(["Acessórios", "Bolsas"]);
  });

  test("escolher a folha traz só a folha", () => {
    expect(expandirComDescendentes(["Botas"], ARVORE)).toEqual(["Botas"]);
  });

  test("seleção vazia continua significando Todos", () => {
    expect(expandirComDescendentes([], ARVORE)).toEqual([]);
  });

  test("base sem árvore devolve a seleção intacta", () => {
    // O comportamento tem que ser byte a byte o de antes da D2: a maioria
    // das empresas ainda não tem árvore nenhuma.
    expect(expandirComDescendentes(["Chinelos"], [])).toEqual(["Chinelos"]);
    expect(expandirComDescendentes(["Chinelos"], null)).toEqual(["Chinelos"]);
    expect(expandirComDescendentes(["Chinelos"], undefined)).toEqual(["Chinelos"]);
  });

  test("nome que não está na árvore é preservado", () => {
    // Produto com texto legado que o wizard ainda não migrou.
    const r = expandirComDescendentes(["Promoção Antiga"], ARVORE);
    expect(r).toEqual(["Promoção Antiga"]);
  });

  test("irmãos homônimos casam os dois ramos — over-match deliberado", () => {
    // Limitação herdada da DEC-01, aceita como transitória. O filtro
    // mostra a MAIS (Tênis entra junto), nunca a menos: produto demais o
    // lojista descarta com o olho, produto escondido ele não descobre.
    const r = expandirComDescendentes(["Calçados"], ARVORE);
    expect(r).toEqual(expect.arrayContaining(["Calçados", "Botas", "Sandálias", "Tênis"]));
  });

  test("várias seleções somam as subárvores, sem repetir", () => {
    const r = expandirComDescendentes(["Acessórios", "Masculino"], ARVORE);
    expect(r).toEqual(expect.arrayContaining(["Acessórios", "Bolsas", "Masculino", "Calçados", "Tênis"]));
    expect(new Set(r).size).toBe(r.length);
  });
});
