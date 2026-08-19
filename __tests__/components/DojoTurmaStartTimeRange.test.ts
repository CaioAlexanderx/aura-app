// ============================================================
// Turmas do dojô — faixa de horário de início (virada do dia)
//
// O backend recusa turma que começa na virada do dia: a janela de
// tolerância do check-in por QR é linear dentro de uma data e vazaria
// pro dia vizinho, quebrando o check-in bem na hora da aula (backend
// PR #527). O formulário mostra a faixa como dica e valida antes do
// submit, pra ninguém descobrir o limite só no 422.
//
// O QUE ESTE ARQUIVO PROTEGE: a faixa vem do SERVIDOR
// (settings.class_start_time_range), derivada lá das constantes da
// janela. O front NUNCA pode hardcodar '00:30'/'22:59' — se alguém
// afrouxar a janela no backend pra 90/120 min, a dica tem que
// acompanhar sozinha. Por isso os casos abaixo passam faixas
// DIFERENTES e exigem que a saída siga a faixa recebida, em vez de
// conferir contra literais fixos.
//
// E o degrade importa tanto quanto a regra: sem faixa conhecida
// (backend antigo, ou o GET de settings falhou) o formulário não pode
// inventar limite nenhum — nada de dica, nada de bloqueio, o 422 do
// servidor segue sendo a rede de segurança.
// ============================================================
import {
  timeToMinutes,
  startTimeRangeHint,
  isStartTimeOutOfRange,
} from "@/components/karate/dojoTurmas/helpers";

// A faixa que o backend manda hoje (30 min antes / 60 min depois).
const FAIXA_PADRAO = { min: "00:30", max: "22:59" };
// A faixa que ele mandaria com a janela afrouxada pra 90/120 min.
const FAIXA_AFROUXADA = { min: "01:30", max: "21:59" };

describe("timeToMinutes", () => {
  it("converte 'HH:MM' em minutos do dia", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("00:30")).toBe(30);
    expect(timeToMinutes("18:00")).toBe(1080);
    expect(timeToMinutes("22:59")).toBe(1379);
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("devolve null pra vazio e formato inválido", () => {
    expect(timeToMinutes("")).toBeNull();
    expect(timeToMinutes("18h")).toBeNull();
    expect(timeToMinutes("8:00")).toBeNull();  // sem zero à esquerda
    expect(timeToMinutes("24:00")).toBeNull(); // hora fora de 0-23
    expect(timeToMinutes("18:60")).toBeNull(); // minuto fora de 0-59
  });
});

describe("startTimeRangeHint", () => {
  it("monta a dica com os limites que VIERAM do servidor", () => {
    expect(startTimeRangeHint(FAIXA_PADRAO)).toContain("00:30");
    expect(startTimeRangeHint(FAIXA_PADRAO)).toContain("22:59");
  });

  it("acompanha o servidor quando a janela muda (nada hardcodado)", () => {
    const dica = startTimeRangeHint(FAIXA_AFROUXADA);
    expect(dica).toContain("01:30");
    expect(dica).toContain("21:59");
    // e NÃO pode ter sobrado nenhum literal da faixa antiga
    expect(dica).not.toContain("00:30");
    expect(dica).not.toContain("22:59");
  });

  it("sem faixa conhecida → sem dica (não inventa limite)", () => {
    expect(startTimeRangeHint(null)).toBeNull();
    expect(startTimeRangeHint(undefined)).toBeNull();
    expect(startTimeRangeHint({ min: "", max: "" })).toBeNull();
  });
});

describe("isStartTimeOutOfRange", () => {
  it("barra a virada do dia — os horários que o backend recusa", () => {
    for (const t of ["00:00", "00:29", "23:00", "23:50", "23:59"]) {
      expect(isStartTimeOutOfRange(t, FAIXA_PADRAO)).toBe(true);
    }
  });

  it("aceita as bordas exatas e o horário real de turma", () => {
    for (const t of ["00:30", "22:59", "18:00", "07:00"]) {
      expect(isStartTimeOutOfRange(t, FAIXA_PADRAO)).toBe(false);
    }
  });

  it("segue a faixa recebida, não uma cópia local dela", () => {
    // 01:00 é válido na faixa padrão e inválido na afrouxada — se o front
    // tivesse hardcodado 00:30/22:59, este caso passaria errado.
    expect(isStartTimeOutOfRange("01:00", FAIXA_PADRAO)).toBe(false);
    expect(isStartTimeOutOfRange("01:00", FAIXA_AFROUXADA)).toBe(true);
    expect(isStartTimeOutOfRange("22:30", FAIXA_PADRAO)).toBe(false);
    expect(isStartTimeOutOfRange("22:30", FAIXA_AFROUXADA)).toBe(true);
  });

  it("campo vazio nunca bloqueia (início é opcional)", () => {
    expect(isStartTimeOutOfRange("", FAIXA_PADRAO)).toBe(false);
  });

  it("sem faixa conhecida nunca bloqueia — nem a meia-noite", () => {
    // Degrade silencioso: o front não conhece o limite, então não decide.
    // Quem recusa é o backend, com 422.
    expect(isStartTimeOutOfRange("00:00", null)).toBe(false);
    expect(isStartTimeOutOfRange("23:50", undefined)).toBe(false);
  });

  it("horário ainda incompleto (digitação) não bloqueia", () => {
    // O campo é mascarado: enquanto o usuário digita, '18' e '18:0' passam
    // pelo onChangeText. Bloquear aí acenderia erro no meio da digitação.
    expect(isStartTimeOutOfRange("18", FAIXA_PADRAO)).toBe(false);
    expect(isStartTimeOutOfRange("18:0", FAIXA_PADRAO)).toBe(false);
  });
});
