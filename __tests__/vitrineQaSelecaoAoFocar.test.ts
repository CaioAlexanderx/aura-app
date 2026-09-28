// ============================================================
// QA 27/09 · P0: a quantidade digitada virava outro número no desktop.
//
// No Chrome, o clique simples no campo (valor 1) deixava o cursor no
// começo sem seleção: "50" virava "501".
//
// QA 28/09 · P1: com o campo JÁ focado, clicar de novo punha o cursor no
// meio ("25" depois de 50 virava 520; na sacola, 120 peças). A regra de
// ligarSelecaoAoFocar agora: todo clique sem arraste (menos de 4 px entre
// mousedown e mouseup) seleciona o número inteiro, focado ou não; o
// arraste continua selecionando só o trecho. E o teto aparece: acima de
// 999, o campo apara e avisa "Máximo de 999 por pedido".
// ============================================================
import { cliqueSemArraste, ligarSelecaoAoFocar, LIMITE_DO_ARRASTE_PX } from "@/components/studio/storefront/ui/selecaoAoFocar";
import {
  DIGITOS_DO_CAMPO, QTD_MAXIMA, notaDoTeto, quantidadeDigitada, quantidadeNoCampo, quantidadeValida,
} from "@/components/studio/storefront/produto/regrasDaPagina";

function campo(valor: string) {
  const el = document.createElement("input");
  el.value = valor;
  document.body.appendChild(el);
  const desligar = ligarSelecaoAoFocar(el);
  return { el, desligar };
}

function clicar(el: HTMLInputElement, de = { x: 10, y: 10 }, ate = de) {
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: de.x, clientY: de.y }));
  el.focus();
  const solto = new MouseEvent("mouseup", { bubbles: true, cancelable: true, clientX: ate.x, clientY: ate.y });
  el.dispatchEvent(solto);
  return solto;
}

afterEach(() => {
  (document.activeElement as HTMLElement | null)?.blur?.();
  document.body.innerHTML = "";
});

describe("o clique que dá o foco seleciona o número inteiro", () => {
  test("primeiro clique: seleção inteira e o mouseup não desfaz", () => {
    const { el } = campo("1");
    const solto = clicar(el);
    expect(solto.defaultPrevented).toBe(true);
    expect(el.selectionStart).toBe(0);
    expect(el.selectionEnd).toBe(1);
  });

  test("com 50 no campo, o clique seleciona os dois dígitos", () => {
    const { el } = campo("50");
    clicar(el);
    expect([el.selectionStart, el.selectionEnd]).toEqual([0, 2]);
  });

  test("segundo clique, com o campo JÁ focado, também seleciona tudo (QA 28/09: 50 + clique + 25 virava 520)", () => {
    const { el } = campo("50");
    clicar(el);
    el.setSelectionRange(1, 1); // o cursor ficou no meio
    const segundo = clicar(el, { x: 30, y: 12 });
    expect(segundo.defaultPrevented).toBe(true);
    expect([el.selectionStart, el.selectionEnd]).toEqual([0, 2]);
  });

  test("arrastar continua selecionando só o trecho (não segura o mouseup)", () => {
    const { el } = campo("520");
    clicar(el);
    const arraste = clicar(el, { x: 10, y: 10 }, { x: 10 + LIMITE_DO_ARRASTE_PX + 6, y: 10 });
    expect(arraste.defaultPrevented).toBe(false);
  });

  test("foco pelo teclado (Tab) também seleciona", () => {
    const { el } = campo("12");
    el.focus();
    expect([el.selectionStart, el.selectionEnd]).toEqual([0, 2]);
  });

  test("depois de desligar, o campo volta ao comportamento do navegador", () => {
    const { el, desligar } = campo("7");
    desligar();
    const solto = clicar(el);
    expect(solto.defaultPrevented).toBe(false);
  });
});

describe("clique ou arraste", () => {
  test("menos de 4 px é clique; 4 px ou mais é arraste", () => {
    expect(cliqueSemArraste({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(true);
    expect(cliqueSemArraste({ x: 10, y: 10 }, { x: 12, y: 12 })).toBe(true);
    expect(cliqueSemArraste({ x: 10, y: 10 }, { x: 14, y: 10 })).toBe(false);
    expect(cliqueSemArraste(null, { x: 1, y: 1 })).toBe(false);
  });
});

describe("o teto da quantidade", () => {
  test("acima de 999 apara no teto e avisa", () => {
    expect(QTD_MAXIMA).toBe(999);
    expect(quantidadeNoCampo("5201")).toEqual({ texto: "999", aparou: true });
    expect(quantidadeNoCampo("999")).toEqual({ texto: "999", aparou: false });
    expect(quantidadeNoCampo("0120")).toEqual({ texto: "120", aparou: false });
    expect(quantidadeNoCampo("")).toEqual({ texto: "", aparou: false });
  });
  test("o campo aceita um dígito a mais que o teto, para perceber o excesso", () => {
    expect(DIGITOS_DO_CAMPO).toBe(4);
  });
  test("a nota diz o máximo", () => {
    expect(notaDoTeto()).toBe("Máximo de 999 por pedido");
  });
});

describe("a regra da quantidade continua a mesma", () => {
  test("só dígitos, e o mínimo é 1", () => {
    expect(quantidadeDigitada("5a0")).toBe("50");
    expect(quantidadeValida("0")).toBe(1);
    expect(quantidadeValida("25")).toBe(25);
  });
});
