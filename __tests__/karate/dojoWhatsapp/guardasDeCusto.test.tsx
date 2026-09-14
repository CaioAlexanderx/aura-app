// ============================================================
// Guardas de custo do WhatsApp automático (Fase 3c).
//
// Cada mensagem de WhatsApp é cobrada pela Meta na conta do dojô. Estes
// testes seguram o que NÃO pode voltar a acontecer:
//
// 1. o toggle "Enviar também por WhatsApp" ficar clicável sem addon,
//    sem número conectado ou sem template aprovado — inclusive quando o
//    backend é antigo e simplesmente NÃO devolve os campos (ausente tem
//    que bloquear igual a false, senão o dojô descobre o adicional pela
//    fatura);
// 2. ligar o automático sem ver antes quantos alunos receberiam;
// 3. desligar ficar bloqueado junto — quem está gastando precisa poder
//    parar de gastar mesmo com o /status fora do ar;
// 4. um skip_reason novo chegar cru na tela ("LIMITE_DIARIO").
//
// react-test-renderer direto (não RTL), mesma razão registrada em
// ordemDeServico.test.tsx: o moduleNameMapper aponta react-native →
// react-native-web e tudo vira div; a identidade vem do testID.
// ============================================================
import React from "react";
import renderer, { act } from "react-test-renderer";

// O <Modal> do react-native-web monta por portal do ReactDOM, e o
// react-test-renderer não tem onde pendurar um portal
// ("parentInstance.children.indexOf is not a function"). Aqui ele vira
// um passa-adiante: visible=false não renderiza, visible=true renderiza
// o conteúdo na própria árvore — que é tudo o que estes testes olham.
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return { ...RN, Modal: ({ visible, children }: any) => (visible ? children : null) };
});

jest.mock("@/components/Icon", () => ({ Icon: "Icon" }));
jest.mock("@/contexts/KarateFederation", () => ({
  useKarateFederation: () => ({ federationId: "fed-1" }),
}));
jest.mock("@/stores/auth", () => ({
  useAuthStore: Object.assign(
    function (selector: any) {
      var state = { company: { id: "dojo-1" }, token: "t" };
      return typeof selector === "function" ? selector(state) : state;
    },
    { getState: () => ({ token: "t" }) }
  ),
}));

// Blocos vizinhos da régua não interessam aqui — e todos buscam rede.
jest.mock("@/components/karate/dojoMensalidades/regua/OffsetsEditor", () => ({ OffsetsEditor: () => null }));
jest.mock("@/components/karate/dojoMensalidades/regua/ReminderLogList", () => ({ ReminderLogList: () => null }));
jest.mock("@/components/karate/dojoMensalidades/regua/WhatsAppQueueSection", () => ({ WhatsAppQueueSection: () => null }));
jest.mock("@/components/karate/dojoMensalidades/CompetenceSelector", () => ({ CompetenceSelector: () => null }));

var mockConfig: any = {
  enabled: true, offsets: [-3, 0], send_email: true, send_whatsapp_auto: false, updated_at: null,
};
var mockUpdate = jest.fn((_f: string, payload: any) => Promise.resolve({ ...mockConfig, ...payload }));
jest.mock("@/services/karateDojoBillingApi", () => ({
  karateDojoBillingApi: {
    getReminderConfig: () => Promise.resolve(mockConfig),
    updateReminderConfig: (f: string, p: any) => mockUpdate(f, p),
    getReminderLog: () => Promise.resolve({ data: [] }),
    runReminders: () => Promise.resolve({}),
  },
}));

var mockStatus: any = null;
var mockPreview: any = { date: "2026-09-13", template_name: "mensalidade_lembrete", would_send: 7, skipped: {}, items: [] };
var mockGetPreview = jest.fn(() => Promise.resolve(mockPreview));
jest.mock("@/services/waApi", () => ({
  waApi: {
    getStatus: () => Promise.resolve(mockStatus),
    getPreview: () => mockGetPreview(),
  },
}));

import { ReguaSection } from "@/components/karate/dojoMensalidades/regua/ReguaSection";
import {
  mapWaError, waAutoBlockers, waPreviewSkippedSummary, waPreviewSkippedTotal,
  waSkipReasonLabel, waTestsSentToday,
} from "@/components/karate/dojoWhatsapp/helpers";

