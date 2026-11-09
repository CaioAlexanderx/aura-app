// ============================================================
// Categorias e subcategorias do Financeiro (09/11/2026) — regras puras
// (utils/categoriasFinanceiro.ts). Mockup: mockup-categorias-financeiro.html.
// ============================================================
import {
  normalizarCategoria, listaFixa, categoriasDaEscolha, selecaoInicial, camposDaCategoria,
  linhaDeBaixo, destinosDaJuncao, agruparPorCategoria, casaComFiltro, textoDosLancamentos,
} from "@/utils/categoriasFinanceiro";
import type { ListaDeCategorias } from "@/services/financeCategoriesApi";

function sub(id: string, parent: string, name: string, extra?: any): any {
  return { id, kind: "expense", parent_id: parent, name, color: null, is_system: false, manual: true, sort_order: 10, archived_at: null, count: 0, ...extra };
}
function cat(id: string, kind: "income" | "expense", name: string, extra?: any): any {
  return { id, kind, parent_id: null, name, color: "#7c3aed", dre_line: null, dre_label: null, is_system: false, manual: true, sort_order: 10, archived_at: null, count: 0, count_direct: 0, subcategories: [], ...extra };
}

const LISTA: ListaDeCategorias = {
  ano: 2026, lojas: 1, pode_todas_as_lojas: false,
  dre_lines: { income: [], expense: [] },
  categories: [
    cat("forn", "expense", "Fornecedores", { is_system: true, dre_label: "Compras de mercadoria", count: 42 }),
    cat("fixas", "expense", "Fixas", { subcategories: [sub("alug", "fixas", "Aluguel"), sub("ener", "fixas", "Energia"), sub("velha", "fixas", "Antiga", { archived_at: "2026-11-01" })] }),
    cat("taxa", "expense", "Taxas de cartão", { is_system: true, manual: false }),
    cat("troca", "expense", "Trocas e devoluções", { is_system: true, manual: false }),
    cat("arq", "expense", "Arquivada", { archived_at: "2026-11-01" }),
    cat("vendas", "income", "Vendas", { is_system: true }),
    cat("serv", "income", "Serviços"),
  ],
};

describe("normalizarCategoria", () => {
  it("sem acento, caixa ou espaço sobrando", () => {
    expect(normalizarCategoria(" Serviços ")).toBe("servicos");
    expect(normalizarCategoria("Internet   e Telefone")).toBe("internet e telefone");
  });
});

describe("escolha no lançamento (seção C)", () => {
  it("sem backend (null) cai na lista fixa de antes", () => {
    expect(categoriasDaEscolha(null, "expense").map((c) => c.name)).toEqual(listaFixa("expense").map((c) => c.name));
    expect(listaFixa("income").every((c) => c.id === null)).toBe(true);
  });

  it("mostra as manuais ativas do tipo; esconde troca, taxa, arquivada e subcategoria arquivada", () => {
    const opcoes = categoriasDaEscolha(LISTA, "expense");
    expect(opcoes.map((c) => c.name)).toEqual(["Fornecedores", "Fixas"]);
    expect(opcoes[1].subcategories.map((s) => s.name)).toEqual(["Aluguel", "Energia"]);
  });

  it("a do lançamento em edição aparece mesmo se for só do sistema", () => {
    expect(categoriasDaEscolha(LISTA, "expense", "taxa").map((c) => c.name)).toContain("Taxas de cartão");
  });

  it("seleção inicial por category_id (mãe ou sub) e, sem ele, pelo texto sem acento", () => {
    const opcoes = categoriasDaEscolha(LISTA, "income");
    expect(selecaoInicial(opcoes, { category: "Servicos" }).categoria?.id).toBe("serv");
    const desp = categoriasDaEscolha(LISTA, "expense");
    expect(selecaoInicial(desp, { category: "Fixas", category_id: "alug" })).toMatchObject({ subId: "alug" });
    expect(selecaoInicial(desp, { category: "Fixas", category_id: "fixas" })).toMatchObject({ subId: null });
    expect(selecaoInicial(desp, { category: "Qualquer" }).categoria).toBeNull();
  });

  it("o corpo leva o nome da MÃE no texto e a sub no id", () => {
    const fixas = categoriasDaEscolha(LISTA, "expense")[1];
    expect(camposDaCategoria(fixas, "alug", "Outros")).toEqual({ category: "Fixas", category_id: "alug" });
    expect(camposDaCategoria(fixas, null, "Outros")).toEqual({ category: "Fixas", category_id: "fixas" });
    expect(camposDaCategoria(listaFixa("expense")[0], null, "Outros")).toEqual({ category: "Fornecedores" });
    expect(camposDaCategoria(null, null, "Outros")).toEqual({ category: "Outros" });
  });
});

