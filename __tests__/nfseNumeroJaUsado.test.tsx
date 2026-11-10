// ============================================================
// NFS-e com série/número já usados por outro emissor (Aura-backend#992)
//   - NfseVendaCard (venda concluída) e NfseDaOrigem (detalhe da venda, OS,
//     cobrança): motivo_codigo DPS_NUMERO_JA_USADO mostra a mensagem do
//     backend, sem frase nossa por cima, e "Tentar de novo".
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
jest.mock("@/utils/entregarTomador", () => ({ entregarTomadorDaVenda: jest.fn(() => Promise.resolve(null)) }));

import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Text } from "react-native";
import { NfseVendaCard } from "@/components/nfse/NfseVendaCard";
import { NfseDaOrigem } from "@/components/nfse/NfseDaOrigem";
import { numeroJaUsado } from "@/utils/nfseAutomatica";

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

const MSG = "A série 1 e o número 1 da DPS já foram usados por outro emissor desta empresa. Confira na configuração da NFS-e a Série da DPS e o último Número usado e tente de novo.";
const notaJaUsada = () => nota({ estado: "erro", nfse_id: null, nfse_number: null, chave_acesso: null, motivo_codigo: "DPS_NUMERO_JA_USADO", motivo: MSG });
/** Todo o texto de um nó (Text aninhado incluído). */
function textos(node: any): string {
  return node.findAllByType(Text).map((t: any) => [t.props.children].flat(Infinity).filter((c: any) => typeof c === "string").join("")).join(" ");
}

beforeEach(() => {
  jest.useFakeTimers();
  [mockSituacao, mockEmitir, mockTentar, mockCompletar].forEach((m) => m.mockReset());
});
afterEach(() => { act(() => { tree && tree.unmount(); }); jest.useRealTimers(); });

test("regra: só a nota em erro com DPS_NUMERO_JA_USADO", () => {
  expect(numeroJaUsado(sit("erro", "tentar_de_novo", [notaJaUsada()]) as any)).toBe(true);
  expect(numeroJaUsado(sit("erro", "tentar_de_novo", [nota({ estado: "erro", motivo_codigo: "INESPERADO" })]) as any)).toBe(false);
  expect(numeroJaUsado(null)).toBe(false);
});

test("venda concluída: a mensagem do backend e \"Tentar de novo\"", async () => {
  mockSituacao.mockResolvedValue(sit("erro", "tentar_de_novo", [notaJaUsada()]));
  mockTentar.mockResolvedValue(sit("emitindo", "aguardar", [nota({ estado: "emitindo", nfse_id: null })]));
  await render(<NfseVendaCard companyId="loja-1" saleId="v1" servicos="Corte feminino" totalServicos={80} />);
  expect(tem("nfse-venda-problema")).toBe(true);
  const t = textos(achar("nfse-venda-problema"));
  expect(t).toContain(MSG);
  expect(t).not.toContain("a nota não sai duas vezes");
  expect(textos(achar("nfse-venda-tentar"))).toContain("Tentar de novo");
  await act(async () => { achar("nfse-venda-tentar").props.onPress(); });
  expect(mockTentar).toHaveBeenCalledWith("loja-1", "venda", "v1");
});

test("detalhe da venda: a mensagem do backend e \"Tentar de novo\"", async () => {
  mockSituacao.mockResolvedValue(sit("erro", "tentar_de_novo", [notaJaUsada()]));
  mockTentar.mockResolvedValue(sit("emitindo", "aguardar", [nota({ estado: "emitindo", nfse_id: null })]));
  await render(<NfseDaOrigem companyId="loja-1" tipo="venda" id="v1" origem="venda" testID="venda-nfse" />);
  const t = textos(achar("venda-nfse-problema"));
  expect(t).toContain(MSG);
  expect(t).not.toContain("pode emitir com tranquilidade");
  expect(textos(achar("venda-nfse-emitir"))).toContain("Tentar de novo");
  await act(async () => { achar("venda-nfse-emitir").props.onPress(); });
  expect(mockTentar).toHaveBeenCalledTimes(1);
});

test("outro erro segue com \"Emitir NFS-e\" no detalhe", async () => {
  mockSituacao.mockResolvedValue(sit("erro", "tentar_de_novo", [nota({ estado: "erro", nfse_id: null, motivo: "Fora do ar." })]));
  await render(<NfseDaOrigem companyId="loja-1" tipo="venda" id="v1" />);
  expect(textos(achar("nfse-origem-emitir"))).toContain("Emitir NFS-e");
});
