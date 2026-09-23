// ============================================================
// Matcon M1 — textos de /acompanhar/[token] por tipo/etapa
// (docs/matcon-faseamento-po-ux.md §3 · docs/CONTRACT_MATCON.md §M1)
//
// Cobre utils/acompanharTextos.ts: "oculos" e "encomenda" (default)
// continuam EXATAMENTE iguais ao que a tela já mostrava; "entrega" ganha os
// três títulos por etapa + os rótulos/rodapé próprios + o texto de entrega
// parcial por item ("6 de 10 sc" + a frase do saldo).
// ============================================================
import {
  tituloAcompanhamento, rotuloSaldo, rotuloItens, rodapePedido, textoItemEntrega, qtdDoItemPublico,
} from "@/utils/acompanharTextos";

describe("tituloAcompanhamento", () => {
  it("oculos: em andamento continua 'Acompanhe seus óculos por aqui.'", () => {
    expect(tituloAcompanhamento({ tipo: "oculos", atual: 1, totalEtapas: 3 }))
      .toBe("Acompanhe seus óculos por aqui.");
  });

  it("oculos: última etapa continua 'Seus óculos estão prontos para retirar.'", () => {
    expect(tituloAcompanhamento({ tipo: "oculos", atual: 2, totalEtapas: 3 }))
      .toBe("Seus óculos estão prontos para retirar.");
  });

  it("encomenda (tipo ausente): em andamento continua 'Acompanhe sua encomenda por aqui.'", () => {
    expect(tituloAcompanhamento({ tipo: undefined, atual: 0, totalEtapas: 4 }))
      .toBe("Acompanhe sua encomenda por aqui.");
  });

  it("encomenda: última etapa continua 'Sua encomenda está pronta.'", () => {
    expect(tituloAcompanhamento({ tipo: undefined, atual: 3, totalEtapas: 4 }))
      .toBe("Sua encomenda está pronta.");
  });

  it("entrega: separando/pronto/aprovado caem em 'Estamos separando seu pedido'", () => {
    expect(tituloAcompanhamento({ tipo: "entrega", etapaAtualKey: "aprovado", atual: 0, totalEtapas: 5 }))
      .toBe("Estamos separando seu pedido");
    expect(tituloAcompanhamento({ tipo: "entrega", etapaAtualKey: "separando", atual: 1, totalEtapas: 5 }))
      .toBe("Estamos separando seu pedido");
    expect(tituloAcompanhamento({ tipo: "entrega", etapaAtualKey: "pronto", atual: 2, totalEtapas: 5 }))
      .toBe("Estamos separando seu pedido");
  });

  it("entrega: 'saiu' vira 'Seu pedido saiu para entrega'", () => {
    expect(tituloAcompanhamento({ tipo: "entrega", etapaAtualKey: "saiu", atual: 3, totalEtapas: 5 }))
      .toBe("Seu pedido saiu para entrega");
  });

  it("entrega: última etapa ('entregue') vira 'Seu pedido foi entregue'", () => {
    expect(tituloAcompanhamento({ tipo: "entrega", etapaAtualKey: "entregue", atual: 4, totalEtapas: 5 }))
      .toBe("Seu pedido foi entregue");
  });
});

describe("rotuloSaldo / rotuloItens / rodapePedido", () => {
  it("oculos: inalterado", () => {
    expect(rotuloSaldo("oculos")).toBe("SALDO DOS ÓCULOS");
    expect(rotuloItens("oculos")).toBe("SEUS ÓCULOS");
    expect(rodapePedido("oculos", "OS-123")).toBe("OS-123 · feito com Aura");
  });

  it("encomenda (tipo ausente): inalterado", () => {
    expect(rotuloSaldo(undefined)).toBe("SALDO DA ENCOMENDA");
    expect(rotuloItens(undefined)).toBe("SEU PEDIDO");
    expect(rodapePedido(undefined, "45")).toBe("Pedido #45 · feito com Aura Studio");
  });

  it("entrega: rótulos e rodapé próprios", () => {
    expect(rotuloSaldo("entrega")).toBe("SALDO DO PEDIDO");
    expect(rotuloItens("entrega")).toBe("SEU PEDIDO");
    expect(rodapePedido("entrega", "1204")).toBe("Pedido #1204 · feito com Aura");
  });
});

describe("textoItemEntrega", () => {
  it("item sem entregue/total: progresso e saldoFrase null (item de sempre)", () => {
    expect(textoItemEntrega({})).toEqual({ progresso: null, saldoFrase: null });
  });

  it("entrega parcial: '6 de 10 sacos' + frase do saldo restante (sem sigla — QA 23/09)", () => {
    const r = textoItemEntrega({ entregue: 6, total: 10, unidade: "sc" });
    expect(r.progresso).toBe("6 de 10 sacos");
    expect(r.saldoFrase).toBe(
      "Os 4 sacos restantes vão na próxima viagem. Você não paga nada a mais por isso."
    );
  });

  it("com proxima_entrega: a frase inclui a data", () => {
    const r = textoItemEntrega({ entregue: 6, total: 10, unidade: "sc" }, "2026-09-23");
    expect(r.saldoFrase).toBe(
      "Os 4 sacos restantes vão no dia 23/09, na próxima viagem. Você não paga nada a mais por isso."
    );
  });

  it("entrega completa (entregue === total): progresso sem saldoFrase", () => {
    const r = textoItemEntrega({ entregue: 2, total: 2, unidade: "m³" });
    expect(r.progresso).toBe("2 de 2 m³");
    expect(r.saldoFrase).toBeNull();
  });

  it("item sem unidade: progresso sem sufixo", () => {
    const r = textoItemEntrega({ entregue: 1, total: 3 });
    expect(r.progresso).toBe("1 de 3");
  });
});

describe("qtdDoItemPublico (QA 23/09/2026)", () => {
  it("com unidade: '1 milheiro', '1 m²', '2 sacos'", () => {
    expect(qtdDoItemPublico({ qtd: 1, unidade: "mlh" })).toBe("1 milheiro");
    expect(qtdDoItemPublico({ qtd: 1, unidade: "m²" })).toBe("1 m²");
    expect(qtdDoItemPublico({ qtd: 2, unidade: "sc" })).toBe("2 sacos");
  });
  it("sem unidade: o '1×' de sempre", () => {
    expect(qtdDoItemPublico({ qtd: 1 })).toBe("1×");
    expect(qtdDoItemPublico({ qtd: 3, unidade: null })).toBe("3×");
  });
});
