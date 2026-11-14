// ============================================================
// Venda concluída: a nota dos produtos (CP4b, 14/11/2026).
// Mockup "Venda concluída: notas": caso 1 (sem CNPJ: NFC-e + "Cliente
// precisa de NF-e?"), caso 2 (CNPJ: NF-e sugerida, automática da NFC-e
// espera), caso 4 (loja sem nota ativa: convite, nunca bloqueio).
// Mocks de sempre; testID + deep:false. Dados fictícios.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
const mockNfce = jest.fn();
jest.mock("@/components/screens/pdv/NfceActions", () => ({
  NfceActions: (p: any) => { mockNfce(p); return null; },
}));
const mockWizard = jest.fn();
jest.mock("@/components/nfe55/Nfe55Wizard", () => ({
  Nfe55Wizard: (p: any) => { mockWizard(p); return null; },
}));
jest.mock("@/components/nfe55/nfe55Acoes", () => ({ abrirDanfe: jest.fn(), baixarXml: jest.fn() }));

import { NotaDeProdutosDaVenda } from "@/components/nfe55/NotaDeProdutosDaVenda";
import { router } from "expo-router";

const BASE = {
  companyId: "loja-a", saleId: "venda-1", saleNumber: 1313, items: [{ product_id: "p1", product_name: "Cimento", quantity: 1, unit_price: 10 }],
  total: 10, paymentMethod: "pix",
};

function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
function montar(p: any) {
  let t!: renderer.ReactTestRenderer;
  act(() => { t = renderer.create(<NotaDeProdutosDaVenda {...BASE} {...p} />); });
  return t;
}

beforeEach(() => jest.clearAllMocks());

describe("caso 1 · sem CNPJ", () => {
  it("NFC-e como sempre (com a automática) e o atalho para a NF-e", () => {
    const t = montar({ documentoDoCliente: "39053344705", autoEmit: true, notaAtiva: true });
    expect(porId(t, "venda-nota-nfce")).toHaveLength(1);
    expect(mockNfce).toHaveBeenCalledWith(expect.objectContaining({ autoEmit: true, notaAtiva: true, saleId: "venda-1" }));
    expect(texto(t.toJSON())).toContain("Cliente precisa de NF-e? (empresa / CNPJ) →");
    act(() => { porId(t, "venda-precisa-nfe")[0].props.onPress(); });
    expect(mockWizard).toHaveBeenCalledWith(expect.objectContaining({ visible: true, companyId: "loja-a", saleId: "venda-1", saleNumber: 1313 }));
  });

  it("depois que a NFC-e sai, o atalho para a NF-e some (uma nota de produtos por venda)", () => {
    const t = montar({ documentoDoCliente: null, autoEmit: false, notaAtiva: true });
    const props = mockNfce.mock.calls[0][0];
    act(() => { props.onEmitted({}); });
    expect(porId(t, "venda-precisa-nfe")).toHaveLength(0);
  });
});

describe("caso 2 · cliente com CNPJ", () => {
  it("NF-e sugerida em destaque; a automática da NFC-e espera e avisa", () => {
    const t = montar({ documentoDoCliente: "11.444.777/0001-61", autoEmit: true, notaAtiva: true });
    expect(porId(t, "venda-nota-nfe-sugerida")).toHaveLength(1);
    expect(porId(t, "venda-automatica-esperou")).toHaveLength(1);
    expect(mockNfce).toHaveBeenCalledWith(expect.objectContaining({ autoEmit: false }));
    const s = texto(t.toJSON());
    expect(s).toContain("Nota fiscal eletrônica (NF-e)");
    expect(s).toContain("Prefere o cupom fiscal (NFC-e)?");
    expect(s).toContain("Uma venda tem uma nota para os produtos");
    act(() => { porId(t, "venda-emitir-nfe")[0].props.onPress(); });
    expect(mockWizard).toHaveBeenCalledWith(expect.objectContaining({ companyId: "loja-a", saleId: "venda-1" }));
  });

  it("sem automática: nada de aviso de espera", () => {
    const t = montar({ documentoDoCliente: "11444777000161", autoEmit: false, notaAtiva: true });
    expect(porId(t, "venda-automatica-esperou")).toHaveLength(0);
  });

  it("NF-e autorizada no assistente: mostra DANFE e XML", () => {
    const t = montar({ documentoDoCliente: "11444777000161", notaAtiva: true });
    act(() => { porId(t, "venda-emitir-nfe")[0].props.onPress(); });
    const { onEmitida } = mockWizard.mock.calls[mockWizard.mock.calls.length - 1][0];
    act(() => { onEmitida({ numero: 16, chave_acesso: "1", nfe: { id: "em-16" } }); });
    expect(porId(t, "venda-nfe-autorizada")).toHaveLength(1);
    expect(texto(t.toJSON())).toContain("NF-e nº 16 autorizada");
  });
});

describe("caso 4 · loja sem nota ativa", () => {
  it("convite para ligar a nota, sem botão de emitir", () => {
    const t = montar({ documentoDoCliente: "11444777000161", autoEmit: true, notaAtiva: false });
    expect(porId(t, "convite-nota-fiscal")).toHaveLength(1);
    expect(mockNfce).not.toHaveBeenCalled();
    expect(porId(t, "venda-emitir-nfe")).toHaveLength(0);
    act(() => { porId(t, "convite-nota-fiscal-ligar")[0].props.onPress(); });
    expect(router.push).toHaveBeenCalledWith("/nfe?tab=certificado");
    act(() => { porId(t, "convite-nota-fiscal-agora-nao")[0].props.onPress(); });
    expect(porId(t, "convite-nota-fiscal")).toHaveLength(0);
  });
});
