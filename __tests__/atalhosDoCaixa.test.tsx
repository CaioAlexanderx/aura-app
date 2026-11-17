// ============================================================
// 17/11/2026 (p-153 / A1): atalhos do Caixa num mapa só.
// 17/11/2026 (p-154 / A2): F6–F9, Alt+1…5, Esc, Enter/Esc/F9 e Ctrl/⌘+P na
// tela final, F8 em dois toques.
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
  ATALHOS_DO_CAIXA, resolverAtalho, atalhoDaTecla, focoEmCampo, focoEmBotao,
  criarDoisToques, PAGAMENTO_DO_ATALHO,
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

  test("cada tecla aparece uma vez só em cada tela", () => {
    const vistas = new Set<string>();
    for (const a of ATALHOS_DO_CAIXA) for (const c of a.teclas) {
      const k = a.onde + ":" + c.tipo + ":" + c.code;
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

  test("nunca tecla solta, nunca Enter sozinho, nunca Tab no Caixa", () => {
    for (const k of ["c", "v", "m", "k", "1", "+", "Enter", "Tab", " ", "ArrowDown"]) {
      const d = resolverAtalho(tecla({ key: k, code: k === "Enter" ? "Enter" : undefined }), LIVRE);
      expect(d).toEqual({ acao: null, segurar: false });
    }
    // Enter do teclado numérico e Shift+Enter também não finalizam
    expect(acao(tecla({ key: "Enter", code: "NumpadEnter" }))).toBeNull();
    expect(acao(tecla({ key: "Enter", code: "Enter", shiftKey: true }))).toBeNull();
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

// ─── Teclas novas (p-154 / A2) ─────────────────────────────────────
describe("teclas novas do Caixa", () => {
  const COM: EstadoDosAtalhos = { telaFinal: false, janelaAberta: false, temItens: true };
  const VAZIO: EstadoDosAtalhos = { telaFinal: false, janelaAberta: false, temItens: false };

  test("F6 busca (além do Ctrl/⌘+K), também com o foco num campo", () => {
    expect(acao(tecla({ key: "F6", code: "F6" }))).toBe("busca");
    expect(acao(tecla({ key: "F6", code: "F6", emCampo: true }))).toBe("busca");
  });

  test("F7/Alt+S desconto e F8/Alt+X remover só com item no carrinho", () => {
    expect(acao(tecla({ key: "F7", code: "F7" }), COM)).toBe("desconto");
    expect(acao(tecla({ key: "s", code: "KeyS", altKey: true }), COM)).toBe("desconto");
    expect(acao(tecla({ key: "F8", code: "F8" }), COM)).toBe("removerUltimo");
    expect(acao(tecla({ key: "x", code: "KeyX", altKey: true }), COM)).toBe("removerUltimo");
    // carrinho vazio: a tecla F é segurada e nada acontece; o Alt segue
    expect(resolverAtalho(tecla({ key: "F7", code: "F7" }), VAZIO)).toEqual({ acao: null, segurar: true });
    expect(resolverAtalho(tecla({ key: "x", code: "KeyX", altKey: true }), VAZIO)).toEqual({ acao: null, segurar: false });
  });

  test("finalizar: F9 e Ctrl/⌘+Enter (também o Enter do teclado numérico), nunca Enter sozinho", () => {
    expect(acao(tecla({ key: "F9", code: "F9" }), COM)).toBe("finalizar");
    expect(acao(tecla({ key: "Enter", code: "Enter", ctrlKey: true }), COM)).toBe("finalizar");
    expect(acao(tecla({ key: "Enter", code: "Enter", metaKey: true }), COM)).toBe("finalizar");
    expect(acao(tecla({ key: "Enter", code: "NumpadEnter", ctrlKey: true }), COM)).toBe("finalizar");
    // com o foco num campo (quantidade, desconto) também
    expect(acao(tecla({ key: "Enter", code: "Enter", ctrlKey: true, emCampo: true }), COM)).toBe("finalizar");
    expect(acao(tecla({ key: "Enter", code: "Enter" }), COM)).toBeNull();
    // Ctrl+Alt+Enter (AltGr) não
    expect(acao(tecla({ key: "Enter", code: "Enter", ctrlKey: true, altKey: true }), COM)).toBeNull();
    // janela aberta (o troco, por exemplo): F9 é segurado e não finaliza de novo
    expect(resolverAtalho(tecla({ key: "F9", code: "F9" }), { ...COM, janelaAberta: true })).toEqual({ acao: null, segurar: true });
  });

  test("Alt+1…5: Dinheiro, PIX, Débito, Crédito, Crediário", () => {
    const esperado = ["pagamento1", "pagamento2", "pagamento3", "pagamento4", "pagamento5"];
    for (let i = 1; i <= 5; i++) {
      expect(acao(tecla({ key: String(i), code: "Digit" + i, altKey: true }), COM)).toBe(esperado[i - 1]);
      expect(acao(tecla({ key: String(i), code: "Numpad" + i, altKey: true }), COM)).toBe(esperado[i - 1]);
    }
    expect(PAGAMENTO_DO_ATALHO.pagamento1).toBe(0);
    expect(PAGAMENTO_DO_ATALHO.pagamento5).toBe(4);
    // Alt+6 não é nada; número solto também não
    expect(acao(tecla({ key: "6", code: "Digit6", altKey: true }), COM)).toBeNull();
    expect(acao(tecla({ key: "1", code: "Digit1" }), COM)).toBeNull();
    // Mac: ⌥1 num campo escreve "¡" — fica com o campo
    expect(acao(tecla({ key: "¡", code: "Digit1", altKey: true, emCampo: true }), COM)).toBeNull();
    expect(acao(tecla({ key: "¡", code: "Digit1", altKey: true }), COM)).toBe("pagamento1");
  });

  test("Esc vai para 'fechar' e quem executa decide se segura (só se fechou algo)", () => {
    expect(resolverAtalho(tecla({ key: "Escape", code: "Escape" }), COM)).toEqual({ acao: "fechar", segurar: false });
    // com janela aberta também (o cadastro rápido não fecha sozinho)
    expect(resolverAtalho(tecla({ key: "Escape", code: "Escape" }), { ...COM, janelaAberta: true })).toEqual({ acao: "fechar", segurar: false });
    expect(acao(tecla({ key: "Esc" }), COM)).toBe("fechar");
  });

  describe("tela de venda concluída", () => {
    const AGORA = 1_000_000;
    const FIM: EstadoDosAtalhos = { telaFinal: true, janelaAberta: false, temItens: false, telaFinalDesde: AGORA - 1000 };
    const r = (t: TeclaDoCaixa, e: EstadoDosAtalhos = FIM) => resolverAtalho(t, e, AGORA);

    test("Enter, Esc e F9 começam a próxima venda", () => {
      expect(r(tecla({ key: "Enter", code: "Enter" }))).toEqual({ acao: "novaVenda", segurar: true });
      expect(r(tecla({ key: "Enter", code: "NumpadEnter" }))).toEqual({ acao: "novaVenda", segurar: true });
      expect(r(tecla({ key: "Escape", code: "Escape" }))).toEqual({ acao: "novaVenda", segurar: true });
      expect(r(tecla({ key: "F9", code: "F9" }))).toEqual({ acao: "novaVenda", segurar: true });
    });

    test("nos primeiros 250 ms nada pula a tela (o Enter do troco, o F9 segurado)", () => {
      const recem = { ...FIM, telaFinalDesde: AGORA - 100 };
      expect(r(tecla({ key: "Enter", code: "Enter" }), recem)).toEqual({ acao: null, segurar: true });
      expect(r(tecla({ key: "F9", code: "F9" }), recem)).toEqual({ acao: null, segurar: true });
      expect(r(tecla({ key: "Enter", code: "Enter", repeat: true }))).toEqual({ acao: null, segurar: true });
    });

    test("Enter num campo ou num botão é deles; Esc num botão começa a venda", () => {
      expect(r(tecla({ key: "Enter", code: "Enter", emCampo: true }))).toEqual({ acao: null, segurar: false });
      expect(r(tecla({ key: "Enter", code: "Enter", emBotao: true }))).toEqual({ acao: null, segurar: false });
      expect(r(tecla({ key: "Escape", code: "Escape", emCampo: true }))).toEqual({ acao: null, segurar: false });
      expect(r(tecla({ key: "Escape", code: "Escape", emBotao: true })).acao).toBe("novaVenda");
    });

    test("Ctrl/⌘+P imprime o cupom; as outras teclas F só são seguradas", () => {
      expect(r(tecla({ key: "p", code: "KeyP", ctrlKey: true }))).toEqual({ acao: "imprimir", segurar: true });
      expect(r(tecla({ key: "p", code: "KeyP", metaKey: true }))).toEqual({ acao: "imprimir", segurar: true });
      for (const f of ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8"]) {
        expect(r(tecla({ key: f, code: f }))).toEqual({ acao: null, segurar: true });
      }
      // no Caixa o Ctrl+P é do navegador
      expect(resolverAtalho(tecla({ key: "p", code: "KeyP", ctrlKey: true }), COM)).toEqual({ acao: null, segurar: false });
    });

    test("janela aberta por cima da tela final: nada", () => {
      const comJanela = { ...FIM, janelaAberta: true };
      expect(r(tecla({ key: "Enter", code: "Enter" }), comJanela)).toEqual({ acao: null, segurar: false });
      expect(r(tecla({ key: "Escape", code: "Escape" }), comJanela)).toEqual({ acao: null, segurar: false });
      expect(r(tecla({ key: "F9", code: "F9" }), comJanela)).toEqual({ acao: null, segurar: true });
    });

    test("letra e número soltos também não (o leitor manda o código antes do Enter)", () => {
      for (const k of ["7", "8", "a", "Tab"]) expect(r(tecla({ key: k }))).toEqual({ acao: null, segurar: false });
    });
  });

  test("dois toques: o segundo em até 2 s confirma; outro item ou depois de 2 s arma de novo", () => {
    const d = criarDoisToques(2000);
    expect(d.tocar("a", 1000)).toBe("armou");
    expect(d.armadoEm()).toBe("a");
    expect(d.tocar("a", 2500)).toBe("confirmou");
    expect(d.armadoEm()).toBeNull();
    expect(d.tocar("a", 5000)).toBe("armou");
    expect(d.tocar("a", 7100)).toBe("armou");
    expect(d.tocar("b", 7200)).toBe("armou");
    expect(d.tocar("a", 7300)).toBe("armou");
    d.desarmar();
    expect(d.tocar("a", 7400)).toBe("armou");
  });

  test("focoEmBotao", () => {
    const b = document.createElement("button");
    const div = document.createElement("div");
    const fake = document.createElement("div");
    fake.setAttribute("role", "button");
    expect(focoEmBotao(b)).toBe(true);
    expect(focoEmBotao(fake)).toBe(true);
    expect(focoEmBotao(div)).toBe(false);
    expect(focoEmBotao(document.createElement("a"))).toBe(true);
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

function Tela({ estado, executar, onScan }: { estado: EstadoDosAtalhos | (() => EstadoDosAtalhos); executar: (a: any) => any; onScan?: (c: string) => void }) {
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

  test("Esc só é segurado quando quem executa fechou algo", () => {
    let fechou = false;
    const executar = jest.fn(() => fechou);
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Tela estado={LIVRE} executar={executar} />); });
    expect(disparar({ key: "Escape", code: "Escape" }).defaultPrevented).toBe(false);
    fechou = true;
    expect(disparar({ key: "Escape", code: "Escape" }).defaultPrevented).toBe(true);
    expect(executar).toHaveBeenCalledWith("fechar");
    act(() => { t.unmount(); });
  });

  test("estado como função: lido na hora da tecla", () => {
    const executar = jest.fn();
    let final = false;
    let t!: renderer.ReactTestRenderer;
    act(() => {
      t = renderer.create(<Tela estado={(() => ({ telaFinal: final, janelaAberta: false, telaFinalDesde: 0 })) as any} executar={executar} />);
    });
    disparar({ key: "Enter", code: "Enter" });
    expect(executar).not.toHaveBeenCalled();
    final = true;
    disparar({ key: "Enter", code: "Enter" });
    expect(executar).toHaveBeenCalledWith("novaVenda");
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

  // 17/11/2026 (p-147): o leitor fica ligado na tela de venda concluída.
  test("tela final com o leitor ligado: o bipe chega inteiro e o Enter dele não é 'Nova venda'", () => {
    const executar = jest.fn();
    const onScan = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<Tela estado={FINAL} executar={executar} onScan={onScan} />); });
    for (const ch of "7890000000028") { disparar({ key: ch }); agora += 8; }
    const ev = disparar({ key: "Enter", code: "Enter" });
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith("7890000000028");
    expect(ev.defaultPrevented).toBe(true);
    expect(executar).not.toHaveBeenCalled();
    // Enter sozinho, sem rajada, continua sendo "Nova venda"
    agora += 1000;
    disparar({ key: "Enter", code: "Enter" });
    expect(executar).toHaveBeenCalledWith("novaVenda");
    expect(onScan).toHaveBeenCalledTimes(1);
    act(() => { t.unmount(); });
  });

  test("tela final, listener do leitor religado depois do dos atalhos: os dois ouvem o Enter do bipe", () => {
    // O leitor religa quando uma janela fecha (o troco). Aí os atalhos ouvem
    // primeiro e "Nova venda" sai junto com o bipe; quem garante uma venda
    // nova só é o usePdvState (lastSaleRef, ver __tests__/bipeNaTelaFinal).
    const executar = jest.fn();
    const onScan = jest.fn();
    function TelaInvertida() {
      useAtalhosDoCaixa({ estado: FINAL, executar });
      useGlobalBarcodeScanner({ onScan, enabled: true });
      return null;
    }
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<TelaInvertida />); });
    for (const ch of "7890000000028") { disparar({ key: ch }); agora += 8; }
    disparar({ key: "Enter", code: "Enter" });
    expect(onScan).toHaveBeenCalledWith("7890000000028");
    expect(executar).toHaveBeenCalledWith("novaVenda");
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
