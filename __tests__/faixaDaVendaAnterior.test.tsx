// ============================================================
// 17/11/2026 (p-147 / R3b): a tela final não segura a próxima venda, e a
// NFC-e automática não pode ficar escondida.
//   1. A emissão mora em services/emissaoDaNfce: com a chave da venda, ela
//      continua depois que o NfceActions sai da tela (a faixa lê o mesmo
//      estado); sem chave, é esquecida ao desmontar, como antes.
//   2. Regras da faixa (utils/faixaDaVendaAnterior): quem fica, quem sai,
//      quando o × aparece.
//   3. A faixa na tela: enviando, autorizada, recusada (vermelha, sem ×, até
//      "Ver o motivo"), "Tentar de novo".
//   4. Ctrl/⌘+P com a faixa na tela imprime o cupom da venda anterior; sem
//      faixa, a tecla é do navegador.
// Mocks do padrão do repo; testID + deep:false.
// ============================================================
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/components/QrCode", () => ({ QrCode: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ token: "t", company: { id: "loja-a" } }) }));
const mockAbrirImpressao = jest.fn((..._a: any[]) => Promise.resolve("ok"));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: (...a: any[]) => mockAbrirImpressao(...a) }));
jest.mock("@/services/api", () => ({ BASE_URL: "http://api.test" }));

type Pendente = { resolve: (v: any) => void; reject: (e: any) => void };
const mockPedidos: Pendente[] = [];
const mockEmit = jest.fn((..._a: any[]) => new Promise((resolve, reject) => { mockPedidos.push({ resolve, reject }); }));
const mockGet = jest.fn((..._a: any[]) => Promise.resolve({ emission: { status: "processando" } as any }));
jest.mock("@/services/nfceApi", () => ({
  nfceApi: { emit: (...a: any[]) => mockEmit(...a), get: (...a: any[]) => mockGet(...a) },
}));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { NfceActions } from "@/components/screens/pdv/NfceActions";
import { FaixaDaVendaAnterior } from "@/components/screens/pdv/FaixaDaVendaAnterior";
import {
  chaveDaNotaDaVenda, estadoDaNota, emitirNota, marcarMotivoVisto, __zerarNotasParaTestes,
} from "@/services/emissaoDaNfce";
import {
  comAVendaQueSaiu, depoisDaVendaSeguinte, faixasVisiveis, notaNaFaixa, notaPrendeAFaixa, podeDispensar,
  rotuloDaVenda, type VendaNaFaixa,
} from "@/utils/faixaDaVendaAnterior";
import { __zerarFaixasParaTestes, cupomDaVenda, guardarVendaAnterior, aoRegistrarVenda, useVendaAnterior } from "@/stores/vendaAnterior";
import { resolverAtalho, CTRL_P_IMPRIME_VENDA_ANTERIOR } from "@/utils/atalhosDoCaixa";

const SALE = "0f6c1d2e-aaaa-bbbb-cccc-000000001048";
const CHAVE = chaveDaNotaDaVenda(SALE);
const BASE = { companyId: "loja-a", saleId: SALE, items: [{ product_id: "p1", product_name: "Blusa", quantity: 1, unit_price: 179.9 }], total: 179.9 };
const FAIXA: VendaNaFaixa = { companyId: "loja-a", saleId: SALE, rotulo: "#1048", total: 179.9, vendaEm: 1_000 };
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
const micro = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPedidos.length = 0;
  __zerarNotasParaTestes();
  __zerarFaixasParaTestes();
});

