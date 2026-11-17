// ============================================================
// 17/11/2026 (p-153 / A1): atalhos do Caixa num mapa só.
//
// O que este arquivo trava:
//   1. o mapa: F1–F5 e Ctrl/⌘+K de sempre, cada um com a alternativa em Alt
//   2. AltGr (Ctrl+Alt no ABNT2) nunca é atalho; Alt compara pela posição da
//      tecla (e.code); ⌥+letra que escreve um caractere num campo (Mac) fica
//      com o campo
//   3. janela aberta e tela final: a tecla F é segurada e não faz nada;
//      Alt e Ctrl seguem para quem está na janela
//   4. nunca tecla solta, nunca Enter, nunca Tab
//   5. o listener único: respeita quem já tratou a tecla, segura a tecla do
//      Caixa e convive com o leitor de código de barras (um bipe nunca
//      dispara atalho)
//   6. os botões da barra não escutam mais o teclado sozinhos
// ============================================================
import React, { createRef } from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));

import {
  ATALHOS_DO_CAIXA, resolverAtalho, atalhoDaTecla, focoEmCampo,
  type TeclaDoCaixa, type EstadoDosAtalhos,
} from "@/utils/atalhosDoCaixa";
import { useAtalhosDoCaixa } from "@/hooks/useAtalhosDoCaixa";
import { useGlobalBarcodeScanner } from "@/hooks/useGlobalBarcodeScanner";
import { ActCoupon, ActPerson, ActBarcode, type AlternarHandle, type PersonPickerHandle } from "@/components/screens/pdv/ActionToolbar";

const LIVRE: EstadoDosAtalhos = { telaFinal: false, janelaAberta: false };
const JANELA: EstadoDosAtalhos = { telaFinal: false, janelaAberta: true };
const FINAL: EstadoDosAtalhos = { telaFinal: true, janelaAberta: false };

const tecla = (t: Partial<TeclaDoCaixa> & { key: string }): TeclaDoCaixa => t;
const acao = (t: TeclaDoCaixa, e: EstadoDosAtalhos = LIVRE) => resolverAtalho(t, e).acao;

