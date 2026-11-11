// ============================================================
// p-108 (entrega B): a lógica de contar, sem tela.
//   1. Linhas: somar/definir, nunca negativo, item vai para o topo.
//   2. Achar o produto: código de barras, código da variante, SKU (como o
//      Caixa), pai com variantes pede a variante, serviço fica de fora.
//   3. Fila: manda "definir" com o total; bipes do mesmo item viram um
//      envio; queda de rede guarda e reenvia; 409 tira a linha; remover
//      sem id não chama o servidor; remover depois do envio usa o id.
//   4. Guardado no aparelho: pendentes e "sem cadastro".
// ============================================================
import { ApiError } from "@/services/api";
import {
  aplicarPendentes,
  anotarSemCadastro,
  buscarPorNome,
  chaveDoItem,
  contarNaLinha,
  criarFilaDeContagem,
  guardarPendentes,
  guardarSemCadastro,
  lerPendentesGuardados,
  lerQuantidadeDigitada,
  lerSemCadastro,
  linhasDoServidor,
  mostrarQuantidade,
  pareceCodigo,
  resolverCodigo,
  textoDoEscopo,
  type ProdutoContavel,
  type ResultadoDaFila,
} from "@/utils/conferenciaContagem";

const ALVO = { product_id: "p1", nome: "Cinto" };

describe("linhas", () => {
  it("bipe soma 1 e o item vai para o topo", () => {
    let r = contarNaLinha([], ALVO, "somar", 1);
    r = contarNaLinha(r.linhas, { product_id: "p2", nome: "Lenço" }, "somar", 1);
    r = contarNaLinha(r.linhas, ALVO, "somar", 1);
    expect(r.linhas.map((l) => [l.product_id, l.contado])).toEqual([["p1", 2], ["p2", 1]]);
    expect(r.linha.estado).toBe("pendente");
  });

  it("definir troca o número; nunca abaixo de zero", () => {
    let r = contarNaLinha([], ALVO, "somar", 1);
    r = contarNaLinha(r.linhas, ALVO, "definir", 12.5);
    expect(r.linha.contado).toBe(12.5);
    r = contarNaLinha(r.linhas, ALVO, "somar", -20);
    expect(r.linha.contado).toBe(0);
  });

  it("variante é outra linha", () => {
    let r = contarNaLinha([], { product_id: "p1", variant_id: "v1", nome: "Camiseta", variante: "Preta · M" }, "somar", 1);
    r = contarNaLinha(r.linhas, { product_id: "p1", variant_id: "v2", nome: "Camiseta", variante: "Preta · G" }, "somar", 1);
    expect(r.linhas).toHaveLength(2);
    expect(chaveDoItem("p1", "v1")).not.toBe(chaveDoItem("p1", null));
  });

  it("itens do servidor: o último contado primeiro, contado em número", () => {
    const ls = linhasDoServidor([
      { id: "i1", product_id: "p1", variant_id: null, nome: "A", contado: "2", contado_em: "2026-11-11T10:00:00Z" },
      { id: "i2", product_id: "p2", variant_id: "v", nome: "B", contado: 3, contado_em: "2026-11-11T11:00:00Z" },
    ]);
    expect(ls.map((l) => [l.item_id, l.contado, l.estado])).toEqual([["i2", 3, "salvo"], ["i1", 2, "salvo"]]);
  });

  it("quantidade digitada", () => {
    expect(lerQuantidadeDigitada("12")).toBe(12);
    expect(lerQuantidadeDigitada("12,5")).toBe(12.5);
    expect(lerQuantidadeDigitada(" 0 ")).toBe(0);
    expect(lerQuantidadeDigitada("")).toBeNull();
    expect(lerQuantidadeDigitada("-1")).toBeNull();
    expect(lerQuantidadeDigitada("doze")).toBeNull();
    expect(mostrarQuantidade(12.5)).toBe("12,5");
    expect(mostrarQuantidade(3)).toBe("3");
  });
});

