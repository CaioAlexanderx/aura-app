// ============================================================
// "Aberta 24 horas" no painel.
//
// O backend tem uma coluna `always_open` (migration 310) porque dizer 24h
// por horário não funciona: 00:00–23:59 deixa a loja Fechada no último
// minuto de todo dia, e 00:00–24:00 (horário que não existe) a deixava
// Fechada o dia INTEIRO — foi ao ar assim em 29/08/2026.
//
// Aqui o que importa é a outra ponta: a lojista precisa ligar isso sem
// preencher sete linhas, e desligar sem perder o que já preencheu.
//
// react-test-renderer direto, e não @testing-library/react-native: o
// moduleNameMapper aponta react-native -> react-native-web, e o RTL quebra
// ao detectar os host components ("children.indexOf is not a function").
// Sob react-native-web o testID vira data-testid — mesmo padrão de
// barraInferiorDoDojo.test.tsx.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

// react-native-svg não passa pelo transformIgnorePatterns. A tela puxa svg
// por dois caminhos (Icon e shared.tsx), então mocka-se a raiz uma vez só.
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

const HORARIO_COMERCIAL = {
  seg: { open: "09:00", close: "18:00", closed: false },
  ter: { open: "09:00", close: "18:00", closed: false },
  qua: { open: "09:00", close: "18:00", closed: false },
  qui: { open: "09:00", close: "18:00", closed: false },
  sex: { open: "09:00", close: "18:00", closed: false },
  sab: { open: "09:00", close: "13:00", closed: false },
  dom: { open: "", close: "", closed: true },
};

function nos(arvore: any): any[] {
  const out: any[] = [];
  const anda = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(anda);
    out.push(n);
    if (n.children) anda(n.children);
  };
  anda(arvore);
  return out;
}
const temTestId = (arvore: any, id: string) =>
  nos(arvore).some((n) => n.props && n.props["data-testid"] === id);

function montar(config: any = {}) {
  const saveConfig = jest.fn().mockResolvedValue({});
  let r: any;
  act(() => {
    r = renderer.create(
      <TabEntrega
        config={{ business_hours: HORARIO_COMERCIAL, ...config }}
        saveConfig={saveConfig}
        isSaving={false}
      />
    );
  });
  const temGrade = () => temTestId(r.toJSON(), "grade-de-horarios");
  const ligar = (v: boolean) => {
    const sw = r.root.findAllByProps({ testID: "toggle-24h" })[0];
    act(() => { sw.props.onValueChange(v); });
  };
  return { r, saveConfig, temGrade, ligar };
}

describe("a grade de horários some quando a loja é 24h", () => {
  test("desligado: a grade está lá", () => {
    expect(montar({ always_open: false }).temGrade()).toBe(true);
  });

  test("ligado: a grade some — não faz sentido preencher os dois", () => {
    expect(montar({ always_open: true }).temGrade()).toBe(false);
  });

  test("base sem a migration 310 (always_open undefined) mostra a grade", () => {
    expect(montar({}).temGrade()).toBe(true);
  });
});

describe("ligar o 24h salva o estado, não uma grade de horário", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("manda always_open: true e esconde a grade na hora", () => {
    const { saveConfig, temGrade, ligar } = montar({ always_open: false });
    ligar(true);
    expect(temGrade()).toBe(false);
    act(() => { jest.advanceTimersByTime(900); });
    expect(saveConfig).toHaveBeenCalledWith({ always_open: true });
  });

  test("NÃO manda business_hours junto — a grade da lojista fica intacta", () => {
    // Se um dia isso virar `{ always_open: true, business_hours: {...} }`
    // com sete dias de 00:00–23:59, voltamos ao bug pelo caminho longo.
    const { saveConfig, ligar } = montar({ always_open: false });
    ligar(true);
    act(() => { jest.advanceTimersByTime(900); });
    expect(Object.keys(saveConfig.mock.calls[0][0])).toEqual(["always_open"]);
  });

  test("desligar volta a grade com o horário que já estava lá", () => {
    const { saveConfig, temGrade, ligar } = montar({ always_open: true });
    expect(temGrade()).toBe(false);
    ligar(false);
    act(() => { jest.advanceTimersByTime(900); });
    expect(saveConfig).toHaveBeenCalledWith({ always_open: false });
    expect(temGrade()).toBe(true);
  });
});
