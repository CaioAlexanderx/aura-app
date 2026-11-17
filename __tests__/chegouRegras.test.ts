// ============================================================
// "Chegou mercadoria" (estimativa p-171, Fase 3): regras sem tela.
//   - a chave contra entrar em dobro tem o formato que o backend aceita
//     (Aura-backend#1056) e muda a cada abertura;
//   - o passo 1 lista os "Mais usados" pela última entrega (B3) e busca
//     por nome, CNPJ ou vendedor;
//   - nota de outro CNPJ: pergunta sempre e nunca troca sozinho
//     (pendência 2); sem escolha nenhuma, ACHA pelo CNPJ (pendência 1).
// ============================================================
import {
  novaChaveDaEntrada, CHAVE_VALIDA, fornecedoresDoPasso1, conferirEmitente,
  fornecedorPeloCnpj, iniciais, diaMes, cnpjComMascara, entradaAnteriorDaNota, consultaDaNota,
  type FornecedorDaLista,
} from "@/components/screens/estoque/chegou/chegouRegras";

function forn(id: string, name: string, extra: Partial<FornecedorDaLista> = {}): FornecedorDaLista {
  return {
    id, name, company_id: "c1", cnpj: null, contact_name: null, phone: null, email: null, notes: null,
    is_active: true, product_count: 0, ...extra,
  };
}

const ALFA = forn("f-alfa", "Distribuidora Alfa", { cnpj: "12345678000190", contact_name: "Marcos", last_delivery_at: "2026-11-12T13:00:00Z", product_count: 38 });
const BRAS = forn("f-bras", "Distribuidora Brás", { cnpj: "23456789000101", last_delivery_at: "2026-11-02T13:00:00Z" });
const BETA = forn("f-beta", "Beta Cosméticos", { cnpj: "34567890000112", contact_name: "Renata", last_delivery_at: "2026-10-21T13:00:00Z" });
const ZETA = forn("f-zeta", "Zeta Embalagens");
const ANTIGO = forn("f-antigo", "Atacado Antigo", { is_active: false, last_delivery_at: "2026-11-15T10:00:00Z" });
const LISTA = [ZETA, BETA, ANTIGO, BRAS, ALFA];

describe("chave da entrada", () => {
  test("formato aceito pelo backend e diferente a cada abertura", () => {
    const a = novaChaveDaEntrada();
    const b = novaChaveDaEntrada();
    expect(a).toMatch(CHAVE_VALIDA);
    expect(b).toMatch(CHAVE_VALIDA);
    expect(a).not.toBe(b);
  });

  test("sem crypto.randomUUID, a chave de reserva também serve", () => {
    const original = (globalThis as any).crypto;
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    try {
      const k = novaChaveDaEntrada();
      expect(k).toMatch(CHAVE_VALIDA);
      expect(k.startsWith("chegou-")).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: original, configurable: true });
    }
  });
});

describe("passo 1: lista de fornecedores", () => {
  test("sem busca: mais recentes primeiro, depois os outros pelo nome; inativo fica de fora", () => {
    const r = fornecedoresDoPasso1(LISTA, "");
    expect(r.maisUsados).toBe(true);
    expect(r.itens.map((f) => f.id)).toEqual(["f-alfa", "f-bras", "f-beta", "f-zeta"]);
  });

  test("ninguém com entrega: sem o título 'Mais usados'", () => {
    const r = fornecedoresDoPasso1([ZETA, forn("f-a", "Atacadão")], "");
    expect(r.maisUsados).toBe(false);
    expect(r.itens.map((f) => f.name)).toEqual(["Atacadão", "Zeta Embalagens"]);
  });

  test("busca por nome sem acento, por vendedor e por CNPJ com ou sem máscara", () => {
    expect(fornecedoresDoPasso1(LISTA, "bras").itens.map((f) => f.id)).toEqual(["f-bras"]);
    expect(fornecedoresDoPasso1(LISTA, "renata").itens.map((f) => f.id)).toEqual(["f-beta"]);
    expect(fornecedoresDoPasso1(LISTA, "12.345.678").itens.map((f) => f.id)).toEqual(["f-alfa"]);
    expect(fornecedoresDoPasso1(LISTA, "34567890000112").itens.map((f) => f.id)).toEqual(["f-beta"]);
    expect(fornecedoresDoPasso1(LISTA, "xyz").itens).toEqual([]);
  });

  test("lista vazia ou ainda carregando", () => {
    expect(fornecedoresDoPasso1(undefined, "").itens).toEqual([]);
  });
});