describe("emissão fora da tela final", () => {
  it("com a chave da venda, a nota segue depois que a tela sai e o resultado fica guardado", async () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<NfceActions {...BASE} autoEmit chave={CHAVE} />); });
    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(estadoDaNota(CHAVE).fase).toBe("emitting");
    // Enter na tela final: o componente sai antes da resposta da SEFAZ.
    act(() => { t.unmount(); });
    await act(async () => { mockPedidos[0].resolve({ nfce: { id: "n1", status: "rejeitada", error_message: "Rejeição 778: NCM inválido" } }); await micro(); });
    const e = estadoDaNota(CHAVE);
    expect(e.fase).toBe("rejected");
    expect(e.erro).toBe("Rejeição 778: NCM inválido");
    expect(notaNaFaixa(e)).toBe("recusada");
  });

  it("sem chave (Troca, Studio): o estado é do componente e some ao desmontar, como antes", async () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<NfceActions {...BASE} autoEmit />); });
    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(estadoDaNota(CHAVE).fase).toBe("idle");
    act(() => { t.unmount(); });
    await act(async () => { mockPedidos[0].resolve({ nfce: { id: "n1", status: "autorizada", numero: 7 } }); await micro(); });
    expect(estadoDaNota(CHAVE).fase).toBe("idle");
  });

  it("a automática não dispara de novo para a mesma venda se a tela final voltar a montar", () => {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<NfceActions {...BASE} autoEmit chave={CHAVE} />); });
    act(() => { t.unmount(); });
    act(() => { renderer.create(<NfceActions {...BASE} autoEmit chave={CHAVE} />); });
    expect(mockEmit).toHaveBeenCalledTimes(1);
  });

  it("onEmitted continua sendo chamado na autorização (NotaDeProdutosDaVenda esconde a NF-e)", async () => {
    const onEmitted = jest.fn();
    act(() => { renderer.create(<NfceActions {...BASE} autoEmit chave={CHAVE} onEmitted={onEmitted} />); });
    await act(async () => { mockPedidos[0].resolve({ nfce: { id: "n1", status: "autorizada", numero: 7, pdf_url: "x" }, pdf_url: "x" }); await micro(); });
    expect(onEmitted).toHaveBeenCalledTimes(1);
    expect(notaNaFaixa(estadoDaNota(CHAVE))).toBe("autorizada");
  });

  it("processando: a consulta à SEFAZ continua sem a tela; ao autorizar, a faixa vê", async () => {
    jest.useFakeTimers();
    try {
      let t!: renderer.ReactTestRenderer;
      act(() => { t = renderer.create(<NfceActions {...BASE} autoEmit chave={CHAVE} />); });
      await act(async () => { mockPedidos[0].resolve({ nfce: { id: "n1", status: "processando", numero: 9 } }); await micro(); });
      expect(notaNaFaixa(estadoDaNota(CHAVE))).toBe("enviando");
      act(() => { t.unmount(); });
      mockGet.mockImplementationOnce(() => Promise.resolve({ emission: { id: "n1", status: "autorizada", numero: 9 } as any }));
      await act(async () => { jest.advanceTimersByTime(3000); await micro(); });
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(notaNaFaixa(estadoDaNota(CHAVE))).toBe("autorizada");
    } finally { jest.useRealTimers(); }
  });

  it("falha de rede no pedido conta como não aceita (não pode ficar escondida)", async () => {
    emitirNota(CHAVE, "loja-a", { items: [] } as any);
    await act(async () => { mockPedidos[0].reject(Object.assign(new Error("Sem conexão"), { data: {} })); await micro(); });
    expect(estadoDaNota(CHAVE).fase).toBe("error");
    expect(notaNaFaixa(estadoDaNota(CHAVE))).toBe("recusada");
  });
});

