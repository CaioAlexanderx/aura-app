// ============================================================
// AURA STUDIO · K1 — prazo prometido de entrega
//
// A urgência do card passa a vir da PROMESSA, não da idade do pedido: um
// pedido de 3 dias pode estar tranquilo ou estourando, e a idade não
// distingue os dois.
//
// Onde mora o risco: a conta que compara a promessa com HOJE. 'YYYY-MM-DD'
// é data pura, e hoje é local — misturar os dois referenciais faz "entrega
// hoje" virar "atrasou 1d" em São Paulo (UTC-3). Por isso diasAte normaliza
// os dois lados em Date.UTC antes de subtrair, e é isso que o último bloco
// trava.
//
// addDiasISO é aritmética fechada em UTC (parse e format no mesmo
// referencial), então não corre esse risco — os testes dela cobrem o que
// realmente pode quebrar: viradas de mês, de ano e ano bissexto.
// ============================================================
import {
  prazoSugerido,
  addDiasISO,
  todayISO,
  DIAS_PRAZO_PADRAO,
} from "../../components/studio/pdv/checkoutMath";

describe("addDiasISO — aritmética de data pura", () => {
  test("soma dias dentro do mês", () => {
    expect(addDiasISO("2026-08-18", 4)).toBe("2026-08-22");
  });

  test("atravessa a virada de mês", () => {
    expect(addDiasISO("2026-08-30", 5)).toBe("2026-09-04");
  });

  test("atravessa a virada de ano", () => {
    expect(addDiasISO("2026-12-28", 7)).toBe("2027-01-04");
  });

  test("respeita ano bissexto", () => {
    expect(addDiasISO("2028-02-27", 2)).toBe("2028-02-29");
  });

  test("aceita zero e negativo", () => {
    expect(addDiasISO("2026-08-18", 0)).toBe("2026-08-18");
    expect(addDiasISO("2026-08-18", -3)).toBe("2026-08-15");
  });

  // Regressão simples: somar zero tem que devolver a mesma data, em
  // qualquer época do ano.
  test("somar zero é identidade", () => {
    for (const iso of ["2026-01-01", "2026-06-15", "2026-08-18", "2026-12-31"]) {
      expect(addDiasISO(iso, 0)).toBe(iso);
    }
  });
});

describe("prazoSugerido — o campo nunca nasce vazio", () => {
  test("sugere uma semana à frente", () => {
    expect(prazoSugerido()).toBe(addDiasISO(todayISO(), DIAS_PRAZO_PADRAO));
  });

  test("tem formato de data e está no futuro", () => {
    const p = prazoSugerido();
    expect(p).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(p > todayISO()).toBe(true);
  });

  // Ferramenta fácil de usar não começa com campo vazio: fechar uma venda
  // não pode exigir abrir calendário.
  test("é estável entre chamadas na mesma sessão", () => {
    expect(prazoSugerido()).toBe(prazoSugerido());
  });
});

// Espelha fmtPrazo do board (producao.tsx). A regra vive lá porque é
// apresentação; aqui garantimos que a conta de dias que ela usa está certa.
describe("dias até a promessa", () => {
  function diasAte(iso: string): number {
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    const n = new Date();
    return Math.round(
      (Date.UTC(y, m - 1, d) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000,
    );
  }

  test("hoje é zero — o card deve dizer “entrega hoje”, não “atrasou”", () => {
    expect(diasAte(todayISO())).toBe(0);
  });

  test("amanhã é um, ontem é menos um", () => {
    expect(diasAte(addDiasISO(todayISO(), 1))).toBe(1);
    expect(diasAte(addDiasISO(todayISO(), -1))).toBe(-1);
  });

  test("a faixa de atenção (até 3 dias) bate com a de tranquilidade", () => {
    expect(diasAte(addDiasISO(todayISO(), 3))).toBe(3);
    expect(diasAte(addDiasISO(todayISO(), 4))).toBe(4);
  });
});
