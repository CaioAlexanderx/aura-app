// 24/10/2026 (tq-86) — em atraso o muro conta dias. Decisão do Caio (21/10):
// as outras telas pausam no dia 7 e o Caixa no dia 14. O backend manda as
// datas prontas no objeto da empresa; sem elas (backend anterior), tudo como
// antes (bloqueado desde o dia 1, Caixa vivo no shell Negócio).
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...a: any[]) => mockPush(...a), replace: jest.fn() } }));

import {
  semAssinatura, destinoSemAssinatura, textoDoAviso, ROTA_CAIXA, ROTA_CHECKOUT,
  faseDoAtraso, caixaPausado, avisoDeAtraso, textoDoAtraso, hojeEmSaoPaulo, estadoDaLoja,
  type EstadoDeAssinatura,
} from "@/utils/muroDeAssinatura";
import { AvisoAssine } from "@/components/screens/pdv/AvisoAssine";

const dono: EstadoDeAssinatura = {
  billingStatus: "overdue", trialActive: false, isDemo: false, isStaff: false, emailVerified: true,
  temEmpresa: true, isOwner: true, isKarateFederation: false, isKarateDojoVertical: false,
};

// Vencimento em 10/10: telas pausam em 17/10 (dia 7), Caixa em 24/10 (dia 14).
const VENC = "2026-10-10";
const comDatas: EstadoDeAssinatura = { ...dono, billingPauseScreensOn: "2026-10-17", billingPauseCaixaOn: "2026-10-24" };
const semDatas: EstadoDeAssinatura = { ...dono };
const dia = (n: number) => {
  const d = new Date(VENC + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// O que o AuthGuard faz (app/_layout.tsx): shell Negócio com o Caixa vivo
// até o Caixa pausar; Odonto/Food/Studio sempre sem Caixa vivo.
const negocio = (e: EstadoDeAssinatura, segments: string[]) =>
  semAssinatura(e) ? destinoSemAssinatura(segments, { caixaVivo: !caixaPausado(e) }) : null;
const vertical = (e: EstadoDeAssinatura, segments: string[]) =>
  semAssinatura(e) ? destinoSemAssinatura(segments, { caixaVivo: false }) : null;

describe("muro em atraso, com as datas do backend", () => {
  it.each([0, 6])("dia %i: tudo liberado, faixa com a data da pausa", (n) => {
    const e = { ...comDatas, hoje: dia(n) };
    expect(faseDoAtraso(e)).toBe("liberado");
    expect(semAssinatura(e)).toBe(false);
    expect(caixaPausado(e)).toBe(false);
    expect(negocio(e, ["(tabs)", "estoque"])).toBeNull();
    expect(vertical(e, ["dental", "(clinic)", "hoje"])).toBeNull();
    expect(avisoDeAtraso(e)).toEqual({ fase: "liberado", pausaTelasEm: "17/10", pausaCaixaEm: "24/10" });
  });

  it.each([7, 13])("dia %i: outras telas pausam, o Caixa segue; Odonto/Food/Studio vão ao checkout", (n) => {
    const e = { ...comDatas, hoje: dia(n) };
    expect(faseDoAtraso(e)).toBe("telas_pausadas");
    expect(semAssinatura(e)).toBe(true);
    expect(caixaPausado(e)).toBe(false);
    expect(negocio(e, ["(tabs)", "estoque"])).toBe(ROTA_CAIXA);
    expect(negocio(e, ["(tabs)", "pdv"])).toBeNull();
    expect(vertical(e, ["dental", "(clinic)", "hoje"])).toBe(ROTA_CHECKOUT);
    expect(avisoDeAtraso(e)).toEqual({ fase: "telas_pausadas", pausaTelasEm: "17/10", pausaCaixaEm: "24/10" });
  });

  it.each([14, 15])("dia %i: o Caixa também pausa e o shell Negócio vai ao checkout", (n) => {
    const e = { ...comDatas, hoje: dia(n) };
    expect(faseDoAtraso(e)).toBe("caixa_pausado");
    expect(semAssinatura(e)).toBe(true);
    expect(caixaPausado(e)).toBe(true);
    expect(negocio(e, ["(tabs)", "pdv"])).toBe(ROTA_CHECKOUT);
    expect(negocio(e, ["(tabs)", "estoque"])).toBe(ROTA_CHECKOUT);
    expect(negocio(e, ["(tabs)", "checkout"])).toBeNull();
    expect(vertical(e, ["dental", "(clinic)", "hoje"])).toBe(ROTA_CHECKOUT);
    expect(avisoDeAtraso(e)).toBeNull();
  });
});

describe("muro em atraso, SEM os campos (backend anterior)", () => {
  it.each([0, 6, 7, 13, 14, 15])("dia %i: exatamente como antes", (n) => {
    const e = { ...semDatas, hoje: dia(n) };
    expect(faseDoAtraso(e)).toBe("sem_prazo");
    expect(semAssinatura(e)).toBe(true);
    expect(caixaPausado(e)).toBe(false);
    expect(negocio(e, ["(tabs)", "estoque"])).toBe(ROTA_CAIXA);
    expect(negocio(e, ["(tabs)", "pdv"])).toBeNull();
    expect(vertical(e, ["dental", "(clinic)", "hoje"])).toBe(ROTA_CHECKOUT);
    expect(avisoDeAtraso(e)).toBeNull();
    // O aviso do Caixa continua o de sempre.
    expect(textoDoAviso("2026-09-01T00:00:00Z", null, avisoDeAtraso(e)).titulo).toBe("Seu período de teste terminou");
  });

  it("campos presentes mas nulos: como antes; sem a data do Caixa, o Caixa nunca pausa", () => {
    const nulos = { ...semDatas, billingPauseScreensOn: null, billingPauseCaixaOn: null, hoje: dia(3) };
    expect(faseDoAtraso(nulos)).toBe("sem_prazo");
    expect(semAssinatura(nulos)).toBe(true);
    expect(caixaPausado(nulos)).toBe(false);
    const soTelas = { ...semDatas, billingPauseScreensOn: "2026-10-17", billingPauseCaixaOn: null, hoje: dia(20) };
    expect(faseDoAtraso(soTelas)).toBe("telas_pausadas");
    expect(caixaPausado(soTelas)).toBe(false);
    expect(avisoDeAtraso(soTelas)).toEqual({ fase: "telas_pausadas", pausaTelasEm: "17/10", pausaCaixaEm: null });
  });

  it("datas com hora (ISO) também valem; texto que não é data vira backend anterior", () => {
    const e = { ...comDatas, billingPauseScreensOn: "2026-10-17T00:00:00.000Z", billingPauseCaixaOn: "2026-10-24T00:00:00.000Z" };
    expect(faseDoAtraso({ ...e, hoje: "2026-10-16" })).toBe("liberado");
    expect(faseDoAtraso({ ...e, hoje: "2026-10-17" })).toBe("telas_pausadas");
    expect(faseDoAtraso({ ...semDatas, billingPauseScreensOn: "amanhã", hoje: dia(1) })).toBe("sem_prazo");
  });
});

describe("quem o muro em atraso alcança", () => {
  it("Karatê, staff, demo e vendedor ficam fora; cobrança ativa e trial ativo também", () => {
    const e = { ...comDatas, hoje: dia(15) };
    expect(semAssinatura({ ...e, isKarateDojoVertical: true })).toBe(false);
    expect(semAssinatura({ ...e, isKarateFederation: true })).toBe(false);
    expect(semAssinatura({ ...e, isStaff: true })).toBe(false);
    expect(semAssinatura({ ...e, isDemo: true })).toBe(false);
    expect(semAssinatura({ ...e, isOwner: false })).toBe(false);
    expect(avisoDeAtraso({ ...comDatas, hoje: dia(3), isOwner: false })).toBeNull();
    expect(avisoDeAtraso({ ...comDatas, hoje: dia(3), isKarateFederation: true })).toBeNull();
    expect(faseDoAtraso({ ...e, billingStatus: "active" })).toBeNull();
    expect(semAssinatura({ ...e, trialActive: true })).toBe(false);
  });

  it("hoje é contado em São Paulo (21h30 de 16/10 em SP ainda é dia 16)", () => {
    expect(hojeEmSaoPaulo(new Date("2026-10-17T00:30:00Z"))).toBe("2026-10-16");
    expect(hojeEmSaoPaulo(new Date("2026-10-17T03:00:00Z"))).toBe("2026-10-17");
  });

  it("estadoDaLoja lê as datas do objeto da empresa (/auth/me); sem os campos, nada de datas", () => {
    const base = { user: { email_verified: true }, trialActive: false, isDemo: false, isStaff: false };
    const comCampos = estadoDaLoja({ ...base, company: {
      billing_status: "overdue", member_role: "owner",
      billing_overdue_since: VENC, billing_pause_screens_on: "2026-10-17", billing_pause_caixa_on: "2026-10-24",
    } });
    expect(comCampos.billingPauseScreensOn).toBe("2026-10-17");
    expect(comCampos.billingPauseCaixaOn).toBe("2026-10-24");
    expect(semAssinatura({ ...comCampos, hoje: dia(3) })).toBe(false);
    const antigo = estadoDaLoja({ ...base, company: { billing_status: "overdue", member_role: "owner" } });
    expect("billingPauseScreensOn" in antigo).toBe(false);
    expect(semAssinatura({ ...antigo, hoje: dia(3) })).toBe(true);
    expect(estadoDaLoja({ ...base, company: { vertical_active: "karate_dojo" } }).isKarateDojoVertical).toBe(true);
    expect(estadoDaLoja({ ...base, company: { member_role: "seller" } }).isOwner).toBe(false);
  });
});

describe("faixa de atraso no Caixa e no Painel", () => {
  beforeEach(() => mockPush.mockClear());
  const PROIBIDAS = [/nada se perde/i, /tudo volta na hora/i];

  it("antes da pausa: data da pausa das telas e até quando o Caixa vende; botão leva ao checkout", () => {
    const a = { fase: "liberado" as const, pausaTelasEm: "17/10", pausaCaixaEm: "24/10" };
    const t = textoDoAtraso(a);
    expect(t.titulo).toBe("A mensalidade está em aberto");
    expect(t.corpo).toBe("Se continuar em aberto, o acesso às outras telas pausa no dia 17/10. O Caixa segue funcionando para você vender até 24/10.");
    let r!: renderer.ReactTestRenderer;
    act(() => { r = renderer.create(<AvisoAssine atraso={a} testID="painel-aviso-atraso" />); });
    const out = JSON.stringify(r.toJSON());
    expect(out).toContain("Pagar a mensalidade");
    expect(out).not.toContain("teste");
    expect(r.root.findByProps({ testID: "painel-aviso-atraso" })).toBeTruthy();
    act(() => { r.root.findByProps({ testID: "caixa-aviso-assinar" }).props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith(ROTA_CHECKOUT);
  });

  it("telas pausadas: o aviso do Caixa fala da mensalidade, não do teste", () => {
    const t = textoDoAviso("2026-09-01T00:00:00Z", null, { fase: "telas_pausadas", pausaTelasEm: "17/10", pausaCaixaEm: "24/10" });
    expect(t.titulo).toBe("O acesso às outras telas está pausado");
    expect(t.corpo).toBe(
      "A mensalidade segue em aberto. O Caixa continua funcionando para você vender até 24/10. "
      + "Seus dados continuam guardados. Assim que o pagamento for confirmado, o acesso volta.",
    );
  });

  it("nenhum texto usa as frases proibidas", () => {
    const textos = [
      textoDoAtraso({ fase: "liberado", pausaTelasEm: "17/10", pausaCaixaEm: "24/10" }),
      textoDoAtraso({ fase: "liberado", pausaTelasEm: "17/10", pausaCaixaEm: null }),
      textoDoAtraso({ fase: "telas_pausadas", pausaTelasEm: "17/10", pausaCaixaEm: "24/10" }),
      textoDoAtraso({ fase: "telas_pausadas", pausaTelasEm: "17/10", pausaCaixaEm: null }),
    ];
    for (const t of textos) for (const re of PROIBIDAS) expect(t.titulo + " " + t.corpo).not.toMatch(re);
  });
});