describe("regras da faixa", () => {
  const prende = (ids: string[]) => (id: string) => ids.includes(id);
  const v = (id: string, companyId = "loja-a"): VendaNaFaixa => ({ ...FAIXA, saleId: id, companyId });

  it("rótulo: número da venda; sem número, o código curto", () => {
    expect(rotuloDaVenda({ id: SALE, saleNumber: 1048 })).toBe("#1048");
    expect(rotuloDaVenda({ id: "abcd1234-ffff", saleNumber: null })).toBe("#ABCD1234");
  });

  it("a venda que saiu vai na frente; das antigas, só as que a nota prende", () => {
    const lista = [v("a"), v("b")];
    expect(comAVendaQueSaiu(lista, v("c"), prende(["b"])).map(f => f.saleId)).toEqual(["c", "b"]);
  });

  it("venda seguinte registrada: sai tudo o que a nota não prende", () => {
    expect(depoisDaVendaSeguinte([v("a"), v("b")], prende(["b"])).map(f => f.saleId)).toEqual(["b"]);
  });

  it("visíveis: só da loja escolhida; a da frente sempre, as antigas enquanto a nota prende", () => {
    const lista = [v("a"), v("b"), v("c", "loja-b")];
    expect(faixasVisiveis(lista, "loja-a", prende([])).map(f => f.saleId)).toEqual(["a"]);
    expect(faixasVisiveis(lista, "loja-a", prende(["b"])).map(f => f.saleId)).toEqual(["a", "b"]);
    expect(faixasVisiveis(lista, "loja-b", prende([])).map(f => f.saleId)).toEqual(["c"]);
    expect(faixasVisiveis(lista, null, prende([]))).toEqual([]);
  });

  it("recusa sem ninguém ver: prende a faixa e tira o ×; vista, solta", () => {
    const recusada = { ...estadoDaNota("x"), fase: "rejected" as const };
    expect(notaPrendeAFaixa(recusada)).toBe(true);
    expect(podeDispensar(recusada)).toBe(false);
    expect(notaPrendeAFaixa({ ...recusada, motivoVisto: true })).toBe(false);
    expect(podeDispensar({ ...recusada, motivoVisto: true })).toBe(true);
    const enviando = { ...estadoDaNota("x"), fase: "emitting" as const };
    expect(notaPrendeAFaixa(enviando)).toBe(true);
    expect(podeDispensar(enviando)).toBe(true);
  });

  it("na loja: a faixa de nota recusada sobrevive à venda seguinte", async () => {
    emitirNota(CHAVE, "loja-a", { items: [] } as any);
    await act(async () => { mockPedidos[0].resolve({ nfce: { id: "n1", status: "rejeitada" } }); await micro(); });
    guardarVendaAnterior(FAIXA);
    guardarVendaAnterior({ ...FAIXA, saleId: "venda-sem-nota" });
    aoRegistrarVenda();
    expect(useVendaAnterior.getState().faixas.map(f => f.saleId)).toEqual([SALE]);
    marcarMotivoVisto(CHAVE);
    aoRegistrarVenda();
    expect(useVendaAnterior.getState().faixas).toHaveLength(0);
  });
});

