// ============================================================
// Estoque só consulta (permissão estoque_consulta, 30/10/2026).
//
// O que estes testes seguram:
// 1. a regra: dono, admin e permissions null nunca são restringidos; com as
//    duas chaves, vale consulta; consolidado segue a interseção do backend;
// 2. o módulo: vale no Essencial, não abre Black Friday nem Fornecedores, e
//    Fornecedores continua igual para quem tem Estoque;
// 3. a tela: em consulta, nenhum R$ e nenhuma ação; sem a prop, igual a antes.
// ============================================================
jest.mock("@/services/api", () => ({ request: jest.fn(), companiesApi: { variants: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "c1" } }) }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn(() => ({ data: undefined, isLoading: false, isError: false })) }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/ProductImageUpload", () => ({ ProductImageUpload: "ProductImageUpload" }));

import React from "react";
import { Pressable, Text } from "react-native";
import renderer, { act } from "react-test-renderer";
import { useQuery } from "@tanstack/react-query";
import { computeVisibleModules, MODULE_PLAN_MAP } from "@/hooks/useVisibleModules";
import { alternarPermissao, estaEmConsulta, ordemSemPreco, ordensSemPreco } from "@/utils/estoqueConsulta";
import { ORDENS_ESTOQUE } from "@/utils/productSort";
import { ProductRow } from "@/components/screens/estoque/ProductRow";
import { AlertsList } from "@/components/screens/estoque/AlertsList";
import { rotuloDaVariante, VariantesConsulta } from "@/components/screens/estoque/VariantesConsulta";

const PRODUTO: any = {
  id: "p1", name: "Vestido", code: "V1", barcode: "789", category: "Roupas",
  price: 120, cost: 50, stock: 1, minStock: 2, unit: "un", brand: "", notes: "",
  color: "", size: "", has_variants: false,
};

function textos(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(Text as any)
    .map((t) => [].concat(t.props.children).filter((c) => typeof c === "string" || typeof c === "number").join(""))
    .join(" | ");
}

function montar(el: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(el); });
  return tree;
}

function abrirDetalhe(tree: renderer.ReactTestRenderer) {
  act(() => { tree.root.findAllByType(Pressable as any)[0].props.onPress(); });
}

describe("regra", () => {
  const permissions = { estoque_consulta: true };

  test("dono, admin e permissions null nunca são restringidos", () => {
    expect(estaEmConsulta(undefined)).toBe(false);
    expect(estaEmConsulta({ is_owner: true, permissions })).toBe(false);
    expect(estaEmConsulta({ is_owner: false, role: "admin", permissions })).toBe(false);
    expect(estaEmConsulta({ is_owner: false, role: "Estoque", permissions: null })).toBe(false);
    expect(estaEmConsulta({ is_owner: false, role: "Caixa", permissions: { pdv: true } })).toBe(false);
  });

  test("funcionário em consulta, e as duas chaves juntas valem consulta", () => {
    expect(estaEmConsulta({ is_owner: false, role: "Estoque", permissions })).toBe(true);
    expect(estaEmConsulta({ is_owner: false, role: "Gerente", permissions: { estoque: true, estoque_consulta: true } })).toBe(true);
  });

  test("consolidado: a interseção vem como papel member", () => {
    expect(estaEmConsulta({ is_owner: false, role: "member", permissions, consolidated_view: true })).toBe(true);
  });

  test("no seletor, ligar uma chave desliga a outra", () => {
    expect(alternarPermissao({ estoque: true }, "estoque_consulta")).toEqual({ estoque: false, estoque_consulta: true });
    expect(alternarPermissao({ estoque_consulta: true }, "estoque")).toEqual({ estoque: true, estoque_consulta: false });
    expect(alternarPermissao({ pdv: true }, "clientes")).toEqual({ pdv: true, clientes: true });
  });

  test("ordenação por preço some e a escolha salva cai no padrão", () => {
    expect(ordensSemPreco(ORDENS_ESTOQUE)).not.toContain("price_desc");
    expect(ordensSemPreco(ORDENS_ESTOQUE)).not.toContain("price_asc");
    expect(ordemSemPreco("price_desc", "recent")).toBe("recent");
    expect(ordemSemPreco("name_asc", "recent")).toBe("name_asc");
  });
});

