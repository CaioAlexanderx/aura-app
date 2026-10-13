// 13/10/2026 — vale-troca por QR: o que acontece quando o QR do cupom é bipado.
//
//   1. O QR chega ao Caixa pelo leitor (global ou campo) inteiro e intacto,
//      e é reconhecido como vale — nunca como produto nem como busca.
//   2. A Troca abre com a venda carregada, direto no passo 2, sem a busca.
//   3. Venda inexistente / de fora do grupo: aviso claro, passo 1 livre.
//   4. Prazo vencido: avisa e deixa o lojista decidir (não trava).
//   5. QR bipado no campo do passo 1 com o modal já aberto faz o mesmo.
// Mocks do padrão do repo (Icon, toast); testID + deep:false.
import React from "react";
import renderer, { act } from "react-test-renderer";
import { TextInput } from "react-native";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(() => ({ company: { id: "loja-1" }, token: "t" }), { getState: () => ({ token: "t", company: { id: "loja-1" } }) }),
}));
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: {}, isLoading: false, invalidate: jest.fn() }) }));
jest.mock("@/components/Toast", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/trocaApi", () => ({
  trocaApi: {
    searchSalesForTroca: jest.fn(),
    searchSalesByProductBarcode: jest.fn(),
    create: jest.fn(),
    createV2: jest.fn(),
  },
}));

import { TrocaModal } from "@/components/screens/pdv/TrocaModal";
import { trocaApi } from "@/services/trocaApi";
import { criarLeitorDeCampo } from "@/utils/leituraRapida";
import { useGlobalBarcodeScanner } from "@/hooks/useGlobalBarcodeScanner";
import { lerCodigoDoVale, montarCodigoDoVale } from "@/utils/valeTroca";

const mockBusca = trocaApi.searchSalesForTroca as jest.Mock;

const VENDA_ID = "3f2a9c1e-7b44-4d0a-9e5f-0a1b2c3d4e5f";
const venda = (extra: any = {}) => ({
  id: VENDA_ID,
  total_amount: 249.8,
  payment_method: "pix",
  status: "completed",
  created_at: "2026-12-12T18:42:10Z",
  company_id: "loja-1",
  company_name: "Modas da Ana",
  customer_id: null,
  customer_name: "Maria",
  cpf_cnpj: null,
  seller_id: null,
  seller_name: "Carla",
  is_cross_filial: false,
  has_nfce: false,
  item_count: 1,
  items: [{
    product_id: "p1", variant_id: null, product_name_snapshot: "Vestido Midi Floral",
    quantity: 1, unit_price: 189.9, total_price: 189.9, original_sale_item_id: "item-1",
  }],
  ...extra,
});

function textoDe(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoDe).join("");
  return textoDe(node.children);
}
function achar(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
}
const tudo = (tree: renderer.ReactTestRenderer) => textoDe(tree.toJSON());
// O campo único do passo 1 (a busca de venda).
const campoDaBusca = (tree: renderer.ReactTestRenderer) =>
  tree.root.findAllByType(TextInput).filter((n) => String(n.props.placeholder || "").includes("Bipe o código de barras"));

async function montar(props: any = {}) {
  let t!: renderer.ReactTestRenderer;
  await act(async () => {
    t = renderer.create(
      <TrocaModal visible companyId="loja-1" products={[]} onClose={() => {}} {...props} />,
    );
  });
  await act(async () => {});
  return t;
}

beforeEach(() => {
  mockBusca.mockReset();
  mockBusca.mockResolvedValue([]);
});

