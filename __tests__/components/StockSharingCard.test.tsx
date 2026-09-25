// ============================================================
// Estoque compartilhado entre as empresas do grupo (25/09/2026).
//
// Caso Luis Henrique: adega e loja de roupas no mesmo grupo multi-CNPJ,
// cada uma vendo o estoque da outra. O Davi usa o compartilhamento, então
// ele continua sendo o padrão, e quem decide se a opção aparece é o
// backend (available).
//
// Cobre:
//   - available=false (empresa única / não é o dono / backend antigo):
//     o cartão não aparece.
//   - available=true: mostra o estado atual.
//   - desligar passa por confirmação e só então chama o PATCH.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/api", () => ({ request: jest.fn() }));

// O Modal do RNW abre um portal que o test-renderer não suporta: aqui ele
// só mostra os filhos quando visível.
jest.mock("react-native", () => ({
  ...jest.requireActual("react-native"),
  Modal: ({ visible, children }: any) => (visible ? children : null),
}));

const mockInvalidate = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

const mockGet = jest.fn();
const mockSet = jest.fn();
jest.mock("@/services/multicnpj", () => ({
  userCompaniesApi: {
    stockSharing: (...a: any[]) => mockGet(...a),
    setStockSharing: (...a: any[]) => mockSet(...a),
  },
}));

import { StockSharingCard } from "@/components/StockSharingCard";

const DUAS = [
  { id: "c1", name: "Adega" },
  { id: "c2", name: "Roupas" },
];

function flatten(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(flatten).join("");
  return flatten(node.children);
}

async function montar() {
  let t!: renderer.ReactTestRenderer;
  await act(async () => {
    t = renderer.create(<StockSharingCard />);
  });
  return t;
}

const porTestId = (t: renderer.ReactTestRenderer, id: string) =>
  t.root.findAll((n) => n.props?.testID === id);

beforeEach(() => {
  mockGet.mockReset();
  mockSet.mockReset();
  mockInvalidate.mockReset();
});

test("empresa única (available=false): o cartão não aparece", async () => {
  mockGet.mockResolvedValue({ available: false, shared: true, companies: [] });
  const t = await montar();
  expect(t.toJSON()).toBeNull();
});

test("falha ao consultar: o cartão não aparece", async () => {
  mockGet.mockRejectedValue(new Error("rede"));
  const t = await montar();
  expect(t.toJSON()).toBeNull();
});

test("grupo compartilhado mostra o estado e o interruptor ligado", async () => {
  mockGet.mockResolvedValue({ available: true, shared: true, companies: DUAS });
  const t = await montar();
  expect(porTestId(t, "stock-sharing-card").length).toBeGreaterThan(0);
  expect(flatten(t.toJSON())).toContain("aparecem no Estoque e no Caixa das outras");
  expect(porTestId(t, "stock-sharing-switch")[0].props.value).toBe(true);
});

test("desligar pede confirmação e só então separa o estoque", async () => {
  mockGet.mockResolvedValue({ available: true, shared: true, companies: DUAS });
  mockSet.mockResolvedValue({ available: true, shared: false, companies: DUAS, products_changed: 5 });
  const t = await montar();

  await act(async () => {
    porTestId(t, "stock-sharing-switch")[0].props.onValueChange(false);
  });
  expect(mockSet).not.toHaveBeenCalled();

  await act(async () => {
    porTestId(t, "stock-sharing-confirm")[0].props.onPress();
  });
  expect(mockSet).toHaveBeenCalledWith(false);
  expect(mockInvalidate).toHaveBeenCalled();
  expect(flatten(t.toJSON())).toContain("Cada empresa vê só o próprio estoque");
});