describe("mapa de atalhos do Caixa", () => {
  test("F1–F5 de hoje, cada um com a alternativa em Alt", () => {
    const esperado: [string, string, string][] = [
      ["F1", "KeyM", "codigoManual"],
      ["F2", "KeyV", "vendedora"],
      ["F3", "KeyC", "cliente"],
      ["F4", "KeyU", "cupom"],
      ["F5", "KeyT", "troca"],
    ];
    for (const [f, alt, a] of esperado) {
      expect(acao(tecla({ key: f, code: f }))).toBe(a);
      const letra = alt.slice(3).toLowerCase();
      expect(acao(tecla({ key: letra, code: alt, altKey: true }))).toBe(a);
    }
  });

  test("Ctrl+K (Windows) e ⌘K (Mac) levam à busca", () => {
    expect(acao(tecla({ key: "k", code: "KeyK", ctrlKey: true }))).toBe("busca");
    expect(acao(tecla({ key: "k", code: "KeyK", metaKey: true }))).toBe("busca");
    expect(acao(tecla({ key: "K", code: "KeyK", ctrlKey: true, shiftKey: true }))).toBe("busca");
    // com o foco num campo também (é para onde a pessoa quer ir)
    expect(acao(tecla({ key: "k", code: "KeyK", ctrlKey: true, emCampo: true }))).toBe("busca");
  });

  test("cada tecla aparece uma vez só no mapa", () => {
    const vistas = new Set<string>();
    for (const a of ATALHOS_DO_CAIXA) for (const c of a.teclas) {
      const k = c.tipo + ":" + c.code;
      expect(vistas.has(k)).toBe(false);
      vistas.add(k);
    }
  });

  test("AltGr (Ctrl+Alt) nunca é atalho: AltGr+Q é a barra no ABNT2", () => {
    expect(atalhoDaTecla(tecla({ key: "/", code: "KeyQ", ctrlKey: true, altKey: true }))).toBeNull();
    expect(atalhoDaTecla(tecla({ key: "c", code: "KeyC", ctrlKey: true, altKey: true }))).toBeNull();
    // Ctrl+Alt+K não é o Ctrl+K
    expect(atalhoDaTecla(tecla({ key: "k", code: "KeyK", ctrlKey: true, altKey: true }))).toBeNull();
  });

  test("Mac: ⌥C chega como 'ç' — fora de campo é o atalho; dentro, é o ç do texto", () => {
    expect(acao(tecla({ key: "ç", code: "KeyC", altKey: true }))).toBe("cliente");
    expect(acao(tecla({ key: "ç", code: "KeyC", altKey: true, emCampo: true }))).toBeNull();
    expect(resolverAtalho(tecla({ key: "ç", code: "KeyC", altKey: true, emCampo: true }), LIVRE).segurar).toBe(false);
    // Windows: Alt+C no campo não escreve nada, e o atalho vale
    expect(acao(tecla({ key: "c", code: "KeyC", altKey: true, emCampo: true }))).toBe("cliente");
  });

  test("tecla F com modificador não é a tecla F do mapa", () => {
    expect(atalhoDaTecla(tecla({ key: "F5", code: "F5", ctrlKey: true }))).toBeNull(); // Ctrl+F5 do navegador
    expect(atalhoDaTecla(tecla({ key: "F4", code: "F4", altKey: true }))).toBeNull();  // Alt+F4
  });

  test("nunca tecla solta, nunca Enter, nunca Tab", () => {
    for (const k of ["c", "v", "m", "k", "1", "+", "Enter", "Tab", "Escape", " ", "ArrowDown"]) {
      const d = resolverAtalho(tecla({ key: k }), LIVRE);
      expect(d).toEqual({ acao: null, segurar: false });
    }
  });

  test("janela aberta: a tecla F é segurada e não faz nada; Alt e Ctrl ficam com a janela", () => {
    expect(resolverAtalho(tecla({ key: "F2", code: "F2" }), JANELA)).toEqual({ acao: null, segurar: true });
    expect(resolverAtalho(tecla({ key: "F5", code: "F5" }), JANELA)).toEqual({ acao: null, segurar: true });
    expect(resolverAtalho(tecla({ key: "c", code: "KeyC", altKey: true }), JANELA)).toEqual({ acao: null, segurar: false });
    expect(resolverAtalho(tecla({ key: "k", code: "KeyK", ctrlKey: true }), JANELA)).toEqual({ acao: null, segurar: false });
  });

  test("tela de venda concluída: F1–F5 seguradas (o F5 não recarrega a página)", () => {
    for (const f of ["F1", "F2", "F3", "F4", "F5"]) {
      expect(resolverAtalho(tecla({ key: f, code: f }), FINAL)).toEqual({ acao: null, segurar: true });
    }
  });

  test("tecla segurada (repeat) não repete a ação", () => {
    expect(resolverAtalho(tecla({ key: "F3", code: "F3", repeat: true }), LIVRE)).toEqual({ acao: null, segurar: true });
  });

  test("sem e.code (teclado virtual): cai no e.key", () => {
    expect(acao(tecla({ key: "F4" }))).toBe("cupom");
    expect(acao(tecla({ key: "k", ctrlKey: true }))).toBe("busca");
  });

  test("focoEmCampo", () => {
    const input = document.createElement("input");
    const div = document.createElement("div");
    expect(focoEmCampo(input)).toBe(true);
    expect(focoEmCampo(document.createElement("textarea"))).toBe(true);
    expect(focoEmCampo(div)).toBe(false);
    expect(focoEmCampo(null)).toBe(false);
  });
});

// ─── O listener único ─────────────────────────────────────────────
let agora = 1_000_000;
function disparar(init: KeyboardEventInit, alvo: EventTarget = window): KeyboardEvent {
  const ev = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(ev, "timeStamp", { value: agora });
  act(() => { alvo.dispatchEvent(ev); });
  return ev;
}

function Tela({ estado, executar, onScan }: { estado: EstadoDosAtalhos; executar: (a: any) => void; onScan?: (c: string) => void }) {
  useGlobalBarcodeScanner({ onScan: onScan || (() => {}), enabled: !!onScan });
  useAtalhosDoCaixa({ estado, executar });
  return null;
}

