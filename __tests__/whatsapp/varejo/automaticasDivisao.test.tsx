// ============================================================
// Automáticas: a divisão das novidades com + e − e o aceite (26/11/2026).
//
// A função pura segura as regras que o servidor também aplica: a soma
// nunca passa do saldo, o − não desce abaixo do que já foi usado, e um
// toque travado devolve a MESMA divisão (nada vai ao servidor).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
const mockSave = jest.fn(() => Promise.resolve({ ok: true }));
jest.mock("@/services/birthdayApi", () => ({ birthdayApi: { saveSettings: (...a: any[]) => (mockSave as any)(...a) } }));

import { AutomaticasCard } from "@/components/whatsapp/AutomaticasCard";
import { waSaldoInfo } from "@/components/whatsapp/waSaldo";
import {
  DIVISAO_PADRAO, ajustarParte, divisaoValida, lerAutomaticas, lerPartes, podeDarMais, podeTirar, semDono,
} from "@/components/whatsapp/waDivisao";

const zero = { aniversario: 0, vendamais: 0, crediario: 0 };

describe("waDivisao", () => {
  it("padrão 4/4/2 soma 10 e não sobra nada", () => {
    expect(semDono(DIVISAO_PADRAO, 10)).toBe(0);
    expect(divisaoValida(DIVISAO_PADRAO, zero, 10)).toBe(true);
  });

  it("o + trava no limite do saldo", () => {
    expect(podeDarMais(DIVISAO_PADRAO, "aniversario", 10)).toBe(false);
    const mesma = ajustarParte(DIVISAO_PADRAO, zero, "aniversario", 1, 10);
    expect(mesma).toBe(DIVISAO_PADRAO);
  });

  it("tirar de um libera para outro; a soma nunca passa", () => {
    let d = ajustarParte(DIVISAO_PADRAO, zero, "vendamais", -1, 10);
    expect(d).toEqual({ aniversario: 4, vendamais: 3, crediario: 2 });
    d = ajustarParte(d, zero, "crediario", 1, 10);
    expect(d).toEqual({ aniversario: 4, vendamais: 3, crediario: 3 });
    expect(ajustarParte(d, zero, "crediario", 1, 10)).toBe(d);
  });

  it("o − trava no que já foi usado e em zero", () => {
    const usadas = { aniversario: 3, vendamais: 0, crediario: 0 };
    const d = { aniversario: 3, vendamais: 0, crediario: 2 };
    expect(podeTirar(d, usadas, "aniversario")).toBe(false);
    expect(podeTirar(d, usadas, "vendamais")).toBe(false);
    expect(ajustarParte(d, usadas, "aniversario", -1, 10)).toBe(d);
    expect(podeTirar(d, usadas, "crediario")).toBe(true);
  });

  it("divisão que passa do saldo ou abaixo do usado é inválida", () => {
    expect(divisaoValida({ aniversario: 5, vendamais: 4, crediario: 2 }, zero, 10)).toBe(false);
    expect(divisaoValida({ aniversario: 1, vendamais: 4, crediario: 2 }, { ...zero, aniversario: 2 }, 10)).toBe(false);
  });

  it("leitura torta bloqueia", () => {
    expect(lerPartes({ aniversario: 4, vendamais: 4 })).toBeNull();
    expect(lerPartes({ aniversario: 4, vendamais: -1, crediario: 2 })).toBeNull();
    expect(lerPartes({ aniversario: 4.5, vendamais: 4, crediario: 2 })).toBeNull();
    expect(lerAutomaticas({ divisao: DIVISAO_PADRAO })).toBeNull();
    const ok = lerAutomaticas({ divisao: DIVISAO_PADRAO, usadas: zero });
    expect(ok!.ligadas.aniversario).toBe(false); // ausente = desligada
  });
});

