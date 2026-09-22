// ============================================================
// Matcon M4 — lote / tonalidade: o gate, o rateio e as frases
// (docs/CONTRACT_MATCON.md secao M4 + mockup matcon-m4-profundidade.html).
//
// O caso do mockup e a dona Marlene: 100 m² de porcelanato, dois lotes na
// pilha (27B com 95,12 m² e 28A com 53,36 m²). A venda NUNCA e bloqueada —
// o que muda e a frase que o vendedor le antes de prometer o ambiente.
// ============================================================

import {
  usaLote,
  alocarLotes,
  fraseDoAviso,
  fraseDoLote,
  resumoDeLotes,
  type LoteSaldo,
} from "@/utils/matconLots";

const L27B: LoteSaldo = { id: "l-27b", lot_code: "27B", qty: 95.12 };
const L28A: LoteSaldo = { id: "l-28a", lot_code: "28A", qty: 53.36 };
const LOTES = [L27B, L28A];

const ON = { matcon_enabled: true, matcon_lots_enabled: true };

describe("usaLote — gate do M4", () => {
  it("so com os dois toggles ligados E unidade de area/volume", () => {
    expect(usaLote(ON, "m²")).toBe(true);
    expect(usaLote(ON, "m³")).toBe(true);
    expect(usaLote(ON, "m2")).toBe(true);
  });

  it("cimento em sc, metro linear e produto sem unidade nunca entram", () => {
    expect(usaLote(ON, "sc")).toBe(false);
    expect(usaLote(ON, "m")).toBe(false);
    expect(usaLote(ON, null)).toBe(false);
  });

  it("toggle do lote off, Matcon off ou settings ausente: nada de lote", () => {
    expect(usaLote({ matcon_enabled: true, matcon_lots_enabled: false }, "m²")).toBe(false);
    expect(usaLote({ matcon_enabled: false, matcon_lots_enabled: true }, "m²")).toBe(false);
    expect(usaLote(null, "m²")).toBe(false);
  });
});

describe("alocarLotes — de qual pilha sai o material", () => {
  it("100 m² em 2 lotes: 95,12 do 27B + 4,88 do 28A", () => {
    const r = alocarLotes(100, LOTES);
    expect(r.estado).toBe("dois_lotes");
    expect(r.allocations).toEqual([
      { lot_id: "l-27b", lot_code: "27B", quantity: 95.12 },
      { lot_id: "l-28a", lot_code: "28A", quantity: 4.88 },
    ]);
  });

  it("50 m² cabem no lote mais antigo (FIFO), sozinho", () => {
    const r = alocarLotes(50, LOTES);
    expect(r.estado).toBe("cabe");
    expect(r.allocations).toEqual([{ lot_id: "l-27b", lot_code: "27B", quantity: 50 }]);
  });

  it("200 m²: nem somando os dois lotes da", () => {
    const r = alocarLotes(200, LOTES);
    expect(r.estado).toBe("nao_cabe");
    expect(r.allocations.map(a => a.quantity)).toEqual([95.12, 53.36]);
  });

  it("precisando de 3 lotes tambem e nao_cabe", () => {
    const tres = [L27B, { id: "l-28a", lot_code: "28A", qty: 30 }, { id: "l-29c", lot_code: "29C", qty: 30 }];
    const r = alocarLotes(140, tres);
    expect(r.estado).toBe("nao_cabe");
    expect(r.allocations).toHaveLength(3);
  });

  it("lote preferido vem primeiro: 50 m² saem do 28A quando o vendedor troca", () => {
    const r = alocarLotes(50, LOTES, "l-28a");
    expect(r.estado).toBe("cabe");
    expect(r.allocations).toEqual([{ lot_id: "l-28a", lot_code: "28A", quantity: 50 }]);
  });

  it("preferido que nao cobre sozinho continua na frente, depois FIFO", () => {
    const r = alocarLotes(60, LOTES, "l-28a");
    expect(r.estado).toBe("dois_lotes");
    expect(r.allocations).toEqual([
      { lot_id: "l-28a", lot_code: "28A", quantity: 53.36 },
      { lot_id: "l-27b", lot_code: "27B", quantity: 6.64 },
    ]);
  });

  it("sem lote cadastrado (ou qty zerada) nao inventa alocacao nem aviso", () => {
    expect(alocarLotes(100, [])).toEqual({ allocations: [], estado: "cabe" });
    expect(alocarLotes(0, LOTES)).toEqual({ allocations: [], estado: "cabe" });
    expect(alocarLotes(100, [{ id: "z", lot_code: "Z", qty: 0 }]).allocations).toEqual([]);
  });
});

describe("as frases que o vendedor le", () => {
  it("cabe: nenhum aviso — so a linha violeta do lote", () => {
    const r = alocarLotes(50, LOTES);
    expect(fraseDoAviso(r.estado, r.allocations, LOTES, "m²")).toBeNull();
    expect(fraseDoLote(L27B, "m²")).toBe("lote 27B · 95,12 m² disponíveis");
  });

  it("dois lotes: a frase do mockup, com as duas parcelas", () => {
    const r = alocarLotes(100, LOTES);
    expect(fraseDoAviso(r.estado, r.allocations, LOTES, "m²")).toBe(
      "Precisa de 2 lotes: 27B (95,12 m²) + 28A (4,88 m²). " +
      "Lotes diferentes podem ter tom diferente — avise o cliente ou escolha outro lote."
    );
  });

  it("nenhum lote sozinho da conta: aponta o maior e o caminho", () => {
    const tres = [L27B, { id: "l-28a", lot_code: "28A", qty: 30 }, { id: "l-29c", lot_code: "29C", qty: 30 }];
    const r = alocarLotes(140, tres);
    expect(fraseDoAviso(r.estado, r.allocations, tres, "m²")).toBe(
      "Nenhum lote sozinho dá conta — o maior tem 95,12 m². " +
      "Dá para separar 3 lotes ou pedir mais do 27B."
    );
  });

  it("nem somando tudo da: diz quanto a loja tem no total", () => {
    const r = alocarLotes(200, LOTES);
    expect(fraseDoAviso(r.estado, r.allocations, LOTES, "m²")).toBe(
      "Nenhum lote sozinho dá conta — o maior tem 95,12 m². " +
      "Somando todos os lotes dá 148,48 m² — dá para pedir mais do 27B."
    );
  });
});

describe("resumoDeLotes — o saldo da lista do estoque", () => {
  it("148,48 m² em 2 lotes", () => {
    expect(resumoDeLotes({ count: 2, lots: [L27B, L28A] }, "m²")).toBe("148,48 m² em 2 lotes");
  });

  it("um lote so fala no singular", () => {
    expect(resumoDeLotes({ count: 1, lots: [L27B] }, "m²")).toBe("95,12 m² em 1 lote");
  });

  it("sem lots_summary (loja sem o toggle) a ficha fica a de hoje", () => {
    expect(resumoDeLotes(null, "m²")).toBeNull();
    expect(resumoDeLotes({ count: 0, lots: [] }, "m²")).toBeNull();
  });
});
