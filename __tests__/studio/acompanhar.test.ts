// ============================================================
// AURA STUDIO · K3 — página pública de acompanhamento
//
// Quem abre é o CLIENTE FINAL: sem conta, chegou por um link no WhatsApp,
// provavelmente no celular. A tela precisa se explicar numa olhada.
//
// O que dá pra travar em teste puro é a formatação que o cliente lê — e é
// onde mora o bug clássico: 'YYYY-MM-DD' passado por new Date() vira UTC e
// volta um dia em São Paulo. "Entrega 22 de agosto" viraria "21 de agosto"
// na tela do cliente, contra o que a lojista combinou.
// ============================================================

// Espelha dataPorExtenso de app/acompanhar/[token].tsx. Diferente da regra
// de privacidade da K2 (que virou módulo importável), aqui é formatação de
// apresentação e o alvo é a aritmética de data.
function dataPorExtenso(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
                 "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${d} de ${meses[m - 1]}`;
}

describe("data que o cliente lê", () => {
  test("escreve o mês por extenso", () => {
    expect(dataPorExtenso("2026-08-22")).toBe("22 de agosto");
    expect(dataPorExtenso("2026-01-05")).toBe("5 de janeiro");
    expect(dataPorExtenso("2026-12-31")).toBe("31 de dezembro");
  });

  // O bug clássico: new Date("2026-08-22") é meia-noite UTC, que em São
  // Paulo ainda é dia 21. O cliente leria uma data diferente da combinada.
  test("não volta um dia por causa de fuso", () => {
    for (const iso of ["2026-01-01", "2026-03-15", "2026-08-22", "2026-12-31"]) {
      const dia = Number(iso.slice(8, 10));
      expect(dataPorExtenso(iso)).toContain(String(dia));
    }
  });

  test("data ausente ou quebrada não imprime lixo na tela", () => {
    expect(dataPorExtenso(null)).toBe("");
    expect(dataPorExtenso(undefined)).toBe("");
    expect(dataPorExtenso("")).toBe("");
    expect(dataPorExtenso("sem-data")).toBe("");
  });

  test("aceita timestamp completo, usando só a parte da data", () => {
    expect(dataPorExtenso("2026-08-22T23:30:00Z")).toBe("22 de agosto");
  });
});

// Espelha etapaDoStatus da rota pública (backend). O contrato entre os dois
// é o índice: se o backend mudar o mapa, a barra de progresso aponta errado.
describe("os 6 status do board viram 4 marcos do cliente", () => {
  function etapaDoStatus(status: string | null): number {
    switch (status) {
      case "awaiting_customization": return 0;
      case "pending_art":            return 1;
      case "approved":
      case "in_production":          return 2;
      case "ready":
      case "delivered":              return 3;
      default:                       return 0;
    }
  }

  test("a fila avança sem pular nem retroceder", () => {
    const ordem = ["awaiting_customization", "pending_art", "approved", "in_production", "ready", "delivered"];
    const etapas = ordem.map(etapaDoStatus);
    for (let i = 1; i < etapas.length; i++) {
      expect(etapas[i]).toBeGreaterThanOrEqual(etapas[i - 1]);
    }
  });

  // "Aprovado" e "em produção" são a mesma promessa pra quem espera: está
  // sendo feito. Separá-los na tela do cliente não acrescenta informação.
  test("aprovado e em produção caem no mesmo marco", () => {
    expect(etapaDoStatus("approved")).toBe(etapaDoStatus("in_production"));
  });

  test("pronto e entregue fecham a barra", () => {
    expect(etapaDoStatus("ready")).toBe(3);
    expect(etapaDoStatus("delivered")).toBe(3);
  });

  // Venda sem fabricação (produto não-personalizável) também tem link: ela
  // mostra "recebido" e o saldo, que é o que existe pra acompanhar.
  test("venda sem produção fica no primeiro marco, sem quebrar", () => {
    expect(etapaDoStatus(null)).toBe(0);
    expect(etapaDoStatus("status_novo_qualquer")).toBe(0);
  });

  test("todo marco cabe nas 4 posições da barra", () => {
    const todos = ["awaiting_customization", "pending_art", "approved", "in_production", "ready", "delivered", null];
    for (const s of todos) {
      const i = etapaDoStatus(s);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThanOrEqual(3);
    }
  });
});
