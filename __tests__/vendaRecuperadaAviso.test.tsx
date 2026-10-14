// ============================================================
// 14/10/2026: faixa "Venda recuperada (N itens)" do Caixa — o texto, a
// conferência de preço (só avisa) e o encaixe da faixa nos dois layouts.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import * as fs from "fs";
import * as path from "path";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));

import { algumPrecoMudou, tituloDaVendaRecuperada, TEXTO_CONFIRA_VALORES } from "@/utils/vendaRecuperada";
import { AvisoVendaRecuperada } from "@/components/screens/pdv/AvisoVendaRecuperada";

const raiz = path.resolve(__dirname, "..");
const fonte = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");

describe("tituloDaVendaRecuperada", () => {
  test("singular e plural", () => {
    expect(tituloDaVendaRecuperada(1)).toBe("Venda recuperada (1 item)");
    expect(tituloDaVendaRecuperada(3)).toBe("Venda recuperada (3 itens)");
  });
});

describe("algumPrecoMudou (confira os valores)", () => {
  const catalogo = [
    { id: "piso", price: 70 },
    { id: "cim", price: 38 },
  ];

  test("preço de tabela igual ao de hoje: não avisa", () => {
    expect(algumPrecoMudou([{ productId: "cim", price: 38, listPrice: 38 }], catalogo)).toBe(false);
  });

  test("preço de tabela diferente do catálogo de hoje: avisa", () => {
    expect(algumPrecoMudou([{ productId: "piso", price: 64.8, listPrice: 64.8 }], catalogo)).toBe(true);
  });

  test("o lápis do Caixa (price editado, listPrice igual) não dispara o aviso", () => {
    expect(algumPrecoMudou([{ productId: "cim", price: 30, listPrice: 38 }], catalogo)).toBe(false);
  });

  test("sem listPrice compara o price", () => {
    expect(algumPrecoMudou([{ productId: "piso", price: 64.8 }], catalogo)).toBe(true);
  });

  test("fora da comparação: variante, linha sem produto do cadastro e produto que sumiu", () => {
    expect(algumPrecoMudou([{ productId: "piso__v1", price: 1, listPrice: 1 }], catalogo)).toBe(false);
    expect(algumPrecoMudou([{ productId: "orcamento-q1-0", price: 1, listPrice: 1 }], catalogo)).toBe(false);
    expect(algumPrecoMudou([{ productId: "outro", price: 1, listPrice: 1 }], catalogo)).toBe(false);
  });

  test("catálogo ainda não carregou: não acusa nada", () => {
    expect(algumPrecoMudou([{ productId: "piso", price: 1, listPrice: 1 }], [])).toBe(false);
  });
});

describe("AvisoVendaRecuperada", () => {
  function texto(n: any): string {
    return (n.children || []).map((c: any) => (typeof c === "string" ? c : texto(c))).join("");
  }

  test("mostra o título e o Limpar; o confira só aparece quando há preço mudado", () => {
    const onLimpar = jest.fn();
    const onDispensar = jest.fn();
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<AvisoVendaRecuperada itens={2} onLimpar={onLimpar} onDispensar={onDispensar} />); });
    expect(texto(t.root.findByProps({ testID: "caixa-venda-recuperada-titulo" }))).toBe("Venda recuperada (2 itens)");
    expect(t.root.findAllByProps({ testID: "caixa-venda-recuperada-confira" })).toHaveLength(0);

    act(() => { t.root.findByProps({ testID: "caixa-venda-recuperada-limpar" }).props.onPress(); });
    expect(onLimpar).toHaveBeenCalledTimes(1);
    act(() => { t.root.findByProps({ testID: "caixa-venda-recuperada-dispensar" }).props.onPress(); });
    expect(onDispensar).toHaveBeenCalledTimes(1);

    act(() => { t.update(<AvisoVendaRecuperada itens={2} conferirValores onLimpar={onLimpar} onDispensar={onDispensar} />); });
    expect(texto(t.root.findByProps({ testID: "caixa-venda-recuperada-confira" }))).toBe(TEXTO_CONFIRA_VALORES);
  });
});

describe("encaixe no Caixa", () => {
  test("a faixa aparece nos dois layouts (web largo e mobile) e Limpar é a Nova venda", () => {
    const pdv = fonte("app/(tabs)/pdv.tsx");
    expect((pdv.match(/<AvisoVendaRecuperada/g) || []).length).toBe(2);
    expect(pdv).toMatch(/onLimpar=\{st\.limparVendaRecuperada\}/);
    const st = fonte("hooks/usePdvState.ts");
    expect(st).toMatch(/limparVendaRecuperada: newSale/);
  });

  test("Caixa aberto com ?quote= não restaura a venda guardada", () => {
    const st = fonte("hooks/usePdvState.ts");
    expect(st).toMatch(/useCart\(cardCfg, \{ recuperar: !quoteRouteParams\.quote \}\)/);
  });
});
