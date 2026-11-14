// ============================================================
// Assistente da NF-e 55 de venda (CP4, 14/11/2026) — render dos passos.
//   - abre com /auth/me revalidado e a prévia da venda (GET)
//   - faltante em amarelo, sem bloquear o "Continuar"
//   - Continuar revalida (POST prévia) e mostra itens com CFOP
//   - Revisar: aviso de homologação; Emitir 201 → Pronto (DANFE/XML/e-mail)
//   - 422 faltantes volta ao passo do campo; 409 e recusa em texto humano
//   - celular (375 px): "Passo n de 4"
// Mocks de sempre (Icon, Toast, WebPortal), testID + deep:false. Fictício.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/components/WebPortal", () => ({ WebPortal: ({ children }: any) => children }));
const mockRefreshMe = jest.fn(() => Promise.resolve());
jest.mock("@/stores/auth", () => ({ useAuthStore: Object.assign(() => ({}), { getState: () => ({ refreshMe: mockRefreshMe, token: "t" }) }) }));
jest.mock("@/services/api", () => ({ request: jest.fn(), BASE_URL: "http://x" }));
const mockPrevia = jest.fn();
const mockEmitir = jest.fn();
const mockEnviar = jest.fn();
jest.mock("@/services/nfe55Api", () => ({
  nfe55Api: {
    previa: (...a: any[]) => mockPrevia(...a),
    emitir: (...a: any[]) => mockEmitir(...a),
    enviarEmail: (...a: any[]) => mockEnviar(...a),
    danfePath: () => "/d", xmlPath: () => "/x",
  },
}));
let mockLargura = 1024;
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return Object.assign({}, RN, { useWindowDimensions: () => ({ width: mockLargura, height: 800 }) });
});

import { Nfe55Wizard } from "@/components/nfe55/Nfe55Wizard";

function previa(extra: any = {}) {
  return Object.assign({
    pode_emitir: false, bloqueio: null, nota_existente: null, nota_pendente: null, ambiente: "homologacao",
    faltantes: [{ campo: "destinatario.endereco.cep", mensagem: "CEP do endereço do cliente", tipo: "faltando" }],
    destinatario: {
      documento: "11444777000161", nome: "Construtora Ficticia", ie: "110042490114", ind_ie_dest: 1, email: "compras@exemplo.com",
      endereco: { cep: null, logradouro: "Av. Central", numero: "200", complemento: null, bairro: "Centro", municipio: "Campinas", uf: "SP", codigo_municipio_ibge: null },
      origem: { cadastro: true, ibge: null }, customer_id: "c1",
    },
    operacao: { natureza_operacao: "Venda de mercadoria", uf_emitente: "SP", uf_destino: "SP", id_dest: 1, ind_final: 0, ind_ie_dest: 1, ind_pres: 1 },
    itens: [
      { product_id: "p1", nome: "Cimento", ncm: "25232910", cest: null, unidade: "SC", quantidade: 10, valor_unitario: 35.9, valor_bruto: 359, desconto: 0, frete: 0, valor_total: 359, cfop: "5102", csosn: "102", origem: 0 },
      { product_id: "p2", nome: "Tinta", ncm: "32091010", cest: "2400700", unidade: "UN", quantidade: 1, valor_unitario: 90, valor_bruto: 90, desconto: 0, frete: 0, valor_total: 90, cfop: "5405", csosn: "500", origem: 0 },
    ],
    pagamentos: [{ forma: "pix", tPag: "17", valor: 449, a_prazo: false }],
    totais: { produtos: 449, desconto: 0, frete: 0, nota: 449 },
    frete: { modalidade: 9, transportadora: null },
  }, extra);
}

const AUTORIZADA = {
  nfe: { id: "em-1", numero: 15, serie: 2, status: "autorizada", chave_acesso: "35261111222333000181550020000000151123456786", protocolo: "135260000000001", authorized_at: "2026-11-14T13:00:05Z" },
  status: "autorizada", chave_acesso: "35261111222333000181550020000000151123456786", protocolo: "135260000000001",
  numero: 15, serie: 2, cStat: "100", motivo: "Autorizado", ambiente: "homologacao",
};

function texto(node: any): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join("");
  return texto(node.children);
}
const porId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAllByProps({ testID: id }, { deep: false });
const tudo = (t: renderer.ReactTestRenderer) => texto(t.toJSON());
const flush = () => new Promise((r) => setTimeout(r, 0));

async function montar(props: any = {}) {
  let t!: renderer.ReactTestRenderer;
  await act(async () => {
    t = renderer.create(<Nfe55Wizard visible companyId="loja-b" saleId="venda-1" saleNumber={1284} onClose={jest.fn()} {...props} />);
    await flush();
  });
  return t;
}
async function tocar(t: renderer.ReactTestRenderer, id: string) {
  const [el] = porId(t, id);
  if (!el) throw new Error("sem " + id);
  await act(async () => { el.props.onPress(); await flush(); });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLargura = 1024;
  mockPrevia.mockResolvedValue(previa());
});

it("abre: revalida /auth/me, busca a prévia na loja da venda e marca o faltante em amarelo", async () => {
  const t = await montar();
  expect(mockRefreshMe).toHaveBeenCalled();
  expect(mockPrevia).toHaveBeenCalledWith("loja-b", "venda-1");
  expect(porId(t, "nfe55-passo-cliente")).toHaveLength(1);
  expect(porId(t, "nfe55-passos")).toHaveLength(1);
  expect(porId(t, "nfe55-faixa-faltam")).toHaveLength(1);
  expect(porId(t, "nfe55-cep-falta")).toHaveLength(1);
  expect(tudo(t)).toContain("Falta: CEP do endereço do cliente");
  // sem bloqueio: Continuar ativo
  expect(porId(t, "nfe55-continuar")[0].props.disabled).toBe(false);
});

