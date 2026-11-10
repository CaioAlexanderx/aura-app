// ============================================================
// NFS-e automática — telas (mockup nfse-cadastro-servico.html, telas 4 e 5)
//   - NfseVendaCard (venda concluída): emitindo, emitida, pendente (Completar
//     o cliente), erro (Tentar de novo), sem código (cadastro do serviço);
//   - NfseDaOrigem (OS, venda, cobrança): nota emitida = só "Imprimir 2ª
//     via"; falha/pendência = "Emitir NFS-e"; 'nenhuma' = nada;
//   - SaleComplete: dois cartões (NFC-e dos produtos + NFS-e) com o opt-in;
//     venda só de produto igual a antes;
//   - NfceActions: venda só de serviço (skipped) sem "autorizada" falso.
// ============================================================
jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("@/components/karate/FpktLogo", () => ({ FpktLogo: () => null, default: () => null }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/QrCode", () => ({ QrCode: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock("@/services/printWindow", () => ({ openPrintWindow: jest.fn() }));
jest.mock("@/services/api", () => ({ BASE_URL: "http://api.test", request: jest.fn() }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ company: { id: "loja-1", name: "Loja Centro" }, token: "t", isDemo: false, companyCount: 1 }),
}));
const mockSituacao = jest.fn();
const mockEmitir = jest.fn();
const mockTentar = jest.fn();
const mockCompletar = jest.fn();
const mockConfig = jest.fn();
jest.mock("@/services/nfseAutomaticaApi", () => ({
  nfseAutomaticaApi: {
    situacao: (...a: any[]) => mockSituacao(...a),
    emitir: (...a: any[]) => mockEmitir(...a),
    tentarDeNovo: (...a: any[]) => mockTentar(...a),
    completar: (...a: any[]) => mockCompletar(...a),
    config: (...a: any[]) => mockConfig(...a),
    pdfPath: () => "/x.pdf",
  },
}));
const mockEmitNfce = jest.fn();
jest.mock("@/services/nfceApi", () => ({ nfceApi: { emit: (...a: any[]) => mockEmitNfce(...a), get: jest.fn(), getConfig: jest.fn() } }));
let mockCfgAtiva = true;
jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (o: any) => (o && o.queryKey && o.queryKey[0] === "nfse-automatica-config")
      ? { data: { ativa: mockCfgAtiva }, isLoading: false }
      : { data: undefined, isLoading: false },
  };
});
jest.mock("@/components/screens/pdv/OsActions", () => ({ OsActions: () => null }));
jest.mock("@/components/screens/pdv/WarrantySaleActions", () => ({ WarrantySaleActions: () => null }));
jest.mock("@/utils/entregarTomador", () => ({ entregarTomadorDaVenda: jest.fn(() => Promise.resolve(null)) }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "@/components/Toast";
import { NfseVendaCard } from "@/components/nfse/NfseVendaCard";
import { NfseDaOrigem } from "@/components/nfse/NfseDaOrigem";
import { NfceActions } from "@/components/screens/pdv/NfceActions";
import { SaleComplete } from "@/components/screens/pdv/SaleComplete";
import { entregarTomadorDaVenda } from "@/utils/entregarTomador";

function nota(p: any = {}) {
  return {
    id: "r1", origem_tipo: "venda", origem_id: "v1", ctribnac: "060101", estado: "emitida", motivo: null,
    motivo_codigo: null, valor: 80, gatilho: "venda", nfse_id: "n1", nfse_number: "312", chave_acesso: "3550308",
    emitida_em: null, atualizado_em: null, ...p,
  };
}
function sit(estado: string, acao: string, notas: any[] = []) {
  return { origem: { tipo: "venda", id: "v1" }, estado, acao, tem_nota: estado === "emitida", notas };
}

let tree: renderer.ReactTestRenderer;
const qc = new QueryClient();
async function render(el: React.ReactElement) {
  await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); });
  await act(async () => { await Promise.resolve(); });
}
const tem = (id: string) => tree.root.findAll((n) => n.props.testID === id, { deep: false }).length > 0;
const achar = (id: string) => tree.root.findAll((n) => n.props.testID === id, { deep: false })[0];

beforeEach(() => {
  jest.useFakeTimers();
  [mockSituacao, mockEmitir, mockTentar, mockCompletar, mockEmitNfce].forEach((m) => m.mockReset());
  (toast.success as jest.Mock).mockClear();
  (entregarTomadorDaVenda as jest.Mock).mockClear();
  mockCfgAtiva = true;
});
afterEach(() => { act(() => { tree && tree.unmount(); }); jest.useRealTimers(); });

const CARD = { companyId: "loja-1", saleId: "v1", servicos: "Corte feminino", totalServicos: 80 };

