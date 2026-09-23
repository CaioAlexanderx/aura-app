// ============================================================
// DanfeImportModal — a nota entrou, o Matcon fica sabendo (23/09/2026,
// Matcon M4 › Compras, Aura-backend#741).
//
//  1. Depois dos PATCH de estoque, UMA chamada a registerPurchaseReceipt
//     na mesma empresa, com as linhas gravadas: quantidade e custo da nota
//     (10 cx a R$ 89,90), não os convertidos (23,2 m²). Linha desmarcada
//     não vai.
//  2. Resposta com pedidos: "Pedido de compra C-0042 recebido por completo".
//  3. Falha: a importação continua valendo (estoque gravado, resumo de
//     "importado") e o aviso aparece.
//  4. Matcon desligado: a rota nem é chamada.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (s: any) => s, absoluteFillObject: {} },
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
}));
jest.mock("@/constants/colors", () => ({
  Colors: { ink: "#111", ink3: "#666", violet: "#7c3aed", violet3: "#a78bfa" },
  IS_DARK_MODE: false,
}));

let mockPdvSettings: any = { matcon_enabled: true };
jest.mock("@/hooks/usePdvSettings", () => ({
  usePdvSettings: () => ({ settings: mockPdvSettings, isLoading: false, error: null, invalidate: jest.fn() }),
}));

const mockCatalogo = {
  products: [
    { id: "prod-piso", name: "Porcelanato Bianco 60x60", unit: "m²", purchase_unit: "cx", purchase_factor: "2.32", stock_qty: "10" },
  ],
};
jest.mock("@tanstack/react-query", () => ({
  useQuery: (opts: any) => ({ data: opts.enabled ? mockCatalogo : undefined }),
}));

const mockUpdateProduct = jest.fn((..._a: any[]) => Promise.resolve({}));
const mockCreateProduct = jest.fn((..._a: any[]) => Promise.resolve({ id: "prod-novo" }));
jest.mock("@/services/api", () => ({
  companiesApi: {
    products: jest.fn(),
    updateProduct: (...a: any[]) => mockUpdateProduct(...a),
    createProduct: (...a: any[]) => mockCreateProduct(...a),
  },
}));

const mockRegister = jest.fn();
jest.mock("@/services/matconApi", () => ({
  matconApi: {
    registerPurchaseReceipt: (...a: any[]) => mockRegister(...a),
    createLot: jest.fn(() => Promise.resolve({})),
  },
}));

import { DanfeImportModal } from "@/components/screens/estoque/DanfeImportModal";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe>
  <ide><nNF>12884</nNF></ide>
  <emit><CNPJ>11111111000111</CNPJ><xNome>Cerâmica Portobello Distribuidora</xNome></emit>
  <det nItem="1"><prod><xProd>Porcelanato Bianco 60x60</xProd><NCM>69072100</NCM><qCom>10</qCom><vUnCom>89.90</vUnCom><vProd>899.00</vProd></prod></det>
  <det nItem="2"><prod><xProd>Rejunte Cinza 5 kg</xProd><NCM>32149000</NCM><qCom>4</qCom><vUnCom>18.50</vUnCom><vProd>74.00</vProd></prod></det>
  <det nItem="3"><prod><xProd>Argamassa AC-III 20 kg</xProd><NCM>32149000</NCM><qCom>6</qCom><vUnCom>31.00</vUnCom><vProd>186.00</vProd></prod></det>