describe("módulos", () => {
  const membro = (permissions: any) => ({ is_owner: false, role: "Estoque", permissions });

  test("consulta abre o Estoque no Essencial, sem Painel com o preset", () => {
    const v = computeVisibleModules("essencial", {}, membro({ painel: false, estoque_consulta: true }));
    expect(v.has("estoque")).toBe(true);
    expect(v.has("painel")).toBe(false);
  });

  test("consulta não abre Black Friday nem Fornecedores, nem com estoque junto", () => {
    for (const p of [{ estoque_consulta: true }, { estoque: true, estoque_consulta: true }]) {
      const v = computeVisibleModules("negocio", {}, membro(p));
      expect(v.has("estoque")).toBe(true);
      expect(v.has("black_friday")).toBe(false);
      expect(v.has("fornecedores")).toBe(false);
    }
  });

  test("Fornecedores segue o Estoque para todo mundo mais", () => {
    expect(MODULE_PLAN_MAP.fornecedores).toBe(MODULE_PLAN_MAP.estoque);
    expect(computeVisibleModules("essencial", {}, undefined).has("fornecedores")).toBe(true);
    expect(computeVisibleModules("essencial", {}, membro({ estoque: true })).has("fornecedores")).toBe(true);
    expect(computeVisibleModules("essencial", {}, membro({ pdv: true })).has("fornecedores")).toBe(false);
    expect(computeVisibleModules("essencial", { estoque: false }, undefined).has("fornecedores")).toBe(false);
  });
});

describe("linha do produto", () => {
  test("em consulta: sem R$, sem custo, sem margem e sem editar", () => {
    const tree = montar(<ProductRow product={PRODUTO} consulta />);
    abrirDetalhe(tree);
    const t = textos(tree);
    expect(t).not.toMatch(/R\$|Custo|Margem|Valor estoque|Editar|Excluir/);
    expect(t).toMatch(/Vestido/);
    expect(t).toMatch(/Estoque mínimo/);
    expect(tree.root.findAll((n) => (n.type as any) === "ProductImageUpload")).toHaveLength(0);
  });

  test("dono: igual a antes", () => {
    const tree = montar(<ProductRow product={PRODUTO} onEdit={jest.fn()} onDelete={jest.fn()} />);
    abrirDetalhe(tree);
    const t = textos(tree);
    expect(t).toMatch(/Custo/);
    expect(t).toMatch(/Margem/);
    expect(t).toMatch(/Valor estoque/);
    expect(t).toMatch(/Editar produto/);
    expect(t).toMatch(/Excluir/);
  });

  test("serviço em consulta: sem preço no detalhe", () => {
    const tree = montar(<ProductRow product={{ ...PRODUTO, unit: "srv" }} consulta />);
    abrirDetalhe(tree);
    expect(textos(tree)).not.toMatch(/R\$|Preço|Custo|Margem/);
  });
});

describe("alertas", () => {
  test("em consulta: quantidade e reposição, sem custo", () => {
    const t = textos(montar(<AlertsList products={[PRODUTO]} consulta />));
    expect(t).toMatch(/Vestido/);
    expect(t).toMatch(/Repor/);
    expect(t).not.toMatch(/R\$|Custo estimado/);
  });

  test("dono: mostra o custo de reposição", () => {
    expect(textos(montar(<AlertsList products={[PRODUTO]} />))).toMatch(/Custo estimado/);
  });
});

describe("variantes", () => {
  test("rótulo usa o nome da cor no lugar do hex", () => {
    expect(rotuloDaVariante({
      color_name: "Vinho",
      attributes: [{ attribute: "Cor", value: "#800000" }, { attribute: "Tamanho", value: "M" }],
    })).toBe("Vinho · M");
    expect(rotuloDaVariante({ sku_suffix: "P", attributes: [] })).toBe("P");
  });

  test("lista quantidade por variante, sem valores", () => {
    (useQuery as jest.Mock).mockReturnValueOnce({
      data: { variants: [{ id: "v1", stock_qty: 3, attributes: [{ attribute: "Tamanho", value: "P" }] }] },
      isLoading: false, isError: false,
    });
    const t = textos(montar(<VariantesConsulta productId="p1" unit="un" />));
    expect(t).toMatch(/P/);
    expect(t).toMatch(/3/);
    expect(t).not.toMatch(/R\$/);
  });
});