describe("NfseVendaCard — cada estado", () => {
  test("emitindo: botões desabilitados e o polling continua", async () => {
    mockSituacao.mockResolvedValue(sit("emitindo", "aguardar", [nota({ estado: "emitindo", nfse_id: null })]));
    await render(<NfseVendaCard {...CARD} />);
    expect(tem("nfse-venda-emitindo")).toBe(true);
    expect(mockSituacao).toHaveBeenCalledTimes(1);
    expect(mockSituacao).toHaveBeenCalledWith("loja-1", "venda", "v1");
    mockSituacao.mockResolvedValue(sit("emitida", "imprimir_2a_via", [nota()]));
    await act(async () => { jest.advanceTimersByTime(1500); });
    await act(async () => { await Promise.resolve(); });
    expect(mockSituacao).toHaveBeenCalledTimes(2);
    expect(tem("nfse-venda-emitida")).toBe(true);
    // estado final: o polling para
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(mockSituacao).toHaveBeenCalledTimes(2);
  });

  test("emitida: Imprimir NFS-e e WhatsApp", async () => {
    mockSituacao.mockResolvedValue(sit("emitida", "imprimir_2a_via", [nota()]));
    await render(<NfseVendaCard {...CARD} customerPhone="11999998888" />);
    expect(tem("nfse-venda-emitida")).toBe(true);
    expect(tem("nfse-venda-imprimir")).toBe(true);
    expect(tem("nfse-venda-whatsapp")).toBe(true);
    expect(tem("nfse-venda-tentar")).toBe(false);
  });

  test("pendente sem tomador: Completar o cliente; o documento do Caixa é levado", async () => {
    mockSituacao.mockResolvedValue(sit("pendente_dados", "completar_dados", [nota({ estado: "pendente_dados", nfse_id: null, motivo_codigo: "SEM_TOMADOR", motivo: "Falta o CPF/CNPJ de quem contratou o serviço." })]));
    await render(<NfseVendaCard {...CARD} tomador={{ doc: "52998224725", nome: null }} />);
    expect(entregarTomadorDaVenda).toHaveBeenCalledWith({ companyId: "loja-1", saleId: "v1", tomador: { doc: "52998224725", nome: null } });
    expect(tem("nfse-venda-pendente")).toBe(true);
    await act(async () => { achar("nfse-venda-completar").props.onPress(); });
    expect(tem("nfse-completar")).toBe(true);
    expect(achar("nfse-completar-doc").props.value).toBe("529.982.247-25");
  });

  test("erro: Tentar de novo chama a nova tentativa", async () => {
    mockSituacao.mockResolvedValue(sit("erro", "tentar_de_novo", [nota({ estado: "erro", nfse_id: null, motivo: "O sistema da prefeitura está fora do ar." })]));
    mockTentar.mockResolvedValue(sit("emitindo", "aguardar", [nota({ estado: "emitindo", nfse_id: null })]));
    await render(<NfseVendaCard {...CARD} />);
    expect(tem("nfse-venda-problema")).toBe(true);
    expect(tem("nfse-venda-cadastro")).toBe(false);
    await act(async () => { achar("nfse-venda-tentar").props.onPress(); });
    expect(mockTentar).toHaveBeenCalledWith("loja-1", "venda", "v1");
    expect(mockEmitir).not.toHaveBeenCalled();
    expect(tem("nfse-venda-emitindo")).toBe(true);
  });

  test("serviço sem código: atalho para o cadastro do serviço", async () => {
    mockSituacao.mockResolvedValue(sit("erro", "cadastrar_codigo", [nota({ estado: "erro", ctribnac: "000000", nfse_id: null, motivo_codigo: "SEM_CODIGO", motivo: "Falta o código de tributação nacional do serviço." })]));
    await render(<NfseVendaCard {...CARD} />);
    expect(tem("nfse-venda-problema")).toBe(true);
    expect(tem("nfse-venda-cadastro")).toBe(true);
  });
});

