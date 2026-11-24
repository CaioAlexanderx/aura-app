// ============================================================
// p-210 e p-211 (23/11/2026): cadastro do cliente por link.
//
// O que este arquivo trava:
//   Regras puras (utils/cadastroPorLink.ts)
//     1. Sem o aviso de privacidade do Caio, nada envia (podeEnviar false).
//     2. A mensagem do WhatsApp leva só o nome da loja e o link.
//     3. Validação igual à do servidor; corpo do envio sem campo vazio.
//   Página pública (app/cadastro/[token].tsx)
//     4. Link aberto: nome da loja e formulário VAZIO; botão desligado.
//     5. Sem o aviso: o aceite não aparece e o botão nunca liga.
//     6. Com aviso, aceite e dados válidos: envia e mostra "recebido".
//     7. Link usado ou vencido: mensagem clara, sem formulário.
//   Lado do lojista (PedirCadastroPorWhatsApp)
//     8. Sem a ótica ou sem o aviso: não desenha nada (nem consulta).
//     9. Toque: abre a aba no mesmo tick, gera o link e aponta para o wa.me
//        com a mensagem sem dado pessoal.
//    10. Diferenças: Aceitar/Manter chamam o resolve do campo.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

jest.mock("expo-font", () => ({ useFonts: () => [true, null], loadAsync: jest.fn(), isLoaded: () => true }));
jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), info: jest.fn(), warning: jest.fn(), error: jest.fn() } }));
let mockToken = "t".repeat(43);
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ token: mockToken }), router: { back: jest.fn(), push: jest.fn() } }));
jest.mock("@/stores/auth", () => ({ useAuthStore: () => ({ company: { id: "loja-1", trade_name: "Ótica Exemplo" } }) }));
let mockOtica = true;
jest.mock("@/hooks/usePdvSettings", () => ({ usePdvSettings: () => ({ settings: { otica_enabled: mockOtica } }) }));
jest.mock("@/components/endereco/endereco", () => ({ buscarCep: jest.fn(() => Promise.resolve(null)) }));

let mockEstado: any = null;
const mockInvalidate = jest.fn();
const mockUseQuery = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
  useQuery: (cfg: any) => { mockUseQuery(cfg); return { data: cfg.enabled ? mockEstado : undefined }; },
}));

const mockApi = {
  lojaDoLink: jest.fn(),
  enviar: jest.fn(),
  criar: jest.fn(),
  estado: jest.fn(),
  resolver: jest.fn(),
};
jest.mock("@/services/cadastroLinkApi", () => ({ get cadastroLinkApi() { return mockApi; } }));

import CadastroPorLinkPage from "@/app/cadastro/[token]";
import { PedirCadastroPorWhatsApp } from "@/components/cadastroPorLink/PedirCadastroPorWhatsApp";
import {
  AVISO_DE_PRIVACIDADE, FORMULARIO_VAZIO, avisoPronto, corpoDoEnvio, errosDoFormulario, mensagemDoLink,
  podeEnviar, urlDoLink, dataDeNascimentoValida,
} from "@/utils/cadastroPorLink";

const AVISO_TESTE = "Li e aceito o aviso de privacidade (texto de teste).";
const VALIDO = { ...FORMULARIO_VAZIO, name: "Maria Souza", birth_date: "15/06/1990", cpf: "529.982.247-25" };

const porId = (tree: renderer.ReactTestRenderer, id: string) =>
  tree.root.findAll((n) => n.props && n.props.testID === id, { deep: false });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  jest.clearAllMocks();
  mockOtica = true;
  mockEstado = null;
});

