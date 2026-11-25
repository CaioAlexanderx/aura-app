// ============================================================
// Datas digitadas na ficha do crediário (24/11/2026)
// Sugestão da 1ª parcela do Renegociar, conferência do ano e o aviso de
// cada painel — utils/crediarioDatas.ts.
// ============================================================
import {
  sugestaoDaPrimeiraParcela, conferenciaDoAno, avisoDaData, ehPrimeiraParcelaNoPassado,
  textoConfiraOAno, TEXTO_RENEGOCIAR_DATA_PASSADA, TEXTO_MUDAR_DATA_PASSADA,
} from "@/utils/crediarioDatas";

describe("sugestaoDaPrimeiraParcela", () => {
  test("caso real: renegociação em 23/11 com a mais antiga de 22/11 → 22/12", () => {
    expect(sugestaoDaPrimeiraParcela("2026-11-22", "2026-11-23")).toBe("2026-12-22");
  });
  test("mais antiga hoje ou à frente fica como está", () => {
    expect(sugestaoDaPrimeiraParcela("2026-11-23", "2026-11-23")).toBe("2026-11-23");
    expect(sugestaoDaPrimeiraParcela("2026-12-05", "2026-11-23")).toBe("2026-12-05");
    expect(sugestaoDaPrimeiraParcela("2026-12-05T03:00:00Z", "2026-11-23")).toBe("2026-12-05");
  });
  test("o dia ainda não passou neste mês: usa este mês (inclusive hoje)", () => {
    expect(sugestaoDaPrimeiraParcela("2026-10-25", "2026-11-23")).toBe("2026-11-25");
    expect(sugestaoDaPrimeiraParcela("2026-08-23", "2026-11-23")).toBe("2026-11-23");
  });
  test("dia 29–31 que não existe no mês vira o último dia", () => {
    expect(sugestaoDaPrimeiraParcela("2026-10-31", "2026-11-30")).toBe("2026-11-30");
    expect(sugestaoDaPrimeiraParcela("2027-01-31", "2027-02-10")).toBe("2027-02-28");
    expect(sugestaoDaPrimeiraParcela("2028-01-30", "2028-02-10")).toBe("2028-02-29");
    // dia 31 de dezembro: em janeiro cai no 31; em fevereiro encosta no 28
    expect(sugestaoDaPrimeiraParcela("2026-12-31", "2027-01-31")).toBe("2027-01-31");
    expect(sugestaoDaPrimeiraParcela("2026-12-31", "2027-02-01")).toBe("2027-02-28");
  });
  test("virada de ano", () => {
    expect(sugestaoDaPrimeiraParcela("2026-12-10", "2026-12-15")).toBe("2027-01-10");
  });
  test("sem vencimento ou ilegível: hoje", () => {
    expect(sugestaoDaPrimeiraParcela(null, "2026-11-23")).toBe("2026-11-23");
    expect(sugestaoDaPrimeiraParcela("", "2026-11-23")).toBe("2026-11-23");
    expect(sugestaoDaPrimeiraParcela("lixo", "2026-11-23")).toBe("2026-11-23");
  });
  test("nunca devolve data no passado (todo dia de 2026, mais antiga em qualquer dia)", () => {
    const base = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 366; i += 3) {
      const hoje = new Date(base + i * 86400000).toISOString().slice(0, 10);
      for (let j = 1; j <= 400; j += 13) {
        const antiga = new Date(base + (i - j) * 86400000).toISOString().slice(0, 10);
        const s = sugestaoDaPrimeiraParcela(antiga, hoje);
        expect(s >= hoje).toBe(true);
        // no máximo um mês e pouco à frente
        expect((Date.parse(s) - Date.parse(hoje)) / 86400000).toBeLessThanOrEqual(31);
      }
    }
  });
});