describe("NfseDaOrigem — 2ª via contra Emitir", () => {
  test("nota emitida: só Imprimir 2ª via", async () => {
    mockSituacao.mockResolvedValue(sit("emitida", "imprimir_2a_via", [nota({ gatilho: "os" })]));
    await render(<NfseDaOrigem companyId="loja-2" tipo="os" id="os-1" origem="os" />);
    expect(mockSituacao).toHaveBeenCalledWith("loja-2", "os", "os-1");
    expect(tem("nfse-origem-2a-via")).toBe(true);
    expect(tem("nfse-origem-emitir")).toBe(false);
    expect(tem("ajuda-fiscal")).toBe(true);
  });

  test("falha: Emitir NFS-e (nunca a 2ª via)", async () => {
    mockSituacao.mockResolvedValue(sit("erro", "tentar_de_novo", [nota({ estado: "erro", nfse_id: null, motivo: "Fora do ar." })]));
    mockTentar.mockResolvedValue(sit("emitida", "imprimir_2a_via", [nota()]));
    await render(<NfseDaOrigem companyId="loja-1" tipo="venda" id="v1" />);
    expect(tem("nfse-origem-emitir")).toBe(true);
    expect(tem("nfse-origem-2a-via")).toBe(false);
    await act(async () => { achar("nfse-origem-emitir").props.onPress(); });
    expect(mockTentar).toHaveBeenCalledTimes(1);
    expect(tem("nfse-origem-2a-via")).toBe(true);
    expect(tem("nfse-origem-emitir")).toBe(false);
  });

  test("pendência do cliente: Completar o cliente + Emitir NFS-e", async () => {
    mockSituacao.mockResolvedValue(sit("pendente_dados", "completar_dados", [nota({ estado: "pendente_dados", nfse_id: null, motivo_codigo: "SEM_TOMADOR" })]));
    await render(<NfseDaOrigem companyId="loja-1" tipo="venda" id="v1" origem="cobranca" />);
    expect(tem("nfse-origem-completar")).toBe(true);
    expect(tem("nfse-origem-emitir")).toBe(true);
  });

  test("'nenhuma' (só produto / loja sem NFS-e): não renderiza e não fica consultando", async () => {
    mockSituacao.mockResolvedValue(sit("nenhuma", "emitir"));
    await render(<NfseDaOrigem companyId="loja-1" tipo="venda" id="v1" />);
    expect(tem("nfse-origem")).toBe(false);
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(mockSituacao).toHaveBeenCalledTimes(1);
  });
});

const VENDA_BASE = {
  id: "v1", saleNumber: 428, total: 119.9, payment: "pix", date: "", subtotal: 119.9, discount: 0,
};

describe("SaleComplete — duas notas", () => {
  test("venda mista com opt-in: cartão da NFC-e e cartão da NFS-e, com ajuda", async () => {
    mockSituacao.mockResolvedValue(sit("emitindo", "aguardar"));
    const sale: any = {
      ...VENDA_BASE,
      items: [
        { productId: "p1", name: "Shampoo", price: 39.9, qty: 1, unit: "un" },
        { productId: "s1", name: "Corte feminino", price: 80, qty: 1, unit: "srv" },
      ],
      tomador: { doc: "52998224725", nome: null }, cpfNaNota: "52998224725",
    };
    await render(<SaleComplete sale={sale} onNewSale={() => {}} />);
    expect(tem("venda-duas-notas")).toBe(true);
    expect(tem("venda-nota-nfce")).toBe(true);
    expect(tem("nfse-venda-emitindo")).toBe(true);
    expect(tem("ajuda-fiscal")).toBe(true);
    expect(achar("venda-doc-tomador").props.children).toBe("529.982.247-25");
  });

  test("só de serviço com opt-in: sem cartão de NFC-e", async () => {
    mockSituacao.mockResolvedValue(sit("emitindo", "aguardar"));
    const sale: any = { ...VENDA_BASE, total: 80, items: [{ productId: "s1", name: "Corte", price: 80, qty: 1, unit: "srv" }] };
    await render(<SaleComplete sale={sale} onNewSale={() => {}} />);
    expect(tem("venda-duas-notas")).toBe(true);
    expect(tem("venda-nota-nfce")).toBe(false);
  });

  test("só de produto: nenhuma das novidades, nem consulta de NFS-e", async () => {
    const sale: any = { ...VENDA_BASE, total: 39.9, items: [{ productId: "p1", name: "Shampoo", price: 39.9, qty: 1, unit: "un" }] };
    await render(<SaleComplete sale={sale} onNewSale={() => {}} />);
    expect(tem("venda-duas-notas")).toBe(false);
    expect(tem("ajuda-fiscal")).toBe(false);
    expect(mockSituacao).not.toHaveBeenCalled();
  });

  test("loja sem opt-in: serviço segue com a tela de sempre", async () => {
    mockCfgAtiva = false;
    const sale: any = { ...VENDA_BASE, total: 80, items: [{ productId: "s1", name: "Corte", price: 80, qty: 1, unit: "srv" }] };
    await render(<SaleComplete sale={sale} onNewSale={() => {}} />);
    expect(tem("venda-duas-notas")).toBe(false);
    expect(mockSituacao).not.toHaveBeenCalled();
  });
});

describe("NfceActions — venda só de serviço (skipped)", () => {
  test("mostra a frase neutra, sem 'autorizada' e sem toast de sucesso", async () => {
    mockEmitNfce.mockResolvedValue({ skipped: true, reason: "somente_servicos", nfce: null, message: "Venda so de servicos" });
    await render(
      <NfceActions companyId="loja-1" saleId="v1" items={[{ product_id: "s1", product_name: "Corte", quantity: 1, unit_price: 80 }]} total={80} autoEmit />,
    );
    await act(async () => { await Promise.resolve(); });
    expect(mockEmitNfce).toHaveBeenCalledTimes(1);
    expect(tem("nfce-pulada")).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