</infNFe></NFe></nfeProc>`;

function flattenText(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return flattenText(node.children);
}

async function flush(fn: () => void) {
  await act(async () => { fn(); for (let i = 0; i < 10; i++) await Promise.resolve(); });
}

function one(t: renderer.ReactTestRenderer, testID: string) {
  return t.root.findAllByProps({ testID }, { deep: false })[0];
}

// FileReader do jsdom é assíncrono de verdade: espera o onload terminar.
async function carregarXml(t: renderer.ReactTestRenderer) {
  const input = t.root.findByType("input" as any);
  await act(async () => {
    input.props.onChange({ target: { files: [new File([XML], "nota.xml", { type: "text/xml" })] } });
    await new Promise((r) => setTimeout(r, 30));
  });
}

async function montarEImportar(desmarcarLinha?: number) {
  let t!: renderer.ReactTestRenderer;
  await act(async () => {
    t = renderer.create(<DanfeImportModal visible companyId="loja-2" onClose={jest.fn()} onSuccess={jest.fn()} />);
  });
  await carregarXml(t);
  if (desmarcarLinha != null) {
    // Checkbox de cada linha: o Pressable com o estilo da coluna (o "todos"
    // do cabeçalho usa o estilo dentro de um array e não entra aqui).
    const checks = t.root.findAll((n: any) => n.type === "Pressable" && n.props.style && n.props.style.width === 36);
    await flush(() => checks[desmarcarLinha].props.onPress());
  }
  await flush(() => one(t, "danfe-importar").props.onPress());
  return t;
}

beforeEach(() => {
  mockPdvSettings = { matcon_enabled: true };
  mockUpdateProduct.mockClear();
  mockCreateProduct.mockClear();
  mockRegister.mockReset();
});

describe("DanfeImportModal → entrada da nota no Matcon", () => {
  it("registra a compra uma vez, na empresa da importação, com qtd/custo da nota e sem a linha desmarcada", async () => {
    mockRegister.mockResolvedValue({ products_updated: 2, ignored: 0, orders: [] });
    await montarEImportar(1); // desmarca o rejunte

    // Estoque do piso entrou convertido (10 cx × 2,32 = 23,2 m² + 10 que já tinha)…
    expect(mockUpdateProduct).toHaveBeenCalledWith("loja-2", "prod-piso", expect.objectContaining({ stock_qty: 33.2 }));
    // …mas a entrada da compra vai do jeito da nota.
    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockRegister).toHaveBeenCalledWith("loja-2", {
      supplier_name: "Cerâmica Portobello Distribuidora",
      supplier_cnpj: "11111111000111",
      invoice_number: "12884",
      items: [
        { product_id: "prod-piso", quantity: 10, unit_cost: 89.9 },
        { product_id: "prod-novo", quantity: 6, unit_cost: 31 },
      ],
    });
  });

  it("mostra no resumo os pedidos que a nota fechou ou recebeu em parte", async () => {
    mockRegister.mockResolvedValue({
      products_updated: 1, ignored: 0,
      orders: [
        { id: "po-1", number: "C-0042", status: "received", items: [] },
        { id: "po-2", number: "C-0043", status: "sent", items: [] },
      ],
    });
    const t = await montarEImportar();
    expect(flattenText(one(t, "danfe-pedido-0").props.children)).toBe("Pedido de compra C-0042 recebido por completo");
    expect(flattenText(one(t, "danfe-pedido-1").props.children)).toBe("Pedido de compra C-0043 recebido em parte");
    expect(one(t, "danfe-aviso-entrada")).toBeUndefined();
  });

  it("falha ao registrar: a importação continua valendo e o aviso aparece", async () => {
    mockRegister.mockRejectedValue(Object.assign(new Error("fora do ar"), { status: 500 }));
    const t = await montarEImportar();
    const tudo = flattenText(t.toJSON());
    expect(tudo).toContain("3 produtos importados");
    expect(tudo).toContain("O estoque foi atualizado com sucesso.");
    expect(mockUpdateProduct).toHaveBeenCalledTimes(1);
    expect(mockCreateProduct).toHaveBeenCalledTimes(2);
    expect(one(t, "danfe-aviso-entrada").findByType("Text" as any).props.children).toBe(
      "A nota entrou no estoque, mas não consegui registrar a compra no módulo de materiais de construção."
    );
  });

  it("Matcon desligado: nenhuma chamada de compra, resumo como antes", async () => {
    mockPdvSettings = { matcon_enabled: false };
    const t = await montarEImportar();
    expect(mockRegister).not.toHaveBeenCalled();
    expect(mockCreateProduct).toHaveBeenCalledTimes(3);
    expect(one(t, "danfe-aviso-entrada")).toBeUndefined();
  });
});