describe("regras puras", () => {
  it("o aviso do Caio ainda não está no app: nada envia", () => {
    expect(AVISO_DE_PRIVACIDADE).toBeNull();
    expect(avisoPronto()).toBe(false);
    expect(podeEnviar(VALIDO, true)).toBe(false);
    expect(podeEnviar(VALIDO, true, AVISO_TESTE)).toBe(true);
    expect(podeEnviar(VALIDO, false, AVISO_TESTE)).toBe(false);
  });

  it("mensagem só com a loja e o link", () => {
    const m = mensagemDoLink("Ótica Exemplo", "https://app.getaura.com.br/cadastro/abc");
    expect(m).toBe("Oi! Aqui é da Ótica Exemplo. Para agilizar a sua compra, preencha o seu cadastro neste link, leva 1 minuto: https://app.getaura.com.br/cadastro/abc\n\nO link é só seu e vale por 7 dias.");
    expect(urlDoLink("/cadastro/abc", "https://staging.example.com/")).toBe("https://staging.example.com/cadastro/abc");
  });

  it("validação e corpo do envio", () => {
    expect(errosDoFormulario(VALIDO)).toEqual({});
    expect(errosDoFormulario({ ...VALIDO, name: "Maria" }).name).toBeTruthy();
    expect(errosDoFormulario({ ...VALIDO, cpf: "111.111.111-11" }).cpf).toBeTruthy();
    expect(dataDeNascimentoValida("31/02/1990")).toBe(false);
    expect(dataDeNascimentoValida("15/06")).toBe(false);
    expect(corpoDoEnvio({ ...VALIDO, zip_code: "01310-100", state: "sp" }, "v9")).toEqual({
      name: "Maria Souza", birth_date: "15/06/1990", cpf: "52998224725", zip_code: "01310100", state: "SP",
      consent: { accepted: true, version: "v9" },
    });
  });
});

async function montarPagina(aviso: string | null) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<CadastroPorLinkPage aviso={aviso} versao="v-teste" />); });
  await flush();
  return tree;
}
async function preencher(tree: renderer.ReactTestRenderer) {
  await act(async () => { porId(tree, "cadastro-nome")[0].props.onChangeText("Maria Souza"); });
  await act(async () => { porId(tree, "cadastro-nascimento")[0].props.onChangeText("15061990"); });
  await act(async () => { porId(tree, "cadastro-cpf")[0].props.onChangeText("52998224725"); });
}

describe("página pública", () => {
  it("link aberto: loja e formulário vazio, botão desligado", async () => {
    mockApi.lojaDoLink.mockResolvedValue({ store: { name: "Ótica Exemplo", logo_url: null }, expires_at: "2026-12-01" });
    const tree = await montarPagina(AVISO_TESTE);
    expect(porId(tree, "cadastro-formulario")).toHaveLength(1);
    expect(porId(tree, "cadastro-nome")[0].props.value).toBe("");
    expect(porId(tree, "cadastro-cpf")[0].props.value).toBe("");
    expect(porId(tree, "cadastro-enviar")[0].props.disabled).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain("Ótica Exemplo");
  });

  it("sem o aviso: não há aceite e o botão não liga nem com tudo certo", async () => {
    mockApi.lojaDoLink.mockResolvedValue({ store: { name: "Ótica Exemplo", logo_url: null }, expires_at: "2026-12-01" });
    const tree = await montarPagina(null);
    await preencher(tree);
    expect(porId(tree, "cadastro-aceite")).toHaveLength(0);
    expect(porId(tree, "cadastro-sem-aviso")).toHaveLength(1);
    expect(porId(tree, "cadastro-enviar")[0].props.disabled).toBe(true);
    await act(async () => { porId(tree, "cadastro-enviar")[0].props.onPress(); });
    expect(mockApi.enviar).not.toHaveBeenCalled();
  });

  it("com aviso e aceite: envia o corpo com a versão e mostra recebido", async () => {
    mockApi.lojaDoLink.mockResolvedValue({ store: { name: "Ótica Exemplo", logo_url: null }, expires_at: "2026-12-01" });
    mockApi.enviar.mockResolvedValue({ ok: true, store: { name: "Ótica Exemplo" } });
    const tree = await montarPagina(AVISO_TESTE);
    await preencher(tree);
    expect(porId(tree, "cadastro-enviar")[0].props.disabled).toBe(true);
    await act(async () => { porId(tree, "cadastro-aceite")[0].props.onPress(); });
    expect(porId(tree, "cadastro-enviar")[0].props.disabled).toBe(false);
    await act(async () => { porId(tree, "cadastro-enviar")[0].props.onPress(); });
    await flush();
    expect(mockApi.enviar).toHaveBeenCalledWith(mockToken, {
      name: "Maria Souza", birth_date: "15/06/1990", cpf: "52998224725", consent: { accepted: true, version: "v-teste" },
    });
    expect(porId(tree, "cadastro-recebido")).toHaveLength(1);
    expect(porId(tree, "cadastro-formulario")).toHaveLength(0);
  });

  it("link usado ou vencido: mensagem clara, sem formulário", async () => {
    mockApi.lojaDoLink.mockRejectedValue({ status: 410, data: { code: "LINK_INDISPONIVEL", store: { name: "Ótica Exemplo", logo_url: null } } });
    const tree = await montarPagina(AVISO_TESTE);
    expect(porId(tree, "cadastro-indisponivel")).toHaveLength(1);
    expect(porId(tree, "cadastro-formulario")).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain("Este link já foi usado ou venceu.");
  });
});

