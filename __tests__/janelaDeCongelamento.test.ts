// ============================================================
// Janela de congelamento — a conta de datas (13/10/2026).
//
// O que aqui segura:
//   1. as duas janelas do plano: 24/11/2026 a 01/12/2026 e 20/12/2026 a
//      02/01/2027, bordas INCLUSIVAS, no horário de Brasília;
//   2. a virada do dia é a de Brasília, não a da máquina nem a do UTC: às
//      23h59 de 01/12 em Brasília ainda é janela (já é 02/12 em UTC);
//   3. proximaJanela devolve a vigente, senão a próxima, senão null;
//   4. a linha para a equipe diz "até dd/mm (temporada)".
// ============================================================
import {
  avisoDeAtualizacoesPausadas,
  diaDeBrasilia,
  emCongelamento,
  JANELAS_DE_CONGELAMENTO,
  proximaJanela,
} from "@/utils/janelaDeCongelamento";

const d = (iso: string) => new Date(iso);

describe("as janelas do plano", () => {
  test("são as duas combinadas, em ordem", () => {
    expect(JANELAS_DE_CONGELAMENTO.map((j) => [j.inicio, j.fim])).toEqual([
      ["2026-11-24", "2026-12-01"],
      ["2026-12-20", "2027-01-02"],
    ]);
  });
});

describe("emCongelamento: bordas da Black Friday", () => {
  test("23/11 às 23h59 (Brasília) ainda não", () => {
    expect(emCongelamento(d("2026-11-23T23:59:59-03:00"))).toBe(false);
  });
  test("24/11 às 00h00 já é janela (borda inclusiva)", () => {
    expect(emCongelamento(d("2026-11-24T00:00:00-03:00"))).toBe(true);
  });
  test("01/12 às 23h59 ainda é janela (borda inclusiva)", () => {
    expect(emCongelamento(d("2026-12-01T23:59:59-03:00"))).toBe(true);
  });
  test("02/12 às 00h00 já saiu", () => {
    expect(emCongelamento(d("2026-12-02T00:00:00-03:00"))).toBe(false);
  });
  test("no meio da janela", () => {
    expect(emCongelamento(d("2026-11-27T10:00:00-03:00"))).toBe(true);
  });
});

describe("emCongelamento: bordas do fim de ano", () => {
  test("19/12 às 23h59 ainda não", () => {
    expect(emCongelamento(d("2026-12-19T23:59:59-03:00"))).toBe(false);
  });
  test("20/12 às 00h00 já é janela", () => {
    expect(emCongelamento(d("2026-12-20T00:00:00-03:00"))).toBe(true);
  });
  test("a virada do ano está dentro", () => {
    expect(emCongelamento(d("2026-12-31T23:59:59-03:00"))).toBe(true);
    expect(emCongelamento(d("2027-01-01T00:00:00-03:00"))).toBe(true);
  });
  test("02/01 às 23h59 ainda é janela", () => {
    expect(emCongelamento(d("2027-01-02T23:59:59-03:00"))).toBe(true);
  });
  test("03/01 às 00h00 já saiu", () => {
    expect(emCongelamento(d("2027-01-03T00:00:00-03:00"))).toBe(false);
  });
});

describe("emCongelamento: o dia é o de Brasília, em qualquer fuso", () => {
  test("instantes em UTC: a borda é 03:00Z", () => {
    expect(emCongelamento(d("2026-11-24T02:59:59Z"))).toBe(false); // 23/11 23h59 em Brasília
    expect(emCongelamento(d("2026-11-24T03:00:00Z"))).toBe(true); //  24/11 00h00 em Brasília
    expect(emCongelamento(d("2026-12-02T02:59:59Z"))).toBe(true); //  01/12 23h59 em Brasília
    expect(emCongelamento(d("2026-12-02T03:00:00Z"))).toBe(false); // 02/12 00h00 em Brasília
  });

  test("diaDeBrasilia", () => {
    expect(diaDeBrasilia(d("2026-12-02T01:00:00Z"))).toBe("2026-12-01");
    expect(diaDeBrasilia(d("2026-12-02T03:00:00Z"))).toBe("2026-12-02");
    expect(diaDeBrasilia(new Date("lixo"))).toBeNull();
  });

  test("data inválida nunca congela", () => {
    expect(emCongelamento(new Date("lixo"))).toBe(false);
  });

  test("lista própria no segundo argumento (a lista é fácil de editar)", () => {
    const lista = [{ inicio: "2030-01-01", fim: "2030-01-01" }];
    expect(emCongelamento(d("2030-01-01T12:00:00-03:00"), lista)).toBe(true);
    expect(emCongelamento(d("2030-01-02T12:00:00-03:00"), lista)).toBe(false);
  });
});

describe("proximaJanela", () => {
  test("antes de tudo: a Black Friday", () => {
    expect(proximaJanela(d("2026-10-13T12:00:00-03:00"))?.inicio).toBe("2026-11-24");
  });
  test("dentro de uma janela: ela mesma", () => {
    expect(proximaJanela(d("2026-11-25T12:00:00-03:00"))?.fim).toBe("2026-12-01");
  });
  test("entre as duas: a de fim de ano", () => {
    expect(proximaJanela(d("2026-12-10T12:00:00-03:00"))?.inicio).toBe("2026-12-20");
  });
  test("no último dia da última: ainda ela; no dia seguinte: null", () => {
    expect(proximaJanela(d("2027-01-02T20:00:00-03:00"))?.fim).toBe("2027-01-02");
    expect(proximaJanela(d("2027-01-03T00:00:00-03:00"))).toBeNull();
  });
  test("data inválida → null", () => {
    expect(proximaJanela(new Date("lixo"))).toBeNull();
  });
});

describe("avisoDeAtualizacoesPausadas: a linha da equipe", () => {
  test("dentro da janela, com o fim dela", () => {
    expect(avisoDeAtualizacoesPausadas(d("2026-11-25T12:00:00-03:00"))).toBe(
      "Atualizações pausadas até 01/12 (temporada)",
    );
    expect(avisoDeAtualizacoesPausadas(d("2026-12-25T12:00:00-03:00"))).toBe(
      "Atualizações pausadas até 02/01 (temporada)",
    );
  });
  test("fora da janela, nada", () => {
    expect(avisoDeAtualizacoesPausadas(d("2026-10-13T12:00:00-03:00"))).toBeNull();
  });
});