describe("achar o produto", () => {
  const PRODUTOS: ProdutoContavel[] = [
    { id: "p1", name: "Cinto de couro", code: "CIN-1", barcode: "7891000100011", unit: "un" },
    { id: "p2", name: "Camiseta Básica", code: "---", barcode: "", unit: "un", has_variants: true, variant_barcodes: ["7891000200018"] },
    { id: "p3", name: "Vestido midi", code: "VES-9", barcode: "7891000300015", unit: "un", has_variants: true },
    { id: "p4", name: "Ajuste de barra", code: "SRV-1", barcode: "7891000400012", unit: "srv" },
  ];

  it("código de barras do produto", () => {
    expect(resolverCodigo("7891000100011", PRODUTOS)).toEqual({ tipo: "produto", produto: PRODUTOS[0] });
  });
  it("código de uma variante", () => {
    expect(resolverCodigo("7891000200018", PRODUTOS)).toEqual({ tipo: "variante", produto: PRODUTOS[1], codigo: "7891000200018" });
  });
  it("SKU, sem diferença de maiúscula", () => {
    expect(resolverCodigo("cin-1", PRODUTOS)).toEqual({ tipo: "produto", produto: PRODUTOS[0] });
  });
  it("código do pai com variantes pede a variante", () => {
    expect(resolverCodigo("7891000300015", PRODUTOS).tipo).toBe("escolher_variante");
    expect(resolverCodigo("VES-9", PRODUTOS).tipo).toBe("escolher_variante");
  });
  it("serviço não se conta; código desconhecido é nenhum", () => {
    expect(resolverCodigo("7891000400012", PRODUTOS).tipo).toBe("nenhum");
    expect(resolverCodigo("7899999999999", PRODUTOS).tipo).toBe("nenhum");
    expect(resolverCodigo("   ", PRODUTOS).tipo).toBe("nenhum");
  });
  it("busca pelo nome sem acento e fora de ordem; serviço fora", () => {
    expect(buscarPorNome("basica camiseta", PRODUTOS).map((p) => p.id)).toEqual(["p2"]);
    expect(buscarPorNome("ajuste", PRODUTOS)).toEqual([]);
    expect(buscarPorNome("c", PRODUTOS)).toEqual([]);
  });
  it("parece código", () => {
    expect(pareceCodigo("7891000100011")).toBe(true);
    expect(pareceCodigo("camiseta")).toBe(false);
    expect(pareceCodigo("123")).toBe(false);
  });
});

// ── Fila ──────────────────────────────────────────────────

function relogio() {
  const tarefas: Array<{ fn: () => void; ms: number }> = [];
  return {
    agendar: (fn: () => void, ms: number) => { const t = { fn, ms }; tarefas.push(t); return t; },
    cancelar: (t: any) => { const i = tarefas.indexOf(t); if (i >= 0) tarefas.splice(i, 1); },
    tarefas,
    rodar: () => { const t = tarefas.shift(); if (t) t.fn(); return t; },
  };
}
const esperar = () => new Promise((r) => setTimeout(r, 0));
async function drenar() { for (let i = 0; i < 6; i++) await esperar(); }
const def = (chave: string, quantidade: number) => ({ tipo: "definir" as const, chave, product_id: chave.split("|")[0], variant_id: null, quantidade });

