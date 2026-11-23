// ============================================================
// Configurações do crediário › Mensagens de cobrança (21/11/2026).
//
// 1. loja sem modelo: os 4 prontos com "Salvar uma cópia" e o aviso
//    "Você ainda não salvou nenhum modelo";
// 2. "Salvar uma cópia" abre o editor com o texto do pronto; os botões de
//    variável inserem; salvar manda replaces_aura;
// 3. loja com modelos: contagem "N de 10", Editar e "⋯" sempre à mostra;
//    "⋯ › Usar como padrão" chama a rota do padrão;
// 4. os 5 textos da régua saíram da tela, e salvar as configurações manda
//    o `template` gravado de volta, sem apagar nada.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock("@/components/Toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/ResponsiveSheet", () => ({
  ResponsiveSheet: ({ visible, children }: any) => (visible ? children : null),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      var state = { company: { id: "loja-1", name: "Loja Exemplo" }, token: "t" };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t" }) }
  ),
}));

var mockLista: any = null;
var mockCreate = jest.fn((_id: string, body: any) => Promise.resolve({
  ...mockLista, source: "loja",
  template: { id: "n1", name: body.name, body: body.body, situation: body.situation ?? null, is_default: !!body.situation, origin: "loja" },
}));
var mockDefault = jest.fn((_id: string, _tid: string, _s: any) => Promise.resolve({ ...mockLista, template: mockLista.templates[0] }));
var mockUpdateRules = jest.fn((_id: string, body: any) => Promise.resolve(body));
var mockRules: any = {
  enabled: true, pix_key: "", whatsapp_auto: false,
  rules: [{ id: "lembrete", name: "Lembrete", days_relative: -3, template: "texto que a loja escreveu", channel: "whatsapp", enabled: true }],
};
jest.mock("@/services/creditApi", () => ({
  creditApi: {
    getPlanConfig: () => Promise.resolve({ max_installments: 12, min_installment_value: 20 }),
    getCollectionRules: () => Promise.resolve(mockRules),
    updatePlanConfig: jest.fn(() => Promise.resolve({})),
    updateCollectionRules: (id: string, body: any) => mockUpdateRules(id, body),
    listMessageTemplates: () => Promise.resolve(mockLista),
    createMessageTemplate: (id: string, body: any) => mockCreate(id, body),
    updateMessageTemplate: jest.fn(),
    setDefaultMessageTemplate: (id: string, tid: string, s: any) => mockDefault(id, tid, s),
    deleteMessageTemplate: jest.fn(),
  },
}));
jest.mock("@/services/waApi", () => {
  const actual = jest.requireActual("@/services/waApi");
  return { ...actual, waApi: { getStatus: () => Promise.resolve(null), getPreview: jest.fn() } };
});

import CrediarioSettingsScreen from "@/app/(tabs)/crediario/settings";
import { MODELOS_DA_AURA } from "@/utils/crediarioMensagem";

async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  });
}
const porId = (tree: any, id: string) => tree.root.findAllByProps({ testID: id })[0];
const tem = (tree: any, id: string) => tree.root.findAllByProps({ testID: id }).length > 0;
const json = (tree: any) => JSON.stringify(tree.toJSON());

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderer.create(
    <QueryClientProvider client={qc}>
      <CrediarioSettingsScreen />
    </QueryClientProvider>
  );
}

