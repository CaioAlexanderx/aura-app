// ============================================================
// FornecedorFormSheet (A2 do "Chegou mercadoria", 17/11/2026).
// Sem a prop `noPasso`, /fornecedores segue igual: folha própria, X,
// "Salvar e cadastrar outro", "Salvar" e "Abrir" no CNPJ já cadastrado.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
let mockSheetAberta = 0;
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: ({ children, visible }: any) => {
    if (visible) mockSheetAberta++;
    return visible ? children : null;
  },
}));
const mockLookup = jest.fn();
const mockCreate = jest.fn();
jest.mock("@/services/suppliersApi", () => ({
  suppliersApi: { lookupCnpj: (...a: any[]) => mockLookup(...a), create: (...a: any[]) => mockCreate(...a), update: jest.fn() },
}));

import { FornecedorFormSheet } from "@/components/fornecedores/FornecedorFormSheet";

const porId = (tree: any, id: string) => tree.root.findAll((n: any) => n.props && n.props.testID === id, { deep: false });
const tem = (tree: any, id: string) => porId(tree, id).length > 0;

async function montar(extra: Record<string, unknown> = {}) {
  let tree: any;
  const props = { visible: true, companyId: "c1", supplier: null, onClose: jest.fn(), onSalvo: jest.fn(), onAbrirExistente: jest.fn(), ...extra };
  await act(async () => { tree = renderer.create(<FornecedorFormSheet {...(props as any)} />); });
  return { tree, props };
}

beforeEach(() => {
  mockSheetAberta = 0;
  mockLookup.mockReset();
  mockCreate.mockReset();
});

test("sem noPasso: folha, X, 'Salvar e cadastrar outro', 'Salvar' e 'Abrir'", async () => {
  mockLookup.mockResolvedValue({ cnpj: "11222333000181", existing: { id: "f-1", name: "Alfa" } });
  const { tree, props } = await montar();
  expect(mockSheetAberta).toBeGreaterThan(0);
  expect(tem(tree, "fornecedor-form-fechar")).toBe(true);
  expect(tem(tree, "fornecedor-form-salvar-outro")).toBe(true);
  expect(tem(tree, "fornecedor-form-no-passo")).toBe(false);
  expect(JSON.stringify(tree.toJSON())).toContain("\"Salvar\"");
  await act(async () => { porId(tree, "fornecedor-form-cnpj")[0].props.onChangeText("11.222.333/0001-81"); });
  await act(async () => { await new Promise((x) => setTimeout(x, 0)); });
  expect(tem(tree, "fornecedor-form-usar-existente")).toBe(false);
  await act(async () => { porId(tree, "fornecedor-form-abrir-existente")[0].props.onPress(); });
  expect(props.onAbrirExistente).toHaveBeenCalledWith("f-1");
});

test("sem noPasso: salvar chama onSalvo e fecha", async () => {
  mockCreate.mockResolvedValue({ id: "f-9", name: "Novo" });
  const { tree, props } = await montar();
  await act(async () => { porId(tree, "fornecedor-form-nome")[0].props.onChangeText("Novo"); });
  await act(async () => { porId(tree, "fornecedor-form-salvar")[0].props.onPress(); });
  expect(props.onSalvo).toHaveBeenCalled();
  expect(props.onClose).toHaveBeenCalled();
});

test("com noPasso: salvar chama onSalvo e NÃO fecha (o wizard decide)", async () => {
  mockCreate.mockResolvedValue({ id: "f-9", name: "Novo" });
  const onVoltar = jest.fn();
  const { tree, props } = await montar({
    noPasso: {
      rotuloSalvar: "Salvar e continuar", rotuloVoltar: "Voltar", rotuloUsar: (n: string) => "Usar " + n,
      rodape: "r", rodapeExistente: "re", onVoltar, onUsarExistente: jest.fn(),
    },
  });
  expect(mockSheetAberta).toBe(0);
  await act(async () => { porId(tree, "fornecedor-form-nome")[0].props.onChangeText("Novo"); });
  await act(async () => { porId(tree, "fornecedor-form-salvar")[0].props.onPress(); });
  expect(props.onSalvo).toHaveBeenCalled();
  expect(props.onClose).not.toHaveBeenCalled();
  await act(async () => { porId(tree, "fornecedor-form-voltar")[0].props.onPress(); });
  expect(onVoltar).toHaveBeenCalled();
});
