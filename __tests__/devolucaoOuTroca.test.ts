// Devolver ou trocar? (16/09/2026) — caso MHT / Karina Quadros:
// "removi o 42/43 pra trocar pelo 40/41 e a venda continua com o 42".
import {
  ROTA_TROCA_PDV,
  querAbrirTroca,
  rotuloDevolvido,
  mensagemCancelamento,
  avisoRetornosAtivos,
} from "@/utils/devolucaoOuTroca";

describe("rota da Troca", () => {
  it("a rota que sai do Editar lançamento é lida pelo PDV", () => {
    const valor = new URLSearchParams(ROTA_TROCA_PDV.split("?")[1]).get("troca");
    expect(ROTA_TROCA_PDV.startsWith("/pdv?")).toBe(true);
    expect(querAbrirTroca(valor)).toBe(true);
  });
  it("sem o parâmetro (ou com lixo), não abre", () => {
    expect(querAbrirTroca(undefined)).toBe(false);
    expect(querAbrirTroca("")).toBe(false);
    expect(querAbrirTroca("0")).toBe(false);
    expect(querAbrirTroca(["1"])).toBe(true);
  });
});

describe("rotuloDevolvido", () => {
  it("nada voltou: sem rótulo", () => {
    expect(rotuloDevolvido(1, 0)).toBeNull();
    expect(rotuloDevolvido(1, undefined)).toBeNull();
  });
  it("voltou tudo: Devolvido (o Vans 42/43 da Karina)", () => {
    expect(rotuloDevolvido(1, 1)).toBe("Devolvido");
  });
  it("voltou parte: diz quanto resta", () => {
    expect(rotuloDevolvido(3, 1)).toBe("1 devolvido(s) · restam 2");
    expect(rotuloDevolvido(1.5, 0.5)).toBe("0,5 devolvido(s) · restam 1");
  });
});

describe("mensagemCancelamento", () => {
  it("devolução desfeita diz o que voltou", () => {
    const msg = mensagemCancelamento({
      type: "devolucao", items_returned: 0, refunded_amount: 0,
      devolucao_undo: { credit_removed: 120, stock_removed: [{ quantity: 1 }] },
    });
    expect(msg).toBe("Devolução desfeita. 1 peça saiu de novo do estoque. R$ 120,00 voltaram a ser dívida do cliente.");
    expect(msg).not.toMatch(/0 item/);
  });
  it("devolução sem resumo (backend antigo) não inventa números", () => {
    expect(mensagemCancelamento({ type: "devolucao" })).toBe("Devolução desfeita.");
  });
  it("venda e troca mantêm o texto de antes", () => {
    expect(mensagemCancelamento({ type: "sale", items_returned: 3, refunded_amount: 290 }))
      .toBe("Venda cancelada. 3 item(s) devolvido(s) ao estoque e R$ 290,00 removido(s) da receita.");
    expect(mensagemCancelamento({ type: "troca" })).toMatch(/^Troca cancelada\./);
  });
});

describe("avisoRetornosAtivos", () => {
  it("sem devolução/troca ativa: sem aviso", () => {
    expect(avisoRetornosAtivos([])).toBeNull();
    expect(avisoRetornosAtivos(undefined)).toBeNull();
  });
  it("nomeia a devolução e manda cancelar antes", () => {
    expect(avisoRetornosAtivos([{ sale_number: 40, type: "devolucao" }]))
      .toBe("Esta venda tem devolução #40. Para cancelar a venda, cancele antes essa operação.");
  });
  it("várias operações, troca inclusa", () => {
    expect(avisoRetornosAtivos([{ sale_number: 40, type: "devolucao" }, { sale_number: null, type: "troca" }]))
      .toBe("Esta venda tem devolução #40, troca. Para cancelar a venda, cancele antes essas operações.");
  });
});