const STATUS_LIBERADO = {
  connected: true,
  phone_display: "5511912345678",
  waba_id: "w1",
  queue: {},
  schema_pending: false,
  addon_active: true,
  template_ready: true,
  template_name: "mensalidade_lembrete",
  template_status: "APPROVED",
  paused_reason: null,
  usage: { today_sent: 2, month_sent: 40, daily_cap: 300 },
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function temTestId(tree: any, id: string): boolean {
  return tree.root.findAllByProps({ testID: id }).length > 0;
}

describe("waAutoBlockers — quem pode ligar o envio automático", () => {
  it("libera só com addon, conexão e template aprovados", () => {
    expect(waAutoBlockers(STATUS_LIBERADO as any)).toEqual([]);
  });

  it("bloqueia sem a liberação do plano", () => {
    const b = waAutoBlockers({ ...STATUS_LIBERADO, addon_active: false } as any);
    expect(b.map((x) => x.code)).toEqual(["ADDON"]);
    // Fase 8b: o WhatsApp oficial vem no Aura Dojô. O aviso deixou de
    // pedir uma compra e passou a pedir a liberação.
    expect(b[0].label).toMatch(/incluso no Aura Dojô/i);
  });

  it("campo ausente conta como bloqueio, nunca como liberação", () => {
    // Backend anterior à Fase 1 não devolve addon_active nem template_ready.
    const antigo = { connected: true, phone_display: null, waba_id: null, queue: {}, schema_pending: false };
    const codes = waAutoBlockers(antigo as any).map((x) => x.code);
    expect(codes).toContain("ADDON");
    expect(codes).toContain("TEMPLATE");
  });

  it("bloqueia sem número conectado e, com token vencido, manda reconectar", () => {
    expect(waAutoBlockers({ ...STATUS_LIBERADO, connected: false } as any).map((x) => x.code))
      .toContain("CONEXAO");
    const expirado = waAutoBlockers({ ...STATUS_LIBERADO, connected: false, token_expired: true } as any);
    expect(expirado.map((x) => x.code)).toContain("TOKEN");
    expect(expirado.map((x) => x.code)).not.toContain("CONEXAO");
  });

  it("bloqueia com template não aprovado e com a fila pausada", () => {
    expect(waAutoBlockers({ ...STATUS_LIBERADO, template_ready: false } as any).map((x) => x.code))
      .toEqual(["TEMPLATE"]);
    const pausado = waAutoBlockers({ ...STATUS_LIBERADO, paused_reason: "QUALIDADE_BAIXA" } as any);
    expect(pausado.map((x) => x.code)).toEqual(["PAUSADO"]);
    expect(pausado[0].label).toMatch(/qualidade do número/);
  });

  it("status ausente (falha ao carregar) bloqueia — o lado certo do erro", () => {
    expect(waAutoBlockers(null).map((x) => x.code)).toEqual(["SEM_STATUS"]);
  });
});

describe("mapWaError — nenhum código cru na tela", () => {
  it("traduz ADDON_REQUIRED", () => {
    const m = mapWaError({ status: 403, data: { code: "ADDON_REQUIRED" } });
    expect(m.code).toBe("ADDON_REQUIRED");
    // Fase 8b: não é mais adicional — é o plano Negócio / Aura Dojô.
    expect(m.message).toMatch(/plano Negócio e do Aura Dojô/i);
    expect(m.message).not.toMatch(/ADDON_REQUIRED/);
  });

  it("traduz TEMPLATE_NAO_APROVADO e prefere a frase do backend quando vem", () => {
    expect(mapWaError({ status: 409, data: { code: "TEMPLATE_NAO_APROVADO" } }).message)
      .toMatch(/aprovado pela Meta/i);
    expect(mapWaError({ status: 409, data: { code: "TEMPLATE_NAO_APROVADO", error: "Texto do backend." } }).message)
      .toBe("Texto do backend.");
  });

  it("mantém NAO_CONECTADO e TOKEN_EXPIRADO em pt-BR", () => {
    expect(mapWaError({ data: { code: "NAO_CONECTADO" } }).message).toMatch(/não está conectado/i);
    expect(mapWaError({ data: { code: "TOKEN_EXPIRADO" } }).message).toMatch(/expirou/i);
  });
});

describe("skip_reason das guardas → pt-BR", () => {
  it("traduz os motivos novos da fila", () => {
    expect(waSkipReasonLabel("LIMITE_DIARIO")).toMatch(/Limite diário/);
    expect(waSkipReasonLabel("ADDON_INATIVO")).toMatch(/não está liberado nesta conta/i);
    expect(waSkipReasonLabel("TEMPLATE_NAO_APROVADO")).toMatch(/aprovado pela Meta/i);
    expect(waSkipReasonLabel("TELEFONE_INVALIDO_META")).toMatch(/não recebe mensagens/i);
    expect(waSkipReasonLabel("LIMITE_POR_CONTATO")).toMatch(/máximo de mensagens do dia/i);
  });

  it("código desconhecido vira texto legível, nunca o código", () => {
    expect(waSkipReasonLabel("MOTIVO_NOVO_DA_META")).toBe("Motivo novo da meta");
  });

  it("resume os pulados da prévia sem mostrar chave crua", () => {
    const skipped = { OPT_OUT: 3, JA_ENVIADO: 2, SEM_TELEFONE: 0 };
    expect(waPreviewSkippedTotal(skipped)).toBe(5);
    const txt = waPreviewSkippedSummary(skipped) || "";
    expect(txt).toContain("opt-out 3");
    expect(txt).toContain("já enviados 2");
    expect(txt).not.toContain("SEM_TELEFONE");
  });
});

describe("waTestsSentToday — cota de teste contada na fila", () => {
  it("conta só os testes de hoje", () => {
    const hoje = new Date().toISOString();
    const ontem = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const n = waTestsSentToday([
      { source_type: "teste", created_at: hoje },
      { source_type: "teste", created_at: hoje },
      { source_type: "teste", created_at: ontem },
      { source_type: "regua", created_at: hoje },
    ]);
    expect(n).toBe(2);
  });

  it("lista vazia ou ausente não quebra", () => {
    expect(waTestsSentToday(null)).toBe(0);
    expect(waTestsSentToday(undefined)).toBe(0);
  });
});

describe("ReguaSection — o toggle do WhatsApp na tela", () => {
  beforeEach(() => {
    mockConfig = { enabled: true, offsets: [-3, 0], send_email: true, send_whatsapp_auto: false, updated_at: null };
    mockPreview = { date: "2026-09-13", template_name: "mensalidade_lembrete", would_send: 7, skipped: { OPT_OUT: 1 }, items: [] };
    mockUpdate.mockClear();
    mockGetPreview.mockClear();
  });

  it("sem a liberação do plano: switch travado e o motivo escrito na tela", async () => {
    mockStatus = { ...STATUS_LIBERADO, addon_active: false };
    let tree: any;
    await act(async () => { tree = renderer.create(<ReguaSection />); });
    await flush();

    expect(temTestId(tree, "regua-wa-switch-travado")).toBe(true);
    expect(temTestId(tree, "regua-wa-switch")).toBe(false);
    expect(temTestId(tree, "regua-wa-motivos")).toBe(true);
    const motivos = JSON.stringify(tree.toJSON());
    expect(motivos).toContain("incluso no Aura Dojô");
    // E nunca o texto antigo, que mandava contratar um adicional que não
    // existe mais.
    expect(motivos).not.toContain("Adicional não ativo");
    tree.unmount();
  });

  it("status fora do ar: switch travado, sem liberar por omissão", async () => {
    mockStatus = null;
    let tree: any;
    await act(async () => { tree = renderer.create(<ReguaSection />); });
    await flush();
    expect(temTestId(tree, "regua-wa-switch-travado")).toBe(true);
    tree.unmount();
  });

  it("tudo aprovado: switch liberado e LIGAR abre a prévia antes de salvar", async () => {
    mockStatus = STATUS_LIBERADO;
    let tree: any;
    await act(async () => { tree = renderer.create(<ReguaSection />); });
    await flush();

    expect(temTestId(tree, "regua-wa-switch")).toBe(true);
    expect(temTestId(tree, "wa-preview-modal")).toBe(false);

    const sw = tree.root.findAllByProps({ testID: "regua-wa-switch" })[0];
    await act(async () => { sw.props.onValueChange(true); });
    await flush();

    // Abriu a prévia e NÃO salvou nada ainda.
    expect(temTestId(tree, "wa-preview-modal")).toBe(true);
    expect(mockGetPreview).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();

    const resumo = JSON.stringify(tree.toJSON());
    expect(resumo).toContain("7");
    expect(resumo).toContain("alunos receberiam a cobrança hoje");
    tree.unmount();
  });

  it("a prévia avisa quando passa do teto diário do dojô", async () => {
    mockStatus = { ...STATUS_LIBERADO, usage: { today_sent: 0, month_sent: 0, daily_cap: 5 } };
    mockPreview = { date: "2026-09-13", template_name: "t", would_send: 40, skipped: {}, items: [] };
    let tree: any;
    await act(async () => { tree = renderer.create(<ReguaSection />); });
    await flush();
    const sw = tree.root.findAllByProps({ testID: "regua-wa-switch" })[0];
    await act(async () => { sw.props.onValueChange(true); });
    await flush();
    expect(temTestId(tree, "wa-preview-acima-do-teto")).toBe(true);
    tree.unmount();
  });

  it("DESLIGAR é livre e imediato, mesmo com as guardas reprovando", async () => {
    // Já estava ligado e o addon caiu: o sensei tem que conseguir desligar.
    mockConfig = { enabled: true, offsets: [-3], send_email: true, send_whatsapp_auto: true, updated_at: null };
    mockStatus = { ...STATUS_LIBERADO, addon_active: false, connected: false };
    let tree: any;
    await act(async () => { tree = renderer.create(<ReguaSection />); });
    await flush();

    const sw = tree.root.findAllByProps({ testID: "regua-wa-switch" })[0];
    expect(sw.props.disabled).toBe(false);
    await act(async () => { sw.props.onValueChange(false); });
    await flush();
    // Desligar não passa pela prévia.
    expect(temTestId(tree, "wa-preview-modal")).toBe(false);
    tree.unmount();
  });
});
