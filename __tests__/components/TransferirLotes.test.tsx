// ============================================================
// Estoque · Transferir para outra loja: envio em lotes (10/11/2026).
//
// O backend aceita até 1.000 itens por POST. Para a lista caber no teste,
// o limite vira 4 aqui (o modal lê MAX_ITENS_POR_LOTE do módulo); a regra
// com 1.000 de verdade está em TransferirModal.test.tsx ("regras").
//   1. Seleção maior vai em partes, uma depois da outra, com progresso.
//   2. Parte que falha no meio: as anteriores ficam feitas e saem da lista.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  TextInput: "TextInput",
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  useWindowDimensions: () => ({ width: 1024, height: 800 }),
}));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/constants/colors", () => ({ Colors: new Proxy({}, { get: (_t, k) => String(k) }), IS_DARK_MODE: true }));
jest.mock("@/components/screens/estoque/VariantesConsulta", () => ({ rotuloDaVariante: () => "Variante" }));
jest.mock("@/services/api", () => ({ companiesApi: { variants: jest.fn() } }));
const mockCriar = jest.fn();
jest.mock("@/services/estoqueTransferenciasApi", () => ({
  estoqueTransferenciasApi: { criar: (...a: any[]) => mockCriar(...a) },
  codigoDoErro: (e: any) => (e && e.data && e.data.code) || null,
}));
jest.mock("@/utils/transferenciaEstoque", () => ({
  ...jest.requireActual("@/utils/transferenciaEstoque"),
  MAX_ITENS_POR_LOTE: 4,
}));

import { TransferirModal } from "@/components/screens/estoque/transferencia/TransferirModal";

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}
function porTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}
function um(tree: renderer.ReactTestRenderer, id: string) {
  const nos = porTestID(tree, id);
  expect(nos.length).toBeGreaterThan(0);
  return nos[0];
}
function textoDe(tree: renderer.ReactTestRenderer, id: string): string {
  return porTestID(tree, id).map((n) => flattenText(n.children)).join("");
}
async function tocar(tree: renderer.ReactTestRenderer, id: string) {
  await act(async () => { um(tree, id).props.onPress(); });
}

const DESTINO = { id: "c2", nome: "Loja Nova" };
const PRODUTOS = Array.from({ length: 10 }, (_, i) => ({ id: "m" + i, name: "Peça " + i, stock: 2, unit: "un" }));

async function montarPreenchido() {
  let tree!: renderer.ReactTestRenderer;
  const onConcluido = jest.fn();
  const onEstoqueMudou = jest.fn();
  await act(async () => {
    tree = renderer.create(
      <TransferirModal origem={{ id: "c1", nome: "Loja Centro" }} destinos={[DESTINO]} produtos={PRODUTOS}
        onFechar={jest.fn()} onConcluido={onConcluido} onEstoqueMudou={onEstoqueMudou} />,
    );
  });
  await act(async () => {
    PRODUTOS.forEach((p) => um(tree, "transferir-qtd-p:" + p.id).props.onChangeText("1"));
  });
  await tocar(tree, "transferir-revisar");
  return { tree, onConcluido, onEstoqueMudou };
}

beforeEach(() => mockCriar.mockReset());

it("divide a seleção em partes e mostra o progresso", async () => {
  const { tree, onConcluido } = await montarPreenchido();
  expect(textoDe(tree, "transferir-aviso-lotes")).toContain("vai em 3 partes de até 4");

  const resolvers: Array<(v: any) => void> = [];
  mockCriar.mockImplementation(() => new Promise((r) => { resolvers.push(r); }));
  await tocar(tree, "transferir-confirmar");
  expect(mockCriar).toHaveBeenCalledTimes(1);
  expect(mockCriar.mock.calls[0][1].itens.map((i: any) => i.product_id)).toEqual(["m0", "m1", "m2", "m3"]);
  expect(textoDe(tree, "transferir-rodape")).toBe("Enviando lote 1 de 3…");
  expect(porTestID(tree, "transferir-progresso")).toHaveLength(1);

  await act(async () => { resolvers[0]({ transferencia: { numero: 10 } }); });
  expect(textoDe(tree, "transferir-rodape")).toBe("Enviando lote 2 de 3…");
  expect(mockCriar.mock.calls[1][1].itens.map((i: any) => i.product_id)).toEqual(["m4", "m5", "m6", "m7"]);

  await act(async () => { resolvers[1]({ transferencia: { numero: 11 } }); });
  expect(mockCriar.mock.calls[2][1].itens).toEqual([
    { product_id: "m8", variant_id: null, quantidade: 1 },
    { product_id: "m9", variant_id: null, quantidade: 1 },
  ]);
  expect(mockCriar.mock.calls[2][1].destino_company_id).toBe("c2");

  await act(async () => { resolvers[2]({ transferencia: { numero: 12 } }); });
  expect(mockCriar).toHaveBeenCalledTimes(3);
  expect(onConcluido).toHaveBeenCalledWith([10, 11, 12], 10, DESTINO);
});

it("parte que falha no meio: as anteriores ficam feitas e saem da lista", async () => {
  const { tree, onConcluido, onEstoqueMudou } = await montarPreenchido();
  mockCriar
    .mockResolvedValueOnce({ transferencia: { numero: 20 } })
    .mockRejectedValueOnce(Object.assign(new Error("x"), {
      status: 409, data: { code: "ESTOQUE_INSUFICIENTE", itens: [{ product_id: "m5", variant_id: null, disponivel: 0 }] },
    }));
  await tocar(tree, "transferir-confirmar");
  expect(mockCriar).toHaveBeenCalledTimes(2);
  expect(onConcluido).not.toHaveBeenCalled();
  expect(onEstoqueMudou).toHaveBeenCalled();
  expect(textoDe(tree, "transferir-ja-enviados")).toContain("transferência nº 20");
  expect(porTestID(tree, "transferir-linha-p:m0")).toHaveLength(0);
  expect(porTestID(tree, "transferir-linha-p:m3")).toHaveLength(0);
  expect(textoDe(tree, "transferir-erro-p:m5")).toBe("Não tem estoque nesta loja.");
  // Sobram m4..m9; m5 está com erro e fica de fora até ajustar.
  expect(textoDe(tree, "transferir-rodape")).toBe("5 itens · 5 peças");
});