describe("a faixa na tela", () => {
  function montar(compact = false) {
    let t!: renderer.ReactTestRenderer;
    act(() => { t = renderer.create(<FaixaDaVendaAnterior faixa={FAIXA} token="t" compact={compact} />); });
    return t;
  }

  it("número, total, Imprimir cupom e ×; nota enviando", () => {
    emitirNota(CHAVE, "loja-a", { items: [] } as any);
    const t = montar();
    const tudo = texto(porId(t, "faixa-venda-anterior")[0].children);
    expect(tudo).toContain("Venda #1048");
    expect(tudo).toContain("registrada · R$ 179,90");
    expect(porId(t, "faixa-imprimir")).toHaveLength(1);
    expect(porId(t, "faixa-nota-enviando")).toHaveLength(1);
    expect(porId(t, "faixa-dispensar")).toHaveLength(1);
  });

  it("nota recusada: vermelha, sem ×, até 'Ver o motivo'; o motivo aparece com 'Tentar de novo'", async () => {
    emitirNota(CHAVE, "loja-a", { items: [{ product_id: "p1" }] } as any);
    await act(async () => { mockPedidos[0].resolve({ nfce: { id: "n1", status: "rejeitada", error_message: "Rejeição 778" } }); await micro(); });
    const t = montar(true);
    expect(porId(t, "faixa-nota-recusada")).toHaveLength(1);
    expect(porId(t, "faixa-dispensar")).toHaveLength(0);
    act(() => { porId(t, "faixa-ver-motivo")[0].props.onPress(); });
    expect(porId(t, "faixa-dispensar")).toHaveLength(1);
    expect(texto(porId(t, "faixa-motivo")[0].children)).toContain("Rejeição 778");
    act(() => { porId(t, "faixa-tentar-de-novo")[0].props.onPress(); });
    expect(mockEmit).toHaveBeenCalledTimes(2);
    expect(mockEmit.mock.calls[1][1]).toEqual({ items: [{ product_id: "p1" }] });
    expect(porId(t, "faixa-nota-enviando")).toHaveLength(1);
  });

  it("nota autorizada; loja sem nota não mostra nada da nota", async () => {
    const t = montar();
    expect(porId(t, "faixa-nota-enviando")).toHaveLength(0);
    expect(porId(t, "faixa-nota-recusada")).toHaveLength(0);
    emitirNota(CHAVE, "loja-a", { items: [] } as any);
    await act(async () => { mockPedidos[0].resolve({ nfce: { id: "n1", status: "autorizada", numero: 3, pdf_url: "x" } }); await micro(); });
    expect(porId(t, "faixa-nota-autorizada")).toHaveLength(1);
  });

  it("Imprimir cupom: imprimindo… e depois Cupom impresso", async () => {
    const t = montar();
    act(() => { porId(t, "faixa-imprimir")[0].props.onPress(); });
    expect(mockAbrirImpressao).toHaveBeenCalledTimes(1);
    await act(async () => { await micro(); });
    expect(cupomDaVenda(SALE)).toBe("impresso");
    expect(porId(t, "faixa-cupom-impresso")).toHaveLength(1);
  });

  it("o × tira a faixa", () => {
    guardarVendaAnterior(FAIXA);
    const t = montar();
    act(() => { porId(t, "faixa-dispensar")[0].props.onPress(); });
    expect(useVendaAnterior.getState().faixas).toHaveLength(0);
  });
});

describe("Ctrl/⌘+P com a faixa na tela", () => {
  const caixa = { telaFinal: false, janelaAberta: false, temItens: true };
  it("está ligado (pendência do mockup, constante fácil de desligar)", () => {
    expect(CTRL_P_IMPRIME_VENDA_ANTERIOR).toBe(true);
  });
  it("com a faixa: imprime o cupom da venda anterior, Ctrl no Windows e ⌘ no Mac", () => {
    expect(resolverAtalho({ key: "p", code: "KeyP", ctrlKey: true }, { ...caixa, temVendaAnterior: true }))
      .toEqual({ acao: "imprimirAnterior", segurar: true });
    expect(resolverAtalho({ key: "p", code: "KeyP", metaKey: true, emCampo: true }, { ...caixa, temItens: false, temVendaAnterior: true }))
      .toEqual({ acao: "imprimirAnterior", segurar: true });
  });
  it("sem faixa ou com janela aberta: a tecla segue para o navegador", () => {
    expect(resolverAtalho({ key: "p", code: "KeyP", ctrlKey: true }, caixa)).toEqual({ acao: null, segurar: false });
    expect(resolverAtalho({ key: "p", code: "KeyP", ctrlKey: true }, { ...caixa, janelaAberta: true, temVendaAnterior: true }))
      .toEqual({ acao: null, segurar: false });
  });
  it("na tela final continua sendo o cupom da venda da tela", () => {
    expect(resolverAtalho({ key: "p", code: "KeyP", ctrlKey: true }, { telaFinal: true, janelaAberta: false, temVendaAnterior: true }))
      .toEqual({ acao: "imprimir", segurar: true });
  });
});