describe("nota de outro CNPJ (pendência 2)", () => {
  const notaDaBeta = { nome: "Beta Cosméticos", cnpj: "34.567.890/0001-12" };
  const notaDesconhecida = { nome: "Gama Distribuição", cnpj: "45678901000123" };

  test("sem escolha: acha pelo CNPJ (atalho do passo 1)", () => {
    expect(conferirEmitente(notaDaBeta, null, LISTA)).toEqual({ tipo: "achou", fornecedor: BETA });
  });

  test("sem escolha e CNPJ que ninguém tem: pergunta (Cadastrar)", () => {
    expect(conferirEmitente(notaDesconhecida, null, LISTA)).toEqual({ tipo: "perguntar", atual: null, achado: null });
  });

  test("mesmo CNPJ do escolhido: segue", () => {
    expect(conferirEmitente(notaDaBeta, { tipo: "existente", fornecedor: BETA }, LISTA)).toEqual({ tipo: "ok" });
  });

  test("outro CNPJ: pergunta, nunca troca sozinho", () => {
    const r = conferirEmitente(notaDaBeta, { tipo: "existente", fornecedor: ALFA }, LISTA);
    expect(r).toEqual({ tipo: "perguntar", atual: { tipo: "existente", fornecedor: ALFA }, achado: BETA });
    const r2 = conferirEmitente(notaDesconhecida, { tipo: "existente", fornecedor: ALFA }, LISTA);
    expect(r2).toEqual({ tipo: "perguntar", atual: { tipo: "existente", fornecedor: ALFA }, achado: null });
  });

  test("seguiu sem fornecedor: pergunta se liga à nota", () => {
    expect(conferirEmitente(notaDaBeta, { tipo: "sem" }, LISTA)).toEqual({ tipo: "perguntar", atual: { tipo: "sem" }, achado: BETA });
  });

  test("escolhido sem CNPJ: só pergunta se OUTRO fornecedor tem o CNPJ da nota", () => {
    expect(conferirEmitente(notaDaBeta, { tipo: "existente", fornecedor: ZETA }, LISTA).tipo).toBe("perguntar");
    expect(conferirEmitente(notaDesconhecida, { tipo: "existente", fornecedor: ZETA }, LISTA)).toEqual({ tipo: "ok" });
  });

  test("nota sem CNPJ do emitente e fornecedor escolhido: segue", () => {
    expect(conferirEmitente({ nome: "X", cnpj: null }, { tipo: "existente", fornecedor: ALFA }, LISTA)).toEqual({ tipo: "ok" });
  });

  test("fornecedor inativo não é achado pelo CNPJ", () => {
    expect(fornecedorPeloCnpj([{ ...BETA, is_active: false }], BETA.cnpj)).toBeNull();
  });
});

describe("pedaços de texto", () => {
  test("iniciais, dia/mês e CNPJ com máscara", () => {
    expect(iniciais("Distribuidora Alfa")).toBe("DA");
    expect(iniciais("Beta")).toBe("BE");
    expect(iniciais("Casa de Tintas")).toBe("CT");
    expect(diaMes("2026-11-14T10:00:00-03:00")).toBe("14/11");
    expect(diaMes(null)).toBeNull();
    expect(cnpjComMascara("12345678000190")).toBe("12.345.678/0001-90");
  });
});

describe("nota já lançada (A3)", () => {
  test("a mais recente entre as entradas novas e as antigas", () => {
    const r = entradaAnteriorDaNota({
      receipts: [{ created_at: "2026-11-10T12:00:00Z", supplier_name: "Alfa", lines: 18 }],
      legacy: [{ created_at: "2026-11-14T12:00:00Z", supplier_name: null, products: 3 }],
    });
    expect(r).toEqual({ quando: "2026-11-14T12:00:00Z", fornecedor: null, itens: 3 });
  });

  test("nada encontrado ou sem resposta: null", () => {
    expect(entradaAnteriorDaNota({ receipts: [], legacy: [] })).toBeNull();
    expect(entradaAnteriorDaNota(undefined)).toBeNull();
  });

  test("consulta: chave de 44, número e fornecedor quando há", () => {
    const chave = "3".repeat(44);
    expect(consultaDaNota({ numero: "004512", chave }, { tipo: "existente", fornecedor: ALFA }))
      .toEqual({ nfe_key: chave, invoice_number: "004512", supplier_id: "f-alfa" });
    expect(consultaDaNota({ numero: "77", chave: null }, { tipo: "sem" }))
      .toEqual({ nfe_key: null, invoice_number: "77", supplier_id: null });
    expect(consultaDaNota({ numero: "", chave: null }, { tipo: "sem" })).toBeNull();
    expect(consultaDaNota(null, { tipo: "sem" })).toBeNull();
  });
});
