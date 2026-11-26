// ============================================================
// Automáticas: a divisão das novidades com + e − e o aceite (26/11/2026).
//
// A função pura segura as regras que o servidor também aplica
// (DIVISAO_ACIMA_DO_SALDO, DIVISAO_ABAIXO_DO_USADO): a soma nunca passa do
// saldo, o − não desce abaixo do que já foi usado, e um toque travado
// devolve a MESMA divisão (nada vai ao servidor).
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import { AutomaticasCard } from "@/components/whatsapp/AutomaticasCard";
import {
  DIVISAO_PADRAO, ajustarParte, divisaoValida, lerAutomaticas, lerPartes, podeDarMais, podeTirar, semDono,
} from "@/components/whatsapp/waDivisao";

const zero = { aniversario: 0, venda_mais: 0, crediario: 0 };

function resposta(over: any = {}) {
  return {
    mes: "2026-12",
    aceite_novidades_em: null,
    novidades: { total: 10, livres: 10, divisao: DIVISAO_PADRAO, usadas: zero, sem_dono: 0 },
    automaticas: [
      { key: "aniversario", ligada: false, usa: "novidades", parte: "aniversario", livres: 4, config: {} },
      { key: "venda_mais", ligada: false, usa: "novidades", parte: "venda_mais", livres: 4, config: {} },
      { key: "crediario_cobrar", ligada: false, usa: "avisos", config: {} },
      { key: "crediario_vender", ligada: false, usa: "novidades", parte: "crediario", livres: 2, config: {} },
    ],
    ...over,
  };
}

describe("waDivisao", () => {
  it("padrão 4/4/2 soma 10 e não sobra nada", () => {
    expect(semDono(DIVISAO_PADRAO, 10)).toBe(0);
    expect(divisaoValida(DIVISAO_PADRAO, zero, 10)).toBe(true);
  });

  it("o + trava no limite do saldo", () => {
    expect(podeDarMais(DIVISAO_PADRAO, "aniversario", 10)).toBe(false);
    expect(ajustarParte(DIVISAO_PADRAO, zero, "aniversario", 1, 10)).toBe(DIVISAO_PADRAO);
  });

  it("tirar de um libera para outro; a soma nunca passa", () => {
    let d = ajustarParte(DIVISAO_PADRAO, zero, "venda_mais", -1, 10);
    expect(d).toEqual({ aniversario: 4, venda_mais: 3, crediario: 2 });
    d = ajustarParte(d, zero, "crediario", 1, 10);
    expect(d).toEqual({ aniversario: 4, venda_mais: 3, crediario: 3 });
    expect(ajustarParte(d, zero, "crediario", 1, 10)).toBe(d);
  });

  it("o − trava no que já foi usado e em zero", () => {
    const usadas = { aniversario: 3, venda_mais: 0, crediario: 0 };
    const d = { aniversario: 3, venda_mais: 0, crediario: 2 };
    expect(podeTirar(d, usadas, "aniversario")).toBe(false);
    expect(podeTirar(d, usadas, "venda_mais")).toBe(false);
    expect(ajustarParte(d, usadas, "aniversario", -1, 10)).toBe(d);
    expect(podeTirar(d, usadas, "crediario")).toBe(true);
  });

  it("divisão que passa do saldo ou abaixo do usado é inválida", () => {
    expect(divisaoValida({ aniversario: 5, venda_mais: 4, crediario: 2 }, zero, 10)).toBe(false);
    expect(divisaoValida({ aniversario: 1, venda_mais: 4, crediario: 2 }, { ...zero, aniversario: 2 }, 10)).toBe(false);
  });

  it("leitura torta bloqueia", () => {
    expect(lerPartes({ aniversario: 4, venda_mais: 4 })).toBeNull();
    expect(lerPartes({ aniversario: 4, venda_mais: -1, crediario: 2 })).toBeNull();
    expect(lerPartes({ aniversario: 4.5, venda_mais: 4, crediario: 2 })).toBeNull();
    expect(lerAutomaticas({ novidades: { divisao: DIVISAO_PADRAO, usadas: zero } })).toBeNull(); // sem total
    expect(lerAutomaticas({})).toBeNull();
  });

  it("lê o contrato do B; ligada ausente = desligada; aceite nulo", () => {
    const i = lerAutomaticas(resposta({ automaticas: [{ key: "aniversario" }] }))!;
    expect(i.total).toBe(10);
    expect(i.aceiteEm).toBeNull();
    expect(i.autos.aniversario!.ligada).toBe(false);
    expect(i.autos.venda_mais).toBeUndefined();
    expect(lerAutomaticas(resposta({ aceite_novidades_em: "2026-12-01T10:00:00Z" }))!.aceiteEm).toBeTruthy();
  });
});