describe("Mensagens de cobrança nas Configurações do crediário", () => {
  beforeEach(() => {
    mockCreate.mockClear(); mockDefault.mockClear(); mockUpdateRules.mockClear();
  });

  it("loja sem modelo: prontos da Aura com Salvar uma cópia", async () => {
    mockLista = { source: "aura", templates: MODELOS_DA_AURA, limit: 10, max_body: 1000 };
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(tem(tree, "mensagens-de-cobranca")).toBe(true);
    expect(tem(tree, "mensagens-vazio")).toBe(true);
    expect(json(tree)).toContain("Você ainda não salvou nenhum modelo");
    expect(tem(tree, "mensagens-copiar-aura:lembrete")).toBe(true);
    expect(tem(tree, "mensagens-editar-aura:lembrete")).toBe(false);
    expect(json(tree)).toContain("+ Escrever um modelo do zero");
    tree.unmount();
  });

  it("Salvar uma cópia: editor com o texto do pronto, variável no cursor, replaces_aura", async () => {
    mockLista = { source: "aura", templates: MODELOS_DA_AURA, limit: 10, max_body: 1000 };
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    await act(async () => { porId(tree, "mensagens-copiar-aura:lembrete").props.onPress(); });
    expect(tem(tree, "mensagens-editor")).toBe(true);
    const campo = porId(tree, "mensagens-editor-texto");
    expect(campo.props.value).toBe(MODELOS_DA_AURA[0].body);
    await act(async () => { campo.props.onChangeText("Oi, !"); });
    await act(async () => { porId(tree, "mensagens-editor-texto").props.onSelectionChange({ nativeEvent: { selection: { start: 4, end: 4 } } }); });
    await act(async () => { porId(tree, "mensagens-var-nome").props.onPress(); });
    expect(porId(tree, "mensagens-editor-texto").props.value).toBe("Oi, {nome}!");
    await act(async () => { await porId(tree, "mensagens-editor-salvar").props.onPress(); });
    await flush();
    expect(mockCreate).toHaveBeenCalledWith("loja-1", {
      name: "Lembrete", body: "Oi, {nome}!", situation: "a_vencer", replaces_aura: "lembrete",
    });
    tree.unmount();
  });

  it("loja com modelos: contagem, ações sempre à mostra e Usar como padrão", async () => {
    mockLista = {
      source: "loja", limit: 10, max_body: 1000,
      templates: [
        { id: "t1", name: "Lembrete", body: "Oi {nome}", situation: "a_vencer", is_default: true, origin: "loja" },
        { id: "t2", name: "Novidade", body: "Oi {nome}!", situation: null, is_default: false, origin: "loja" },
      ],
    };
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(json(tree)).toContain("2 de 10 modelos");
    expect(json(tree)).toContain("padrão · a vencer");
    expect(tem(tree, "mensagens-editar-t2")).toBe(true);
    expect(tem(tree, "mensagens-mais-t2")).toBe(true);
    await act(async () => { porId(tree, "mensagens-mais-t2").props.onPress(); });
    expect(tem(tree, "mensagens-menu-t2")).toBe(true);
    await act(async () => { await porId(tree, "mensagens-padrao-em_atraso").props.onPress(); });
    await flush();
    expect(mockDefault).toHaveBeenCalledWith("loja-1", "t2", "em_atraso");
    tree.unmount();
  });

  it("os textos da régua saíram da tela e o template gravado volta igual no PUT", async () => {
    mockLista = { source: "aura", templates: MODELOS_DA_AURA, limit: 10, max_body: 1000 };
    let tree: any;
    await act(async () => { tree = montar(); });
    await flush();
    expect(tree.root.findAllByProps({ placeholder: "Mensagem desta etapa" })).toHaveLength(0);
    expect(json(tree)).not.toContain("texto que a loja escreveu");
    // Mexe num campo qualquer para liberar o Salvar.
    const inputs = tree.root.findAll((n: any) => n.props && n.props.keyboardType === "numbers-and-punctuation");
    await act(async () => { inputs[0].props.onChangeText("-5"); });
    await act(async () => { porId(tree, "crediario-config-salvar").props.onPress(); });
    await flush();
    expect(mockUpdateRules).toHaveBeenCalledTimes(1);
    const enviado = mockUpdateRules.mock.calls[0][1];
    expect(enviado.rules[0]).toMatchObject({ id: "lembrete", days_relative: -5, template: "texto que a loja escreveu" });
    tree.unmount();
  });
});
