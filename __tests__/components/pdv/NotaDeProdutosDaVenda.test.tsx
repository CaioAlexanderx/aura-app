// ============================================================
// Venda concluída: a nota dos produtos (CP4b, 14/11/2026).
// Mockup "Venda concluída: notas": caso 1 (sem CNPJ: NFC-e + "Cliente
// precisa de NF-e?"), caso 2 (CNPJ: NF-e sugerida, automática da NFC-e
// espera), caso 4 (loja sem nota ativa: convite, nunca bloqueio).
// Mocks de sempre; testID + deep:false. Dados fictícios.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/JanelaEmpilhada", () => ({ JanelaEmpilhada: ({ children }: any) => children }));
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
const mockPrevia = jest.fn();
jest.mock("@/services/nfe55Api", () => ({ nfe55Api: { previa: (...a: any[]) => mockPrevia(...a) } }));

import { NotaDeProdutosDaVenda, PRAZO_DA_PREVIA_MS } from "@/components/nfe55/NotaDeProdutosDaVenda";
import { _limparClienteCompletoNaOtica } from "@/hooks/useClienteCompletoNaOtica";
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

beforeEach(() => { jest.clearAllMocks(); _limparClienteCompletoNaOtica(); });

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

// ── 24/11/2026 (hotfix ótica): NF-e sugerida pelo cadastro completo ──
// A prévia (GET .../nfe55/venda/:saleId/previa, só leitura) monta o
// destinatário do cadastro e devolve os faltantes. Dados fictícios.

const LINK_ANTIGO = "Cliente precisa de NF-e? (empresa / CNPJ) →";
const LINK_OTICA = "Nota com os dados completos do cliente (NF-e) →";

function previaCompleta(extra: any = {}) {
  return {
    pode_emitir: true, bloqueio: null, faltantes: [], nota_existente: null, nota_pendente: null,
    destinatario: {
      documento: "39053344705", nome: "Ana Exemplo", ie: null, ind_ie_dest: 9, email: null,
      endereco: { cep: "01310100", logradouro: "Av. Paulista", numero: "1000", bairro: "Bela Vista", municipio: "São Paulo", uf: "SP", codigo_municipio_ibge: "3550308" },
      customer_id: "cli-1",
    },
    ...extra,
  };
}
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const ultimaNfce = () => mockNfce.mock.calls[mockNfce.mock.calls.length - 1][0];

describe("sem ótica · nada muda", () => {
  it("NFC-e sugerida, texto de sempre e a prévia nunca é chamada (mesmo com cliente)", async () => {
    const t = montar({ documentoDoCliente: "39053344705", autoEmit: true, notaAtiva: true, otica: false, customerId: "cli-1" });
    await flush();
    expect(porId(t, "venda-nota-nfce")).toHaveLength(1);
    expect(texto(t.toJSON())).toContain(LINK_ANTIGO);
    expect(texto(t.toJSON())).not.toContain(LINK_OTICA);
    expect(mockNfce.mock.calls.every((c) => c[0].autoEmit === true)).toBe(true);
    expect(mockPrevia).not.toHaveBeenCalled();
  });

  it("sem a prop otica (quem já chamava): igual", async () => {
    const t = montar({ documentoDoCliente: null, autoEmit: true, notaAtiva: true, customerId: "cli-1" });
    await flush();
    expect(texto(t.toJSON())).toContain(LINK_ANTIGO);
    expect(mockPrevia).not.toHaveBeenCalled();
  });
});

describe("ótica · cliente com cadastro completo", () => {
  it("NF-e sugerida, NFC-e alternativa, a automática espera e avisa; uma chamada só", async () => {
    mockPrevia.mockResolvedValue(previaCompleta());
    const t = montar({ documentoDoCliente: null, autoEmit: true, notaAtiva: true, otica: true, customerId: "cli-1" });
    // enquanto a prévia não volta: a NFC-e de sempre, com a automática segurando
    expect(porId(t, "venda-nota-nfce")).toHaveLength(1);
    expect(ultimaNfce().autoEmit).toBe(false);
    expect(texto(t.toJSON())).toContain(LINK_OTICA);
    await flush();
    expect(porId(t, "venda-nota-nfe-sugerida")).toHaveLength(1);
    expect(porId(t, "venda-automatica-esperou")).toHaveLength(1);
    expect(mockNfce.mock.calls.every((c) => c[0].autoEmit === false)).toBe(true);
    const s = texto(t.toJSON());
    expect(s).toContain("Sugerida: o cliente tem cadastro completo");
    expect(s).toContain("Prefere o cupom fiscal (NFC-e)?");
    expect(s).toContain("esperou porque o cliente tem cadastro completo");
    expect(mockPrevia).toHaveBeenCalledTimes(1);
    expect(mockPrevia).toHaveBeenCalledWith("loja-a", "venda-1");
    // re-render e remontagem da tela final não chamam de novo
    act(() => { t.update(<NotaDeProdutosDaVenda {...BASE} documentoDoCliente={null} autoEmit notaAtiva otica customerId="cli-1" />); });
    act(() => { t.unmount(); });
    const t2 = montar({ documentoDoCliente: null, autoEmit: true, notaAtiva: true, otica: true, customerId: "cli-1" });
    expect(porId(t2, "venda-nota-nfe-sugerida")).toHaveLength(1);
    await flush();
    expect(mockPrevia).toHaveBeenCalledTimes(1);
    act(() => { porId(t2, "venda-emitir-nfe")[0].props.onPress(); });
    expect(mockWizard).toHaveBeenCalledWith(expect.objectContaining({ companyId: "loja-a", saleId: "venda-1" }));
  });

  it("faltante só de item (NCM) não tira a sugestão: é dado do produto, não do cliente", async () => {
    mockPrevia.mockResolvedValue(previaCompleta({ pode_emitir: false, faltantes: [{ campo: "itens[0].ncm", mensagem: "NCM", tipo: "faltando" }] }));
    const t = montar({ documentoDoCliente: "39053344705", autoEmit: false, notaAtiva: true, otica: true, customerId: "cli-1" });
    await flush();
    expect(porId(t, "venda-nota-nfe-sugerida")).toHaveLength(1);
    expect(porId(t, "venda-automatica-esperou")).toHaveLength(0);
  });

  it("cliente com CNPJ na ótica: o caso 2 de sempre, sem chamar a prévia", async () => {
    const t = montar({ documentoDoCliente: "11444777000161", autoEmit: true, notaAtiva: true, otica: true, customerId: "cli-1" });
    await flush();
    expect(porId(t, "venda-nota-nfe-sugerida")).toHaveLength(1);
    expect(texto(t.toJSON())).toContain("Sugerida: o cliente tem CNPJ");
    expect(mockPrevia).not.toHaveBeenCalled();
  });
});

