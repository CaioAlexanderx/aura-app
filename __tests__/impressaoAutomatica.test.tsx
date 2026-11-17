// p-159 (17/11/2026): impressão automática do cupom — escolha por aparelho.
import React from "react";
import {
  chaveDoAparelho, escolhaPadrao, lerEscolhaDoAparelho, gravarEscolhaDoAparelho,
  imprimeNesteAparelho, lerImpressaoAutomaticaLigada, textoDaEscolha, TEXTOS_DA_IMPRESSAO,
} from "@/utils/impressaoAutomatica";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRoot } = require("react-dom/client") as { createRoot: (el: Element) => Root };
type Root = { render: (n: React.ReactNode) => void; unmount: () => void };
const act = (React as any).act as (fn: () => void | Promise<void>) => Promise<void>;

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));

beforeEach(() => { try { localStorage.clear(); } catch {} });

describe("utils/impressaoAutomatica", () => {
  test("padrão: computador imprime, celular não", () => {
    expect(escolhaPadrao(false)).toBe("imprimir");
    expect(escolhaPadrao(true)).toBe("nao");
    expect(lerEscolhaDoAparelho("co-1", false)).toBe("imprimir");
    expect(lerEscolhaDoAparelho("co-1", true)).toBe("nao");
  });
  test("a escolha gravada vale por loja", () => {
    gravarEscolhaDoAparelho("co-1", "nao");
    expect(localStorage.getItem(chaveDoAparelho("co-1"))).toBe("nao");
    expect(lerEscolhaDoAparelho("co-1", false)).toBe("nao");
    expect(lerEscolhaDoAparelho("co-2", false)).toBe("imprimir");
  });
  test("valor estranho no navegador cai no padrão", () => {
    localStorage.setItem(chaveDoAparelho("co-1"), "talvez");
    expect(lerEscolhaDoAparelho("co-1", true)).toBe("nao");
  });
  test("imprime só com a loja ligada e o aparelho em Imprimir aqui", () => {
    expect(lerImpressaoAutomaticaLigada(undefined)).toBe(false);
    expect(lerImpressaoAutomaticaLigada({ auto_print_receipt: true } as any)).toBe(true);
    expect(imprimeNesteAparelho({} as any, "co-1", false)).toBe(false);
    expect(imprimeNesteAparelho({ auto_print_receipt: true } as any, "co-1", false)).toBe(true);
    expect(imprimeNesteAparelho({ auto_print_receipt: true } as any, "co-1", true)).toBe(false);
    gravarEscolhaDoAparelho("co-1", "imprimir");
    expect(imprimeNesteAparelho({ auto_print_receipt: true } as any, "co-1", true)).toBe(true);
  });
  test("textos por aparelho e escolha", () => {
    expect(textoDaEscolha("nao", true)).toBe(TEXTOS_DA_IMPRESSAO.celularNao);
    expect(textoDaEscolha("imprimir", false)).toBe(TEXTOS_DA_IMPRESSAO.computadorImprime);
  });
});

describe("ImpressaoNesteAparelho", () => {
  test("celular nasce em Neste aparelho não; tocar em Imprimir aqui grava", async () => {
    const { ImpressaoNesteAparelho } = require("@/components/screens/configuracoes/ImpressaoNesteAparelho");
    const div = document.createElement("div");
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => { root.render(React.createElement(ImpressaoNesteAparelho, { companyId: "co-9", celular: true })); });
    expect(div.textContent).toContain("Neste celular");
    expect(div.textContent).toContain(TEXTOS_DA_IMPRESSAO.celularNao);
    const botao = div.querySelector('[data-testid="impressao-aparelho-imprimir"]') as HTMLElement;
    expect(botao).toBeTruthy();
    await act(async () => { botao.click(); });
    expect(localStorage.getItem(chaveDoAparelho("co-9"))).toBe("imprimir");
    expect(div.textContent).toContain(TEXTOS_DA_IMPRESSAO.celularImprime);
    await act(async () => { root.unmount(); });
  });
});

describe("ajuda: imprimir sem a janela (p-161)", () => {
  const A = require("@/components/screens/configuracoes/textosDaAjudaSemJanela");

  test("os endereços levam a impressão direta e o app", () => {
    for (const c of [A.COMANDO_CHROME_WINDOWS, A.COMANDO_EDGE_WINDOWS, A.COMANDO_CHROME_MAC]) {
      expect(c).toContain("--kiosk-printing https://app.getaura.com.br");
    }
    const barra = String.fromCharCode(92);
    expect(A.COMANDO_CHROME_WINDOWS.startsWith('"C:' + barra + "Program Files" + barra + "Google" + barra + "Chrome" + barra + "Application" + barra + 'chrome.exe"')).toBe(true);
  });

  test("Mac só no Mac (iPad fica de fora)", () => {
    expect(A.ehMac({ platform: "MacIntel", userAgent: "Mozilla/5.0 (Macintosh)" })).toBe(true);
    expect(A.ehMac({ platform: "Win32", userAgent: "Mozilla/5.0 (Windows NT 10.0)" })).toBe(false);
    expect(A.ehMac({ platform: "MacIntel", userAgent: "Mozilla/5.0 (iPad)" })).toBe(false);
  });

  async function montar(props: any) {
    const { ImpressaoNesteAparelho } = require("@/components/screens/configuracoes/ImpressaoNesteAparelho");
    const div = document.createElement("div");
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => { root.render(React.createElement(ImpressaoNesteAparelho, props)); });
    return { div, root };
  }

  test("computador que imprime: o link aparece e abre o passo a passo", async () => {
    const { div, root } = await montar({ companyId: "co-7", celular: false });
    const link = div.querySelector('[data-testid="impressao-ajuda-sem-janela"]') as HTMLElement;
    expect(link).toBeTruthy();
    expect(link.textContent).toBe(A.TEXTOS_DA_AJUDA.link);
    await act(async () => { link.click(); });
    expect(document.body.textContent).toContain(A.TEXTOS_DA_AJUDA.passo1Titulo);
    expect(document.body.textContent).toContain(A.TEXTOS_DA_AJUDA.aviso);
    await act(async () => { root.unmount(); });
  });

  test("Neste aparelho não, ou no celular: sem link", async () => {
    gravarEscolhaDoAparelho("co-8", "nao");
    const a = await montar({ companyId: "co-8", celular: false });
    expect(a.div.querySelector('[data-testid="impressao-ajuda-sem-janela"]')).toBeNull();
    await act(async () => { a.root.unmount(); });
    const b = await montar({ companyId: "co-9", celular: true });
    expect(b.div.querySelector('[data-testid="impressao-ajuda-sem-janela"]')).toBeNull();
    await act(async () => { b.root.unmount(); });
  });
});
