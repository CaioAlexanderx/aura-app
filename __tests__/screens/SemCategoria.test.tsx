// ============================================================
// AURA. — Produtos sem categoria: atribuição em lote (F0)
//
// O que estes testes provam:
//   1. O lote vai com `mode: 'replace_primary'`. O contrato §4 avisa que
//      `add_secondary`/`DO NOTHING` de primária FALHA EM SILÊNCIO num
//      produto que já tem primária — 200, e nada muda. Se alguém trocar
//      o modo, este teste quebra.
//   2. Aplicar manda TODOS os marcados numa chamada só — 1.183 produtos
//      não se resolvem em 1.183 requests.
//   3. Aplicar sem destino ou sem seleção não chama nada.
//   4. "Marcar visíveis" marca o que está na tela, e a seleção some
//      depois de aplicar (senão o lojista reaplica sem perceber).
//   5. Sem árvore, a tela manda criar categoria em vez de oferecer um
//      lote sem destino possível.
//
// Mesmo padrão do C1/C2: react-native e hooks mockados, sem rede.
// ============================================================
import TestRenderer, { act } from "react-test-renderer";
import React from "react";

jest.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView",
  TextInput: "TextInput", ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s }, Platform: { OS: "web" },
}));

jest.mock("@/constants/colors", () => ({
  useColors: () => ({ bg: "#060816", bg3: "#0e1228", ink: "#f0edff", ink3: "#aaa", border: "#222" }),
}));

// O prefixo `mock` e obrigatorio: jest.mock nao pode referenciar
// variavel de fora do escopo sem ele.
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), push: mockPush }) }));

jest.mock("@/hooks/useCategories", () => ({ useCategories: jest.fn() }));
jest.mock("@/hooks/useUnclassifiedProducts", () => ({ useUnclassifiedProducts: jest.fn() }));

import SemCategoriaScreen from "@/app/catalogo/sem-categoria";
import { useCategories } from "@/hooks/useCategories";
import { useUnclassifiedProducts } from "@/hooks/useUnclassifiedProducts";

const mockCats = useCategories as unknown as jest.Mock;
const mockUnc = useUnclassifiedProducts as unknown as jest.Mock;

const BOTAS = { id: "cat-botas", name: "Botas", path: "/feminino/botas", depth: 1 } as any;

const PRODUTOS = [
  { id: "p-1", name: "Bota Cano Curto", stock_qty: 3 },
  { id: "p-2", name: "Bota Cano Longo", stock_qty: 0 },
  { id: "p-3", name: "Sandália Rasteira", stock_qty: 7 },
];

function montar(over: { categorias?: any[]; produtos?: any[] } = {}) {
  const atribuirEmLote = jest.fn().mockResolvedValue({ updated: 3 });

  mockCats.mockReturnValue({
    flattened: over.categorias ?? [BOTAS],
    isLoading: false,
  });
  mockUnc.mockReturnValue({
    produtos: over.produtos ?? PRODUTOS,
    total: (over.produtos ?? PRODUTOS).length,
    isLoading: false,
    refetch: jest.fn(),
    atribuirEmLote,
    isAtribuindo: false,
  });

  let r: any;
  act(() => { r = TestRenderer.create(<SemCategoriaScreen />); });
  return { r, atribuirEmLote };
}

function textos(r: any): string[] {
  return r.root.findAllByType("Text")
    .map((n: any) => (Array.isArray(n.props.children) ? n.props.children.join("") : String(n.props.children ?? "")))
    .filter(Boolean);
}

function acharPressable(r: any, texto: string) {
  return r.root.findAllByType("Pressable").find((p: any) => {
    const kids = Array.isArray(p.props.children) ? p.props.children : [p.props.children];
    return kids.some((k: any) => {
      const t = k?.props?.children;
      return typeof t === "string" ? t.includes(texto) : Array.isArray(t) && t.join("").includes(texto);
    });
  });
}

describe("Produtos sem categoria — atribuição em lote", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test("aplica em UMA chamada, com replace_primary", async () => {
    const { r, atribuirEmLote } = montar();

    act(() => { acharPressable(r, "marcar visíveis").props.onPress(); });
    const destino = acharPressable(r, "feminino › botas") || acharPressable(r, "Botas");
    act(() => { destino.props.onPress(); });
    await act(async () => { await acharPressable(r, "Mover").props.onPress(); });

    expect(atribuirEmLote).toHaveBeenCalledTimes(1);
    const [ids, catId, mode] = atribuirEmLote.mock.calls[0];
    // Os três de uma vez — 1.183 produtos não viram 1.183 requests.
    expect(ids.sort()).toEqual(["p-1", "p-2", "p-3"]);
    expect(catId).toBe("cat-botas");
    // O contrato §4 avisa que o outro modo falha em silêncio.
    expect(mode).toBe("replace_primary");
  });

  test("a seleção some depois de aplicar", async () => {
    const { r } = montar();

    act(() => { acharPressable(r, "marcar visíveis").props.onPress(); });
    expect(textos(r).some((t) => t.includes("3 marcado(s)"))).toBe(true);

    act(() => { (acharPressable(r, "feminino › botas") || acharPressable(r, "Botas")).props.onPress(); });
    await act(async () => { await acharPressable(r, "Mover").props.onPress(); });

    // Senão o lojista reaplica o mesmo lote sem perceber.
    expect(textos(r).some((t) => t.includes("marcado(s)"))).toBe(false);
  });

  test("sem destino escolhido não chama nada", async () => {
    const { r, atribuirEmLote } = montar();

    act(() => { acharPressable(r, "marcar visíveis").props.onPress(); });
    await act(async () => { await acharPressable(r, "Escolha produtos e destino").props.onPress(); });

    expect(atribuirEmLote).not.toHaveBeenCalled();
  });

  test("sem produto marcado não chama nada", async () => {
    const { r, atribuirEmLote } = montar();

    act(() => { (acharPressable(r, "feminino › botas") || acharPressable(r, "Botas")).props.onPress(); });
    await act(async () => { await acharPressable(r, "Escolha produtos e destino").props.onPress(); });

    expect(atribuirEmLote).not.toHaveBeenCalled();
  });

  test("sem árvore, manda criar categoria em vez de oferecer lote sem destino", () => {
    const { r } = montar({ categorias: [] });

    expect(textos(r).some((t) => t.includes("ainda não tem categorias"))).toBe(true);

    act(() => { acharPressable(r, "Organizar catálogo").props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith("/catalogo/organizar");
  });

  test("lista vazia diz que o catálogo está coberto", () => {
    const { r } = montar({ produtos: [] });
    expect(textos(r).some((t) => t.includes("catálogo está coberto"))).toBe(true);
  });
});