describe("conferenciaDoAno", () => {
  test("caso real: 09/01/2026 digitado em 24/11/2026 → 09/01/2027", () => {
    expect(conferenciaDoAno("2026-01-09", "2026-11-24")).toBe("2027-01-09");
  });
  test("até 60 dias no passado não pergunta", () => {
    expect(conferenciaDoAno("2026-09-25", "2026-11-24")).toBeNull(); // 60 dias
    expect(conferenciaDoAno("2026-09-24", "2026-11-24")).toBe("2027-09-24"); // 61 dias
    expect(conferenciaDoAno("2026-11-22", "2026-11-24")).toBeNull();
  });
  test("ano seguinte ainda no passado: não pergunta", () => {
    expect(conferenciaDoAno("2025-01-09", "2026-11-24")).toBeNull();
    expect(conferenciaDoAno("2025-11-20", "2026-11-24")).toBeNull();
  });
  test("ano seguinte cai hoje: pergunta", () => {
    expect(conferenciaDoAno("2025-11-24", "2026-11-24")).toBe("2026-11-24");
  });
  test("data futura ou ilegível: null", () => {
    expect(conferenciaDoAno("2027-01-09", "2026-11-24")).toBeNull();
    expect(conferenciaDoAno(null, "2026-11-24")).toBeNull();
    expect(conferenciaDoAno("09/01/2026", "2026-11-24")).toBeNull();
  });
  test("29/02 sem bissexto no ano seguinte vira 28/02", () => {
    expect(conferenciaDoAno("2028-02-29", "2028-12-01")).toBe("2029-02-28");
  });
});

describe("avisoDaData", () => {
  const HOJE = "2026-11-24";
  test("renegociar: passado bloqueia em vermelho; hoje e futuro passam", () => {
    expect(avisoDaData("23/11/2026", "renegociar", HOJE)).toEqual({
      texto: TEXTO_RENEGOCIAR_DATA_PASSADA, tom: "erro", bloqueia: true, sugestaoDoAno: null,
    });
    expect(avisoDaData("24/11/2026", "renegociar", HOJE).bloqueia).toBe(false);
    expect(avisoDaData("24/11/2026", "renegociar", HOJE).texto).toBeNull();
    expect(avisoDaData("10/12/2026", "renegociar", HOJE).bloqueia).toBe(false);
  });
  test("renegociar: ano esquecido bloqueia e oferece o ano certo", () => {
    expect(avisoDaData("09/01/2026", "renegociar", HOJE)).toEqual({
      texto: TEXTO_RENEGOCIAR_DATA_PASSADA, tom: "erro", bloqueia: true, sugestaoDoAno: "09/01/2027",
    });
  });
  test("mudar: passado só avisa em âmbar", () => {
    expect(avisoDaData("23/11/2026", "mudar", HOJE)).toEqual({
      texto: TEXTO_MUDAR_DATA_PASSADA, tom: "aviso", bloqueia: false, sugestaoDoAno: null,
    });
    expect(avisoDaData("24/11/2026", "mudar", HOJE).texto).toBeNull();
  });
  test("mudar: com o ano esquecido mostra só o atalho", () => {
    expect(avisoDaData("09/01/2026", "mudar", HOJE)).toEqual({
      texto: null, tom: "aviso", bloqueia: false, sugestaoDoAno: "09/01/2027",
    });
  });
  test("incompleta ou inválida: nada (o confirmar já diz 'Data inválida')", () => {
    for (const v of ["", "09/01", "31/02/2026", "lixo"]) {
      expect(avisoDaData(v, "renegociar", HOJE)).toEqual({ texto: null, tom: "aviso", bloqueia: false, sugestaoDoAno: null });
    }
  });
});

describe("textos e erro do backend", () => {
  test("textos aprovados", () => {
    expect(TEXTO_RENEGOCIAR_DATA_PASSADA).toBe("Essa data já passou. A renegociação precisa começar hoje ou depois.");
    expect(TEXTO_MUDAR_DATA_PASSADA).toBe("Essa data já passou — a parcela fica vencida.");
    expect(textoConfiraOAno("09/01/2027")).toBe("Confira o ano: você quis dizer 09/01/2027?");
  });
  test("422 FIRST_DUE_DATE_PAST", () => {
    expect(ehPrimeiraParcelaNoPassado({ status: 422, data: { error: "x", code: "FIRST_DUE_DATE_PAST" } })).toBe(true);
    expect(ehPrimeiraParcelaNoPassado({ code: "FIRST_DUE_DATE_PAST" })).toBe(true);
    expect(ehPrimeiraParcelaNoPassado({ status: 422, data: { code: "FIRST_DUE_DATE_TOO_FAR" } })).toBe(false);
    expect(ehPrimeiraParcelaNoPassado(null)).toBe(false);
  });
});