describe("useAtalhosDoCaixa", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    agora = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => agora);
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  test("F3 abre o cliente e segura a tecla; Alt+T abre a troca", () => {
    const executar = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Tela estado={LIVRE} executar={executar} />); });
    const ev = disparar({ key: "F3", code: "F3" });
    expect(ev.defaultPrevented).toBe(true);
    disparar({ key: "t", code: "KeyT", altKey: true });
    expect(executar.mock.calls.map(c => c[0])).toEqual(["cliente", "troca"]);
    act(() => { t.unmount(); });
  });

  test("tecla já tratada (defaultPrevented) não é atropelada", () => {
    const executar = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Tela estado={LIVRE} executar={executar} />); });
    const segura = (e: KeyboardEvent) => e.preventDefault();
    window.addEventListener("keydown", segura, true);
    disparar({ key: "F2", code: "F2" });
    window.removeEventListener("keydown", segura, true);
    expect(executar).not.toHaveBeenCalled();
    act(() => { t.unmount(); });
  });

  test("tela final: F5 é segurado e nada acontece", () => {
    const executar = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Tela estado={FINAL} executar={executar} />); });
    expect(disparar({ key: "F5", code: "F5" }).defaultPrevented).toBe(true);
    expect(executar).not.toHaveBeenCalled();
    act(() => { t.unmount(); });
  });

  test("desmontou: não escuta mais", () => {
    const executar = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Tela estado={LIVRE} executar={executar} />); });
    act(() => { t.unmount(); });
    expect(disparar({ key: "F2", code: "F2" }).defaultPrevented).toBe(false);
    expect(executar).not.toHaveBeenCalled();
  });

  test("um bipe nunca dispara atalho: o código chega inteiro ao leitor", () => {
    const executar = jest.fn();
    const onScan = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Tela estado={LIVRE} executar={executar} onScan={onScan} />); });
    // código com letras do mapa (C, V, M, T, U, K) e Enter no fim
    for (const ch of "CVMTUK7891") { disparar({ key: ch }); agora += 8; }
    disparar({ key: "Enter", code: "Enter" });
    expect(onScan).toHaveBeenCalledWith("CVMTUK7891");
    expect(executar).not.toHaveBeenCalled();
    // e um atalho logo depois do bipe vale normalmente
    disparar({ key: "F4", code: "F4" });
    expect(executar).toHaveBeenCalledWith("cupom");
    act(() => { t.unmount(); });
  });
});

// ─── Os botões não escutam mais o teclado ───────────────────────────
function abertos(t: renderer.ReactTestRenderer, titulo: string): number {
  return t.root.findAll((n: any) => n.props && n.props.children === titulo && typeof n.type !== "string").length;
}

describe("barra de ações: a tecla vem de fora, pelo ref", () => {
  test("F4 sozinho não abre o cupom; alternar() abre e fecha", () => {
    const ref = createRef<AlternarHandle>();
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(<ActCoupon ref={ref} value={null} onChange={jest.fn()} onValidate={jest.fn() as any} />);
    });
    disparar({ key: "F4", code: "F4" });
    expect(abertos(t, "Aplicar cupom de desconto")).toBe(0);
    act(() => { ref.current!.alternar(); });
    expect(abertos(t, "Aplicar cupom de desconto")).toBeGreaterThan(0);
    act(() => { ref.current!.alternar(); });
    expect(abertos(t, "Aplicar cupom de desconto")).toBe(0);
    act(() => { t.unmount(); });
  });

  test("F3 sozinho não abre o cliente; alternar() abre; desabilitado não abre", () => {
    const ref = createRef<PersonPickerHandle>();
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(<ActPerson ref={ref} kind="cliente" shortcut="F3" value={null} onChange={jest.fn()} options={[]} />);
    });
    disparar({ key: "F3", code: "F3" });
    expect(abertos(t, "Buscar cliente")).toBe(0);
    act(() => { ref.current!.alternar(); });
    expect(abertos(t, "Buscar cliente")).toBeGreaterThan(0);
    act(() => { t.unmount(); });

    const ref2 = createRef<PersonPickerHandle>();
    act(() => {
      t = renderer.create(<ActPerson ref={ref2} kind="cliente" shortcut="F3" value={null} onChange={jest.fn()} options={[]} disabled />);
    });
    act(() => { ref2.current!.alternar(); });
    expect(abertos(t, "Buscar cliente")).toBe(0);
    act(() => { t.unmount(); });
  });

  test("F1 sozinho não abre o código manual; alternar() abre", () => {
    const ref = createRef<AlternarHandle>();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<ActBarcode ref={ref} onScan={jest.fn()} />); });
    disparar({ key: "F1", code: "F1" });
    expect(abertos(t, "Entrada manual")).toBe(0);
    act(() => { ref.current!.alternar(); });
    expect(abertos(t, "Entrada manual")).toBeGreaterThan(0);
    act(() => { t.unmount(); });
  });
});
