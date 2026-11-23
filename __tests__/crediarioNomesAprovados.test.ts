// ============================================================
// Nomes antigos trocados pelos aprovados (QA 23/11/2026, P2)
// ============================================================
import fs from "fs";
import path from "path";
import { formaComPreposicao } from "@/utils/crediarioRecebimento";
import { derivarCarne } from "@/utils/crediarioCarne";

describe("forma do pagamento com a preposição certa", () => {
  test("no Pix, em dinheiro, no cartão", () => {
    expect(formaComPreposicao("Pix")).toBe("no Pix");
    expect(formaComPreposicao("Dinheiro")).toBe("em dinheiro");
    expect(formaComPreposicao("Cartão")).toBe("no cartão");
    expect(formaComPreposicao("Transferência")).toBe("na transferência");
  });
});

describe("textos dos painéis", () => {
  const fonte = fs.readFileSync(path.join(__dirname, "..", "components", "crediario", "ClienteCrediarioModal.tsx"), "utf8");
  const editar = fs.readFileSync(path.join(__dirname, "..", "components", "crediario", "ficha", "EditarPagamentoModal.tsx"), "utf8");
  test.each([
    ["Alterar vencimento", "Mudar a data"],
    ["Confirmar renegociação", "Mudar as parcelas"],
    ["novo cronograma", "estas novas parcelas"],
    ["Pix da Parcela", "Pix da parcela"],
  ])("'%s' → '%s'", (antigo, novo) => {
    expect(fonte).not.toContain(antigo);
    expect(fonte).toContain(novo);
  });
  test("Dia do pagamento ao corrigir", () => {
    expect(editar).toContain(">Dia do pagamento</Text>");
    expect(editar).not.toContain(">Data do pagamento</Text>");
  });
  test("a pergunta do Receber usa 'no Pix'", () => {
    expect(fonte).toContain("`Confirmar recebimento de ${fmt(freeAmtValue)} ${formaComPreposicao(methodLabel)}?`");
  });
});

describe("Lançamento manual com cedilha", () => {
  test("a descrição padrão do backend vira 'Lançamento manual'", () => {
    const c = derivarCarne({
      id: null, name: "Conta geral", balance: 20, remaining: 20, total_count: 0, paid_count: 0,
      purchases: [{ date: "2026-09-02T12:00:00Z", description: "Lancamento manual", quantity: 1, amount: 20 }],
    } as any, []);
    expect(JSON.stringify(c.compras)).toContain("Lançamento manual");
    expect(JSON.stringify(c.compras)).not.toContain("Lancamento manual");
  });
});
