// ============================================================
// useMenosMovimento (25/11/2026, movimento do crediário)
//
// Web: prefers-reduced-motion pelo matchMedia, acompanhando a mudança.
// Nativo: AccessibilityInfo.isReduceMotionEnabled + "reduceMotionChanged".
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { AccessibilityInfo, Platform } from "react-native";
import { duracao, useMenosMovimento } from "@/constants/motion";

let valor: boolean | null = null;
function Sonda() {
  valor = useMenosMovimento();
  return null;
}

function montar() {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<Sonda />); });
  return t;
}

const matchMediaOriginal = (window as any).matchMedia;

afterEach(() => {
  (window as any).matchMedia = matchMediaOriginal;
  (Platform as any).OS = "web";
  jest.restoreAllMocks();
  valor = null;
});

describe("useMenosMovimento no web", () => {
  function consulta(matches: boolean) {
    const ouvintes: ((e: { matches: boolean }) => void)[] = [];
    const mq = {
      matches,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: jest.fn((_: string, f: any) => ouvintes.push(f)),
      removeEventListener: jest.fn(),
    };
    (window as any).matchMedia = jest.fn(() => mq);
    return { mq, mudar: (m: boolean) => ouvintes.forEach((f) => f({ matches: m })) };
  }

  test("lê a preferência já no primeiro render", () => {
    consulta(true);
    montar();
    expect(valor).toBe(true);
    expect((window as any).matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  test("sem a preferência é false, e acompanha a mudança com a tela aberta", () => {
    const { mudar, mq } = consulta(false);
    const t = montar();
    expect(valor).toBe(false);
    act(() => { mudar(true); });
    expect(valor).toBe(true);
    act(() => { t.unmount(); });
    expect(mq.removeEventListener).toHaveBeenCalled();
  });

  test("navegador sem matchMedia: false, sem quebrar", () => {
    (window as any).matchMedia = undefined;
    montar();
    expect(valor).toBe(false);
  });
});

describe("useMenosMovimento no nativo", () => {
  test("pergunta ao AccessibilityInfo e ouve reduceMotionChanged", async () => {
    (Platform as any).OS = "ios";
    let ouvinte: ((v: boolean) => void) | null = null;
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true as any);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((_: string, f: any) => {
      ouvinte = f;
      return { remove };
    }) as any);
    (window as any).matchMedia = jest.fn(() => { throw new Error("não é para usar no nativo"); });

    const t = montar();
    await act(async () => { await Promise.resolve(); });
    expect(valor).toBe(true);
    expect(AccessibilityInfo.addEventListener).toHaveBeenCalledWith("reduceMotionChanged", expect.any(Function));

    act(() => { ouvinte!(false); });
    expect(valor).toBe(false);

    act(() => { t.unmount(); });
    expect(remove).toHaveBeenCalled();
  });
});

test("duracao: 0 com menos movimento, a de sempre sem", () => {
  expect(duracao(280, true)).toBe(0);
  expect(duracao(280, false)).toBe(280);
});
