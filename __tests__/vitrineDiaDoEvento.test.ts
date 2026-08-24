// ============================================================
// Campeonatos do dojô — vitrine no DIA DO EVENTO
//
// O gap real (flagrado no PR #796): a tela do dojô resolve o campeonato
// pela vitrine GET /dojo/competitions. Quando a federação encerrava as
// inscrições (status closed/done), o campeonato SUMIA da lista — e o
// dojô perdia Presença (check-in) e Minhas chaves exatamente no dia do
// evento. O backend agora mantém na lista as closed/done onde o dojô tem
// delegação, com enrollment_open: false no payload.
//
// O QUE ESTE ARQUIVO PROTEGE:
//   • isEnrollmentOpen — a leitura do flag é TOLERANTE a backend antigo:
//     campo ausente conta como aberto (o backend antigo só listava
//     'open', então ausência nunca significa encerrado). Só o `false`
//     explícito bloqueia o wizard.
//   • initialCartTab — no dia do evento o sensei cai direto na Presença
//     (é o que ele veio fazer); com inscrições abertas, no wizard.
// ============================================================
import { isEnrollmentOpen, initialCartTab } from "@/services/karateDelegationsApi";

describe("isEnrollmentOpen — tolerante a backend antigo", () => {
  it("aberto quando enrollment_open=true", () => {
    expect(isEnrollmentOpen({ enrollment_open: true })).toBe(true);
  });

  it("encerrado SÓ com false explícito (dia do evento)", () => {
    expect(isEnrollmentOpen({ enrollment_open: false })).toBe(false);
  });

  it("campo ausente = aberto (backend antigo só lista 'open')", () => {
    expect(isEnrollmentOpen({})).toBe(true);
    expect(isEnrollmentOpen({ enrollment_open: undefined })).toBe(true);
  });

  it("sem competição resolvida ainda, não bloqueia nada", () => {
    expect(isEnrollmentOpen(null)).toBe(true);
    expect(isEnrollmentOpen(undefined)).toBe(true);
  });
});

describe("initialCartTab — onde o sensei aterrissa", () => {
  it("inscrições abertas → wizard de inscrição", () => {
    expect(initialCartTab({ enrollment_open: true })).toBe("inscricao");
    expect(initialCartTab({})).toBe("inscricao");
  });

  it("dia do evento (encerradas) → Presença", () => {
    expect(initialCartTab({ enrollment_open: false })).toBe("presenca");
  });
});
