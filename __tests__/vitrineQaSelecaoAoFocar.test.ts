// ============================================================
// QA 27/09 · P0: a quantidade digitada virava outro número no desktop.
//
// No Chrome, o clique simples no campo (valor 1) deixava o cursor no
// começo sem seleção: "50" virava "501". A regra de ligarSelecaoAoFocar:
// o mouseup do clique que DÁ o foco não mexe na seleção; o seguinte,
// com o campo já focado, posiciona o cursor normalmente.
// ============================================================
import { ligarSelecaoAoFocar } from "@/components/studio/storefront/ui/selecaoAoFocar";
import { quantidadeDigitada, quantidadeValida } from "@/components/studio/storefront/produto/regrasDaPagina";

function campo(valor: string) {
  const el = document.createElement("input");
  el.value = valor;
  document.body.appendChild(el);
  const desligar = ligarSelecaoAoFocar(el);
  return { el, desligar };
}

function clicar(el: HTMLInputElement) {
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  el.focus();
  const solto = new MouseEvent("mouseup", { bubbles: true, cancelable: true });
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

  test("segundo clique, com o campo já focado, posiciona o cursor (não segura)", () => {
    const { el } = campo("50");
    clicar(el);
    const segundo = clicar(el);
    expect(segundo.defaultPrevented).toBe(false);
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

describe("a regra da quantidade continua a mesma", () => {
  test("só dígitos, e o mínimo é 1", () => {
    expect(quantidadeDigitada("5a0")).toBe("50");
    expect(quantidadeValida("0")).toBe(1);
    expect(quantidadeValida("25")).toBe(25);
  });
});