describe("ótica · destinatário com faltante", () => {
  it("NFC-e como hoje (a automática sai), link novo", async () => {
    mockPrevia.mockResolvedValue(previaCompleta({
      pode_emitir: false,
      faltantes: [{ campo: "destinatario.endereco.cep", mensagem: "CEP do endereço do cliente", tipo: "faltando" }],
    }));
    const t = montar({ documentoDoCliente: "39053344705", autoEmit: true, notaAtiva: true, otica: true, customerId: "cli-1" });
    await flush();
    expect(porId(t, "venda-nota-nfce")).toHaveLength(1);
    expect(porId(t, "venda-nota-nfe-sugerida")).toHaveLength(0);
    expect(ultimaNfce().autoEmit).toBe(true);
    expect(texto(t.toJSON())).toContain(LINK_OTICA);
    expect(mockPrevia).toHaveBeenCalledTimes(1);
  });
});

describe("ótica · a prévia falha", () => {
  it("erro (4xx/rede): NFC-e, sem mensagem de erro", async () => {
    mockPrevia.mockRejectedValue({ status: 422, data: { error: "Erro qualquer", code: "X" } });
    const t = montar({ documentoDoCliente: null, autoEmit: true, notaAtiva: true, otica: true, customerId: "cli-1" });
    await flush();
    expect(porId(t, "venda-nota-nfce")).toHaveLength(1);
    expect(ultimaNfce().autoEmit).toBe(true);
    expect(texto(t.toJSON())).not.toContain("Erro qualquer");
  });

  it("bloqueio na prévia (UF não liberada): NFC-e", async () => {
    mockPrevia.mockResolvedValue(previaCompleta({ pode_emitir: false, bloqueio: { code: "NFE55_UF_NAO_HABILITADA", error: "UF" } }));
    const t = montar({ documentoDoCliente: null, autoEmit: true, notaAtiva: true, otica: true, customerId: "cli-1" });
    await flush();
    expect(porId(t, "venda-nota-nfce")).toHaveLength(1);
    expect(ultimaNfce().autoEmit).toBe(true);
  });

  it("prévia lenta: a automática sai no prazo e a resposta tardia não muda a nota", async () => {
    jest.useFakeTimers();
    try {
      let responder!: (v: any) => void;
      mockPrevia.mockReturnValue(new Promise((r) => { responder = r; }));
      const t = montar({ documentoDoCliente: null, autoEmit: true, notaAtiva: true, otica: true, customerId: "cli-1" });
      expect(ultimaNfce().autoEmit).toBe(false);
      act(() => { jest.advanceTimersByTime(PRAZO_DA_PREVIA_MS); });
      expect(ultimaNfce().autoEmit).toBe(true);
      responder(previaCompleta());
      await flush();
      expect(porId(t, "venda-nota-nfce")).toHaveLength(1);
      expect(porId(t, "venda-nota-nfe-sugerida")).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("ótica · venda sem cliente", () => {
  it("nenhuma chamada; NFC-e com a automática de sempre", async () => {
    const t = montar({ documentoDoCliente: "39053344705", autoEmit: true, notaAtiva: true, otica: true, customerId: null });
    await flush();
    expect(mockPrevia).not.toHaveBeenCalled();
    expect(porId(t, "venda-nota-nfce")).toHaveLength(1);
    expect(mockNfce.mock.calls.every((c) => c[0].autoEmit === true)).toBe(true);
  });

  it("loja sem nota ativa: convite, sem chamada", async () => {
    montar({ documentoDoCliente: null, autoEmit: true, notaAtiva: false, otica: true, customerId: "cli-1" });
    await flush();
    expect(mockPrevia).not.toHaveBeenCalled();
  });
});