describe("botão do lojista", () => {
  const estadoBase = { available: true, link: null, pending: [], pending_link_id: null };

  async function montarBotao(props: any = {}) {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<PedirCadastroPorWhatsApp customerId="cli-1" phone="11999990000" aviso={AVISO_TESTE} testID="t" {...props} />);
    });
    return tree;
  }

  it("ótica desligada ou sem aviso: nada na tela e nenhuma consulta", async () => {
    mockEstado = estadoBase;
    mockOtica = false;
    let tree = await montarBotao();
    expect(tree.toJSON()).toBeNull();
    expect(mockUseQuery.mock.calls.every((c) => c[0].enabled === false)).toBe(true);
    mockOtica = true;
    tree = await montarBotao({ aviso: null });
    expect(tree.toJSON()).toBeNull();
  });

  it("servidor sem a rota (available false): nada na tela", async () => {
    mockEstado = { ...estadoBase, available: false };
    const tree = await montarBotao();
    expect(tree.toJSON()).toBeNull();
  });

  it("toque abre a aba no mesmo tick e aponta para o wa.me sem dado pessoal", async () => {
    mockEstado = estadoBase;
    const janela: any = { location: { href: "" }, close: jest.fn(), opener: {} };
    const open = jest.spyOn(window, "open").mockImplementation(() => janela);
    let resolver!: (v: any) => void;
    mockApi.criar.mockReturnValue(new Promise((r) => { resolver = r; }));
    const tree = await montarBotao();
    act(() => { porId(tree, "t-pedir")[0].props.onPress(); });
    expect(open).toHaveBeenCalledTimes(1); // antes da resposta do servidor
    expect(mockApi.criar).toHaveBeenCalledWith("loja-1", { customer_id: "cli-1" });
    await act(async () => { resolver({ path: "/cadastro/abc", token: "abc", link: {}, customer: { id: "cli-1" }, customer_created: false }); });
    await flush();
    const url = decodeURIComponent(janela.location.href);
    expect(janela.location.href.startsWith("https://wa.me/5511999990000?text=")).toBe(true);
    expect(url).toContain("Ótica Exemplo");
    expect(url).toContain("/cadastro/abc");
    expect(janela.opener).toBeNull();
    open.mockRestore();
  });

  it("falha ao gerar fecha a aba em branco", async () => {
    mockEstado = estadoBase;
    const janela: any = { location: { href: "" }, close: jest.fn(), opener: {} };
    const open = jest.spyOn(window, "open").mockImplementation(() => janela);
    mockApi.criar.mockRejectedValue({ status: 403, data: { error: "Modulo Otica nao esta habilitado." } });
    const tree = await montarBotao();
    await act(async () => { porId(tree, "t-pedir")[0].props.onPress(); });
    await flush();
    expect(janela.close).toHaveBeenCalled();
    open.mockRestore();
  });

  it("estado e diferenças: Aceitar e Manter chamam o resolve do campo", async () => {
    mockEstado = {
      available: true,
      link: { id: "l1", status: "recebido", used_at: "2026-11-24T15:00:00Z", created_at: "", expires_at: "", filled_fields: [] },
      pending: [
        { field: "cpf_cnpj", label: "CPF", current: "11144477735", received: "52998224725" },
        { field: "name", label: "Nome", current: "Maria", received: "Maria Souza" },
      ],
      pending_link_id: "l1",
    };
    mockApi.resolver.mockResolvedValue({ pending: [] });
    const tree = await montarBotao();
    expect(JSON.stringify(tree.toJSON())).toContain("Cadastro recebido em 24/11");
    expect(JSON.stringify(tree.toJSON())).toContain("529.982.247-25");
    await act(async () => { porId(tree, "t-aceitar-cpf_cnpj")[0].props.onPress(); });
    expect(mockApi.resolver).toHaveBeenCalledWith("loja-1", "l1", { accept: ["cpf_cnpj"], keep: [] });
    await act(async () => { porId(tree, "t-manter-name")[0].props.onPress(); });
    expect(mockApi.resolver).toHaveBeenLastCalledWith("loja-1", "l1", { accept: [], keep: ["name"] });
  });
});