describe("gestão (seção A)", () => {
  it("linha de baixo: contagem do ano, Fornecedores com a linha do resultado, sistema com texto próprio", () => {
    expect(linhaDeBaixo(LISTA.categories[0], 2026)).toBe("42 lançamentos em 2026 · entra como “Compras de mercadoria” no resultado");
    expect(linhaDeBaixo(LISTA.categories[2], 2026)).toBe("Lançada sozinha pela taxa da maquininha (Configurações › Caixa)");
    expect(linhaDeBaixo(LISTA.categories[5], 2026)).toBe("Vem do Caixa e da loja online");
    expect(textoDosLancamentos(1, 2026)).toBe("1 lançamento em 2026");
    expect(textoDosLancamentos(0)).toBe("Nenhum lançamento");
  });

  it("juntar: principal só com principal (sem troca); sub também com subs", () => {
    expect(destinosDaJuncao(LISTA, { id: "fixas", kind: "expense", parent_id: null }).map((d) => d.label))
      .toEqual(["Fornecedores", "Taxas de cartão"]);
    expect(destinosDaJuncao(LISTA, { id: "alug", kind: "expense", parent_id: "fixas" }).map((d) => d.label))
      .toEqual(["Fornecedores", "Fixas", "Fixas › Energia", "Taxas de cartão"]);
  });
});

describe("relatório (seção D)", () => {
  const txs: any[] = [
    { type: "expense", status: "confirmed", amount: 1850, category: "Fixas", category_name: "Fixas", subcategory: "Aluguel" },
    { type: "expense", status: "confirmed", amount: 540, category: "Fixas", category_name: "Fixas", subcategory: "Energia" },
    { type: "expense", status: "confirmed", amount: 240, category: "fixas" },
    { type: "expense", status: "pending", amount: 999, category: "Fixas", subcategory: "Aluguel" },
    { type: "expense", status: "confirmed", amount: 1980, category: "Fornecedores" },
    { type: "income", status: "confirmed", amount: 50, category: "Servicos" },
    { type: "income", status: "confirmed", amount: 30, category: "Servicos", category_name: "Serviços" },
  ];

  it("abre cada categoria nas subcategorias; texto antigo sem acento soma junto", () => {
    const linhas = agruparPorCategoria(txs, "expense");
    expect(linhas.map((l) => [l.label, l.value])).toEqual([["Fixas", 2630], ["Fornecedores", 1980]]);
    expect(linhas[0].subs.map((s) => [s.label, s.value])).toEqual([["Aluguel", 1850], ["Energia", 540]]);
    expect(linhas[0].semSub).toBe(240);
    expect(Math.round(linhas[0].pct)).toBe(57);
    const rec = agruparPorCategoria(txs, "income");
    expect(rec).toHaveLength(1);
    expect(rec[0]).toMatchObject({ label: "Serviços", value: 80 });
  });

  it("filtro da lista por categoria e subcategoria", () => {
    expect(casaComFiltro(txs[0], "Fixas", "Aluguel")).toBe(true);
    expect(casaComFiltro(txs[1], "Fixas", "Aluguel")).toBe(false);
    expect(casaComFiltro(txs[2], "Fixas", "")).toBe(true);
    expect(casaComFiltro(txs[0], "Fixas", "")).toBe(false);
    expect(casaComFiltro(txs[5], "Serviços")).toBe(true);
    expect(casaComFiltro(txs[4], null)).toBe(true);
  });
});