describe("fila de envio", () => {
  it("manda definir com o total; bipes do mesmo item enquanto um vai viram um envio só", async () => {
    const enviados: number[] = [];
    let soltar: (v: any) => void = () => {};
    const definir = jest.fn((op: any) => {
      enviados.push(op.quantidade);
      return enviados.length === 1 ? new Promise((r) => { soltar = r; }) : Promise.resolve({ item: { id: "i1" } });
    });
    const resultados: ResultadoDaFila[] = [];
    const fila = criarFilaDeContagem({ definir, remover: jest.fn(), aoResolver: (r) => resultados.push(r) });
    fila.colocar(def("p1|", 1));
    fila.colocar(def("p1|", 2));
    fila.colocar(def("p1|", 3));
    expect(fila.estado().pendentes).toBe(2);
    soltar({ item: { id: "i1" } });
    await drenar();
    expect(enviados).toEqual([1, 3]);
    expect(resultados.map((r) => r.tipo)).toEqual(["salvo", "salvo"]);
    expect((resultados[0] as any).aindaPendente).toBe(true);
    expect((resultados[1] as any).aindaPendente).toBe(false);
    expect(fila.estado()).toEqual({ pendentes: 0, enviando: false, semConexao: false, emPreparo: false });
  });

  it("queda de rede: guarda, avisa sem conexão e reenvia sozinha com o último total", async () => {
    const r = relogio();
    let falhar = true;
    const definir = jest.fn(async (op: any) => {
      if (falhar) throw new ApiError("sem rede", 0, null, true, "network");
      return { item: { id: "i-" + op.chave } };
    });
    const estados: any[] = [];
    const resultados: ResultadoDaFila[] = [];
    const fila = criarFilaDeContagem({
      definir, remover: jest.fn(), aoResolver: (x) => resultados.push(x),
      aoMudarEstado: (e) => estados.push(e), agendar: r.agendar, cancelar: r.cancelar, esperas: [100, 200],
    });
    fila.colocar(def("p1|", 1));
    await drenar();
    expect(fila.estado()).toMatchObject({ pendentes: 1, semConexao: true });
    expect(fila.pendentes()).toEqual([def("p1|", 1)]);
    fila.colocar(def("p1|", 2));
    fila.colocar(def("p2|", 1));
    expect(r.tarefas.map((t) => t.ms)).toEqual([100]);
    r.rodar();
    await drenar();
    expect(r.tarefas.map((t) => t.ms)).toEqual([200]);
    falhar = false;
    r.rodar();
    await drenar();
    expect(definir.mock.calls.map((c: any) => [c[0].chave, c[0].quantidade])).toEqual([["p1|", 1], ["p1|", 2], ["p1|", 2], ["p2|", 1]]);
    expect(resultados.map((x) => x.tipo)).toEqual(["salvo", "salvo"]);
    expect(fila.estado()).toMatchObject({ pendentes: 0, semConexao: false });
    expect(estados.some((e) => e.semConexao)).toBe(true);
  });

  it("tentar agora não espera o relógio", async () => {
    const r = relogio();
    let falhar = true;
    const definir = jest.fn(async () => { if (falhar) throw new ApiError("x", 0, null, true); return { item: { id: "i1" } }; });
    const fila = criarFilaDeContagem({ definir, remover: jest.fn(), aoResolver: () => {}, agendar: r.agendar, cancelar: r.cancelar });
    fila.colocar(def("p1|", 1));
    await drenar();
    falhar = false;
    fila.reenviarAgora();
    await drenar();
    expect(r.tarefas).toHaveLength(0);
    expect(fila.estado().pendentes).toBe(0);
  });

  it("503 MIGRATION_PENDING: fica guardado como em preparo", async () => {
    const r = relogio();
    const definir = jest.fn(async () => { throw new ApiError("x", 503, { code: "MIGRATION_PENDING" }); });
    const fila = criarFilaDeContagem({ definir, remover: jest.fn(), aoResolver: () => {}, agendar: r.agendar, cancelar: r.cancelar });
    fila.colocar(def("p1|", 1));
    await drenar();
    expect(fila.estado()).toMatchObject({ pendentes: 1, emPreparo: true, semConexao: false });
  });

  it("409 (produto do grupo de outra loja): recusado com o texto, sem reenviar", async () => {
    const r = relogio();
    const definir = jest.fn(async () => { throw new ApiError("x", 409, { error: "O estoque deste produto fica na Loja Centro." }); });
    const resultados: ResultadoDaFila[] = [];
    const fila = criarFilaDeContagem({ definir, remover: jest.fn(), aoResolver: (x) => resultados.push(x), agendar: r.agendar, cancelar: r.cancelar });
    fila.colocar(def("p1|", 1));
    await drenar();
    expect(resultados).toEqual([{ tipo: "recusado", chave: "p1|", mensagem: "O estoque deste produto fica na Loja Centro." }]);
    expect(r.tarefas).toHaveLength(0);
    expect(fila.estado().pendentes).toBe(0);
  });

  it("remover sem id não chama o servidor; com id (do servidor ou do envio) chama", async () => {
    const remover = jest.fn(async () => ({ ok: true }));
    const definir = jest.fn(async () => ({ item: { id: "novo" } }));
    const resultados: ResultadoDaFila[] = [];
    const fila = criarFilaDeContagem({ definir, remover, aoResolver: (x) => resultados.push(x), itemIds: { "p9|": "antigo" } });
    fila.colocar({ tipo: "remover", chave: "p5|", product_id: "p5", variant_id: null });
    await drenar();
    expect(remover).not.toHaveBeenCalled();
    fila.colocar({ tipo: "remover", chave: "p9|", product_id: "p9", variant_id: null });
    await drenar();
    expect(remover).toHaveBeenCalledWith("antigo");
    fila.colocar(def("p1|", 1));
    fila.colocar({ tipo: "remover", chave: "p1|", product_id: "p1", variant_id: null });
    await drenar();
    expect(remover).toHaveBeenLastCalledWith("novo");
    expect(resultados.map((x) => x.tipo)).toEqual(["removido", "removido", "salvo", "removido"]);
  });

  it("remover de item que o servidor já não tem (404) conta como removido", async () => {
    const remover = jest.fn(async () => { throw new ApiError("x", 404, { error: "Item não encontrado" }); });
    const resultados: ResultadoDaFila[] = [];
    const fila = criarFilaDeContagem({ definir: jest.fn(), remover, aoResolver: (x) => resultados.push(x), itemIds: { "p1|": "i1" } });
    fila.colocar({ tipo: "remover", chave: "p1|", product_id: "p1", variant_id: null });
    await drenar();
    expect(resultados).toEqual([{ tipo: "removido", chave: "p1|" }]);
  });
});