function auto(over: any = {}, resp: any = resposta()) {
  return {
    info: lerAutomaticas(resp),
    carregando: false, falhou: false, salvando: false, erro: null,
    recarregar: jest.fn(), ajustar: jest.fn(), aplicarDivisao: jest.fn(),
    ligar: jest.fn(() => Promise.resolve({ ok: true, code: null })),
    salvarConfig: jest.fn(),
    ...over,
  } as any;
}

function achar(t: any, id: string) { return t.root.findAllByProps({ testID: id })[0]; }
function tem(t: any, id: string) { return t.root.findAllByProps({ testID: id }).length > 0; }

describe("AutomaticasCard", () => {
  it("+ trava sem novidade sem dono; − livre", () => {
    const t = renderer.create(<AutomaticasCard auto={auto()} />);
    expect(achar(t, "wa-auto-mais-aniversario").props.disabled).toBe(true);
    expect(achar(t, "wa-auto-menos-aniversario").props.disabled).toBe(false);
    expect(tem(t, "wa-auto-livres")).toBe(true);
  });

  it("sem leitura do servidor, trava tudo", () => {
    const t = renderer.create(<AutomaticasCard auto={auto({ info: null, falhou: true })} />);
    expect(tem(t, "wa-auto-indisponivel")).toBe(true);
    expect(tem(t, "wa-auto-liga-aniversario")).toBe(false);
  });

  it("sem aceite, a primeira automática pergunta; 'Ainda não' não liga", async () => {
    const a = auto();
    const t = renderer.create(<AutomaticasCard auto={a} />);
    await act(async () => { await achar(t, "wa-auto-liga-aniversario").props.onPress(); });
    expect(tem(t, "wa-auto-aceite")).toBe(true);
    expect(a.ligar).not.toHaveBeenCalled();
    await act(async () => { achar(t, "wa-auto-aceite-nao").props.onPress(); });
    expect(tem(t, "wa-auto-aceite")).toBe(false);
    expect(a.ligar).not.toHaveBeenCalled();
  });

  it("'Sim, aceitaram' reenvia com aceite_novidades", async () => {
    const a = auto();
    const t = renderer.create(<AutomaticasCard auto={a} />);
    await act(async () => { await achar(t, "wa-auto-liga-venda_mais").props.onPress(); });
    await act(async () => { await achar(t, "wa-auto-aceite-sim").props.onPress(); });
    expect(a.ligar).toHaveBeenCalledWith("venda_mais", true, true);
  });

  it("com aceite, liga direto; a cobrança (avisos) nunca pergunta", async () => {
    const a = auto({}, resposta({ aceite_novidades_em: "2026-12-01T00:00:00Z" }));
    const t = renderer.create(<AutomaticasCard auto={a} />);
    await act(async () => { await achar(t, "wa-auto-liga-crediario_vender").props.onPress(); });
    expect(a.ligar).toHaveBeenCalledWith("crediario_vender", true);
    expect(tem(t, "wa-auto-aceite")).toBe(false);

    const b = auto();
    const t2 = renderer.create(<AutomaticasCard auto={b} />);
    await act(async () => { await achar(t2, "wa-auto-liga-crediario_cobrar").props.onPress(); });
    expect(b.ligar).toHaveBeenCalledWith("crediario_cobrar", true);
    expect(tem(t2, "wa-auto-aceite")).toBe(false);
  });

  it("o servidor pedindo o aceite (409) abre a pergunta", async () => {
    const a = auto({ ligar: jest.fn(() => Promise.resolve({ ok: false, code: "SEM_ACEITE_NOVIDADES" })) },
      resposta({ aceite_novidades_em: "2026-12-01T00:00:00Z" }));
    const t = renderer.create(<AutomaticasCard auto={a} />);
    await act(async () => { await achar(t, "wa-auto-liga-aniversario").props.onPress(); });
    expect(tem(t, "wa-auto-aceite")).toBe(true);
  });
});