describe("bipe do QR → leitor do Caixa", () => {
  it("o código chega inteiro pelo leitor global e é reconhecido como vale", () => {
    jest.useFakeTimers();
    try {
      const lidos: string[] = [];
      function Leitor() {
        useGlobalBarcodeScanner({ onScan: (c) => lidos.push(c) });
        return null;
      }
      act(() => { renderer.create(<Leitor />); });
      const codigo = montarCodigoDoVale(VENDA_ID);
      let t = 5_000_000;
      for (const ch of codigo) {
        const ev = new KeyboardEvent("keydown", { key: ch });
        Object.defineProperty(ev, "timeStamp", { value: t });
        act(() => { window.dispatchEvent(ev); });
        t += 8;
      }
      const enter = new KeyboardEvent("keydown", { key: "Enter" });
      Object.defineProperty(enter, "timeStamp", { value: t });
      act(() => { window.dispatchEvent(enter); });
      expect(lidos).toEqual([codigo]);
      expect(lerCodigoDoVale(lidos[0])).toEqual({ saleId: VENDA_ID });
    } finally {
      jest.useRealTimers();
    }
  });

  it("o código chega inteiro pelo campo de busca do Caixa (sem sobrar texto no campo)", () => {
    jest.useFakeTimers();
    try {
      let texto = "";
      const lidos: string[] = [];
      const leitor = criarLeitorDeCampo({
        valor: () => texto,
        escrever: (v) => { texto = v; },
        onLeitura: (c) => lidos.push(c),
      });
      let t = 7_000_000;
      for (const ch of montarCodigoDoVale(VENDA_ID)) {
        let segurou = false;
        leitor.tecla({ key: ch, timeStamp: t, preventDefault: () => { segurou = true; } });
        if (!segurou) texto += ch;
        t += 8;
      }
      leitor.tecla({ key: "Enter", timeStamp: t, preventDefault: () => {} });
      expect(lidos).toEqual([montarCodigoDoVale(VENDA_ID)]);
      expect(texto).toBe("");
      expect(lerCodigoDoVale(lidos[0])?.saleId).toBe(VENDA_ID);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("Troca aberta pelo vale", () => {
  it("busca a venda pelo ID (365 dias), pula a busca e entra no passo 2 com a origem e o prazo", async () => {
    mockBusca.mockResolvedValue([venda()]);
    jest.useFakeTimers({ now: new Date("2027-01-10T15:00:00Z"), doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
    try {
      const t = await montar({ vale: { saleId: VENDA_ID } });
      expect(mockBusca).toHaveBeenCalledTimes(1);
      expect(mockBusca).toHaveBeenCalledWith("loja-1", { order_number: VENDA_ID, days: 365, limit: 5 });
      const faixa = achar(t, "vale-troca-lido");
      expect(faixa).toHaveLength(1);
      const txt = textoDe(faixa[0].children);
      expect(txt).toContain("Lido pelo vale-troca");
      expect(txt).toContain("#3F2A9C1E");
      expect(txt).toContain("Troca até 31/01/2027");
      expect(achar(t, "vale-troca-vencido")).toHaveLength(0);
      expect(achar(t, "vale-troca-aviso")).toHaveLength(0);
      // passo 2 ("Devolver"): o campo de busca do passo 1 não está mais na tela
      expect(campoDaBusca(t)).toHaveLength(0);
      expect(tudo(t)).toContain("Marque o que o cliente esta devolvendo");
      expect(tudo(t)).toContain("Vestido Midi Floral");
    } finally {
      jest.useRealTimers();
    }
  });

  it("venda de outra filial do grupo mostra de qual", async () => {
    mockBusca.mockResolvedValue([venda({ is_cross_filial: true, company_name: "Filial Centro" })]);
    const t = await montar({ vale: { saleId: VENDA_ID } });
    expect(textoDe(achar(t, "vale-troca-lido")[0].children)).toContain("Filial Centro");
  });

  it("venda que não existe (ou é de fora do grupo): aviso claro e a busca do passo 1 segue livre", async () => {
    mockBusca.mockResolvedValue([]);
    const t = await montar({ vale: { saleId: VENDA_ID } });
    const aviso = achar(t, "vale-troca-aviso");
    expect(aviso).toHaveLength(1);
    expect(textoDe(aviso[0].children)).toContain("Não achei a venda deste vale-troca");
    expect(achar(t, "vale-troca-lido")).toHaveLength(0);
    expect(campoDaBusca(t).length).toBeGreaterThan(0); // passo 1
    expect(tudo(t)).toContain("Busque ou escolha uma venda recente");
  });

  it("a API devolve outra venda parecida: não vale (confere o ID inteiro)", async () => {
    mockBusca.mockResolvedValue([venda({ id: "ffffffff-7b44-4d0a-9e5f-0a1b2c3d4e5f" })]);
    const t = await montar({ vale: { saleId: VENDA_ID } });
    expect(achar(t, "vale-troca-aviso")).toHaveLength(1);
  });

  it("falha de conexão: avisa para bipar de novo", async () => {
    mockBusca.mockRejectedValue(new Error("rede"));
    const t = await montar({ vale: { saleId: VENDA_ID } });
    expect(textoDe(achar(t, "vale-troca-aviso")[0].children)).toContain("Confira a conexão");
  });

  it("prazo vencido: avisa, mostra a data e NÃO trava — segue no passo 2", async () => {
    mockBusca.mockResolvedValue([venda()]);
    jest.useFakeTimers({ now: new Date("2027-02-05T15:00:00Z"), doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
    try {
      const t = await montar({ vale: { saleId: VENDA_ID } });
      const faixa = achar(t, "vale-troca-vencido");
      expect(faixa).toHaveLength(1);
      const txt = textoDe(faixa[0].children);
      expect(txt).toContain("terminou em 31/01/2027");
      expect(txt).toContain("Você decide");
      expect(tudo(t)).toContain("Marque o que o cliente esta devolvendo"); // passo 2
      expect(tudo(t)).toContain("Vestido Midi Floral");
    } finally {
      jest.useRealTimers();
    }
  });

  it("venda de fora da campanha: lê o vale, sem prazo do vale (vale o normal da loja)", async () => {
    mockBusca.mockResolvedValue([venda({ created_at: "2026-09-20T15:00:00Z" })]);
    const t = await montar({ vale: { saleId: VENDA_ID } });
    const txt = textoDe(achar(t, "vale-troca-lido")[0].children);
    expect(txt).toContain("prazo normal da loja");
    expect(achar(t, "vale-troca-vencido")).toHaveLength(0);
  });

  it("sem vale (botão Trocar): nenhuma busca extra e nenhuma faixa", async () => {
    const t = await montar({});
    expect(mockBusca).toHaveBeenCalledTimes(1); // só as vendas recentes do passo 1
    expect(mockBusca).toHaveBeenCalledWith("loja-1", { days: 90, limit: 50 });
    expect(achar(t, "vale-troca-lido")).toHaveLength(0);
    expect(achar(t, "vale-troca-aviso")).toHaveLength(0);
  });
});

describe("QR bipado no campo do passo 1 com a Troca já aberta", () => {
  it("não vira busca: carrega a venda do vale e avança", async () => {
    mockBusca.mockImplementation(async (_c: string, p: any) => (p.order_number === VENDA_ID ? [venda()] : []));
    const t = await montar({});
    await act(async () => { campoDaBusca(t)[0].props.onChangeText(montarCodigoDoVale(VENDA_ID)); });
    await act(async () => { campoDaBusca(t)[0].props.onSubmitEditing(); });
    await act(async () => {});
    expect(mockBusca).toHaveBeenCalledWith("loja-1", { order_number: VENDA_ID, days: 365, limit: 5 });
    // nenhuma busca de texto com o código do vale
    expect(mockBusca.mock.calls.some(([, p]) => String(p.q || "").includes("AURA-TROCA"))).toBe(false);
    expect(achar(t, "vale-troca-lido")).toHaveLength(1);
    expect(tudo(t)).toContain("Marque o que o cliente esta devolvendo");
  });
});