describe("guardado no aparelho", () => {
  beforeEach(() => { localStorage.clear(); });

  it("pendentes voltam com o nome da linha e se juntam ao servidor", () => {
    const linhas = contarNaLinha([], { product_id: "p2", nome: "Lenço", variante: "Azul" }, "somar", 4).linhas;
    guardarPendentes("k1", [def("p1|", 7), { tipo: "definir", chave: "p2|", product_id: "p2", variant_id: null, quantidade: 4 }, { tipo: "remover", chave: "p3|", product_id: "p3", variant_id: null }], linhas);
    const g = lerPendentesGuardados("k1");
    expect(g.pendentes).toHaveLength(3);
    const servidor = linhasDoServidor([
      { id: "i1", product_id: "p1", variant_id: null, nome: "Cinto", contado: 2 },
      { id: "i3", product_id: "p3", variant_id: null, nome: "Boné", contado: 1 },
    ]);
    const juntas = aplicarPendentes(servidor, g.pendentes, g.nomes);
    expect(juntas.map((l) => [l.product_id, l.contado, l.estado, l.nome])).toEqual([
      ["p2", 4, "pendente", "Lenço"],
      ["p1", 7, "pendente", "Cinto"],
    ]);
  });

  it("sem pendentes nem sem cadastro, a chave some", () => {
    guardarPendentes("k1", [def("p1|", 1)], []);
    guardarPendentes("k1", [], []);
    expect(localStorage.getItem("aura_conferencia_k1")).toBeNull();
  });

  it("sem cadastro: conta as vezes, o último primeiro, e fica por conferência", () => {
    const agora = new Date("2026-11-11T12:00:00Z");
    let lista = anotarSemCadastro([], "7890000000001", agora);
    lista = anotarSemCadastro(lista, "7890000000002", agora);
    lista = anotarSemCadastro(lista, "7890000000001", agora);
    expect(lista.map((c) => [c.codigo, c.vezes])).toEqual([["7890000000001", 2], ["7890000000002", 1]]);
    guardarSemCadastro("k1", lista);
    expect(lerSemCadastro("k1")).toEqual(lista);
    expect(lerSemCadastro("k2")).toEqual([]);
  });

  it("storage quebrado não derruba nada", () => {
    guardarSemCadastro("k1", anotarSemCadastro([], "7890000000001"));
    const ls: any = Storage.prototype;
    const original = ls.getItem;
    const originalSet = ls.setItem;
    ls.getItem = () => { throw new Error("bloqueado"); };
    ls.setItem = () => { throw new Error("cheio"); };
    try {
      expect(lerSemCadastro("k1")).toEqual([]);
      expect(lerPendentesGuardados("k1").pendentes).toEqual([]);
      expect(() => guardarPendentes("k1", [def("p1|", 1)], [])).not.toThrow();
    } finally {
      ls.getItem = original;
      ls.setItem = originalSet;
    }
    expect(lerSemCadastro("k1")).toHaveLength(1);
  });
});

describe("textos", () => {
  it("escopo", () => {
    const cats = [{ id: "c1", name: "Camisetas" }, { id: "c2", name: "Vestidos" }, { id: "c3", name: "Calçados" }];
    expect(textoDoEscopo({ tipo: "loja_toda" })).toBe("A loja toda");
    expect(textoDoEscopo({ tipo: "com_estoque" })).toBe("O que tem estoque");
    expect(textoDoEscopo({ tipo: "categoria", category_ids: ["c1"] }, cats)).toBe("Camisetas");
    expect(textoDoEscopo({ tipo: "categoria", category_ids: ["c1", "c2"] }, cats)).toBe("Camisetas e Vestidos");
    expect(textoDoEscopo({ tipo: "categoria", category_ids: ["c1", "c2", "c3"] }, cats)).toBe("Camisetas e mais 2");
    expect(textoDoEscopo({ tipo: "categoria", category_ids: ["x"] }, cats)).toBe("Uma categoria");
  });
});