it("Continuar revalida com o corpo (POST) e mostra os itens com CFOP; Revisar avisa homologação; Emitir → Pronto", async () => {
  const t = await montar();
  mockPrevia.mockResolvedValue(previa({ faltantes: [] }));
  await tocar(t, "nfe55-continuar");
  expect(mockPrevia).toHaveBeenLastCalledWith("loja-b", "venda-1", expect.objectContaining({ destinatario: expect.objectContaining({ documento: "11444777000161" }) }));
  expect(porId(t, "nfe55-passo-itens")).toHaveLength(1);
  expect(texto(porId(t, "nfe55-cfops")[0].props.children)).toBe("5102 / 5405");
  await tocar(t, "nfe55-continuar");
  expect(porId(t, "nfe55-passo-revisar")).toHaveLength(1);
  expect(porId(t, "nfe55-homologacao")).toHaveLength(1);
  mockEmitir.mockResolvedValue(AUTORIZADA);
  await tocar(t, "nfe55-emitir");
  expect(mockEmitir).toHaveBeenCalledWith("loja-b", "venda-1", expect.any(Object));
  expect(porId(t, "nfe55-pronto")).toHaveLength(1);
  expect(porId(t, "nfe55-danfe")).toHaveLength(1);
  expect(porId(t, "nfe55-xml")).toHaveLength(1);
  expect(porId(t, "nfe55-enviar-email")).toHaveLength(1);
  expect(tudo(t)).toContain("NF-e nº 15 autorizada");
  expect(tudo(t)).toContain("3526 1111 2223 3300 0181 5500 2000 0000 1511 2345 6786");
});

it("422 de faltantes na emissão volta ao passo do cliente com o campo em amarelo", async () => {
  mockPrevia.mockResolvedValue(previa({ faltantes: [] }));
  const t = await montar();
  await tocar(t, "nfe55-continuar");
  await tocar(t, "nfe55-continuar");
  mockEmitir.mockRejectedValue({ status: 422, data: { code: "NFE_DADOS_FALTANTES", error: "Faltam alguns dados", faltantes: [{ campo: "destinatario.ie", mensagem: "A IE do cliente não confere.", tipo: "invalido" }] } });
  await tocar(t, "nfe55-emitir");
  expect(porId(t, "nfe55-passo-cliente")).toHaveLength(1);
  expect(porId(t, "nfe55-ie-falta")).toHaveLength(1);
  expect(tudo(t)).toContain("A IE do cliente não confere.");
});

it("recusa da Sefaz: texto do catálogo, ação e 'Tentar de novo' no lugar de Emitir", async () => {
  mockPrevia.mockResolvedValue(previa({ faltantes: [] }));
  const t = await montar();
  await tocar(t, "nfe55-continuar");
  await tocar(t, "nfe55-continuar");
  mockEmitir.mockRejectedValue({ status: 422, data: { code: "NFE_REJEITADA", cStat: "233", motivo: "IE nao cadastrada",
    rejeicao_amigavel: { cStat: "233", titulo: "A inscrição estadual (IE) do cliente não está cadastrada na SEFAZ", acao: "Confira a IE com o cliente.", quem: "lojista", conhecida: true } } });
  await tocar(t, "nfe55-emitir");
  expect(porId(t, "nfe55-rejeicao")).toHaveLength(1);
  const s = tudo(t);
  expect(s).toContain("A Sefaz não aceitou a nota, e dá para resolver");
  expect(s).toContain("O que fazer: Confira a IE com o cliente.");
  expect(s).toContain("Tentar de novo");
});

it("venda que já tem NFC-e: avisa e não deixa emitir", async () => {
  mockPrevia.mockResolvedValue(previa({ faltantes: [], nota_existente: { id: "n1", tipo: "nfce", numero: 900, serie: 2, status: "autorizada", chave_acesso: null } }));
  const t = await montar();
  expect(porId(t, "nfe55-ja-tem-nota")).toHaveLength(1);
  await tocar(t, "nfe55-continuar");
  await tocar(t, "nfe55-continuar");
  expect(porId(t, "nfe55-emitir")[0].props.disabled).toBe(true);
});

it("bloqueio do v1 (regime normal) aparece com título humano", async () => {
  mockPrevia.mockResolvedValue({ pode_emitir: false, bloqueio: { code: "NFE_REGIME_NORMAL_FORA_DO_V1", error: "Ainda não emitimos NF-e para o regime normal." }, faltantes: [], nota_existente: null, nota_pendente: null });
  const t = await montar();
  expect(porId(t, "nfe55-bloqueio-previa")).toHaveLength(1);
  expect(tudo(t)).toContain("Ainda não emitimos NF-e para o regime normal");
});

it("celular (375 px): barra vira 'Passo 1 de 4'", async () => {
  mockLargura = 375;
  const t = await montar();
  expect(porId(t, "nfe55-passos")).toHaveLength(0);
  expect(porId(t, "nfe55-passos-celular")).toHaveLength(1);
  expect(tudo(t)).toContain("Passo 1 de 4 · Cliente");
});
