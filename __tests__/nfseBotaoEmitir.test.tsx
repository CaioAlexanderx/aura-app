// ============================================================
// Botão "Emitir NFS-e" (10/11/2026, Aura-backend#989) — a loja emite NFS-e
// (config.emite) mas sem a emissão automática:
//   - SaleComplete: o botão aparece só com serviço + emite; com a
//     automática ligada fica como antes (sem botão manual extra); venda só
//     de produto intacta;
//   - NfseVendaCard (manual): toque sem tomador abre o completar; toque com
//     tomador chama /emitir com ele; com cliente sem documento, /emitir e,
//     se voltar pendente, o completar abre; estados depois de emitir;
//   - NfseDaOrigem (detalhe da venda): 'nenhuma' + pode_emitir = "Emitir
//     NFS-e"; depois de emitida, "Imprimir 2ª via".
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
jest.mock("@/services/nfseAutomaticaApi", () => ({
  nfseAutomaticaApi: {
    situacao: (...a: any[]) => mockSituacao(...a),
    emitir: (...a: any[]) => mockEmitir(...a),
    tentarDeNovo: (...a: any[]) => mockTentar(...a),
    completar: (...a: any[]) => mockCompletar(...a),
    config: jest.fn(),
    pdfPath: () => "/x.pdf",
  },
}));
const mockEmitNfce = jest.fn();
jest.mock("@/services/nfceApi", () => ({ nfceApi: { emit: (...a: any[]) => mockEmitNfce(...a), get: jest.fn(), getConfig: jest.fn() } }));
let mockCfg: any = null;
jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (o: any) => (o && o.queryKey && o.queryKey[0] === "nfse-automatica-config")
      ? { data: mockCfg, isLoading: false }
      : { data: undefined, isLoading: false },
  };
});
jest.mock("@/components/screens/pdv/OsActions", () => ({ OsActions: () => null }));
jest.mock("@/components/screens/pdv/WarrantySaleActions", () => ({ WarrantySaleActions: () => null }));
jest.mock("@/utils/entregarTomador", () => ({ entregarTomadorDaVenda: jest.fn(() => Promise.resolve(null)) }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NfseVendaCard } from "@/components/nfse/NfseVendaCard";
import { NfseDaOrigem } from "@/components/nfse/NfseDaOrigem";
import { SaleComplete } from "@/components/screens/pdv/SaleComplete";
import { entregarTomadorDaVenda } from "@/utils/entregarTomador";

function nota(p: any = {}) {
  return {
    id: "r1", origem_tipo: "venda", origem_id: "v1", ctribnac: "060101", estado: "emitida", motivo: null,
    motivo_codigo: null, valor: 80, gatilho: "manual", nfse_id: "n1", nfse_number: "312", chave_acesso: "3550308",
    emitida_em: null, atualizado_em: null, ...p,
  };
}
function sit(estado: string, acao: string, notas: any[] = [], extra: any = {}) {
  return { origem: { tipo: "venda", id: "v1" }, estado, acao, tem_nota: estado === "emitida", notas, ...extra };
}
const NENHUMA_PODE = () => sit("nenhuma", "emitir", [], { emite: true, tem_servico: true, pode_emitir: true });

let tree: renderer.ReactTestRenderer;
const qc = new QueryClient();
async function render(el: React.ReactElement) {
  await act(async () => { tree = renderer.create(<QueryClientProvider client={qc}>{el}</QueryClientProvider>); });
  await act(async () => { await Promise.resolve(); });
}
const tem = (id: string) => tree.root.findAll((n) => n.props.testID === id, { deep: false }).length > 0;
const achar = (id: string) => tree.root.findAll((n) => n.props.testID === id, { deep: false })[0];
async function tocar(id: string) { await act(async () => { await achar(id).props.onPress(); }); }
async function digitar(id: string, v: string) { await act(async () => { achar(id).props.onChangeText(v); }); }

const SO_EMITE = { ligada_no_servidor: false, tem_config: true, provider: "nacional", emissao_automatica: false, ativa: false, emite: true };
const AUTOMATICA = { ligada_no_servidor: true, tem_config: true, provider: "nacional", emissao_automatica: true, ativa: true, emite: true };

beforeEach(() => {
  jest.useFakeTimers();
  [mockSituacao, mockEmitir, mockTentar, mockCompletar, mockEmitNfce].forEach((m) => m.mockReset());
  (entregarTomadorDaVenda as jest.Mock).mockClear();
  mockCfg = SO_EMITE;
});
afterEach(() => { act(() => { tree && tree.unmount(); }); jest.useRealTimers(); });

const VENDA_BASE = { id: "v1", saleNumber: 428, total: 119.9, payment: "pix", date: "", subtotal: 119.9, discount: 0 };
const MISTA = [
  { productId: "p1", name: "Shampoo", price: 39.9, qty: 1, unit: "un" },
  { productId: "s1", name: "Corte feminino", price: 80, qty: 1, unit: "srv" },
];
const SO_SERVICO = [{ productId: "s1", name: "Corte", price: 80, qty: 1, unit: "srv" }];
const SO_PRODUTO = [{ productId: "p1", name: "Shampoo", price: 39.9, qty: 1, unit: "un" }];

describe("SaleComplete — o botão aparece só com serviço + emite", () => {
  test("venda mista, loja que emite sem a automática: NFC-e, botão Emitir NFS-e e ajuda", async () => {
    mockSituacao.mockResolvedValue(sit("nenhuma", "emitir"));
    await render(<SaleComplete sale={{ ...VENDA_BASE, items: MISTA } as any} onNewSale={() => {}} />);
    expect(tem("venda-duas-notas")).toBe(true);
    expect(tem("venda-nota-nfce")).toBe(true);
    expect(tem("nfse-venda-manual")).toBe(true);
    expect(tem("nfse-venda-emitir")).toBe(true);
    expect(tem("nfse-venda-emitindo")).toBe(false);
    expect(tem("ajuda-fiscal")).toBe(true);
    // nada vai sair sozinho: 'nenhuma' para o polling e a rede de segurança não roda
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(mockSituacao).toHaveBeenCalledTimes(1);
    expect(entregarTomadorDaVenda).not.toHaveBeenCalled();
  });

  test("só de serviço: botão sem o cartão da NFC-e", async () => {
    mockSituacao.mockResolvedValue(sit("nenhuma", "emitir"));
    await render(<SaleComplete sale={{ ...VENDA_BASE, total: 80, items: SO_SERVICO } as any} onNewSale={() => {}} />);
    expect(tem("nfse-venda-emitir")).toBe(true);
    expect(tem("venda-nota-nfce")).toBe(false);
  });

  test("loja que não emite (emite=false, sem automática): tela de sempre, sem consulta", async () => {
    mockCfg = { ...SO_EMITE, emite: false };
    await render(<SaleComplete sale={{ ...VENDA_BASE, total: 80, items: SO_SERVICO } as any} onNewSale={() => {}} />);
    expect(tem("venda-duas-notas")).toBe(false);
    expect(tem("nfse-venda-emitir")).toBe(false);
    expect(mockSituacao).not.toHaveBeenCalled();
  });

  test("backend anterior (config sem emite): tela de sempre", async () => {
    mockCfg = { ativa: false };
    await render(<SaleComplete sale={{ ...VENDA_BASE, total: 80, items: SO_SERVICO } as any} onNewSale={() => {}} />);
    expect(tem("venda-duas-notas")).toBe(false);
    expect(mockSituacao).not.toHaveBeenCalled();
  });

  test("automática ligada: comportamento de hoje, sem botão manual extra", async () => {
    mockCfg = AUTOMATICA;
    mockSituacao.mockResolvedValue(sit("nenhuma", "emitir"));
    const sale: any = { ...VENDA_BASE, items: MISTA, tomador: { doc: "52998224725", nome: null }, cpfNaNota: "52998224725" };
    await render(<SaleComplete sale={sale} onNewSale={() => {}} />);
    expect(tem("venda-duas-notas")).toBe(true);
    expect(tem("nfse-venda-emitindo")).toBe(true);
    expect(tem("nfse-venda-manual")).toBe(false);
    expect(tem("nfse-venda-emitir")).toBe(false);
    expect(entregarTomadorDaVenda).toHaveBeenCalledTimes(1);
    // 'nenhuma' segue no polling (o gatilho ainda vai rodar)
    await act(async () => { jest.advanceTimersByTime(1500); });
    expect(mockSituacao).toHaveBeenCalledTimes(2);
  });

  test("venda só de produto intacta: nenhuma novidade, nem consulta", async () => {
    await render(<SaleComplete sale={{ ...VENDA_BASE, total: 39.9, items: SO_PRODUTO } as any} onNewSale={() => {}} />);
    expect(tem("venda-duas-notas")).toBe(false);
    expect(tem("nfse-venda-emitir")).toBe(false);
    expect(tem("ajuda-fiscal")).toBe(false);
    expect(mockSituacao).not.toHaveBeenCalled();
  });
});

const CARD = { companyId: "loja-1", saleId: "v1", servicos: "Corte feminino", totalServicos: 80, automatica: false };

describe("NfseVendaCard manual — o toque", () => {
  test("sem tomador e sem cliente: abre o completar, sem chamar o emitir; completar emite", async () => {
    mockSituacao.mockResolvedValue(sit("nenhuma", "emitir"));
    mockCompletar.mockResolvedValue(sit("emitida", "imprimir_2a_via", [nota()]));
    await render(<NfseVendaCard {...CARD} />);
    await tocar("nfse-venda-emitir");
    expect(mockEmitir).not.toHaveBeenCalled();
    expect(tem("nfse-completar")).toBe(true);
    expect(achar("nfse-completar-enviar").props.disabled).toBe(true);
    await digitar("nfse-completar-doc", "52998224725");
    await digitar("nfse-completar-nome", "Maria Souza");
    await tocar("nfse-completar-enviar");
    expect(mockCompletar).toHaveBeenCalledWith("loja-1", "venda", "v1", { doc: "52998224725", nome: "Maria Souza" });
    expect(tem("nfse-venda-emitida")).toBe(true);
    expect(tem("nfse-venda-imprimir")).toBe(true);
  });

  test("Voltar do completar mostra o botão de novo", async () => {
    mockSituacao.mockResolvedValue(sit("nenhuma", "emitir"));
    await render(<NfseVendaCard {...CARD} />);
    await tocar("nfse-venda-emitir");
    await tocar("nfse-completar-cancelar");
    expect(tem("nfse-completar")).toBe(false);
    expect(tem("nfse-venda-emitir")).toBe(true);
  });

  test("com o tomador do Caixa: chama o emitir com ele e acompanha até emitida", async () => {
    mockSituacao.mockResolvedValue(sit("nenhuma", "emitir"));
    mockEmitir.mockResolvedValue(sit("emitindo", "aguardar", [nota({ estado: "emitindo", nfse_id: null })]));
    await render(<NfseVendaCard {...CARD} tomador={{ doc: "529.982.247-25", nome: "Maria Souza" }} customerPhone="11999998888" />);
    await tocar("nfse-venda-emitir");
    expect(mockEmitir).toHaveBeenCalledTimes(1);
    expect(mockEmitir).toHaveBeenCalledWith("loja-1", "venda", "v1", { doc: "52998224725", nome: "Maria Souza" });
    expect(tem("nfse-completar")).toBe(false);
    expect(tem("nfse-venda-emitindo")).toBe(true);
    mockSituacao.mockResolvedValue(sit("emitida", "imprimir_2a_via", [nota()]));
    await act(async () => { jest.advanceTimersByTime(1500); });
    await act(async () => { await Promise.resolve(); });
    expect(tem("nfse-venda-emitida")).toBe(true);
    expect(tem("nfse-venda-imprimir")).toBe(true);
    expect(tem("nfse-venda-whatsapp")).toBe(true);
    expect(tem("nfse-venda-emitir")).toBe(false);
  });

  test("cliente na venda sem documento digitado: emitir sem tomador; pendente abre o completar", async () => {
    mockSituacao.mockResolvedValue(sit("nenhuma", "emitir"));
    mockEmitir.mockResolvedValue(sit("pendente_dados", "completar_dados", [nota({ estado: "pendente_dados", nfse_id: null, motivo_codigo: "SEM_TOMADOR", motivo: "Falta o CPF/CNPJ de quem contratou o serviço." })]));
    await render(<NfseVendaCard {...CARD} customerId="cli-1" />);
    await tocar("nfse-venda-emitir");
    expect(mockEmitir).toHaveBeenCalledWith("loja-1", "venda", "v1", null);
    expect(tem("nfse-venda-pendente")).toBe(true);
    expect(tem("nfse-completar")).toBe(true);
  });

  test("emitir com problema: mostra o motivo e Tentar de novo (nova tentativa)", async () => {
    mockSituacao.mockResolvedValue(sit("nenhuma", "emitir"));
    mockEmitir.mockResolvedValue(sit("erro", "tentar_de_novo", [nota({ estado: "erro", nfse_id: null, motivo: "O sistema da prefeitura está fora do ar." })]));
    mockTentar.mockResolvedValue(sit("emitida", "imprimir_2a_via", [nota()]));
    await render(<NfseVendaCard {...CARD} tomador={{ doc: "52998224725", nome: "Maria" }} />);
    await tocar("nfse-venda-emitir");
    expect(tem("nfse-venda-problema")).toBe(true);
    await tocar("nfse-venda-tentar");
    expect(mockTentar).toHaveBeenCalledWith("loja-1", "venda", "v1");
    expect(tem("nfse-venda-emitida")).toBe(true);
  });

  test("venda que já tem nota (outra tela emitiu): só Imprimir, sem botão", async () => {
    mockSituacao.mockResolvedValue(sit("emitida", "imprimir_2a_via", [nota()]));
    await render(<NfseVendaCard {...CARD} />);
    expect(tem("nfse-venda-emitida")).toBe(true);
    expect(tem("nfse-venda-emitir")).toBe(false);
  });
});

describe("NfseDaOrigem (detalhe da venda) — o mesmo botão", () => {
  test("serviço sem NFS-e e a loja emite: Emitir NFS-e; depois só a 2ª via", async () => {
    mockSituacao.mockResolvedValue(NENHUMA_PODE());
    mockEmitir.mockResolvedValue(sit("emitida", "imprimir_2a_via", [nota()]));
    await render(<NfseDaOrigem companyId="loja-2" tipo="venda" id="v1" origem="venda" testID="venda-nfse" />);
    expect(tem("venda-nfse-sem-nota")).toBe(true);
    expect(tem("venda-nfse-emitir")).toBe(true);
    expect(tem("venda-nfse-2a-via")).toBe(false);
    expect(tem("ajuda-fiscal")).toBe(true);
    await tocar("venda-nfse-emitir");
    expect(mockEmitir).toHaveBeenCalledWith("loja-2", "venda", "v1", null);
    expect(tem("venda-nfse-2a-via")).toBe(true);
    expect(tem("venda-nfse-emitir")).toBe(false);
  });

  test("toque que volta pendente por falta de quem contratou abre o completar", async () => {
    mockSituacao.mockResolvedValue(NENHUMA_PODE());
    mockEmitir.mockResolvedValue(sit("pendente_dados", "completar_dados", [nota({ estado: "pendente_dados", nfse_id: null, motivo_codigo: "SEM_TOMADOR" })]));
    await render(<NfseDaOrigem companyId="loja-1" tipo="venda" id="v1" testID="venda-nfse" />);
    await tocar("venda-nfse-emitir");
    expect(tem("nfse-completar")).toBe(true);
  });

  test("'nenhuma' sem pode_emitir (só produto, loja que não emite, backend anterior): nada", async () => {
    mockSituacao.mockResolvedValue(sit("nenhuma", "emitir", [], { emite: true, tem_servico: false, pode_emitir: false }));
    await render(<NfseDaOrigem companyId="loja-1" tipo="venda" id="v1" testID="venda-nfse" />);
    expect(tree.toJSON()).toBeNull();
    expect(tem("venda-nfse-emitir")).toBe(false);
    act(() => { tree.unmount(); });
    mockSituacao.mockResolvedValue(sit("nenhuma", "emitir"));
    await render(<NfseDaOrigem companyId="loja-1" tipo="venda" id="v1" testID="venda-nfse" />);
    expect(tree.toJSON()).toBeNull();
  });
});