function auto(over: any = {}) {
  return {
    info: lerAutomaticas({ divisao: DIVISAO_PADRAO, usadas: zero, automaticas: { aniversario: { ligada: false } } }),
    carregando: false, falhou: false, salvando: false, erro: null,
    recarregar: jest.fn(), ajustar: jest.fn(), ligar: jest.fn(() => Promise.resolve(true)),
    ...over,
  } as any;
}
const saldo = waSaldoInfo({
  mes_ref: "2026-12",
  novidades: { total: 10, usado: 0 }, avisos: { total: 100, usado: 0 }, aurinha: { total: 80, usado: 0 },
}, new Date(2026, 11, 1));

function achar(t: any, id: string) { return t.root.findAllByProps({ testID: id })[0]; }
async function flush() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }

describe("AutomaticasCard", () => {
  beforeEach(() => mockSave.mockClear());

  it("+ trava sem novidade sem dono e nem chama o servidor", () => {
    const a = auto();
    const t = renderer.create(<AutomaticasCard companyId="c" saldo={saldo} auto={a} status={{ marketing_consent_at: "2026-11-01" } as any} onStatusChanged={jest.fn()} />);
    expect(achar(t, "wa-auto-mais-aniversario").props.disabled).toBe(true);
    expect(achar(t, "wa-auto-menos-aniversario").props.disabled).toBe(false);
    expect(achar(t, "wa-auto-livres")).toBeTruthy();
  });

  it("sem leitura do servidor, trava tudo", () => {
    const t = renderer.create(<AutomaticasCard companyId="c" saldo={saldo} auto={auto({ info: null, falhou: true })} status={null} onStatusChanged={jest.fn()} />);
    expect(t.root.findAllByProps({ testID: "wa-auto-indisponivel" }).length).toBe(1);
    expect(t.root.findAllByProps({ testID: "wa-auto-liga-aniversario" }).length).toBe(0);
  });

  it("primeira automática ligada pergunta o aceite; 'Ainda não' não liga", async () => {
    const a = auto();
    const t = renderer.create(<AutomaticasCard companyId="c" saldo={saldo} auto={a} status={{ marketing_consent_at: null } as any} onStatusChanged={jest.fn()} />);
    await act(async () => { achar(t, "wa-auto-liga-aniversario").props.onPress(); });
    expect(t.root.findAllByProps({ testID: "wa-auto-aceite" }).length).toBe(1);
    expect(a.ligar).not.toHaveBeenCalled();
    await act(async () => { achar(t, "wa-auto-aceite-nao").props.onPress(); });
    expect(t.root.findAllByProps({ testID: "wa-auto-aceite" }).length).toBe(0);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("'Sim, aceitaram' grava o aceite e só então liga", async () => {
    const a = auto();
    const onStatus = jest.fn();
    const t = renderer.create(<AutomaticasCard companyId="c" saldo={saldo} auto={a} status={{ marketing_consent_at: null } as any} onStatusChanged={onStatus} />);
    await act(async () => { achar(t, "wa-auto-liga-vendamais").props.onPress(); });
    await act(async () => { achar(t, "wa-auto-aceite-sim").props.onPress(); });
    await flush();
    expect(mockSave).toHaveBeenCalledWith("c", { wa_marketing_consent: true });
    expect(onStatus).toHaveBeenCalled();
    expect(a.ligar).toHaveBeenCalledWith("vendamais", true);
  });

  it("com o aceite já dado, liga direto", async () => {
    const a = auto();
    const t = renderer.create(<AutomaticasCard companyId="c" saldo={saldo} auto={a} status={{ marketing_consent_at: "2026-11-01T00:00:00Z" } as any} onStatusChanged={jest.fn()} />);
    await act(async () => { achar(t, "wa-auto-liga-crediario").props.onPress(); });
    expect(a.ligar).toHaveBeenCalledWith("crediario", true);
    expect(t.root.findAllByProps({ testID: "wa-auto-aceite" }).length).toBe(0);
  });
});
