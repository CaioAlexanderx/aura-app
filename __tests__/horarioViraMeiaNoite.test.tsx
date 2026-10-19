// ============================================================
// Horário que passa da meia-noite no painel (19/10/2026).
//
// Desde 19/10 a loja "Fechada" recusa pedido no servidor. Então a grade
// precisa aceitar a adega que abre 18:00 e fecha 02:00 (e dizer "fecha no
// dia seguinte"), e não pode salvar abertura igual ao fechamento nem dia
// pela metade enquanto a lojista digita. Mesma regra do backend
// (services/horarioDaLoja.js). Montagem igual a lojaSempreAberta.test.tsx.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native-svg", () => {
  const R = require("react");
  const stub = (nome: string) => (props: any) => R.createElement(nome, props, props.children);
  return {
    __esModule: true,
    default: stub("Svg"),
    Svg: stub("Svg"), Path: stub("Path"), Circle: stub("Circle"),
    Rect: stub("Rect"), Ellipse: stub("Ellipse"), G: stub("G"),
    Defs: stub("Defs"), LinearGradient: stub("LinearGradient"), Stop: stub("Stop"),
  };
});
jest.mock("@/components/Toast", () => ({ toast: { show: jest.fn(), error: jest.fn() } }));

import { TabEntrega } from "@/components/screens/canal/TabEntrega";
import { avisoDoDia, horarioPodeSalvar, situacaoDoDia } from "@/components/screens/canal/entrega";

const ADEGA = {
  seg: { open: "", close: "", closed: true },
  ter: { open: "18:00", close: "23:00", closed: false },
  qua: { open: "18:00", close: "23:00", closed: false },
  qui: { open: "18:00", close: "02:00", closed: false },
  sex: { open: "18:00", close: "02:00", closed: false },
  sab: { open: "18:00", close: "02:00", closed: false },
  dom: { open: "", close: "", closed: true },
};

describe("situacaoDoDia", () => {
  test.each([
    ["", "", "fechado"],
    ["09:00", "18:00", "normal"],
    ["18:00", "02:00", "vira_a_noite"],
    ["18:00", "00:00", "vira_a_noite"],
    ["18:00", "18:00", "igual"],
    ["18:00", "", "incompleto"],
    ["", "02:00", "incompleto"],
    ["25:00", "02:00", "formato"],
    ["18", "02:00", "formato"],
  ])("%s às %s = %s", (abre, fecha, esperado) => {
    expect(situacaoDoDia(abre, fecha)).toBe(esperado);
  });

  test("os avisos", () => {
    expect(avisoDoDia("vira_a_noite")).toBe("Fecha no dia seguinte");
    expect(avisoDoDia("igual")).toMatch(/18:00 às 02:00/);
    expect(avisoDoDia("normal")).toBe("");
    expect(avisoDoDia("fechado")).toBe("");
  });

  test("a grade só salva inteira e válida", () => {
    expect(horarioPodeSalvar(Object.values(ADEGA))).toBe(true);
    expect(horarioPodeSalvar([...Object.values(ADEGA), { open: "10:00", close: "10:00" }])).toBe(false);
    expect(horarioPodeSalvar([{ open: "18:00", close: "" }])).toBe(false);
  });
});

function textos(arvore: any): string[] {
  const out: string[] = [];
  const anda = (n: any) => {
    if (n == null) return;
    if (typeof n === "string") { out.push(n); return; }
    if (Array.isArray(n)) return n.forEach(anda);
    if (n.children) anda(n.children);
  };
  anda(arvore);
  return out;
}

function montar(business_hours: any) {
  const saveConfig = jest.fn().mockResolvedValue({});
  let r: any;
  act(() => {
    r = renderer.create(
      <TabEntrega config={{ business_hours, always_open: false }} saveConfig={saveConfig} isSaving={false} />
    );
  });
  const campos = (dia: number) => r.root
    .findAll((n: any) => n.props && typeof n.props.onChangeText === "function" && n.props.placeholder === "—")
    .slice(dia * 2, dia * 2 + 2);
  return { r, saveConfig, campos };
}

describe("a grade de horários", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("18:00 às 02:00 mostra \"Fecha no dia seguinte\"", () => {
    const { r } = montar(ADEGA);
    const t = textos(r.toJSON());
    expect(t.filter((x) => x === "Fecha no dia seguinte")).toHaveLength(3);
  });

  test("o cabeçalho avisa que fechada não recebe pedido", () => {
    const { r } = montar(ADEGA);
    expect(textos(r.toJSON()).join(" ")).toMatch(/não recebe pedidos/);
  });

  test("fechar depois da meia-noite salva", () => {
    const { saveConfig, campos } = montar(ADEGA);
    // ter (índice 1 na grade): fecha 01:30
    const [, fecha] = campos(1);
    act(() => { fecha.props.onChangeText("0130"); });
    act(() => { jest.advanceTimersByTime(900); });
    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig.mock.calls[0][0].business_hours.ter).toEqual({ open: "18:00", close: "01:30", closed: false });
  });

  test("fechamento igual à abertura não salva e explica", () => {
    const { r, saveConfig, campos } = montar(ADEGA);
    const [, fecha] = campos(1);
    act(() => { fecha.props.onChangeText("1800"); });
    act(() => { jest.advanceTimersByTime(900); });
    expect(saveConfig).not.toHaveBeenCalled();
    expect(textos(r.toJSON()).join(" ")).toMatch(/Fechamento igual à abertura/);
  });

  test("dia pela metade espera a lojista terminar", () => {
    const { saveConfig, campos } = montar(ADEGA);
    // seg (índice 0) estava fechada: digita só a abertura
    const [abre] = campos(0);
    act(() => { abre.props.onChangeText("1800"); });
    act(() => { jest.advanceTimersByTime(900); });
    expect(saveConfig).not.toHaveBeenCalled();
  });
});
